"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wifi } from "lucide-react";
import { GhostButton, MobileCard, MobileShell, PrimaryButton } from "@/components/mobile/MobileShell";
import {
  connectWithCode,
  fetchSessionStatus,
  loadStoredSession,
} from "@/lib/mobile/client";

export default function MobileConnectPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const stored = loadStoredSession();
    if (!stored) {
      setRestoring(false);
      return;
    }
    fetchSessionStatus(stored)
      .then((session) => {
        if (["CONNECTED", "SCANNING", "PROCESSING", "WAITING"].includes(session.status)) {
          router.replace("/mobile/scan");
          return;
        }
        if (session.status === "COMPLETED") {
          router.replace("/mobile/result");
          return;
        }
        setRestoring(false);
      })
      .catch(() => setRestoring(false));
  }, [router]);

  async function handleConnect() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setStatus("loading");
    setMessage("");
    try {
      await connectWithCode(trimmed);
      setStatus("ok");
      setTimeout(() => router.push("/mobile/scan"), 400);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Lỗi kết nối");
    }
  }

  if (restoring) {
    return (
      <MobileShell>
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--m3-primary, #1a73e8)" }}>
          <Loader2 className="animate-spin mr-2" size={18} /> Đang khôi phục phiên...
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="flex-1 flex items-center">
        <MobileCard>
          <div className="text-center space-y-1">
            <p className="font-semibold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
              Mã kết nối
            </p>
            <p className="text-xs text-m3-on-surface-variant">Nhập mã hiển thị trên máy tính</p>
          </div>

          <input
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setStatus("idle");
              setMessage("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            placeholder="DP2GQ9"
            className="w-full text-center text-3xl font-bold tracking-[0.35em] py-4 rounded-2xl outline-none border-2"
            style={{
              color: "var(--m3-on-surface, #1b1d20)",
              background: "var(--m3-surface-container-high, #eef1f4)",
              borderColor: status === "error" ? "var(--m3-error, #ba1a1a)" : "var(--m3-outline-variant, #e3e8ee)",
            }}
          />

          <div className="text-center text-sm" style={{ color: status === "ok" ? "var(--color-m3-success)" : "var(--m3-on-surface-variant, #475569)" }}>
            {status === "ok" ? "✓ Đã kết nối" : "○ Đang chờ"}
          </div>

          {message && <p className="text-sm text-m3-error text-center">{message}</p>}

          <PrimaryButton onClick={handleConnect} disabled={code.length < 4 || status === "loading"}>
            {status === "loading" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Đang kết nối...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Wifi size={18} /> Kết nối
              </span>
            )}
          </PrimaryButton>

          <GhostButton onClick={() => setCode("")}>Xóa mã</GhostButton>
          <p className="text-[11px] text-center text-m3-on-surface-variant">
            Có thể bổ sung quét QR mã kết nối ở phiên bản sau.
          </p>
        </MobileCard>
      </div>
    </MobileShell>
  );
}
