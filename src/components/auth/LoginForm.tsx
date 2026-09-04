"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  User,
  Lock,
  ArrowLeft,
  Building2,
  MapPin,
  Package,
  Stethoscope,
} from "lucide-react";
import Image from "next/image";
import logoQd from "@/assets/images/logo_qd.png";
import bg1 from "@/assets/images/bg1.png";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { M3ThemeProvider } from "@/components/m3";
import type { FunctionalRole } from "@/lib/functional-roles";
import {
  LOGIN_PORTAL_OPTIONS,
  portalNeedsUnitStep,
  resolveLoginContext,
  type LoginPortal,
} from "@/lib/login-portals";

const PORTAL_ICONS: Record<LoginPortal, typeof Building2> = {
  cap_bo: Building2,
  dia_phuong: MapPin,
  don_vi_nhan_quan: Package,
  can_bo_y_te: Stethoscope,
};

export default function LoginForm() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loginPortal, setLoginPortal] = useState<LoginPortal | "">("");
  const [localLevel, setLocalLevel] = useState<"tinh" | "xa">("tinh");
  const [tinhCode, setTinhCode] = useState("");
  const [xaCode, setXaCode] = useState("");
  const [donviCode, setDonviCode] = useState("");

  const [units, setUnits] = useState<any[]>([]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/units")
      .then((res) => res.json())
      .then((data) => setUnits(data))
      .catch(console.error);
  }, []);

  const handlePortalStep = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginPortal) {
      setError("Vui lòng chọn loại đăng nhập");
      return;
    }
    if (loginPortal === "cap_bo") {
      setStep(3);
      return;
    }
    setTinhCode("");
    setXaCode("");
    setDonviCode("");
    setLocalLevel("tinh");
    setStep(2);
  };

  const handleUnitStep = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginPortal) return;

    if (loginPortal === "don_vi_nhan_quan" && !donviCode) {
      setError("Vui lòng chọn Đơn vị nhận quân");
      return;
    }
    if (loginPortal === "can_bo_y_te" || loginPortal === "dia_phuong") {
      if (!tinhCode) {
        setError("Vui lòng chọn Tỉnh/Thành phố");
        return;
      }
      if (localLevel === "xa" && !xaCode) {
        setError("Vui lòng chọn Phường/Xã");
        return;
      }
    }
    setStep(3);
  };

  const goBack = () => {
    setError("");
    setStep((s) => {
      if (s === 3) {
        return loginPortal && portalNeedsUnitStep(loginPortal) ? 2 : 1;
      }
      if (s === 2) return 1;
      return s;
    });
  };

  const getLoginPayload = () => {
    if (!loginPortal) {
      return { unitCode: "", functionalRole: "tuyen_quan" as FunctionalRole };
    }
    const ctx = resolveLoginContext({
      portal: loginPortal,
      localLevel,
      tinhCode,
      xaCode,
      donviCode,
    });
    return {
      unitCode: ctx.unitCode,
      functionalRole: ctx.functionalRole,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { unitCode, functionalRole } = getLoginPayload();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          unitCode,
          functionalRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đăng nhập thất bại");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const stepSubtitle =
    step === 1
      ? "Chọn đơn vị đăng nhập"
      : step === 2
        ? "Chọn đơn vị quản lý"
        : "Đăng nhập tài khoản của bạn";

  const cardMaxWidth =
    step === 1 ? "max-w-[920px]" : "max-w-[500px]";

  return (
    <M3ThemeProvider
      mode="light"
      primary="#1a73e8"
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-m3-surface-lowest"
    >
      <div className="absolute inset-0 z-0">
        <Image
          src={bg1}
          alt="Background"
          fill
          className="object-cover opacity-5"
          quality={100}
          priority
        />
      </div>

      <div
        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-30 pointer-events-none blur-3xl"
        style={{ background: "var(--m3-outline-variant, #e3e8ee)" }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-30 pointer-events-none blur-3xl"
        style={{ background: "var(--m3-tertiary-container, #e4e8f2)" }}
      />

      <div className={`relative w-full px-4 z-10 transition-all ${cardMaxWidth}`}>
        <div
          className="rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10"
          style={{
            background: "var(--m3-surface-container-lowest, var(--m3-surface-container-lowest, #ffffff))",
            border: "1px solid var(--m3-outline-variant, #e3e8ee)",
          }}
        >
          <div className="px-8 py-8 md:py-10 pb-5! text-center flex flex-col items-center relative">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="absolute left-6 top-8 p-2 rounded-full hover:bg-m3-surface-container transition-colors"
                style={{ color: "var(--m3-primary, #1a73e8)" }}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex items-center justify-center mb-4 bg-transparent">
              <Image
                src={logoQd}
                alt="Logo Quân Đội"
                width={100}
                height={100}
                quality={100}
                unoptimized
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-normal" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
              Hệ thống Quản lý Nghĩa vụ Quân sự
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--m3-primary, #1a73e8)" }}>
              {stepSubtitle}
            </p>
          </div>

          <div className="px-8 pb-8">
            {error && (
              <div
                className="mb-6 flex items-center gap-3 text-sm px-4 py-3 rounded-xl"
                style={{
                  background: "var(--m3-error-container, var(--m3-error-container, #ffdad6))",
                  border: "1px solid var(--m3-error-container, #ffdad6)",
                  color: "var(--m3-error, #ba1a1a)",
                }}
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            )}

            {step === 1 ? (
              <form
                onSubmit={handlePortalStep}
                className="animate-in fade-in duration-300"
              >
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                  {LOGIN_PORTAL_OPTIONS.map((opt) => {
                    const selected = loginPortal === opt.value;
                    const Icon = PORTAL_ICONS[opt.value];
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLoginPortal(opt.value)}
                        className="flex min-h-[148px] flex-col items-center justify-center rounded-2xl border px-2 py-4 text-center transition-all sm:min-h-[168px] sm:px-3"
                        style={{
                          borderColor: selected ? "var(--m3-primary, #1a73e8)" : "var(--m3-outline-variant, #e3e8ee)",
                          background: selected
                            ? "color-mix(in srgb, var(--m3-primary, #1a73e8) 6%, transparent)"
                            : "#fff",
                          boxShadow: selected
                            ? "0 4px 14px color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)"
                            : "none",
                        }}
                      >
                        <div
                          className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full sm:mb-3 sm:h-12 sm:w-12"
                          style={{
                            background: selected
                              ? "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)"
                              : "var(--m3-surface-container-high, #eef1f4)",
                            color: selected ? "var(--m3-primary, #1a73e8)" : "var(--m3-on-surface-variant, #475569)",
                          }}
                        >
                          <Icon size={22} strokeWidth={1.75} />
                        </div>
                        <p
                          className="text-[13px] font-semibold leading-tight sm:text-[14px]"
                          style={{ color: selected ? "var(--m3-primary, #1a73e8)" : "var(--m3-on-surface, #1b1d20)" }}
                        >
                          {opt.label}
                        </p>
                        <p className="mt-1.5 hidden text-[10px] leading-snug text-m3-on-surface-variant sm:block sm:text-[11px]">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  className="w-full mt-5 py-3 rounded-xl font-normal text-lg transition-all text-white"
                  style={{
                    background: "var(--m3-primary, #1a73e8)",
                    boxShadow: "0 4px 10px color-mix(in srgb, var(--m3-primary, #1a73e8) 20%, transparent)",
                  }}
                >
                  Tiếp tục
                </button>
              </form>
            ) : step === 2 ? (
              <form
                onSubmit={handleUnitStep}
                className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300"
              >
                {(loginPortal === "dia_phuong" ||
                  loginPortal === "can_bo_y_te") && (
                  <SearchableSelect
                    label="Cấp đơn vị"
                    placeholder="-- Chọn cấp --"
                    value={localLevel}
                    onChange={(val) => {
                      setLocalLevel(val as "tinh" | "xa");
                      setXaCode("");
                    }}
                    options={[
                      { value: "tinh", label: "Cấp Tỉnh/Thành phố" },
                      { value: "xa", label: "Cấp Phường/Xã" },
                    ]}
                  />
                )}

                {(loginPortal === "dia_phuong" ||
                  loginPortal === "can_bo_y_te") && (
                  <SearchableSelect
                    label="Tỉnh/Thành phố"
                    placeholder="-- Chọn Tỉnh/Thành phố --"
                    value={tinhCode}
                    onChange={(val) => {
                      setTinhCode(val);
                      setXaCode("");
                    }}
                    options={units
                      .filter((u) => u.level === "tinh")
                      .map((u) => ({ value: u.code, label: u.name }))}
                  />
                )}

                {(loginPortal === "dia_phuong" ||
                  loginPortal === "can_bo_y_te") &&
                  localLevel === "xa" &&
                  tinhCode && (
                    <SearchableSelect
                      label="Phường/Xã"
                      placeholder="-- Chọn Phường/Xã --"
                      value={xaCode}
                      onChange={(val) => setXaCode(val)}
                      options={units
                        .filter(
                          (u) => u.level === "xa" && u.parentCode === tinhCode,
                        )
                        .map((u) => ({ value: u.code, label: u.name }))}
                    />
                  )}

                {loginPortal === "don_vi_nhan_quan" && (
                  <SearchableSelect
                    label="Đơn vị nhận quân"
                    placeholder="-- Chọn Đơn vị nhận quân --"
                    value={donviCode}
                    onChange={(val) => setDonviCode(val)}
                    options={units
                      .filter((u) => u.level === "donvi")
                      .map((u) => ({ value: u.code, label: u.name }))}
                  />
                )}

                <button
                  type="submit"
                  className="w-full mt-4 py-3 rounded-xl font-normal text-lg transition-all text-white"
                  style={{
                    background: "var(--m3-primary, #1a73e8)",
                    boxShadow: "0 4px 10px color-mix(in srgb, var(--m3-primary, #1a73e8) 20%, transparent)",
                  }}
                >
                  Tiếp tục
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300"
              >
                <div className="relative mt-2">
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="peer w-full pl-11 pr-4 py-4 text-[16px] rounded-xl transition-all outline-none placeholder-transparent focus:placeholder-gray-400"
                    placeholder="Nhập tên đăng nhập"
                    required
                    autoComplete="username"
                    style={{
                      background: "#fff",
                      border: "1.5px solid var(--m3-outline-variant, #e3e8ee)",
                      color: "var(--m3-on-surface, #1b1d20)",
                    }}
                  />
                  <label
                    htmlFor="username"
                    className="absolute left-10 px-1 text-m3-on-surface-variant transition-all duration-200 cursor-text
                               top-0 -translate-y-1/2 text-[15px] font-normal bg-m3-surface-lowest
                               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[16px] peer-placeholder-shown:bg-transparent
                               peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[15px] peer-focus:bg-m3-surface-lowest peer-focus:text-m3-primary"
                  >
                    Tài khoản
                  </label>
                  <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--m3-on-surface-variant, #475569)", zIndex: 10 }}
                  >
                    <User size={18} />
                  </div>
                </div>

                <div className="relative mt-5">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="peer w-full pl-11 pr-12 py-4 text-[16px] rounded-xl transition-all outline-none placeholder-transparent focus:placeholder-gray-400"
                    placeholder="Nhập mật khẩu"
                    required
                    autoComplete="current-password"
                    style={{
                      background: "#fff",
                      border: "1.5px solid var(--m3-outline-variant, #e3e8ee)",
                      color: "var(--m3-on-surface, #1b1d20)",
                    }}
                  />
                  <label
                    htmlFor="password"
                    className="absolute left-10 px-1 text-m3-on-surface-variant transition-all duration-200 cursor-text
                               top-0 -translate-y-1/2 text-[15px] font-normal bg-m3-surface-lowest
                               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[16px] peer-placeholder-shown:bg-transparent
                               peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[15px] peer-focus:bg-m3-surface-lowest peer-focus:text-m3-primary"
                  >
                    Mật khẩu
                  </label>
                  <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--m3-on-surface-variant, #475569)", zIndex: 10 }}
                  >
                    <Lock size={18} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors p-1.5 rounded-lg hover:bg-m3-surface-high z-10"
                    style={{ color: "var(--m3-on-surface-variant, #475569)" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="flex justify-start mt-5">
                  <button
                    type="button"
                    className="text-[15px] hover:underline transition-all"
                    style={{ color: "var(--m3-primary, #1a73e8)" }}
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1 py-3 rounded-xl font-normal text-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-white"
                  style={{
                    background: loading ? "var(--m3-on-surface-variant, #475569)" : "var(--m3-primary, #1a73e8)",
                    boxShadow: "0 4px 10px color-mix(in srgb, var(--m3-primary, #1a73e8) 20%, transparent)",
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Đang xử lý...
                    </span>
                  ) : (
                    "Đăng nhập hệ thống"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <p
          className="text-center text-[16px] mt-6 font-normal"
          style={{ color: "var(--m3-on-surface-variant, #475569)" }}
        >
          Coppyright © 2026 Ban Chỉ huy Quân sự
        </p>
      </div>
    </M3ThemeProvider>
  );
}
