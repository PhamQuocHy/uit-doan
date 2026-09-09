"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Citizen, HierarchyUnit } from "@/lib/data";
import { hierarchyNeedsEditPin } from "@/lib/data";
import Hn212ScanButton from "@/components/admin/Hn212ScanButton";
import DateVnInput from "@/components/admin/DateVnInput";
import type { Hn212CitizenScan } from "@/lib/hn212";
import { toPortraitDataUrl } from "@/lib/hn212/normalize";

type FormMode = "create" | "edit";

type CampaignOption = {
  id: string;
  name: string;
  year: number;
};

const emptyForm = {
  fullName: "",
  cccd: "",
  dateOfBirth: "",
  gender: "male" as "male" | "female",
  phone: "",
  address: "",
  educationLevel: "THPT",
  job: "",
  schoolName: "",
  militaryStatus: "chuakham" as Citizen["militaryStatus"],
  healthStatus: "",
  ethnicity: "Kinh",
  nationality: "Việt Nam",
  religion: "Không",
  originPlace: "",
  identificationFeatures: "",
  issueDate: "",
  expiryDate: "",
  oldIdNumber: "",
  fatherName: "",
  motherName: "",
  avatar: "",
  unitCode: "",
  campaignId: "",
};

type CitizenFormValues = typeof emptyForm;

interface CitizenFormModalProps {
  open: boolean;
  mode: FormMode;
  citizen?: Citizen | null;
  prefill?: Partial<CitizenFormValues> | Hn212CitizenScan | null;
  defaultUnitCode?: string | null;
  defaultCampaignId?: string | null;
  onClose: () => void;
  onSaved: (result?: { mode: FormMode; citizen?: Citizen }) => void;
}

function applyScanToForm(
  prev: CitizenFormValues,
  data: Hn212CitizenScan | Partial<CitizenFormValues>,
): CitizenFormValues {
  const gender =
    data.gender === "male" || data.gender === "female"
      ? data.gender
      : prev.gender;
  return {
    ...prev,
    fullName: data.fullName?.trim() || prev.fullName,
    cccd: data.cccd?.trim() || prev.cccd,
    dateOfBirth: data.dateOfBirth?.slice(0, 10) || prev.dateOfBirth,
    gender,
    address: ("address" in data && data.address?.trim()) || prev.address,
    originPlace:
      ("originPlace" in data && data.originPlace?.trim()) || prev.originPlace,
    nationality:
      ("nationality" in data && data.nationality?.trim()) || prev.nationality,
    ethnicity:
      ("ethnicity" in data && data.ethnicity?.trim()) || prev.ethnicity,
    religion: ("religion" in data && data.religion?.trim()) || prev.religion,
    oldIdNumber:
      ("oldIdNumber" in data && data.oldIdNumber?.trim()) || prev.oldIdNumber,
    issueDate:
      ("issueDate" in data && data.issueDate?.slice(0, 10)) || prev.issueDate,
    expiryDate:
      ("expiryDate" in data && data.expiryDate?.slice(0, 10)) ||
      prev.expiryDate,
    fatherName:
      ("fatherName" in data && data.fatherName?.trim()) || prev.fatherName,
    motherName:
      ("motherName" in data && data.motherName?.trim()) || prev.motherName,
    identificationFeatures:
      ("identificationFeatures" in data &&
        data.identificationFeatures?.trim()) ||
      prev.identificationFeatures,
    avatar: (() => {
      if ("avatar" in data && typeof data.avatar === "string" && data.avatar.trim()) {
        return toPortraitDataUrl(data.avatar) || toAvatarSrc(data.avatar);
      }
      if (
        "portraitBase64" in data &&
        typeof data.portraitBase64 === "string" &&
        data.portraitBase64.trim()
      ) {
        return (
          toPortraitDataUrl(data.portraitBase64) ||
          toAvatarSrc(data.portraitBase64)
        );
      }
      return prev.avatar;
    })(),
  };
}

function toAvatarSrc(raw: string): string {
  return toPortraitDataUrl(raw);
}

