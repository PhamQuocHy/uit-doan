"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CreditCard, Search, User } from "lucide-react";
import logoQd from "@/assets/images/logo_qd.png";

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
    <div className="relative flex min-h-screen flex-col bg-[#f7f9fc]">
      {/* Watermark chỉ vùng giữa */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[80px] bottom-[56px] opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%231a73e8' stroke-width='1.2'%3E%3Cpath d='M40 28h20v10H40zM36 38h28v36H36z'/%3E%3Cpath d='M44 48h12M44 56h12M44 64h8'/%3E%3Ccircle cx='118' cy='48' r='14'/%3E%3Cpath d='M112 48h12M118 42v12'/%3E%3Cpath d='M30 118l18-10 18 10v22H30z'/%3E%3Cpath d='M100 110h36v28h-36z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "160px 160px",
        }}
      />

      <header className="relative z-10 w-full border-b border-black/[0.04] bg-white">
        <div className="mx-auto flex h-[80px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/tra-cuu" className="flex min-w-0 items-center gap-3">
            <Image
              src={logoQd}
              alt="Logo Quân đội"
              width={56}
              height={56}
              className="h-12 w-12 object-contain sm:h-14 sm:w-14"
              priority
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[15px] font-bold uppercase tracking-wide text-[#c62828] sm:text-[17px]">
                Hệ thống Quản lý
              </p>
              <p className="truncate text-[15px] font-bold uppercase tracking-wide text-[#1b5e20] sm:text-[17px]">
                Nghĩa vụ Quân sự
              </p>
            </div>
          </Link>

          <a
            href="#lien-he"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#2f6bff] px-6 text-[16px] font-semibold text-white shadow-[0_4px_12px_rgba(47,107,255,0.28)] transition hover:bg-[#2559d9] sm:h-12 sm:px-7 sm:text-[17px]"
          >
            Liên hệ
          </a>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-4 pb-10 pt-10 sm:pt-16">
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="mx-auto w-full max-w-5xl">
          <h1 className="mb-8 text-center text-[28px] font-semibold tracking-tight text-[#1a2744] sm:mb-10 sm:text-[34px]">
            Tra cứu thông tin thanh niên
          </h1>

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <label className="relative block min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-[#9aa3b2]">
                <CreditCard size={20} strokeWidth={1.75} />
              </span>
              <input
                value={cccd}
                onChange={(e) =>
                  setCccd(e.target.value.replace(/\D/g, "").slice(0, 12))
                }
                inputMode="numeric"
                placeholder="Số CCCD"
                aria-label="Số CCCD"
                className="h-14 w-full rounded-full bg-[#eef1f5] py-3 pr-5 pl-12 text-[17px] text-[#1a2744] outline-none placeholder:text-[#9aa3b2] focus:ring-2 focus:ring-[#2f6bff]/25"
                required
              />
            </label>

            <label className="relative block min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-[#9aa3b2]">
                <User size={20} strokeWidth={1.75} />
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Họ và tên"
                aria-label="Họ và tên"
                className="h-14 w-full rounded-full bg-[#eef1f5] py-3 pr-5 pl-12 text-[17px] text-[#1a2744] outline-none placeholder:text-[#9aa3b2] focus:ring-2 focus:ring-[#2f6bff]/25"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              aria-label={loading ? "Đang tra cứu" : "Tra cứu"}
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center self-center rounded-full bg-[#2f6bff] text-white shadow-[0_6px_16px_rgba(47,107,255,0.35)] transition hover:bg-[#2559d9] disabled:opacity-50 sm:self-auto"
            >
              <Search size={22} strokeWidth={2.25} />
            </button>
          </form>

          <p
            id="lien-he"
            className="mt-6 scroll-mt-24 text-center text-[16px] text-[#6b7280] sm:text-[17px]"
          >
            Không tìm thấy thông tin thanh niên?{" "}
            <a
              href="#lien-he"
              className="font-medium text-[#2f6bff] underline underline-offset-2 hover:text-[#2559d9]"
            >
              Liên hệ ngay
            </a>
            .
          </p>

          {error && (
            <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700">
              {error}
            </p>
          )}
          {notFound && (
            <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
              {notFound}
            </p>
          )}
          {result && (
            <div className="mt-6 space-y-3 rounded-3xl border border-emerald-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-emerald-700 sm:text-[14px]">
                {result.statusLabel}
              </p>
              <div>
                <p className="text-[22px] font-bold text-[#1b1d20] sm:text-[24px]">
                  {result.fullName}
                </p>
                <p className="mt-0.5 font-mono text-[15px] text-[#5f6368] sm:text-[16px]">
                  {result.cccd}
                </p>
              </div>
              <dl className="grid gap-3 text-[15px] sm:grid-cols-2 sm:text-[16px]">
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
                  <dd className="font-semibold text-[#1b1d20]">
                    {result.healthResult}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[#5f6368]">Đơn vị nhận quân</dt>
                  <dd className="text-[17px] font-bold text-[#1a3a2a] sm:text-[18px]">
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
      </main>

      <footer className="relative z-10 mt-auto w-full border-t border-black/[0.06] bg-white">
        <div className="mx-auto flex min-h-[56px] w-full max-w-[1440px] items-center justify-center px-4 py-4 text-center text-[14px] text-[#8b93a1] sm:px-8 sm:text-[15px]">
          © 2026 Ban Chỉ huy Quân sự. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
