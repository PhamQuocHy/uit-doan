"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Citizen } from "@/lib/data";

type FormMode = "create" | "edit";

interface CitizenFormModalProps {
  open: boolean;
  mode: FormMode;
  citizen?: Citizen | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = {
  fullName: "",
  cccd: "",
  dateOfBirth: "",
  gender: "male" as "male" | "female",
  phone: "",
  address: "",
  educationLevel: "THPT",
  job: "",
  militaryStatus: "chuakham" as Citizen["militaryStatus"],
  healthStatus: "",
  ethnicity: "Kinh",
  nationality: "Việt Nam",
};

export default function CitizenFormModal({
  open,
  mode,
  citizen,
  onClose,
  onSaved,
}: CitizenFormModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && citizen) {
      setForm({
        fullName: citizen.fullName || "",
        cccd: citizen.cccd || "",
        dateOfBirth: citizen.dateOfBirth?.slice(0, 10) || "",
        gender: citizen.gender || "male",
        phone: citizen.phone || "",
        address: citizen.address || "",
        educationLevel: citizen.educationLevel || "THPT",
        job: citizen.job || "",
        militaryStatus: citizen.militaryStatus || "chuakham",
        healthStatus: citizen.healthStatus || "",
        ethnicity: citizen.ethnicity || "Kinh",
        nationality: citizen.nationality || "Việt Nam",
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, citizen]);

  if (!open) return null;

  const set = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.fullName.trim() || !form.cccd.trim() || !form.dateOfBirth) {
        throw new Error("Vui lòng nhập Họ tên, CCCD và Ngày sinh");
      }

      const url =
        mode === "edit" && citizen
          ? `/api/admin/citizens/${citizen.id}`
          : "/api/admin/citizens";
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...(mode === "edit" && citizen?.militaryStatusLocked
            ? { unlockViaProfile: true }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không lưu được");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi lưu dữ liệu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[20px] font-bold text-[#1d1d1f]">
              {mode === "edit" ? "Sửa thông tin công dân" : "Thêm công dân mới"}
            </h2>
            <p className="mt-0.5 text-[14px] text-[#6e6e73]">
              Điền các ô bên dưới rồi bấm Lưu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] p-2.5 text-[#636366] hover:bg-black/[0.05]"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {error && (
              <div className="rounded-[14px] bg-red-50 px-4 py-3 text-[14px] font-semibold text-[#ff3b30]">
                {error}
              </div>
            )}

            <Field label="Họ và tên *">
              <input
                className={inputCls}
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="VD: Nguyễn Văn A"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Số CCCD *">
                <input
                  className={inputCls}
                  value={form.cccd}
                  onChange={(e) => set("cccd", e.target.value)}
                  placeholder="12 số"
                />
              </Field>
              <Field label="Ngày sinh *">
                <input
                  type="date"
                  className={inputCls}
                  value={form.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Giới tính">
                <select
                  className={inputCls}
                  value={form.gender}
                  onChange={(e) => set("gender", e.target.value)}
                >
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </Field>
              <Field label="Số điện thoại">
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="09..."
                />
              </Field>
            </div>

            <Field label="Địa chỉ">
              <input
                className={inputCls}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Số nhà, đường, xã/phường..."
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Trình độ học vấn">
                <select
                  className={inputCls}
                  value={form.educationLevel}
                  onChange={(e) => set("educationLevel", e.target.value)}
                >
                  <option value="THPT">THPT</option>
                  <option value="Trung cấp">Trung cấp</option>
                  <option value="Cao đẳng">Cao đẳng</option>
                  <option value="Đại học">Đại học</option>
                  <option value="Sau đại học">Sau đại học</option>
                </select>
              </Field>
              <Field label="Nghề nghiệp / việc làm">
                <input
                  className={inputCls}
                  value={form.job}
                  onChange={(e) => set("job", e.target.value)}
                  placeholder="VD: Sinh viên, Công nhân..."
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Trạng thái NVQS">
                <select
                  className={inputCls}
                  value={form.militaryStatus}
                  onChange={(e) => set("militaryStatus", e.target.value)}
                >
                  <option value="chuakham">Chưa khám</option>
                  <option value="dangkham">Đang khám</option>
                  <option value="trungtuyen">Đậu</option>
                  <option value="truottuyen">Rớt</option>
                  <option value="tamhoan">Tạm hoãn</option>
                  <option value="miengoi">Miễn gọi</option>
                  <option value="nhapngu">Nhập ngũ</option>
                </select>
              </Field>
              <Field label="Phân loại sức khỏe">
                <input
                  className={inputCls}
                  value={form.healthStatus}
                  onChange={(e) => set("healthStatus", e.target.value)}
                  placeholder="VD: Loại 1, Loại 2..."
                />
              </Field>
            </div>
          </div>

          <div className="flex gap-3 border-t border-black/[0.06] bg-[#f5f5f7]/80 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-[14px] bg-white text-[16px] font-bold text-[#1d1d1f]"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[48px] flex-[1.4] rounded-[14px] bg-[#007aff] text-[16px] font-bold text-white shadow-md shadow-blue-500/25 disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : mode === "edit" ? "Lưu thay đổi" : "Thêm công dân"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-bold text-[#1d1d1f]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full min-h-[48px] rounded-[14px] border border-black/[0.08] bg-white px-4 text-[16px] text-[#1d1d1f] outline-none focus:border-[#007aff] focus:ring-2 focus:ring-[#007aff]/20";
