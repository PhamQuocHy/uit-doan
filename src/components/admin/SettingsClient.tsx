"use client";

import { useState } from "react";
import { User, Lock, Save, Eye, EyeOff } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SettingsClient({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail?: string;
}) {
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess("");
    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdError("Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("Mật khẩu mới không khớp");
      return;
    }
    if (newPwd.length < 6) {
      setPwdError("Mật khẩu mới phải ít nhất 6 ký tự");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setPwdSuccess("Đổi mật khẩu thành công!");
    setOldPwd("");
    setNewPwd("");
    setConfirmPwd("");
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-xl">
            <User size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              Thông tin tài khoản
            </h3>
            <p className="text-sm text-slate-400">
              Thông tin hồ sơ quản trị viên
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{userName}</p>
            <p className="text-sm text-slate-500">
              {userEmail || "admin@ymsa.edu.vn"}
            </p>
            <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Quản trị viên
            </span>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-50 rounded-xl">
            <Lock size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Đổi mật khẩu</h3>
            <p className="text-sm text-slate-400">
              Cập nhật mật khẩu để bảo mật tài khoản
            </p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {pwdError && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-2.5 rounded-xl">
              {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-4 py-2.5 rounded-xl">
              {pwdSuccess}
            </div>
          )}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mật khẩu hiện tại <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showOld ? "text" : "password"}
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
                className="w-full px-3 py-2.5 pr-11 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                className="w-full px-3 py-2.5 pr-11 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <Input
            label="Xác nhận mật khẩu mới"
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            required
          />
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              icon={<Save size={16} />}
            >
              Cập nhật mật khẩu
            </Button>
          </div>
        </form>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-4">
          Thông tin hệ thống
        </h3>
        <div className="space-y-3 text-sm">
          {[
            { label: "Phiên bản", value: "YMSA v1.0.0" },
            { label: "Framework", value: "Next.js 15 (App Router)" },
            { label: "Ngôn ngữ", value: "TypeScript" },
            { label: "Giao diện", value: "Tailwind CSS v4" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex justify-between py-2 border-b border-slate-50 last:border-0"
            >
              <span className="text-slate-500">{item.label}</span>
              <span className="font-medium text-slate-700">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
