"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanFace,
  Search,
  CheckCircle2,
  AlertCircle,
  Camera,
  CameraOff,
  RefreshCw,
  User,
  UserPlus,
  ArrowRight,
  ImagePlus,
  Mic,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Hn212ScanButton from "@/components/admin/Hn212ScanButton";
import AiVoiceTab from "@/components/admin/AiVoiceTab";
import type { Hn212CitizenScan } from "@/lib/hn212";
import { STATUS_LABELS } from "@/lib/analytics/types";

type Tab = "face" | "voice";

type FaceResult = {
  matched: boolean;
  confidence: number;
  mode: "verify_cccd" | "search_gallery";
  reason?: string;
  cccdFoundWithoutFace?: boolean;
  gallerySize?: number;
  prefillCccd?: string;
  citizen: {
    id: string;
    fullName: string;
    cccd: string;
    dateOfBirth: string;
    address: string;
    militaryStatus: string;
    avatar?: string;
  } | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được file ảnh"));
    reader.readAsDataURL(file);
  });
}

function statusLabel(code: string): string {
  return STATUS_LABELS[code] || code || "—";
}

export default function AiFacePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("face");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "voice" || tab === "face") {
      setActiveTab(tab);
    }
  }, []);

  // Face recognition state
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<FaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanCccd, setScanCccd] = useState<string>("");
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<
    { deviceId: string; label: string }[]
  >([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const CAMERA_PREF_KEY = "ai_face_preferred_camera_id";

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        /* ignore */
      }
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (activeTab !== "face") stopCamera();
  }, [activeTab, stopCamera]);

  const attachStream = async (stream: MediaStream, deviceId?: string) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) {
          resolve();
          return;
        }
        video.onloadedmetadata = () => resolve();
      });
      await video.play();
    }
    const track = stream.getVideoTracks()[0];
    const id =
      deviceId ||
      track?.getSettings()?.deviceId ||
      selectedCameraId ||
      "";
    if (id) {
      setSelectedCameraId(id);
      try {
        localStorage.setItem(CAMERA_PREF_KEY, id);
      } catch {
        /* ignore */
      }
    }
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
    setCameraOn(true);
  };

  /**
   * Cam không dùng cho quét mặt (chỉ theo tên trong danh sách).
   * PC camera luôn được phép.
   */
  const isNonFaceCamera = (label: string) => {
    const n = label.trim().toLowerCase();
    if (/^pc\s*camera\b/.test(n) || /058f:3841/.test(n)) return false;
    if (/^in\s*camera\b/.test(n) || /058f:3855/.test(n)) return true;
    if (/av\s*to\s*usb/.test(n)) return true;
    if (/hn[- ]?212|hanel|document\s*cam|\bscanner\b/.test(n)) return true;
    return false;
  };

  /** @deprecated alias — giữ tên cũ cho ít chỗ gọi */
  const isReaderCamera = isNonFaceCamera;

  /** Webcam quét mặt — ưu tiên PC camera */
  const cameraPreferenceScore = (label: string): number => {
    const n = label.trim().toLowerCase();
    if (/^pc\s*camera\b/.test(n) || /058f:3841/.test(n)) return 0;
    if (isNonFaceCamera(n)) return 1000;
    if (/facetime|hd\s*webcam|webcam|integrated|built[- ]?in|laptop/.test(n))
      return 20;
    if (/obs\s*virtual/.test(n)) return 80;
    return 50;
  };

  const refreshCameraList = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label?.trim() || `Camera ${i + 1}`,
      }));
    setCameraDevices(cams);
    return cams;
  };

  const releaseStream = (stream: MediaStream) => {
    stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
  };

  /** Chỉ mở đúng deviceId bằng exact */
  const openDevice = async (deviceId: string) => {
    const attempts: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      },
      { audio: false, video: { deviceId: { exact: deviceId } } },
    ];
    let lastErr: unknown;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Không mở được thiết bị camera");
  };

  const errBrief = (err: unknown) => {
    if (err instanceof DOMException)
      return `${err.name}: ${err.message || "(không có mô tả)"}`;
    if (err instanceof Error) return err.message;
    return String(err);
  };

  const findPcCamera = (cams: { deviceId: string; label: string }[]) =>
    cams.find(
      (c) =>
        /^pc\s*camera\b/i.test(c.label) || /058f:3841/i.test(c.label),
    ) || null;

  /**
   * Mở PC camera trước. Không “bỏ qua” PC camera vì heuristic sai.
   */
  const requestCameraStream = async (): Promise<{
    stream: MediaStream;
    deviceId: string;
  }> => {
    const failNotes: string[] = [];
    // Xin quyền nhanh để có label thật (một số máy cần)
    try {
      const warm = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      releaseStream(warm);
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      /* ignore — vẫn enumerate được */
    }

    const cams = await refreshCameraList();
    const pc = findPcCamera(cams);
    const others = cams
      .filter(
        (c) =>
          (!pc || c.deviceId !== pc.deviceId) && !isNonFaceCamera(c.label),
      )
      .sort(
        (a, b) =>
          cameraPreferenceScore(a.label) - cameraPreferenceScore(b.label),
      );

    const tryOrder = pc ? [pc, ...others] : others;
    if (!tryOrder.length) {
      throw new Error(
        "Không thấy PC camera trong danh sách. Kiểm tra Windows Camera còn thấy PC camera không.",
      );
    }

    await new Promise((r) => setTimeout(r, 200));

    for (const cam of tryOrder) {
      try {
        const stream = await openDevice(cam.deviceId);
        return { stream, deviceId: cam.deviceId };
      } catch (e) {
        failNotes.push(`${cam.label}: ${errBrief(e)}`);
      }
    }

    throw new Error(
      `Không mở được PC camera.\n${failNotes.join("\n")}\nWindows Camera mở được thì F5 trang rồi bấm «Reset & mở PC camera».`,
    );
  };

  const cameraErrorMessage = (err: unknown): string => {
    if (err instanceof Error && err.message.trim()) return err.message;
    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        return "Chưa cấp quyền camera. Cho phép truy cập camera trong trình duyệt rồi thử lại.";
      }
      if (
        err.name === "NotReadableError" ||
        err.name === "TrackStartError" ||
        /device in use|could not start|busy|in use/i.test(err.message)
      ) {
        return "Webcam đang bị chiếm bởi app khác (Windows Camera, Zoom…). Đóng app đó rồi thử lại.";
      }
      return `${err.name}: ${err.message || "Không mở được camera"}`;
    }
    return "Không mở được camera.";
  };

  const clearCameraPref = () => {
    try {
      localStorage.removeItem(CAMERA_PREF_KEY);
    } catch {
      /* ignore */
    }
    setSelectedCameraId("");
  };

  /** Webcam trình duyệt — ưu tiên PC camera */
  const startCamera = async (forceDeviceId?: string) => {
    setError(null);
    setCameraStarting(true);
    setScanHint("Đang mở PC camera…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Trình duyệt không hỗ trợ camera. Dùng Chrome/Edge trên localhost.",
        );
      }
      stopCamera();

      if (forceDeviceId) {
        const cams = await refreshCameraList();
        const chosen = cams.find((c) => c.deviceId === forceDeviceId);
        if (chosen && isNonFaceCamera(chosen.label)) {
          throw new Error(
            "Không chọn IN camera / cam đầu đọc. Chọn PC camera (quét mặt).",
          );
        }
        const stream = await openDevice(forceDeviceId);
        await refreshCameraList();
        await attachStream(stream, forceDeviceId);
      } else {
        const { stream, deviceId } = await requestCameraStream();
        await refreshCameraList();
        await attachStream(stream, deviceId);
      }
      setScanHint("Canh mặt vào khung rồi Chụp & nhận dạng.");
    } catch (err) {
      setError(cameraErrorMessage(err));
      setCameraOn(false);
      setScanHint(
        "F5 trang rồi bấm «Reset & mở PC camera». Nếu vẫn lỗi: đóng Windows Camera / app khác đang dùng cam.",
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const switchCamera = async (deviceId: string) => {
    if (!deviceId || deviceId === selectedCameraId) return;
    await startCamera(deviceId);
  };

  const openFaceCamera = () => {
    void startCamera();
  };

  const captureFromCamera = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  // ─── Face recognition handlers ──────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      stopCamera();
      const dataUrl = await fileToDataUrl(file);
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setScanCccd("");
      setScanHint(null);
      setResult(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đọc được ảnh");
    }
  };

  const handleHn212Scanned = (data: Hn212CitizenScan) => {
    const portrait = data.portraitBase64?.trim();
    if (portrait) {
      stopCamera();
      const url = portrait.startsWith("data:")
        ? portrait
        : `data:image/jpeg;base64,${portrait}`;
      setImagePreview(url);
      setImageBase64(url);
    }
    if (data.cccd) {
      setScanCccd(data.cccd.replace(/\D/g, ""));
      setScanHint(
        portrait
          ? `Đã lấy ảnh chip + CCCD ${data.cccd}. Mở camera chụp mặt thật rồi nhận dạng, hoặc dùng ảnh chip.`
          : `Đã lấy CCCD ${data.cccd}. Mở camera chụp mặt để đối chiếu hồ sơ.`,
      );
    } else {
      setScanHint(
        portrait
          ? "Đã lấy ảnh từ chip. Có thể nhận dạng hoặc mở camera chụp mặt thật."
          : "Quét xong nhưng không đọc được CCCD/ảnh — thử lại.",
      );
    }
    setResult(null);
    setError(null);
  };

  const runMatch = async (probe: string) => {
    setIsScanning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-face/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: probe,
          cccd: scanCccd || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nhận dạng thất bại");
      setResult(data as FaceResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nhận dạng thất bại");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCaptureAndMatch = async () => {
    const shot = captureFromCamera();
    if (!shot) {
      setError("Chưa sẵn sàng camera. Đợi vài giây rồi chụp lại.");
      return;
    }
    setImagePreview(shot);
    setImageBase64(shot);
    stopCamera();
    await runMatch(shot);
  };

  const handleScan = async () => {
    if (cameraOn) {
      await handleCaptureAndMatch();
      return;
    }
    if (!imageBase64) {
      setError("Mở camera để chụp, hoặc tải ảnh / quét HN-212.");
      return;
    }
    await runMatch(imageBase64);
  };

  const handleReset = () => {
    stopCamera();
    setImagePreview(null);
    setImageBase64(null);
    setScanCccd("");
    setScanHint(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-m3-on-surface">
          Nhận diện khuôn mặt và giọng nói
        </h1>
      </div>

      {/* Tab switcher */}
      <div
        className="flex flex-wrap gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--m3-surface-container-high, #eef1f4)" }}
      >
        {(
          [
            { id: "face", label: "Khuôn mặt", icon: ScanFace },
            { id: "voice", label: "Giọng nói", icon: Mic },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-m3-surface-lowest shadow-sm text-olive-800"
                : "text-m3-on-surface-variant hover:text-m3-on-surface-variant"
            }`}
            style={
              activeTab === id
                ? {
                    color: "var(--m3-on-surface, #1b1d20)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }
                : {}
            }
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Face Tab ──────────────────────────────────────────────────── */}
      {activeTab === "face" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Panel */}
          <div className="macos-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--m3-surface-container-high, #eef1f4)" }}
                >
                  <ScanFace size={20} style={{ color: "var(--m3-primary, #1a73e8)" }} />
                </div>
                <div>
                  <h2 className="font-semibold text-m3-on-surface">
                    Quét khuôn mặt
                  </h2>
                </div>
              </div>
              <Hn212ScanButton
                compact
                label="Quét HN-212"
                onScanned={handleHn212Scanned}
                onBeforeScan={stopCamera}
              />
            </div>

            <div className="relative overflow-hidden rounded-xl border border-m3-outline-variant bg-black/[0.04] aspect-[4/3]">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 h-full w-full object-cover scale-x-[-1] ${
                  cameraOn && !imagePreview
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {imagePreview && !cameraOn ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Ảnh đã chụp"
                  className="absolute inset-0 h-full w-full object-contain bg-black/[0.03]"
                />
              ) : null}

              {!cameraOn && !imagePreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Camera size={40} className="text-m3-on-surface-variant" />
                  <p className="text-sm text-m3-on-surface-variant">
                    Bật webcam PC camera để quét khuôn mặt
                  </p>
                  <button
                    type="button"
                    onClick={openFaceCamera}
                    disabled={cameraStarting}
                    className="inline-flex items-center gap-2 rounded-xl bg-m3-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {cameraStarting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Camera size={16} />
                    )}
                    Mở camera
                  </button>
                </div>
              ) : null}

              {cameraOn && !imagePreview ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-[68%] w-[48%] rounded-[50%] border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
                </div>
              ) : null}
            </div>

            {cameraDevices.length > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-m3-on-surface-variant sm:flex-row sm:items-center sm:gap-2">
                  <span className="shrink-0">Chọn camera</span>
                  <select
                    className="min-h-[40px] w-full flex-1 rounded-[10px] border border-black/[0.08] bg-m3-surface-lowest px-3 text-[13px] font-semibold text-m3-on-surface outline-none focus:border-m3-primary/40"
                    value={
                      selectedCameraId &&
                      cameraDevices.some(
                        (c) =>
                          c.deviceId === selectedCameraId &&
                          !isReaderCamera(c.label),
                      )
                        ? selectedCameraId
                        : cameraDevices.find((c) =>
                            /^pc\s*camera\b/i.test(c.label),
                          )?.deviceId ||
                          cameraDevices.find((c) => !isReaderCamera(c.label))
                            ?.deviceId ||
                          ""
                    }
                    disabled={cameraStarting}
                    onChange={(e) => void switchCamera(e.target.value)}
                  >
                    {cameraDevices.map((cam) => (
                      <option
                        key={cam.deviceId}
                        value={cam.deviceId}
                        disabled={isReaderCamera(cam.label)}
                      >
                        {/^pc\s*camera\b|058f:3841/i.test(cam.label)
                          ? `${cam.label} ★ (quét mặt)`
                          : /^in\s*camera\b|058f:3855/i.test(cam.label)
                            ? `${cam.label} (cam phụ — không chọn)`
                            : isReaderCamera(cam.label)
                              ? `${cam.label} (dành cho HN-212 — không chọn)`
                              : cam.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="shrink-0 text-[12px] font-semibold text-m3-primary hover:underline"
                  onClick={() => {
                    clearCameraPref();
                    setError(null);
                    void startCamera();
                  }}
                >
                  Reset & mở PC camera
                </button>
              </div>
            ) : null}

            {scanCccd ? (
              <p className="text-xs font-medium text-m3-on-surface">
                CCCD từ chip: <span className="font-mono">{scanCccd}</span>
              </p>
            ) : null}
            {scanHint ? (
              <p className="text-xs text-m3-on-surface-variant">{scanHint}</p>
            ) : null}
            {error ? (
              <div className="flex items-start gap-2 rounded-xl bg-m3-error-container px-3 py-2 text-sm text-m3-error">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="whitespace-pre-wrap break-words">{error}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {cameraOn ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleCaptureAndMatch()}
                    disabled={isScanning}
                    className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-m3-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Đang nhận dạng...
                      </>
                    ) : (
                      <>
                        <ScanFace size={16} />
                        Chụp & nhận dạng
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-m3-outline-variant px-4 py-2.5 text-sm text-m3-on-surface-variant hover:bg-m3-surface-high"
                  >
                    <CameraOff size={16} />
                    Tắt
                  </button>
                </>
              ) : (
                <>
                  {!imagePreview ? (
                    <button
                      type="button"
                      onClick={openFaceCamera}
                      disabled={cameraStarting}
                      className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-m3-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {cameraStarting ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Camera size={16} />
                      )}
                      Mở camera
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleScan()}
                        disabled={!imageBase64 || isScanning}
                        className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-m3-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {isScanning ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            Đang nhận dạng...
                          </>
                        ) : (
                          <>
                            <Search size={16} />
                            Nhận dạng
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={openFaceCamera}
                        disabled={cameraStarting}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-m3-outline-variant px-4 py-2.5 text-sm text-m3-on-surface-variant hover:bg-m3-surface-high disabled:opacity-50"
                      >
                        <Camera size={16} />
                        Chụp lại
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-m3-outline-variant px-4 py-2.5 text-sm text-m3-on-surface-variant hover:bg-m3-surface-high"
                  >
                    <ImagePlus size={16} />
                    Tải ảnh
                  </button>
                  {(imagePreview || scanCccd) && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center rounded-xl border border-m3-outline-variant px-4 py-2.5 text-sm text-m3-on-surface-variant hover:bg-m3-surface-high"
                    >
                      Xóa
                    </button>
                  )}
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Result Panel */}
          <div className="macos-card p-6">
            <h2 className="font-semibold text-m3-on-surface mb-4">
              Kết quả nhận dạng
            </h2>

            {!result && !isScanning && (
              <div className="h-48 flex flex-col items-center justify-center text-m3-on-surface-variant space-y-2">
                <ScanFace size={40} className="opacity-30" />
                <p className="text-sm text-center px-4">
                  Chưa có kết quả. Mở camera, chụp mặt rồi hệ thống sẽ đối chiếu.
                </p>
              </div>
            )}

            {isScanning && (
              <div className="h-48 flex flex-col items-center justify-center space-y-3">
                <RefreshCw size={36} className="text-m3-primary animate-spin" />
                <p className="text-sm text-m3-on-surface-variant">
                  Đang đối chiếu với ảnh CCCD trong hồ sơ...
                </p>
              </div>
            )}

            {result && !isScanning && (
              <div className="space-y-4">
                <div
                  className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium"
                  style={{
                    background: result.matched
                      ? "var(--color-m3-success-container)"
                      : "var(--m3-error-container, #ffdad6)",
                    color: result.matched
                      ? "var(--color-m3-success)"
                      : "var(--m3-error, #ba1a1a)",
                  }}
                >
                  {result.matched ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  {result.matched
                    ? `Khớp khuôn mặt – Độ tin cậy: ${result.confidence}%`
                    : result.cccdFoundWithoutFace
                      ? "Đã tìm hồ sơ theo CCCD (chưa có ảnh để đối chiếu mặt)"
                      : result.citizen && !result.matched
                        ? `Không khớp mặt – ${result.confidence}%`
                        : "Không tìm thấy hồ sơ khớp"}
                </div>

                {result.reason ? (
                  <p className="text-xs text-m3-on-surface-variant">{result.reason}</p>
                ) : null}

                {result.citizen ? (
                  <>
                    <div className="flex gap-3">
                      {result.citizen.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            result.citizen.avatar.startsWith("data:")
                              ? result.citizen.avatar
                              : `data:image/jpeg;base64,${result.citizen.avatar}`
                          }
                          alt=""
                          className="h-24 w-[72px] rounded-lg object-cover border border-black/[0.08]"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1 space-y-3">
                        {[
                          { label: "Họ và tên", value: result.citizen.fullName },
                          { label: "Số CCCD", value: result.citizen.cccd },
                          {
                            label: "Ngày sinh",
                            value: result.citizen.dateOfBirth
                              ? new Date(
                                  result.citizen.dateOfBirth,
                                ).toLocaleDateString("vi-VN")
                              : "—",
                          },
                          { label: "Địa chỉ", value: result.citizen.address || "—" },
                          {
                            label: "Trạng thái NVQS",
                            value: statusLabel(result.citizen.militaryStatus),
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex justify-between items-start gap-3 py-1 border-b border-m3-outline-variant last:border-0"
                          >
                            <span className="text-sm text-m3-on-surface-variant shrink-0">
                              {item.label}
                            </span>
                            <span className="text-sm font-medium text-m3-on-surface text-right">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/admin/citizens?search=${encodeURIComponent(result.citizen!.cccd)}`,
                        )
                      }
                      className="w-full py-2 border border-m3-outline-variant text-m3-primary hover:bg-m3-surface-high rounded-xl text-sm font-medium transition-colors"
                    >
                      Xem hồ sơ đầy đủ
                    </button>
                  </>
                ) : result.prefillCccd ? (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/admin/citizens?search=${encodeURIComponent(result.prefillCccd!)}`,
                      )
                    }
                    className="w-full py-2.5 bg-m3-primary text-white rounded-xl text-sm font-medium"
                  >
                    Mở trang công dân để thêm hồ sơ
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Voice Tab ──────────────────────────────────────────────────── */}
      {activeTab === "voice" && <AiVoiceTab />}
    </div>
  );
}
