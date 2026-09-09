"use client";

import { FormEvent, useState } from "react";
import { Search, Shield } from "lucide-react";

type LookupResult = {
  fullName: string;
  cccd: string;
  dateOfBirth: string;
  receivingUnitName: string;
  managingUnitName: string;
  healthResult: string;
  statusLabel: string;
};

export default function TraCuuPage() {
  const [cccd, setCccd] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotFound(null);
    setResult(null);
    try {
      const params = new URLSearchParams({
        cccd: cccd.trim(),
        fullName: fullName.trim(),
      });
      const res = await fetch(`/api/public/tra-cuu?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Không tra cứu được");
        return;
      }
      if (!data.found) {
        setNotFound(data.message || "Không tìm thấy");
        return;
      }
      setResult(data.data);
    } catch {
      setError("Lỗi kết nối. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen px-4 py-10"
      style={{
        background:
          "radial-gradient(1200px 600px at 10% -10%, #dce9f8 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #e8f0e4 0%, transparent 50%), #f5f7fa",
      }}
    >
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a3a2a] text-white shadow-lg">
            <Shield size={22} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1b1d20]">
            Tra cứu danh sách nhận quân
          </h1>
          <p className="mt-2 text-sm text-[#5f6368]">
            Nhập CCCD và họ tên đúng như trên hồ sơ để xem đơn vị nhận quân đã
            được công bố.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
        >
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#5f6368]">
              Số CCCD
            </span>
            <input
              value={cccd}
              onChange={(e) => setCccd(e.target.value.replace(/\D/g, "").slice(0, 12))}
              inputMode="numeric"
              placeholder="012345678901"
              className="h-11 w-full rounded-xl border border-black/[0.1] px-3.5 text-[15px] outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
              required
            />
          </label>
          <label className="mb-5 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#5f6368]">
              Họ và tên
            </span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="h-11 w-full rounded-xl border border-black/[0.1] px-3.5 text-[15px] outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1a3a2a] text-[14px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Search size={16} />
            {loading ? "Đang tra cứu…" : "Tra cứu"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notFound && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {notFound}
          </p>
        )}
        {result && (
          <div className="mt-4 space-y-3 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-emerald-700">
              {result.statusLabel}
            </p>
            <div>
              <p className="text-xl font-bold text-[#1b1d20]">{result.fullName}</p>
              <p className="mt-0.5 font-mono text-sm text-[#5f6368]">{result.cccd}</p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[#5f6368]">Ngày sinh</dt>
                <dd className="font-semibold text-[#1b1d20]">
                  {result.dateOfBirth
                    ? new Date(result.dateOfBirth).toLocaleDateString("vi-VN")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[#5f6368]">Sức khỏe</dt>
                <dd className="font-semibold text-[#1b1d20]">{result.healthResult}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[#5f6368]">Đơn vị nhận quân</dt>
                <dd className="text-base font-bold text-[#1a3a2a]">
                  {result.receivingUnitName}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[#5f6368]">Đơn vị quản lý</dt>
                <dd className="font-semibold text-[#1b1d20]">
                  {result.managingUnitName}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
