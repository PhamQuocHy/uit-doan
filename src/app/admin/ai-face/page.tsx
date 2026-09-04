"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanFace,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Camera,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  Copy,
  Check,
  NfcIcon,
  User,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

const mockResults = [
  {
    id: "1",
    fullName: "Nguyễn Văn An",
    cccd: "079300012345",
    dateOfBirth: "2002-03-14",
    address: "Phường 5, Quận 8, TP. HCM",
    militaryStatus: "Chưa khám",
    confidence: 97.4,
    matched: true,
  },
];

type Tab = "face" | "nfc";

type NfcStatus =
  | "idle"
  | "waiting"
  | "connected"
  | "scanning"
  | "processing"
  | "completed"
  | "error"
  | "expired";

type NfcResult = {
  found: boolean;
  citizen?: Record<string, string>;
  prefill?: Record<string, string>;
  verification?: { matched: boolean; mismatches: { field: string; nfc: string; ocr: string }[] };
};

export default function AiFacePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("face");

  // Face recognition state
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<(typeof mockResults)[0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // NFC state
  const [nfcCode, setNfcCode] = useState<string>("");
  const [nfcStatus, setNfcStatus] = useState<NfcStatus>("idle");
  const [nfcResult, setNfcResult] = useState<NfcResult | null>(null);
  const [copied, setCopied] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ─── Face recognition handlers ──────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleScan = () => {
    if (!imagePreview) return;
    setIsScanning(true);
    setResult(null);
    setError(null);
    setTimeout(() => {
      setIsScanning(false);
      setResult(mockResults[0]);
    }, 2000);
  };

  const handleReset = () => {
    setImagePreview(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ─── NFC handlers ────────────────────────────────────────────────────────
  const stopEvents = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const applySessionEvent = useCallback((data: Record<string, unknown>) => {
    const status = String(data.status || "").toUpperCase();
    if (status === "WAITING") setNfcStatus("waiting");
    if (status === "CONNECTED") setNfcStatus("connected");
    if (status === "SCANNING") setNfcStatus("scanning");
    if (status === "PROCESSING") setNfcStatus("processing");
    if (status === "ERROR") setNfcStatus("error");
    if (status === "EXPIRED" || status === "DISCONNECTED") setNfcStatus("expired");
    if (status === "COMPLETED") {
      setNfcStatus("completed");
      const result = data.result as {
        found?: boolean;
        nfc?: Record<string, string>;
        ocr?: Record<string, string>;
        citizen?: Record<string, string>;
        verification?: NfcResult["verification"];
        citizenId?: string;
      } | null;
      if (result) {
        const nfc = result.nfc ?? {};
        setNfcResult({
          found: Boolean(result.found || result.citizenId || result.citizen),
          verification: result.verification,
          citizen: result.citizen
            ? result.citizen
            : result.found || result.citizenId
            ? {
                fullName: nfc.fullName ?? "",
                cccd: nfc.personalId ?? "",
                dateOfBirth: nfc.dateOfBirth ?? "",
                address: nfc.placeOfResidence ?? "",
                militaryStatus: "",
              }
            : undefined,
          prefill:
            result.found || result.citizenId
              ? undefined
              : {
                  fullName: nfc.fullName ?? result.ocr?.fullName ?? "",
                  cccd: nfc.personalId ?? result.ocr?.personalId ?? "",
                  dateOfBirth: nfc.dateOfBirth ?? result.ocr?.dateOfBirth ?? "",
                  address: nfc.placeOfResidence ?? result.ocr?.placeOfResidence ?? "",
                },
        });
      }
    }
  }, []);

  const startEvents = useCallback(
    (code: string) => {
      stopEvents();
      const es = new EventSource(`/api/mobile/session/events?code=${encodeURIComponent(code)}`);
      eventSourceRef.current = es;
      es.onmessage = (event) => {
        try {
          applySessionEvent(JSON.parse(event.data) as Record<string, unknown>);
        } catch {
          /* ignore malformed payloads */
        }
      };
      es.onerror = () => {
        // Browser reconnects EventSource automatically.
      };
    },
    [applySessionEvent, stopEvents],
  );

  const generateSession = useCallback(async () => {
    stopEvents();
    setNfcStatus("waiting");
    setNfcResult(null);
    try {
      const res = await fetch("/api/mobile/session/create", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "create failed");
      setNfcCode(data.connectionCode);
      startEvents(data.connectionCode);
    } catch {
      setNfcStatus("idle");
    }
  }, [startEvents, stopEvents]);

  useEffect(() => {
    if (activeTab === "nfc" && nfcStatus === "idle") generateSession();
    return () => stopEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const copyCode = () => {
    navigator.clipboard.writeText(nfcCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [mobileUrl, setMobileUrl] = useState("/mobile/connect");

  useEffect(() => {
    setMobileUrl(`${window.location.origin}/mobile/connect`);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
          Nhận dạng AI
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
          Nhận dạng khuôn mặt và quét NFC CCCD gắn chip qua điện thoại
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--m3-surface-container-high, #eef1f4)" }}
      >
        {(
          [
            { id: "face", label: "Nhận dạng Khuôn mặt", icon: ScanFace },
            { id: "nfc", label: "Quét NFC", icon: NfcIcon },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-m3-surface-lowest shadow-sm text-olive-800"
                : "text-m3-on-surface-variant hover:text-m3-on-surface-variant"
            }`}
            style={
              activeTab === id
                ? { color: "var(--m3-on-surface, #1b1d20)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
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
          {/* Upload Panel */}
          <div className="bg-m3-surface-lowest rounded-2xl border border-m3-outline-variant shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--m3-surface-container-high, #eef1f4)" }}
              >
                <ScanFace size={20} style={{ color: "var(--m3-primary, #1a73e8)" }} />
              </div>
              <div>
                <h2 className="font-semibold text-m3-on-surface">
                  Tải ảnh khuôn mặt
                </h2>
                <p className="text-xs text-m3-on-surface-variant">Hỗ trợ JPG, PNG, WEBP</p>
              </div>
            </div>

            <div
              className="border-2 border-dashed border-m3-outline-variant rounded-xl p-6 text-center cursor-pointer hover:border-m3-primary transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mx-auto max-h-48 rounded-lg object-contain"
                />
              ) : (
                <div className="space-y-2">
                  <Camera size={40} className="mx-auto text-m3-on-surface-variant" />
                  <p className="text-sm text-m3-on-surface-variant">
                    Nhấn để chọn ảnh hoặc kéo thả vào đây
                  </p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleScan}
                disabled={!imagePreview || isScanning}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-m3-primary hover:bg-m3-on-surface-variant disabled:opacity-50 text-white rounded-xl transition-colors font-medium text-sm"
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
              {imagePreview && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 border border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-high rounded-xl transition-colors text-sm"
                >
                  Xóa
                </button>
              )}
            </div>

            <div className="p-3 rounded-xl bg-m3-surface-high border border-m3-outline-variant">
              <p className="text-xs text-m3-on-surface-variant">
                <span className="font-semibold">Lưu ý:</span> Ảnh cần rõ mặt, đủ
                ánh sáng, không bị che khuất để đạt độ chính xác cao nhất.
              </p>
            </div>
          </div>

          {/* Result Panel */}
          <div className="bg-m3-surface-lowest rounded-2xl border border-m3-outline-variant shadow-sm p-6">
            <h2 className="font-semibold text-m3-on-surface mb-4">
              Kết quả nhận dạng
            </h2>

            {!result && !isScanning && (
              <div className="h-48 flex flex-col items-center justify-center text-m3-on-surface-variant space-y-2">
                <ScanFace size={40} className="opacity-30" />
                <p className="text-sm">
                  Chưa có kết quả. Tải ảnh và nhấn nhận dạng.
                </p>
              </div>
            )}

            {isScanning && (
              <div className="h-48 flex flex-col items-center justify-center space-y-3">
                <RefreshCw size={36} className="text-m3-primary animate-spin" />
                <p className="text-sm text-m3-on-surface-variant">
                  Đang phân tích khuôn mặt...
                </p>
              </div>
            )}

            {result && !isScanning && (
              <div className="space-y-4">
                <div
                  className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium"
                  style={{
                    background: result.matched ? "var(--color-m3-success-container)" : "var(--m3-error-container, var(--m3-error-container, #ffdad6))",
                    color: result.matched ? "var(--color-m3-success)" : "var(--m3-error, #ba1a1a)",
                  }}
                >
                  {result.matched ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  {result.matched
                    ? `Khớp thành công – Độ tin cậy: ${result.confidence}%`
                    : "Không tìm thấy thông tin khớp"}
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Họ và tên", value: result.fullName },
                    { label: "Số CCCD", value: result.cccd },
                    {
                      label: "Ngày sinh",
                      value: new Date(result.dateOfBirth).toLocaleDateString(
                        "vi-VN",
                      ),
                    },
                    { label: "Địa chỉ", value: result.address },
                    { label: "Trạng thái NVQS", value: result.militaryStatus },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex justify-between items-start gap-3 py-2 border-b border-m3-outline-variant last:border-0"
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
                <button className="w-full py-2 border border-m3-outline-variant text-m3-primary hover:bg-m3-surface-high rounded-xl text-sm font-medium transition-colors">
                  Xem hồ sơ đầy đủ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── NFC Tab ───────────────────────────────────────────────────── */}
      {activeTab === "nfc" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Connection panel */}
          <div className="bg-m3-surface-lowest rounded-2xl border border-m3-outline-variant shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--m3-surface-container-high, #eef1f4)" }}
              >
                <Smartphone size={20} style={{ color: "var(--m3-primary, #1a73e8)" }} />
              </div>
              <div>
                <h2 className="font-semibold text-m3-on-surface">
                  Kết nối điện thoại
                </h2>
                <p className="text-xs text-m3-on-surface-variant">
                  Mở app iOS Nhận dạng AI (hoặc /mobile/connect) và nhập mã bên dưới
                </p>
              </div>
            </div>

            {/* Status indicator */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background:
                  nfcStatus === "completed"
                    ? "var(--color-m3-success-container)"
                    : nfcStatus === "connected" || nfcStatus === "scanning" || nfcStatus === "processing"
                      ? "var(--m3-primary-container, #dae9fb)"
                      : nfcStatus === "waiting"
                        ? "#fef9c3"
                        : nfcStatus === "error" || nfcStatus === "expired"
                          ? "var(--m3-error-container, var(--m3-error-container, #ffdad6))"
                          : "var(--m3-surface-container-high, #eef1f4)",
                color:
                  nfcStatus === "completed"
                    ? "var(--color-m3-success)"
                    : nfcStatus === "connected" || nfcStatus === "scanning" || nfcStatus === "processing"
                      ? "var(--m3-primary, #1a73e8)"
                      : nfcStatus === "waiting"
                        ? "#92400e"
                        : nfcStatus === "error" || nfcStatus === "expired"
                          ? "var(--m3-error, #ba1a1a)"
                          : "var(--m3-on-surface-variant, #475569)",
              }}
            >
              {nfcStatus === "waiting" && (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Đang chờ điện
                  thoại kết nối...
                </>
              )}
              {nfcStatus === "connected" && (
                <>
                  <Wifi size={14} /> ✓ Điện thoại đã kết nối
                </>
              )}
              {nfcStatus === "scanning" && (
                <>
                  <Wifi size={14} /> Điện thoại đang quét CCCD...
                </>
              )}
              {nfcStatus === "processing" && (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Đang đối chiếu NFC/OCR...
                </>
              )}
              {nfcStatus === "completed" && (
                <>
                  <CheckCircle2 size={14} /> Đã nhận dữ liệu CCCD
                </>
              )}
              {nfcStatus === "error" && (
                <>
                  <AlertCircle size={14} /> Phiên gặp lỗi
                </>
              )}
              {nfcStatus === "expired" && (
                <>
                  <WifiOff size={14} /> Phiên hết hạn hoặc đã ngắt
                </>
              )}
              {nfcStatus === "idle" && (
                <>
                  <WifiOff size={14} /> Chưa kết nối
                </>
              )}
            </div>

            {/* Big code display */}
            {nfcCode && (
              <div className="text-center space-y-3">
                <p className="text-xs text-m3-on-surface-variant">Mã kết nối</p>
                <div
                  className="text-5xl font-bold tracking-[0.3em] py-4 rounded-2xl"
                  style={{ color: "var(--m3-on-surface, #1b1d20)", background: "var(--m3-surface-container-high, #eef1f4)" }}
                >
                  {nfcCode}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyCode}
                    className="flex-1 flex items-center justify-center gap-2 py-2 border border-m3-outline-variant text-m3-primary hover:bg-m3-surface-high rounded-xl text-sm transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check size={14} /> Đã copy!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy mã
                      </>
                    )}
                  </button>
                  <button
                    onClick={generateSession}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-m3-outline-variant text-m3-primary hover:bg-m3-surface-high rounded-xl text-sm transition-colors"
                  >
                    <RefreshCw size={14} />
                    Tạo mã mới
                  </button>
                </div>
              </div>
            )}

            {/* Mobile link */}
            <div className="p-3 rounded-xl bg-m3-surface-high border border-m3-outline-variant space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-m3-on-surface-variant">
                  Trang quét NFC (điện thoại)
                </p>
                <button
                  onClick={() => window.open(mobileUrl, "_blank")}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-m3-outline-variant text-m3-primary transition-colors"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Result panel */}
          <div className="bg-m3-surface-lowest rounded-2xl border border-m3-outline-variant shadow-sm p-6">
            <h2 className="font-semibold text-m3-on-surface mb-4">Kết quả NFC</h2>

            {!nfcResult && (
              <div className="h-64 flex flex-col items-center justify-center text-m3-on-surface-variant space-y-3">
                <NfcIcon size={48} className="opacity-20" />
                <p className="text-sm text-center">
                  Kết nối điện thoại và quét CCCD gắn chip
                  <br />
                  để kết quả hiển thị tại đây
                </p>
              </div>
            )}

            {nfcResult && nfcResult.verification && (
              <div
                className={`p-3 rounded-xl text-sm mb-4 ${
                  nfcResult.verification.matched
                    ? "bg-m3-success-container text-m3-on-success-container"
                    : "bg-m3-warning-container text-m3-on-warning-container"
                }`}
              >
                {nfcResult.verification.matched
                  ? "NFC và OCR khớp"
                  : nfcResult.verification.mismatches
                      .map((m) => `${m.field}: NFC ${m.nfc} / OCR ${m.ocr}`)
                      .join(" · ")}
              </div>
            )}

            {nfcResult && nfcResult.found && nfcResult.citizen && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium bg-m3-success-container text-m3-on-success-container">
                  <User size={16} />
                  Tìm thấy công dân trong hệ thống
                </div>
                <div className="space-y-2">
                  {Object.entries({
                    "Họ và tên": nfcResult.citizen.fullName,
                    "Số CCCD": nfcResult.citizen.cccd,
                    "Ngày sinh": nfcResult.citizen.dateOfBirth,
                    "Địa chỉ": nfcResult.citizen.address,
                    "Trạng thái NVQS": nfcResult.citizen.militaryStatus,
                  }).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 py-2 border-b border-m3-outline-variant last:border-0"
                    >
                      <span className="text-sm text-m3-on-surface-variant shrink-0">
                        {label}
                      </span>
                      <span className="text-sm font-medium text-right">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      router.push(
                        `/admin/citizens?search=${encodeURIComponent(nfcResult.citizen?.cccd || "")}`,
                      )
                    }
                    className="flex-1 py-2 bg-m3-primary hover:bg-m3-on-surface-variant text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    Hồ sơ sức khỏe
                  </button>
                  <button
                    onClick={() =>
                      router.push(
                        `/admin/citizens?cccd=${nfcResult.citizen?.cccd}`,
                      )
                    }
                    className="flex-1 py-2 border border-m3-outline-variant text-m3-primary hover:bg-m3-surface-high rounded-xl text-sm font-medium transition-colors"
                  >
                    Thông tin chi tiết
                  </button>
                </div>
              </div>
            )}

            {nfcResult && !nfcResult.found && nfcResult.prefill && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium bg-m3-warning-container text-m3-on-warning-container">
                  <UserPlus size={16} />
                  Công dân chưa có trong hệ thống – Đã điền sẵn thông tin
                </div>
                <div className="space-y-2">
                  {Object.entries({
                    "Họ và tên": nfcResult.prefill.fullName,
                    "Số CCCD": nfcResult.prefill.cccd,
                    "Ngày sinh": nfcResult.prefill.dateOfBirth,
                    "Địa chỉ": nfcResult.prefill.address,
                  }).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 py-2 border-b border-m3-outline-variant last:border-0"
                    >
                      <span className="text-sm text-m3-on-surface-variant shrink-0">
                        {label}
                      </span>
                      <span className="text-sm font-medium text-right">
                        {value || "(Chưa có)"}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const params = new URLSearchParams(
                      nfcResult.prefill as Record<string, string>,
                    );
                    router.push(`/admin/citizens?new=1&${params.toString()}`);
                  }}
                  className="w-full py-2 bg-m3-primary hover:bg-m3-on-surface-variant text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} />
                  Thêm mới công dân
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
