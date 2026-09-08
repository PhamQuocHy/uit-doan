"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, Settings2, X, Zap } from "lucide-react";
import { useHn212Reader } from "@/hooks/useHn212Reader";
import type { Hn212CitizenScan } from "@/lib/hn212";

type Props = {
  onScanned: (data: Hn212CitizenScan) => void;
  /** Gọi trước khi mở modal / quét — ví dụ tắt webcam trình duyệt */
  onBeforeScan?: () => void;
  label?: string;
  compact?: boolean;
  className?: string;
};

const STATUS_DOT: Record<string, string> = {
  disconnected: "bg-slate-400",
  connecting: "bg-amber-400 animate-pulse",
  ready: "bg-emerald-500",
  reading: "bg-sky-500 animate-pulse",
  error: "bg-red-500",
};

const STATUS_TEXT: Record<string, string> = {
  disconnected: "Chưa kết nối",
  connecting: "Đang kết nối…",
  ready: "Máy sẵn sàng",
  reading: "Đang đọc chip…",
  error: "Lỗi kết nối",
};

export default function Hn212ScanButton({
  onScanned,
  onBeforeScan,
  label = "Quét CCCD (HN-212)",
  compact = false,
  className = "",
}: Props) {
  const {
    status,
    error,
    hint: statusHint,
    eventLog,
    lastCardRaw,
    wsUrl,
    busy,
    connect,
    scan,
    demoScan,
    isDev,
  } = useHn212Reader();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draftUrl, setDraftUrl] = useState(wsUrl);
  const [localError, setLocalError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setDraftUrl(wsUrl);
  }, [wsUrl]);

  // Mở modal → tự kết nối WebSocket tới ComQ
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLocalError(null);
    void (async () => {
      const result = await connect();
      if (cancelled) return;
      if ("ok" in result && result.ok === false) {
        setLocalError(result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, connect]);

  const finishWith = (data: Hn212CitizenScan) => {
    onScanned(data);
    setHint(
      data.fullName
        ? `Đã đọc: ${data.fullName}${data.cccd ? ` · ${data.cccd}` : ""}`
        : data.cccd
          ? `Đã đọc CCCD ${data.cccd}`
          : "Đã đọc chip CCCD",
    );
    setTimeout(() => setOpen(false), 500);
  };

  const handleScan = async () => {
    setLocalError(null);
    setHint(null);
    onBeforeScan?.();
    const result = await scan();
    if (result.ok) {
      finishWith(result.data);
      return;
    }
    setLocalError(result.error);
  };

  const handleDemo = () => {
    setLocalError(null);
    finishWith(demoScan());
  };

  const handleSaveUrl = async () => {
    const next = draftUrl.trim();
    setLocalError(null);
    const result = await connect(next);
    if ("ok" in result && result.ok === false) {
      setLocalError(result.error);
    } else {
      setHint("Đã kết nối WebSocket");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onBeforeScan?.();
          setLocalError(null);
          setHint(null);
          setOpen(true);
        }}
        className={
          className ||
          (compact
            ? "inline-flex h-9 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 text-[13px] font-semibold text-sky-700 hover:bg-sky-100"
            : "inline-flex h-10 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 text-[13px] font-semibold text-sky-700 hover:bg-sky-100")
        }
      >
        <CreditCard size={compact ? 15 : 16} />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status] || STATUS_DOT.disconnected}`}
                />
                <div>
                  <h3 className="text-[16px] font-bold text-m3-on-surface">
                    Quét CCCD HN-212
                  </h3>
                  <p className="text-[12px] text-m3-on-surface-variant">
                    {STATUS_TEXT[status] || status}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-m3-on-surface-variant hover:bg-m3-surface-high disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <ol className="list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-m3-on-surface-variant">
                <li>
                  Mở <strong>ComQ ID Reader</strong> và để hiện mã HANEL-…
                </li>
                <li>
                  <strong>Cắm CCCD vào khe trước</strong> (không chỉ đặt gần),
                  giữ thẻ đến khi xong.
                </li>
                <li>
                  Bấm <strong>Bắt đầu quét</strong> — chờ OCR + chip (có thể
                  tới ~90 giây). Trên ComQ phải thấy đang đọc thẻ.
                </li>
                <li className="text-[12px]">
                  WebSocket: <code>ws://127.0.0.1:8000</code>
                </li>
              </ol>

              {statusHint && status === "reading" && (
                <p className="rounded-[12px] bg-sky-50 px-3 py-2.5 text-[13px] text-sky-800">
                  {statusHint}
                </p>
              )}

              {eventLog.length > 0 && (
                <details className="rounded-[12px] bg-m3-surface-high/70 px-3 py-2 text-[11px] text-m3-on-surface-variant">
                  <summary className="cursor-pointer font-semibold">
                    Log sự kiện máy ({eventLog.length})
                  </summary>
                  <ul className="mt-2 max-h-28 space-y-1 overflow-auto font-mono">
                    {eventLog.map((line, i) => (
                      <li key={`${i}-${line}`}>{line}</li>
                    ))}
                  </ul>
                  {lastCardRaw != null && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/80 p-2 text-[10px] leading-snug">
                      {JSON.stringify(lastCardRaw, null, 2)}
                    </pre>
                  )}
                </details>
              )}

              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-m3-on-surface-variant hover:text-m3-primary"
              >
                <Settings2 size={14} />
                {showSettings ? "Ẩn cấu hình WebSocket" : "Cấu hình WebSocket"}
              </button>

              {showSettings && (
                <div className="space-y-2 rounded-[12px] bg-m3-surface-high/80 p-3">
                  <label className="block text-[12px] font-semibold text-m3-on-surface-variant">
                    Địa chỉ HN212Plugin
                  </label>
                  <input
                    className="h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[13px] outline-none focus:border-m3-primary/40"
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder="ws://127.0.0.1:8000"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveUrl()}
                    className="rounded-lg bg-m3-primary px-3 py-1.5 text-[12px] font-bold text-white"
                  >
                    Lưu & kết nối
                  </button>
                  <p className="text-[11px] text-m3-on-surface-variant">
                    Hiện tại: {wsUrl}
                  </p>
                </div>
              )}

              {(localError || error) && (
                <p className="rounded-[12px] bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                  {localError || error}
                </p>
              )}
              {hint && (
                <p className="rounded-[12px] bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700">
                  {hint}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.05] px-5 py-4">
              {isDev && (
                <button
                  type="button"
                  onClick={handleDemo}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/[0.08] px-4 text-[13px] font-semibold text-m3-on-surface-variant hover:bg-m3-surface-high"
                >
                  <Zap size={15} />
                  Demo scan
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center rounded-full px-4 text-[13px] font-semibold text-m3-on-surface-variant hover:bg-m3-surface-high disabled:opacity-40"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleScan}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-sky-600 px-5 text-[13px] font-bold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {busy || status === "reading" || status === "connecting" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang quét…
                  </>
                ) : (
                  <>
                    <CreditCard size={16} />
                    Bắt đầu quét
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