export default function CitizenFormModal({
  open,
  mode,
  citizen,
  prefill,
  defaultUnitCode,
  defaultCampaignId,
  onClose,
  onSaved,
}: CitizenFormModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
  const [sessionUnitCode, setSessionUnitCode] = useState<string | null>(null);
  const [sessionUnitName, setSessionUnitName] = useState("");
  const [provinces, setProvinces] = useState<HierarchyUnit[]>([]);
  const [wards, setWards] = useState<HierarchyUnit[]>([]);
  const [formTinh, setFormTinh] = useState("");
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [editPin, setEditPin] = useState("");

  const needsPin =
    sessionLevel !== null && hierarchyNeedsEditPin(sessionLevel);

  const loadWards = useCallback(async (parentCode: string) => {
    if (!parentCode) {
      setWards([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(parentCode)}`,
      );
      if (!res.ok) throw new Error("wards");
      const data = await res.json();
      setWards(data.items || []);
    } catch {
      setWards([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEditPin("");
    setLoadingUnits(true);

    void (async () => {
      let level: string | null = null;
      let unitCode: string | null = null;
      let unitName = "";
      try {
        const meRes = await fetch("/api/auth/me");
        const me = meRes.ok ? await meRes.json() : null;
        level = me?.user?.hierarchyLevel ?? null;
        unitCode = me?.user?.unitCode ?? null;
        unitName = me?.user?.unitName || me?.user?.department || unitCode || "";
        setSessionLevel(level);
        setSessionUnitCode(unitCode);
        setSessionUnitName(unitName);
      } catch {
        setSessionLevel(null);
        setSessionUnitCode(null);
      }

      try {
        const campRes = await fetch("/api/admin/recruitment?limit=100");
        if (campRes.ok) {
          const campData = await campRes.json();
          const list = (campData.data || campData.items || []) as CampaignOption[];
          setCampaigns(
            [...list].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, "vi")),
          );
        } else {
          setCampaigns([]);
        }
      } catch {
        setCampaigns([]);
      }

      let nextForm = { ...emptyForm };
      if (mode === "edit" && citizen) {
        nextForm = {
          fullName: citizen.fullName || "",
          cccd: citizen.cccd || "",
          dateOfBirth: citizen.dateOfBirth?.slice(0, 10) || "",
          gender: citizen.gender || "male",
          phone: citizen.phone || "",
          address: citizen.address || "",
          educationLevel: citizen.educationLevel || "THPT",
          job: citizen.job || "",
          schoolName: citizen.schoolName || "",
          militaryStatus: citizen.militaryStatus || "chuakham",
          healthStatus: citizen.healthStatus || "",
          ethnicity: citizen.ethnicity || "Kinh",
          nationality: citizen.nationality || "Việt Nam",
          religion: citizen.religion || "Không",
          originPlace: citizen.originPlace || "",
          identificationFeatures: citizen.identificationFeatures || "",
          issueDate: citizen.issueDate?.slice(0, 10) || "",
          expiryDate: citizen.expiryDate?.slice(0, 10) || "",
          oldIdNumber: citizen.oldIdNumber || "",
          fatherName: citizen.fatherName || "",
          motherName: citizen.motherName || "",
          avatar: citizen.avatar ? toAvatarSrc(citizen.avatar) : "",
          unitCode: citizen.unitCode || "",
          campaignId: citizen.campaignId || "",
        };
      } else {
        nextForm = prefill
          ? applyScanToForm({ ...emptyForm }, prefill)
          : { ...emptyForm };
        nextForm.campaignId = defaultCampaignId || "";
      }

      try {
        if (level === "bo") {
          const res = await fetch("/api/admin/hierarchy/children?parentCode=bo");
          const data = res.ok ? await res.json() : { items: [] };
          setProvinces(data.items || []);

          const xaCode = nextForm.unitCode || defaultUnitCode || "";
          if (xaCode.includes("-")) {
            const tinh = xaCode.split("-")[0] || "";
            setFormTinh(tinh);
            await loadWards(tinh);
            nextForm.unitCode = xaCode;
          } else if (defaultUnitCode && !defaultUnitCode.includes("-")) {
            setFormTinh(defaultUnitCode);
            await loadWards(defaultUnitCode);
            nextForm.unitCode = "";
          } else {
            setFormTinh("");
            setWards([]);
          }
        } else if (level === "tinh" && unitCode) {
          setFormTinh(unitCode);
          await loadWards(unitCode);
          const prefer =
            nextForm.unitCode ||
            (defaultUnitCode?.startsWith(`${unitCode}-`)
              ? defaultUnitCode
              : "");
          nextForm.unitCode = prefer || "";
          setProvinces([]);
        } else if (level === "xa" && unitCode) {
          nextForm.unitCode = unitCode;
          setFormTinh("");
          setProvinces([]);
          setWards([]);
        }
      } finally {
        setForm(nextForm);
        setLoadingUnits(false);
      }
    })();
  }, [open, mode, citizen, prefill, defaultUnitCode, defaultCampaignId, loadWards]);

  if (!open) return null;

  const set = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleScanned = (data: Hn212CitizenScan) => {
    setForm((prev) => applyScanToForm(prev, data));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.fullName.trim() || !form.cccd.trim() || !form.dateOfBirth) {
        throw new Error("Vui lòng nhập Họ tên, CCCD và Ngày sinh");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
        throw new Error("Ngày sinh không hợp lệ (dd/mm/yyyy)");
      }
      const unitCode =
        sessionLevel === "xa" ? sessionUnitCode || form.unitCode : form.unitCode;
      if (!unitCode?.trim()) {
        throw new Error("Vui lòng chọn địa phương đăng ký");
      }
      if (!form.campaignId.trim()) {
        throw new Error("Vui lòng chọn đợt đăng ký");
      }
      if (needsPin && !editPin.trim()) {
        throw new Error("Vui lòng nhập mã PIN địa phương để lưu hồ sơ");
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
          unitCode,
          campaignId: form.campaignId,
          ...(needsPin
            ? { requireEditPin: true, editPin: editPin.trim() }
            : {}),
          ...(mode === "edit" && citizen?.militaryStatusLocked
            ? { unlockViaProfile: true }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không lưu được");
      onSaved({ mode, citizen: data as Citizen });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi lưu dữ liệu");
    } finally {
      setSaving(false);
    }
  };

  const xaLocked = sessionLevel === "xa";
  const showTinhSelect = sessionLevel === "bo";
  const showXaSelect = sessionLevel === "bo" || sessionLevel === "tinh";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-m3-surface-lowest shadow-2xl sm:rounded-[24px]">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <h2 className="text-[20px] font-bold text-m3-on-surface">
            {mode === "edit" ? "Sửa nhanh" : "Thêm công dân mới"}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {mode === "create" && (
              <Hn212ScanButton
                compact
                label="Quét CCCD"
                onScanned={handleScanned}
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] p-2.5 text-m3-on-surface-variant hover:bg-black/[0.05]"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {error && (
              <div className="rounded-[14px] bg-m3-error-container px-4 py-3 text-[14px] font-semibold text-m3-error">
                {error}
              </div>
            )}

            <div className="rounded-[16px] border border-sky-100 bg-sky-50/70 p-4 space-y-3">
              <Field label="Đợt đăng ký *">
                <select
                  className={inputCls}
                  value={form.campaignId}
                  onChange={(e) => set("campaignId", e.target.value)}
                  required
                >
                  <option value="">— Chọn đợt —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.year} · {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <p className="mb-1.5 text-[14px] font-bold text-m3-on-surface">
                  Địa phương đăng ký *
                </p>
                {loadingUnits ? (
                  <p className="text-[13px] text-m3-on-surface-variant">Đang tải…</p>
                ) : xaLocked ? (
                  <input
                    className={`${inputCls} bg-m3-surface-high`}
                    value={
                      sessionUnitName
                        ? `${sessionUnitName} (${sessionUnitCode})`
                        : sessionUnitCode || form.unitCode
                    }
                    readOnly
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {showTinhSelect && (
                      <Field label="Tỉnh / Thành phố">
                        <select
                          className={inputCls}
                          value={formTinh}
                          onChange={(e) => {
                            const code = e.target.value;
                            setFormTinh(code);
                            set("unitCode", "");
                            void loadWards(code);
                          }}
                        >
                          <option value="">— Chọn tỉnh/thành —</option>
                          {provinces.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    {showXaSelect && (
                      <Field label="Xã / Phường *">
                        <select
                          className={inputCls}
                          value={form.unitCode}
                          disabled={showTinhSelect && !formTinh}
                          onChange={(e) => set("unitCode", e.target.value)}
                        >
                          <option value="">— Chọn xã/phường —</option>
                          {wards.map((w) => (
                            <option key={w.code} value={w.code}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <div className="shrink-0">
                <p className="mb-1.5 text-[14px] font-bold text-m3-on-surface">
                  Ảnh 3×4
                </p>
                <div className="flex h-[148px] w-[110px] items-center justify-center overflow-hidden rounded-[12px] border border-black/[0.08] bg-m3-surface-high">
                  {form.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <Field label="Họ và tên *">
                  <input
                    className={inputCls}
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Số CCCD *">
                    <input
                      className={inputCls}
                      value={form.cccd}
                      onChange={(e) => set("cccd", e.target.value)}
                    />
                  </Field>
                  <Field label="Số điện thoại">
                    <input
                      className={inputCls}
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Ngày sinh *">
                <DateVnInput
                  valueIso={form.dateOfBirth}
                  onChangeIso={(iso) => set("dateOfBirth", iso)}
                  required
                  className={inputCls}
                />
              </Field>
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
            </div>

            <Field label="Địa chỉ">
              <input
                className={inputCls}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
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
              <Field label="Trường / cơ sở đào tạo">
                <input
                  className={inputCls}
                  value={form.schoolName}
                  onChange={(e) => set("schoolName", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Nghề nghiệp / việc làm">
              <input
                className={inputCls}
                value={form.job}
                onChange={(e) => set("job", e.target.value)}
              />
            </Field>

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
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Quốc tịch">
                <input
                  className={inputCls}
                  value={form.nationality}
                  onChange={(e) => set("nationality", e.target.value)}
                />
              </Field>
              <Field label="Dân tộc">
                <input
                  className={inputCls}
                  value={form.ethnicity}
                  onChange={(e) => set("ethnicity", e.target.value)}
                />
              </Field>
              <Field label="Tôn giáo">
                <input
                  className={inputCls}
                  value={form.religion}
                  onChange={(e) => set("religion", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Quê quán">
              <input
                className={inputCls}
                value={form.originPlace}
                onChange={(e) => set("originPlace", e.target.value)}
              />
            </Field>

            <Field label="Đặc điểm nhận dạng">
              <input
                className={inputCls}
                value={form.identificationFeatures}
                onChange={(e) => set("identificationFeatures", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Ngày cấp CCCD">
                <DateVnInput
                  valueIso={form.issueDate}
                  onChangeIso={(iso) => set("issueDate", iso)}
                  className={inputCls}
                />
              </Field>
              <Field label="Ngày hết hạn">
                <DateVnInput
                  valueIso={form.expiryDate}
                  onChangeIso={(iso) => set("expiryDate", iso)}
                  className={inputCls}
                />
              </Field>
              <Field label="CMND/CCCD cũ">
                <input
                  className={inputCls}
                  value={form.oldIdNumber}
                  onChange={(e) => set("oldIdNumber", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Họ tên cha">
                <input
                  className={inputCls}
                  value={form.fatherName}
                  onChange={(e) => set("fatherName", e.target.value)}
                />
              </Field>
              <Field label="Họ tên mẹ">
                <input
                  className={inputCls}
                  value={form.motherName}
                  onChange={(e) => set("motherName", e.target.value)}
                />
              </Field>
            </div>

            {needsPin && (
              <Field label="Mã PIN địa phương *">
                <input
                  type="password"
                  autoComplete="off"
                  className={inputCls}
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value)}
                  placeholder="Nhập PIN để xác thực lưu hồ sơ"
                />
                <span className="mt-1 block text-[12px] text-m3-on-surface-variant">
                  Cấp tỉnh / xã bắt buộc nhập PIN khi lưu.
                </span>
              </Field>
            )}
          </div>

          <div className="flex gap-3 border-t border-black/[0.06] bg-m3-surface-high/80 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-[14px] bg-m3-surface-lowest text-[16px] font-bold text-m3-on-surface"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[48px] flex-[1.4] rounded-[14px] bg-m3-primary text-[16px] font-bold text-white shadow-md shadow-m3-primary-container/25 disabled:opacity-60"
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
      <span className="mb-1.5 block text-[14px] font-bold text-m3-on-surface">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full min-h-[48px] rounded-[14px] border border-black/[0.08] bg-m3-surface-lowest px-4 text-[16px] text-m3-on-surface outline-none focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/20";
