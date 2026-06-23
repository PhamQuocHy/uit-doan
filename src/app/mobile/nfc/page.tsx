"use client";

import { useState, useEffect, useRef } from "react";
import {
  Nfc,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  KeyRound,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";

type Step = "input" | "scan" | "done";
type NfcState = "idle" | "scanning" | "success" | "error";

declare global {
  interface Window {
    NDEFReader?: new () => {
      scan: () => Promise<void>;
      addEventListener: (
        event: string,
        cb: (e: { message: { records: { data: ArrayBuffer }[] } }) => void,
      ) => void;
    };
  }
}

export default function MobileNfcPage() {
  const [step, setStep] = useState<Step>("input");
  const [code, setCode] = useState("");
  const [connectStatus, setConnectStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [nfcState, setNfcState] = useState<NfcState>("idle");
  const [message, setMessage] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  async function handleConnect() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setConnectStatus("loading");
    try {
      // Verify sessionexists
      const res = await fetch(`/api/nfc/session?code=${trimmed}`);
      if (!res.ok) {
        setConnectStatus("error");
        setMessage("Mã không hợp lệ hoặc đã hết hạn.");
        return;
      }
      // Mark as connected
      await fetch("/api/nfc/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      setConnectStatus("ok");
      setTimeout(() => setStep("scan"), 800);
    } catch {
      setConnectStatus("error");
      setMessage("Lỗi kết nối. Vui lòng thử lại.");
    }
  }

  async function handleStartNfc() {
    setNfcState("scanning");
    setMessage("");

    // Check Web NFC support
    if (typeof window !== "undefined" && "NDEFReader" in window) {
      try {
        const ndef = new window.NDEFReader!();
        await ndef.scan();
        ndef.addEventListener("reading", async (event) => {
          const rawData = event.message.records[0]?.data;
          // Decode raw NFC data (simplified – real CCCD parsing is more complex)
          const decoder = new TextDecoder();
          const text = rawData ? decoder.decode(rawData) : "";
          await submitNfcData(text);
        });
      } catch (error: any) {
        setNfcState("error");
        setMessage(
          "Lỗi truy cập NFC: " +
            (error?.message || "Vui lòng cấp quyền NFC trong trình duyệt."),
        );
      }
    } else {
      setNfcState("error");
      setMessage(
        "Điện thoại hoặc trình duyệt của bạn không hỗ trợ Web NFC. Vui lòng sử dụng Chrome trên Android.",
      );
    }
  }

  function runSimulation() {
    setMessage("(Demo) Đang mô phỏng đọc CCCD chip...");
    setNfcState("scanning");
    setTimeout(async () => {
      // Mock NFC data from CCCD
      const mockData = JSON.stringify({
        cccd: "001099012345",
        fullName: "Nguyễn Văn A",
        dateOfBirth: "2005-10-15",
        gender: "male",
        address: "Phường 1, Quận 1, TP HCM",
      });
      await submitNfcData(mockData);
    }, 1500);
  }

  async function submitNfcData(raw: string) {
    try {
      let nfcData: Record<string, string> = {};
      try {
        nfcData = JSON.parse(raw);
      } catch {
        // Try to extract CCCD from raw string
        const match = raw.match(/\d{12}/);
        if (match) nfcData = { cccd: match[0] };
      }

      const res = await fetch("/api/nfc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase(), nfcData }),
      });
      if (res.ok) {
        setNfcState("success");
        setMessage(
          "Đã gửi dữ liệu thành công! Vui lòng xem kết quả trên máy tính.",
        );
        setStep("done");
      } else {
        setNfcState("error");
        setMessage("Gửi dữ liệu thất bại. Thử lại nhé.");
      }
    } catch {
      setNfcState("error");
      setMessage("Lỗi mạng. Vui lòng kiểm tra kết nối.");
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: "linear-gradient(135deg, #f0f5e0 0%, #dceabf 100%)",
      }}
    >
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: "#748c2c" }}
        >
          <Nfc size={32} color="white" />
        </div>
        <div className="text-center">
          <h1 className="font-bold text-xl" style={{ color: "#3b491e" }}>
            Quét NFC CCCD
          </h1>
          <p className="text-sm" style={{ color: "#748c2c" }}>
            Hệ thống quản lý NVQS
          </p>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden"
        style={{ border: "1px solid #edf4dc" }}
      >
        {/* Step indicator */}
        <div
          className="flex"
          style={{ background: "#f8fae8", borderBottom: "1px solid #edf4dc" }}
        >
          {(["input", "scan", "done"] as Step[]).map((s, i) => (
            <div
              key={s}
              className="flex-1 py-3 text-center text-xs font-medium transition-colors"
              style={{
                color: step === s ? "#3b491e" : "#93a83e",
                borderBottom:
                  step === s ? "2px solid #748c2c" : "2px solid transparent",
              }}
            >
              Bước {i + 1}
            </div>
          ))}
        </div>

        <div className="p-6 space-y-5">
          {/* ── Step 1: Connect ── */}
          {step === "input" && (
            <>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "#f8fae8" }}
                >
                  <KeyRound size={18} style={{ color: "#748c2c" }} />
                </div>
                <div>
                  <p
                    className="font-semibold text-sm"
                    style={{ color: "#3b491e" }}
                  >
                    Nhập mã kết nối
                  </p>
                  <p className="text-xs text-gray-500">
                    Lấy mã từ tab "Quét NFC" trên máy tính
                  </p>
                </div>
              </div>

              <input
                ref={codeRef}
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setConnectStatus("idle");
                  setMessage("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="VD: AB12CD"
                className="w-full text-center text-3xl font-bold tracking-[0.4em] py-4 rounded-2xl outline-none border-2 transition-all"
                style={{
                  color: "#3b491e",
                  borderColor:
                    connectStatus === "ok"
                      ? "#22c55e"
                      : connectStatus === "error"
                        ? "#ef4444"
                        : "#edf4dc",
                  background: "#f8fae8",
                }}
              />

              {message && (
                <p className="text-sm text-red-500 text-center">{message}</p>
              )}

              {connectStatus === "ok" && (
                <div className="flex items-center justify-center gap-2 text-green-600 font-medium text-sm">
                  <CheckCircle2 size={16} />
                  Kết nối thành công!
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={code.length < 4 || connectStatus === "loading"}
                className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: "#748c2c" }}
              >
                {connectStatus === "loading" ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Đang kết
                    nối...
                  </>
                ) : (
                  <>
                    <Wifi size={18} /> Kết nối
                  </>
                )}
              </button>
            </>
          )}

          {/* ── Step 2: NFC Scan ── */}
          {step === "scan" && (
            <>
              <div className="text-center space-y-1">
                <p className="font-semibold" style={{ color: "#3b491e" }}>
                  Quét NFC CCCD gắn chip
                </p>
                <p className="text-xs text-gray-500">
                  Áp mặt sau điện thoại vào mặt sau của CCCD
                </p>
              </div>

              {/* NFC animation */}
              <div className="flex justify-center py-4">
                <div className="relative">
                  <div
                    className="w-32 h-32 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        nfcState === "scanning" ? "#f0f5e0" : "#f8fae8",
                    }}
                  >
                    {nfcState === "scanning" ? (
                      <Loader2
                        size={56}
                        className="animate-spin"
                        style={{ color: "#748c2c" }}
                      />
                    ) : (
                      <Nfc size={56} style={{ color: "#748c2c" }} />
                    )}
                  </div>
                  {nfcState === "scanning" && (
                    <>
                      <div
                        className="absolute inset-0 rounded-full animate-ping opacity-20"
                        style={{ background: "#748c2c" }}
                      />
                      <div
                        className="absolute -inset-4 rounded-full animate-ping opacity-10 animation-delay-300"
                        style={{ background: "#748c2c" }}
                      />
                    </>
                  )}
                </div>
              </div>

              {message && (
                <p className="text-sm text-center text-gray-600">{message}</p>
              )}

              {nfcState === "idle" && (
                <button
                  onClick={handleStartNfc}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
                  style={{ background: "#748c2c" }}
                >
                  <Nfc size={18} />
                  Bắt đầu quét NFC
                </button>
              )}

              {nfcState === "error" && (
                <div className="space-y-3">
                  <button
                    onClick={handleStartNfc}
                    className="w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all border bg-white"
                    style={{ borderColor: "#edf4dc", color: "#748c2c" }}
                  >
                    <RefreshCw size={18} />
                    Thử lại
                  </button>
                  <button
                    onClick={runSimulation}
                    className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
                    style={{ background: "#93a83e" }}
                  >
                    🚀 Chạy mô phỏng (Bỏ qua NFC)
                  </button>
                </div>
              )}

              <p
                className="text-xs text-center px-2 mt-4"
                style={{ color: "#93a83e" }}
              >
                💡 Chức năng tương thích tốt nhất trên trình duyệt Google Chrome
                (Android). Nếu bị chặn, hãy dùng nút Mô phỏng.
              </p>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === "done" && (
            <div className="text-center space-y-5 py-4">
              <div className="flex justify-center">
                <CheckCircle2 size={64} style={{ color: "#748c2c" }} />
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: "#3b491e" }}>
                  Hoàn thành!
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Dữ liệu CCCD đã được gửi về máy tính.
                  <br />
                  Kiểm tra màn hình PC để xem kết quả.
                </p>
              </div>
              <button
                onClick={() => {
                  setStep("input");
                  setCode("");
                  setNfcState("idle");
                  setConnectStatus("idle");
                  setMessage("");
                }}
                className="w-full py-3 rounded-2xl font-medium text-sm border transition-all"
                style={{ borderColor: "#edf4dc", color: "#748c2c" }}
              >
                Quét lần khác
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: "#93a83e" }}>
        Hệ thống Quản lý Nghĩa vụ Quân sự
      </p>
    </div>
  );
}
