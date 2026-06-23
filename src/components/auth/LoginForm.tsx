"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, User, Lock, ArrowLeft } from "lucide-react";
import Image from "next/image";
import logoQd from "@/assets/images/logo_qd.png";
import bg1 from "@/assets/images/bg1.png";
import SearchableSelect from "@/components/ui/SearchableSelect";

const DONVI_OPTIONS = [{ code: "donvi-1", name: "Sư đoàn 5 – Quân khu 7" }];

export default function LoginForm() {
  const router = useRouter();

  // States for Step 1 (Unit Selection)
  const [step, setStep] = useState<1 | 2>(1);
  const [hierarchyLevel, setHierarchyLevel] = useState("");
  const [tinhCode, setTinhCode] = useState("");
  const [huyenCode, setHuyenCode] = useState("");
  const [xaCode, setXaCode] = useState("");
  const [donviCode, setDonviCode] = useState("");

  const [units, setUnits] = useState<any[]>([]);

  // States for Step 2 (Credentials)
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

  const handleNextStep = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!hierarchyLevel) {
      setError("Vui lòng chọn cấp đơn vị");
      return;
    }
    if (hierarchyLevel === "tinh" && !tinhCode) {
      setError("Vui lòng chọn Tỉnh/Thành phố");
      return;
    }
    if (hierarchyLevel === "huyen" && (!tinhCode || !huyenCode)) {
      setError("Vui lòng chọn Tỉnh và Quận/Huyện");
      return;
    }
    if (hierarchyLevel === "xa" && (!tinhCode || !huyenCode || !xaCode)) {
      setError("Vui lòng chọn đầy đủ Tỉnh, Huyện, Xã");
      return;
    }
    if (hierarchyLevel === "donvi" && !donviCode) {
      setError("Vui lòng chọn Đơn vị nhận quân");
      return;
    }
    setStep(2);
  };

  const getSelectedUnitCode = () => {
    switch (hierarchyLevel) {
      case "bo":
        return "bo";
      case "tinh":
        return tinhCode;
      case "huyen":
        return huyenCode;
      case "xa":
        return xaCode;
      case "donvi":
        return donviCode;
      default:
        return "";
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const selectedUnitCode = getSelectedUnitCode();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          unitCode: selectedUnitCode,
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

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white">
      {/* Background Image Layer */}
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
        style={{ background: "#c5d38c" }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-30 pointer-events-none blur-3xl"
        style={{ background: "#eedeba" }}
      />

      <div className="relative w-full max-w-[500px] px-4 z-10 transition-all">
        <div
          className="rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10"
          style={{
            background: "#ffffff",
            border: "1px solid #edf4dc",
          }}
        >
          {/* Header banner */}
          <div className="px-8 py-8 md:py-10 pb-5! text-center flex flex-col items-center relative">
            {step === 2 && (
              <button
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                className="absolute left-6 top-8 p-2 rounded-full hover:bg-gray-100 transition-colors"
                style={{ color: "#748c2c" }}
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
            <h1 className="text-2xl font-normal" style={{ color: "#3b491e" }}>
              Hệ thống Quản lý Nghĩa vụ Quân sự
            </h1>
            <p className="mt-2 text-sm" style={{ color: "#748c2c" }}>
              {step === 1
                ? "Vui lòng chọn cấp đơn vị để tiếp tục"
                : "Đăng nhập tài khoản của bạn"}
            </p>
          </div>

          <div className="px-8 pb-8">
            {error && (
              <div
                className="mb-6 flex items-center gap-3 text-sm px-4 py-3 rounded-xl"
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
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
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="space-y-1">
                  <SearchableSelect
                    label="Cấp đơn vị"
                    placeholder="-- Chọn cấp đơn vị --"
                    value={hierarchyLevel}
                    onChange={(val) => {
                      setHierarchyLevel(val);
                      setTinhCode("");
                      setHuyenCode("");
                      setXaCode("");
                      setDonviCode("");
                    }}
                    options={[
                      { value: "bo", label: "Bộ Quốc phòng" },
                      { value: "tinh", label: "Cấp Tỉnh/Thành phố" },
                      { value: "huyen", label: "Cấp Quận/Huyện" },
                      { value: "xa", label: "Cấp Phường/Xã" },
                      { value: "donvi", label: "Đơn vị nhận quân" },
                    ]}
                  />
                </div>

                {(hierarchyLevel === "tinh" ||
                  hierarchyLevel === "huyen" ||
                  hierarchyLevel === "xa") && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                    <SearchableSelect
                      label="Tỉnh/Thành phố"
                      placeholder="-- Chọn Tỉnh/Thành phố --"
                      value={tinhCode}
                      onChange={(val) => {
                        setTinhCode(val);
                        setHuyenCode("");
                        setXaCode("");
                      }}
                      options={units
                        .filter((u) => u.level === "tinh")
                        .map((u) => ({ value: u.code, label: u.name }))}
                    />
                  </div>
                )}

                {(hierarchyLevel === "huyen" || hierarchyLevel === "xa") &&
                  tinhCode && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                      <SearchableSelect
                        label="Quận/Huyện"
                        placeholder="-- Chọn Quận/Huyện --"
                        value={huyenCode}
                        onChange={(val) => {
                          setHuyenCode(val);
                          setXaCode("");
                        }}
                        options={units
                          .filter(
                            (u) =>
                              u.level === "huyen" && u.parentCode === tinhCode,
                          )
                          .map((u) => ({ value: u.code, label: u.name }))}
                      />
                    </div>
                  )}

                {hierarchyLevel === "xa" && huyenCode && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                    <SearchableSelect
                      label="Phường/Xã"
                      placeholder="-- Chọn Phường/Xã --"
                      value={xaCode}
                      onChange={(val) => setXaCode(val)}
                      options={units
                        .filter(
                          (u) => u.level === "xa" && u.parentCode === huyenCode,
                        )
                        .map((u) => ({ value: u.code, label: u.name }))}
                    />
                  </div>
                )}

                {hierarchyLevel === "donvi" && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                    <SearchableSelect
                      label="Đơn vị nhận quân"
                      placeholder="-- Chọn Đơn vị nhận quân --"
                      value={donviCode}
                      onChange={(val) => setDonviCode(val)}
                      options={DONVI_OPTIONS.map((u) => ({
                        value: u.code,
                        label: u.name,
                      }))}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full mt-4 py-3 rounded-xl font-normal text-lg transition-all text-white"
                  style={{
                    background: "#748c2c",
                    boxShadow: "0 4px 10px rgba(116,140,44,0.2)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#586c23")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#748c2c")
                  }
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
                      border: "1.5px solid #edf4dc",
                      color: "#3b491e",
                    }}
                  />
                  <label
                    htmlFor="username"
                    className="absolute left-10 px-1 text-gray-500 transition-all duration-200 cursor-text
                               top-0 -translate-y-1/2 text-[15px] font-normal bg-white
                               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[16px] peer-placeholder-shown:bg-transparent
                               peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[15px] peer-focus:bg-white peer-focus:text-[#748c2c]"
                  >
                    Tài khoản
                  </label>
                  <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "#93a83e", zIndex: 10 }}
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
                      border: "1.5px solid #edf4dc",
                      color: "#3b491e",
                    }}
                  />
                  <label
                    htmlFor="password"
                    className="absolute left-10 px-1 text-gray-500 transition-all duration-200 cursor-text
                               top-0 -translate-y-1/2 text-[15px] font-normal bg-white
                               peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[16px] peer-placeholder-shown:bg-transparent
                               peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[15px] peer-focus:bg-white peer-focus:text-[#748c2c]"
                  >
                    Mật khẩu
                  </label>
                  <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "#93a83e", zIndex: 10 }}
                  >
                    <Lock size={18} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors p-1.5 rounded-lg hover:bg-gray-50 z-10"
                    style={{ color: "#93a83e" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="flex justify-start mt-5">
                  <button
                    type="button"
                    className="text-[15px] hover:underline transition-all"
                    style={{ color: "#748c2c" }}
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1 py-3 rounded-xl font-normal text-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-white"
                  style={{
                    background: loading ? "#93a83e" : "#748c2c",
                    boxShadow: "0 4px 10px rgba(116,140,44,0.2)",
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
          style={{ color: "#93a83e" }}
        >
          Coppyright © 2026 Ban Chỉ huy Quân sự
        </p>
      </div>
    </div>
  );
}
