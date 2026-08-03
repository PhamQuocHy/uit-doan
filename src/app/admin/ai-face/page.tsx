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

type NfcStatus = "idle" | "waiting" | "connected" | "completed";

type NfcResult = {
  found: boolean;
  citizen?: Record<string, string>;
  prefill?: Record<string, string>;
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
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (code: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/nfc/session?code=${code}`);
          if (!res.ok) {
            stopPolling();
            setNfcStatus("idle");
            return;
          }
          const data = await res.json();
          if (data.status === "connected") setNfcStatus("connected");
          if (data.status === "completed" && data.result) {
            stopPolling();
            setNfcStatus("completed");
            setNfcResult(data.result);
          }
        } catch {
          // ignore
        }
      }, 2000);
    },
    [stopPolling],
  );

  const generateSession = useCallback(async () => {
    stopPolling();
    setNfcStatus("waiting");
    setNfcResult(null);
    try {
      const res = await fetch("/api/nfc/session", { method: "POST" });
      const data = await res.json();
      setNfcCode(data.code);
      startPolling(data.code);
    } catch {
      setNfcStatus("idle");
    }
  }, [startPolling, stopPolling]);

  useEffect(() => {
    if (activeTab === "nfc" && nfcStatus === "idle") generateSession();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const copyCode = () => {
    navigator.clipboard.writeText(nfcCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [mobileUrl, setMobileUrl] = useState("/mobile/nfc");

  useEffect(() => {
    setMobileUrl(`${window.location.origin}/mobile/nfc`);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
          Nhận dạng AI
        </h1>
        <p className="text-sm mt-1" style={{ color: "#007aff" }}>
          Nhận dạng khuôn mặt và quét NFC CCCD gắn chip qua điện thoại
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "#f0f4e4" }}
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
                ? "bg-white shadow-sm text-olive-800"
                : "text-gray-500 hover:text-gray-700"
            }`}
            style={
              activeTab === id
                ? { color: "#1d1d1f", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
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
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#f5f5f7" }}
              >
                <ScanFace size={20} style={{ color: "#007aff" }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">
                  Tải ảnh khuôn mặt
                </h2>
                <p className="text-xs text-gray-500">Hỗ trợ JPG, PNG, WEBP</p>
              </div>
            </div>

            <div
              className="border-2 border-dashed border-[#e5e5ea] rounded-xl p-6 text-center cursor-pointer hover:border-[#007aff] transition-colors"
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
                  <Camera size={40} className="mx-auto text-gray-300" />
                  <p className="text-sm text-gray-500">
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
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#007aff] hover:bg-[#636366] disabled:opacity-50 text-white rounded-xl transition-colors font-medium text-sm"
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
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors text-sm"
                >
                  Xóa
                </button>
              )}
            </div>

            <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
              <p className="text-xs text-[#636366]">
                <span className="font-semibold">Lưu ý:</span> Ảnh cần rõ mặt, đủ
                ánh sáng, không bị che khuất để đạt độ chính xác cao nhất.
              </p>
            </div>
          </div>

          {/* Result Panel */}
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Kết quả nhận dạng
            </h2>

            {!result && !isScanning && (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 space-y-2">
                <ScanFace size={40} className="opacity-30" />
                <p className="text-sm">
                  Chưa có kết quả. Tải ảnh và nhấn nhận dạng.
                </p>
              </div>
            )}

            {isScanning && (
              <div className="h-48 flex flex-col items-center justify-center space-y-3">
                <RefreshCw size={36} className="text-[#007aff] animate-spin" />
                <p className="text-sm text-gray-500">
                  Đang phân tích khuôn mặt...
                </p>
              </div>
            )}

            {result && !isScanning && (
              <div className="space-y-4">
                <div
                  className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium"
                  style={{
                    background: result.matched ? "#d1fae5" : "#fee2e2",
                    color: result.matched ? "#059669" : "#dc2626",
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
                      className="flex justify-between items-start gap-3 py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm text-gray-500 shrink-0">
                        {item.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900 text-right">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
                <button className="w-full py-2 border border-[#e5e5ea] text-[#007aff] hover:bg-[#f5f5f7] rounded-xl text-sm font-medium transition-colors">
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
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#f5f5f7" }}
              >
                <Smartphone size={20} style={{ color: "#007aff" }} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">
                  Kết nối điện thoại
                </h2>
                <p className="text-xs text-gray-500">
                  Mở trang Mobile trên điện thoại và nhập mã bên dưới
                </p>
              </div>
            </div>

            {/* Status indicator */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background:
                  nfcStatus === "completed"
                    ? "#d1fae5"
                    : nfcStatus === "connected"
                      ? "#dbeafe"
                      : nfcStatus === "waiting"
                        ? "#fef9c3"
                        : "#f3f4f6",
                color:
                  nfcStatus === "completed"
                    ? "#059669"
                    : nfcStatus === "connected"
                      ? "#2563eb"
                      : nfcStatus === "waiting"
                        ? "#92400e"
                        : "#6b7280",
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
                  <Wifi size={14} /> Điện thoại đã kết nối – Đang chờ quét
                  NFC...
                </>
              )}
              {nfcStatus === "completed" && (
                <>
                  <CheckCircle2 size={14} /> Đã nhận dữ liệu NFC thành công!
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
                <p className="text-xs text-gray-500">Mã kết nối</p>
                <div
                  className="text-5xl font-bold tracking-[0.3em] py-4 rounded-2xl"
                  style={{ color: "#1d1d1f", background: "#f5f5f7" }}
                >
                  {nfcCode}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyCode}
                    className="flex-1 flex items-center justify-center gap-2 py-2 border border-[#e5e5ea] text-[#007aff] hover:bg-[#f5f5f7] rounded-xl text-sm transition-colors"
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
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-[#e5e5ea] text-[#007aff] hover:bg-[#f5f5f7] rounded-xl text-sm transition-colors"
                  >
                    <RefreshCw size={14} />
                    Tạo mã mới
                  </button>
                </div>
              </div>
            )}

            {/* Mobile link */}
            <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-[#636366]">
                  Trang quét NFC (điện thoại)
                </p>
                <button
                  onClick={() => window.open(mobileUrl, "_blank")}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-[#e5e5ea] text-[#007aff] transition-colors"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Result panel */}
          <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Kết quả NFC</h2>

            {!nfcResult && (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 space-y-3">
                <NfcIcon size={48} className="opacity-20" />
                <p className="text-sm text-center">
                  Kết nối điện thoại và quét CCCD gắn chip
                  <br />
                  để kết quả hiển thị tại đây
                </p>
              </div>
            )}

            {nfcResult && nfcResult.found && nfcResult.citizen && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium bg-green-50 text-green-700">
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
                      className="flex justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm text-gray-500 shrink-0">
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
                    className="flex-1 py-2 bg-[#007aff] hover:bg-[#636366] text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    Hồ sơ sức khỏe
                  </button>
                  <button
                    onClick={() =>
                      router.push(
                        `/admin/citizens?cccd=${nfcResult.citizen?.cccd}`,
                      )
                    }
                    className="flex-1 py-2 border border-[#e5e5ea] text-[#007aff] hover:bg-[#f5f5f7] rounded-xl text-sm font-medium transition-colors"
                  >
                    Thông tin chi tiết
                  </button>
                </div>
              </div>
            )}

            {nfcResult && !nfcResult.found && nfcResult.prefill && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium bg-amber-50 text-amber-700">
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
                      className="flex justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm text-gray-500 shrink-0">
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
                  className="w-full py-2 bg-[#007aff] hover:bg-[#636366] text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
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
