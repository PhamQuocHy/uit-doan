"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Square,
  Loader2,
  Volume2,
  CheckCircle2,
  UserPlus,
  Search,
  AlertCircle,
  User,
} from "lucide-react";
import { STATUS_LABELS } from "@/lib/analytics/types";

type CitizenHit = {
  id: string;
  fullName: string;
  cccd: string;
  dateOfBirth: string;
  address: string;
  militaryStatus: string;
  gender?: string;
  phone?: string;
  avatar?: string;
};

function statusLabel(code: string): string {
  return STATUS_LABELS[code] || code || "—";
}

function genderLabel(g?: string): string {
  if (g === "male" || g === "Nam") return "Nam";
  if (g === "female" || g === "Nữ") return "Nữ";
  return g || "—";
}

function pickRecorderMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "audio/webm";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được file ghi âm"));
    reader.readAsDataURL(blob);
  });
}

export default function AiVoiceTab() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [cccd, setCccd] = useState<string | null>(null);
  const [citizen, setCitizen] = useState<CitizenHit | null>(null);
  const [found, setFound] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [micDevices, setMicDevices] = useState<
    { deviceId: string; label: string }[]
  >([]);
  const [selectedMicId, setSelectedMicId] = useState("");
  const [level, setLevel] = useState(0);
  const [micLive, setMicLive] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peakLevelRef = useRef(0);
  const MIC_PREF_KEY = "ai_voice_preferred_mic_id";

  const stopMeterOnly = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setLevel(0);
  }, []);

  const stopStream = useCallback(() => {
    stopMeterOnly();
    streamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
    setMicLive(false);
  }, [stopMeterOnly]);

  const refreshMicList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label?.trim() || `Micro ${i + 1}`,
      }));
    setMicDevices(mics);
    return mics;
  }, []);

  const attachMeter = useCallback(async (stream: MediaStream) => {
    stopMeterOnly();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      const a = analyserRef.current;
      if (!a) return;
      a.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const next = Math.min(1, rms * 3.2);
      if (next > peakLevelRef.current) peakLevelRef.current = next;
      setLevel((prev) => prev * 0.55 + next * 0.45);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopMeterOnly]);

  useEffect(() => {
    void (async () => {
      try {
        const warm = await navigator.mediaDevices.getUserMedia({ audio: true });
        warm.getTracks().forEach((t) => t.stop());
      } catch {
        /* chưa cấp quyền */
      }
      const mics = await refreshMicList();
      try {
        const saved = localStorage.getItem(MIC_PREF_KEY)?.trim();
        if (saved && mics.some((m) => m.deviceId === saved)) {
          setSelectedMicId(saved);
          return;
        }
      } catch {
        /* ignore */
      }
      if (mics[0]) setSelectedMicId(mics[0].deviceId);
    })();
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopStream();
    };
  }, [refreshMicList, stopStream]);

  const resetResult = () => {
    setCccd(null);
    setCitizen(null);
    setFound(null);
    setError(null);
  };

  const applyLookupResponse = (data: Record<string, unknown>) => {
    if (typeof data.transcript === "string" && data.transcript.trim()) {
      setTranscript(data.transcript.trim());
    }
    setCccd(typeof data.cccd === "string" ? data.cccd : null);
    setCitizen((data.citizen as CitizenHit) ?? null);
    setFound(Boolean(data.found));
    if (data.error && !data.cccd) {
      setError(String(data.error));
      setHint(null);
    } else {
      setHint(typeof data.message === "string" ? data.message : null);
    }
  };

  const lookupAudio = useCallback(async (audioDataUrl: string, mimeType: string) => {
    setIsLookingUp(true);
    setError(null);
    setHint("Đang gửi file ghi âm lên AI để nhận dạng…");
    try {
      const res = await fetch("/api/admin/ai-voice/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: audioDataUrl,
          mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tra cứu thất bại");
      applyLookupResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tra cứu thất bại");
      setHint(null);
      setFound(false);
      setCitizen(null);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const lookupText = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) {
      setError("Chưa có lời nói. Hãy ghi âm hoặc nhập văn bản.");
      return;
    }
    setIsLookingUp(true);
    setError(null);
    setHint("Đang trích CCCD và tìm hồ sơ…");
    try {
      const res = await fetch("/api/admin/ai-voice/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tra cứu thất bại");
      applyLookupResponse(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tra cứu thất bại");
      setHint(null);
      setFound(false);
      setCitizen(null);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ ghi âm.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Trình duyệt không hỗ trợ MediaRecorder. Dùng Chrome/Edge.");
      return;
    }

    resetResult();
    setError(null);
    setTranscript("");
    peakLevelRef.current = 0;
    setRecordSecs(0);
    setHint("Đang ghi… Nói rõ số CCCD, thấy sóng nhảy là micro nhận được.");

    try {
      stopStream();
      const constraints: MediaStreamConstraints = {
        audio: selectedMicId
          ? {
              deviceId: { exact: selectedMicId },
              echoCancellation: true,
              noiseSuppression: true,
            }
          : { echoCancellation: true, noiseSuppression: true },
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setMicLive(true);
      await refreshMicList();
      const track = stream.getAudioTracks()[0];
      const openedId = track?.getSettings()?.deviceId;
      if (openedId) {
        setSelectedMicId(openedId);
        try {
          localStorage.setItem(MIC_PREF_KEY, openedId);
        } catch {
          /* ignore */
        }
      }

      await attachMeter(stream);

      const mime = pickRecorderMime();
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start(200);
      setIsRecording(true);

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordSecs((s) => s + 1);
      }, 1000);
    } catch (e) {
      stopStream();
      setIsRecording(false);
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Chưa cấp quyền micro. Cho phép micro trong trình duyệt."
          : "Không mở được micro đã chọn. Thử chọn micro khác.",
      );
    }
  };

  const handleStopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      stopStream();
      return;
    }

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    const mime = recorder.mimeType || pickRecorderMime();
    const blob: Blob = await new Promise((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: mime }));
      };
      recorder.onerror = () => reject(new Error("Ghi âm lỗi"));
      try {
        recorder.stop();
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Không dừng ghi âm"));
      }
    });

    recorderRef.current = null;
    setIsRecording(false);
    stopStream();

    if (peakLevelRef.current < 0.03) {
      setError(
        "Ghi âm gần như im lặng — micro có thể sai hoặc quá nhỏ. Đổi micro / nói to hơn rồi thử lại.",
      );
      setHint(null);
      return;
    }

    if (blob.size < 800) {
      setError("File ghi âm quá ngắn. Giữ mic và đọc đủ số CCCD rồi dừng.");
      return;
    }

    try {
      const dataUrl = await blobToDataUrl(blob);
      await lookupAudio(dataUrl, mime.split(";")[0] || "audio/webm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được file ghi âm");
    }
  };

  const levelPct = Math.round(level * 100);
  const levelLabel =
    levelPct < 4
      ? "Im lặng"
      : levelPct < 18
        ? "Nhỏ"
        : levelPct < 45
          ? "Vừa"
          : "To";
  const barCount = 24;
  const activeBars = Math.round(level * barCount);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="macos-card overflow-hidden flex flex-col">
        <div className="px-4 pt-4">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-m3-on-surface-variant sm:flex-row sm:items-center sm:gap-2">
            <span className="shrink-0 inline-flex items-center gap-1.5">
              <Mic size={14} />
              Chọn micro
            </span>
            <select
              className="min-h-[40px] w-full flex-1 rounded-[10px] border border-black/[0.08] bg-m3-surface-lowest px-3 text-[13px] font-semibold text-m3-on-surface outline-none focus:border-m3-primary/40 disabled:opacity-60"
              value={
                selectedMicId &&
                micDevices.some((m) => m.deviceId === selectedMicId)
                  ? selectedMicId
                  : micDevices[0]?.deviceId || ""
              }
              disabled={isRecording || isLookingUp}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedMicId(id);
                try {
                  localStorage.setItem(MIC_PREF_KEY, id);
                } catch {
                  /* ignore */
                }
              }}
            >
              {micDevices.length === 0 ? (
                <option value="">Chưa có micro — cấp quyền rồi F5</option>
              ) : (
                micDevices.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <div className="p-6 border-b border-m3-outline-variant bg-m3-surface-high/30 flex flex-col items-center justify-center min-h-[300px]">
          <div className="relative flex items-center justify-center mb-5">
            {isRecording && (
              <div
                className="absolute rounded-full bg-m3-error/25 transition-all duration-75"
                style={{
                  width: `${88 + level * 72}px`,
                  height: `${88 + level * 72}px`,
                }}
              />
            )}

            {!isRecording ? (
              <button
                type="button"
                onClick={() => void handleStartRecording()}
                disabled={isLookingUp}
                className="w-20 h-20 bg-m3-primary hover:bg-m3-on-surface-variant text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 z-10"
              >
                <Mic size={32} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStopRecording()}
                className="w-20 h-20 bg-m3-error-container text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 z-10"
              >
                <Square size={24} fill="currentColor" />
              </button>
            )}
          </div>

          <div className="w-full max-w-sm mb-4">
            <div className="flex items-end justify-center gap-[3px] h-12 px-2">
              {Array.from({ length: barCount }).map((_, i) => {
                const on = isRecording && i < activeBars;
                const tall = 20 + ((i % 5) + 1) * 12;
                return (
                  <div
                    key={i}
                    className={`w-[6px] rounded-full transition-all duration-75 ${
                      on
                        ? i > barCount * 0.72
                          ? "bg-m3-error"
                          : i > barCount * 0.4
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        : "bg-m3-outline-variant/50"
                    }`}
                    style={{
                      height: on
                        ? `${Math.max(10, tall * (0.35 + level))}px`
                        : "10px",
                      opacity: on ? 1 : 0.45,
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-m3-on-surface-variant px-1">
              <span>
                {isRecording
                  ? micLive
                    ? `Đang ghi ${recordSecs}s · ${levelLabel} (${levelPct}%)`
                    : "Đang mở micro…"
                  : "Bấm mic → đọc CCCD → bấm dừng để nhận dạng"}
              </span>
              {isRecording && levelPct < 4 ? (
                <span className="font-semibold text-m3-error">
                  Chưa nghe thấy
                </span>
              ) : null}
            </div>
          </div>

          <div className="text-center px-4">
            {isRecording ? (
              <div>
                <h3 className="text-lg font-bold text-m3-error mb-1">
                  Đang ghi âm...
                </h3>
                <p className="text-sm text-m3-on-surface-variant">
                  Đọc đủ 12 số rồi bấm nút vuông để gửi AI nhận dạng
                </p>
              </div>
            ) : isLookingUp ? (
              <div className="flex flex-col items-center">
                <Loader2
                  className="animate-spin text-m3-primary mb-2"
                  size={28}
                />
                <h3 className="text-lg font-bold text-m3-on-surface-variant">
                  AI đang nghe &amp; tìm hồ sơ…
                </h3>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-m3-on-surface mb-1">
                  Nhấn để bắt đầu
                </h3>
                <p className="text-sm text-m3-on-surface-variant">
                  Ghi âm bằng micro đã chọn — sóng nhảy là đang nhận giọng
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 flex-1 bg-m3-surface-high/50 space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-bold text-m3-on-surface-variant">
            <Volume2 size={16} />
            Văn bản nhận dạng
          </h4>
          <textarea
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              resetResult();
            }}
            rows={4}
            placeholder="Sau khi dừng ghi âm, lời nói sẽ hiện ở đây… (có thể sửa / dán rồi tìm lại)"
            className="w-full bg-m3-surface-lowest p-4 rounded-xl border border-m3-outline-variant text-sm text-m3-on-surface leading-relaxed shadow-inner outline-none focus:border-m3-primary/40"
          />
          <button
            type="button"
            onClick={() => void lookupText(transcript)}
            disabled={isLookingUp || isRecording || !transcript.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-m3-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isLookingUp ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Trích CCCD &amp; tìm hồ sơ
          </button>
          {hint ? (
            <p className="text-xs text-m3-on-surface-variant">{hint}</p>
          ) : null}
          {error ? (
            <div className="flex items-start gap-2 rounded-xl bg-m3-error-container px-3 py-2 text-sm text-m3-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="macos-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant bg-m3-surface-high/50 flex justify-between items-center gap-2">
          <h3 className="font-bold text-m3-on-surface-variant">
            Kết quả hồ sơ
          </h3>
          {cccd ? (
            <span className="font-mono text-xs font-semibold text-m3-primary">
              CCCD: {cccd}
            </span>
          ) : null}
        </div>

        <div className="p-6 flex-1">
          {found === null && !isLookingUp && (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-m3-on-surface-variant gap-3">
              <UserPlus size={48} className="opacity-20" />
              <p className="text-sm text-center px-4">
                Ghi âm số CCCD rồi dừng — hệ thống nhận dạng và tìm hồ sơ phù
                hợp.
              </p>
            </div>
          )}

          {isLookingUp && (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-m3-primary" size={32} />
              <p className="text-sm text-m3-on-surface-variant">
                Đang nhận dạng giọng nói…
              </p>
            </div>
          )}

          {found === true && citizen && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl bg-m3-success-container px-3 py-2 text-sm text-m3-on-success-container">
                <CheckCircle2 size={18} />
                Đã khớp hồ sơ theo CCCD
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-20 h-24 rounded-lg bg-m3-surface-high overflow-hidden shrink-0 flex items-center justify-center">
                  {citizen.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={citizen.avatar}
                      alt={citizen.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User size={28} className="text-m3-on-surface-variant" />
                  )}
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {[
                    { label: "Họ và tên", value: citizen.fullName },
                    { label: "Số CCCD", value: citizen.cccd },
                    {
                      label: "Ngày sinh",
                      value: citizen.dateOfBirth
                        ? new Date(citizen.dateOfBirth).toLocaleDateString(
                            "vi-VN",
                          )
                        : "—",
                    },
                    { label: "Giới tính", value: genderLabel(citizen.gender) },
                    { label: "Địa chỉ", value: citizen.address || "—" },
                    {
                      label: "Trạng thái NVQS",
                      value: statusLabel(citizen.militaryStatus),
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex justify-between gap-3 border-b border-m3-outline-variant pb-1 last:border-0"
                    >
                      <span className="text-xs text-m3-on-surface-variant shrink-0">
                        {row.label}
                      </span>
                      <span className="text-sm font-medium text-m3-on-surface text-right">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/admin/citizens?search=${encodeURIComponent(citizen.cccd)}`,
                  )
                }
                className="w-full py-2.5 rounded-xl border border-m3-outline-variant text-sm font-medium text-m3-primary hover:bg-m3-surface-high"
              >
                Xem hồ sơ đầy đủ
              </button>
            </div>
          )}

          {found === false && cccd && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl bg-m3-error-container px-3 py-2 text-sm text-m3-error">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  Đã trích CCCD{" "}
                  <span className="font-mono font-semibold">{cccd}</span> nhưng
                  chưa có hồ sơ trong hệ thống.
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/admin/citizens?new=1&cccd=${encodeURIComponent(cccd)}`,
                  )
                }
                className="w-full py-2.5 rounded-xl bg-m3-primary text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                <UserPlus size={16} />
                Thêm hồ sơ với CCCD này
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
