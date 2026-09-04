"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Printer, ChevronDown, ChevronUp, Filter, Lock, KeyRound } from "lucide-react";
import type { Citizen, EducationRecord, HealthRecord, ResidenceRecord } from "@/lib/data";
import {
  getHealthConclusionMeaning,
  hierarchyNeedsEditPin,
  isDetailedHealthPhase,
} from "@/lib/data";
import {
  getCallDisplayLabel,
  type CallIntent,
} from "@/lib/enlistment-approval";
import HealthExamWorkflow from "@/components/admin/HealthExamWorkflow";
import HealthExamFormModal from "@/components/admin/HealthExamFormModal";
import {
  canEnterHealthRecords,
  type HealthExamRound,
} from "@/lib/health-exam";

type TabId = "identity" | "education" | "health" | "residence" | "nvqs";

const TABS: { id: TabId; label: string }[] = [
  { id: "identity", label: "Định danh" },
  { id: "education", label: "Học vấn" },
  { id: "health", label: "Sức khỏe" },
  { id: "residence", label: "Cư trú" },
  { id: "nvqs", label: "NVQS" },
];

const EDUCATION_STATUS: Record<
  EducationRecord["status"],
  { label: string; bg: string; color: string }
> = {
  completed: { label: "Đã tốt nghiệp", bg: "color-mix(in srgb, var(--color-m3-success) 14%, transparent)", color: "var(--color-m3-success)" },
  studying: { label: "Đang học", bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)", color: "var(--m3-primary, #1a73e8)" },
  dropped: { label: "Bỏ học", bg: "color-mix(in srgb, var(--m3-error, #ba1a1a) 10%, transparent)", color: "var(--m3-error, #ba1a1a)" },
};

const EDUCATION_LEVEL_STYLE: Record<string, { bg: string; color: string }> = {
  "9/12": { bg: "var(--m3-surface-container-high, #eef1f4)", color: "var(--m3-on-surface-variant, #475569)" },
  "12/12": { bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 10%, transparent)", color: "var(--m3-primary, #1a73e8)" },
  "Cao đẳng": { bg: "color-mix(in srgb, var(--color-m3-warning) 14%, transparent)", color: "var(--m3-error, #ba1a1a)" },
  "Đại học": { bg: "color-mix(in srgb, var(--color-m3-success) 14%, transparent)", color: "var(--color-m3-success)" },
  "Thạc sĩ": { bg: "color-mix(in srgb, var(--m3-tertiary, #5a5f6e) 12%, transparent)", color: "var(--m3-tertiary, #5a5f6e)" },
  "Tiến sĩ": { bg: "color-mix(in srgb, var(--m3-error, #ba1a1a) 10%, transparent)", color: "var(--m3-error, #ba1a1a)" },
};

const RESIDENCE_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  "Quê quán": { bg: "var(--m3-surface-container-high, #eef1f4)", color: "var(--m3-on-surface-variant, #475569)" },
  "Thường trú": { bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 10%, transparent)", color: "var(--m3-primary, #1a73e8)" },
  "Tạm trú": { bg: "color-mix(in srgb, var(--color-m3-warning) 14%, transparent)", color: "var(--m3-error, #ba1a1a)" },
  "Chuyển đi": { bg: "color-mix(in srgb, var(--m3-error, #ba1a1a) 10%, transparent)", color: "var(--m3-error, #ba1a1a)" },
};

const RESIDENCE_STATUS: Record<
  ResidenceRecord["status"],
  { label: string; bg: string; color: string }
> = {
  current: { label: "Đang cư trú", bg: "color-mix(in srgb, var(--color-m3-success) 14%, transparent)", color: "var(--color-m3-success)" },
  past: { label: "Đã chuyển đi", bg: "var(--m3-surface-container-high, #eef1f4)", color: "var(--m3-on-surface-variant, #475569)" },
  pending: { label: "Chờ xác nhận", bg: "color-mix(in srgb, var(--color-m3-warning) 14%, transparent)", color: "var(--m3-error, #ba1a1a)" },
};

const MILITARY_STATUS: Record<string, string> = {
  chuakham: "Chưa khám",
  dangkham: "Đang khám",
  trungtuyen: "Đậu",
  truottuyen: "Rớt",
  tamhoan: "Tạm hoãn",
  miengoi: "Miễn gọi",
  nhapngu: "Nhập ngũ",
};

type NvqsCallChoice = CallIntent | "tamhoan" | "miengoi";

const NVQS_CALL_OPTIONS: { value: NvqsCallChoice; label: string }[] = [
  { value: "unset", label: "Chưa xác định" },
  { value: "du_kien_goi", label: "Dự kiến gọi (chuyển xét duyệt)" },
  { value: "khong_goi", label: "Không gọi" },
  { value: "tamhoan", label: "Tạm hoãn" },
  { value: "miengoi", label: "Miễn gọi" },
];

function citizenToNvqsChoice(c: Citizen): NvqsCallChoice {
  if (c.militaryStatus === "tamhoan") return "tamhoan";
  if (c.militaryStatus === "miengoi") return "miengoi";
  if (c.callIntent === "du_kien_goi") return "du_kien_goi";
  if (c.callIntent === "khong_goi") return "khong_goi";
  return "unset";
}

function nvqsChoiceNeedsReason(choice: NvqsCallChoice) {
  return choice === "tamhoan";
}

const NVQS_INPUT_CLS =
  "w-full min-h-[44px] rounded-[12px] border border-black/[0.08] bg-m3-surface-lowest px-4 text-[15px] text-m3-on-surface outline-none transition-colors focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/15";

interface CitizenDetailModalProps {
  citizen: Citizen | null;
  onClose: () => void;
  onEdit?: (citizen: Citizen) => void;
  onCitizenUpdated?: (citizen: Citizen) => void;
  initialTab?: TabId;
}

export default function CitizenDetailModal({
  citizen,
  onClose,
  onEdit,
  onCitizenUpdated,
  initialTab = "identity",
}: CitizenDetailModalProps) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthYear, setHealthYear] = useState<number | null>(null);
  const [expandedHealthId, setExpandedHealthId] = useState<string | null>(null);
  const [healthFilterOpen, setHealthFilterOpen] = useState(false);
  const healthFilterRef = useRef<HTMLDivElement>(null);
  const [educationRecords, setEducationRecords] = useState<EducationRecord[]>([]);
  const [educationLoading, setEducationLoading] = useState(false);
  const [residenceRecords, setResidenceRecords] = useState<ResidenceRecord[]>([]);
  const [residenceLoading, setResidenceLoading] = useState(false);
  const [nvqsCallChoice, setNvqsCallChoice] = useState<NvqsCallChoice>("unset");
  const [nvqsReason, setNvqsReason] = useState("");
  const [nvqsSaving, setNvqsSaving] = useState(false);
  const [nvqsError, setNvqsError] = useState<string | null>(null);
  const [nvqsUnlocked, setNvqsUnlocked] = useState(false);
  const [nvqsPin, setNvqsPin] = useState("");
  const [nvqsPinError, setNvqsPinError] = useState<string | null>(null);
  const [nvqsPinVerifying, setNvqsPinVerifying] = useState(false);
  const [nvqsVerifiedPin, setNvqsVerifiedPin] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; year: number }[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
  const [sessionFunctionalRole, setSessionFunctionalRole] = useState<string | null>(null);
  const [sessionUserRole, setSessionUserRole] = useState<string | null>(null);
  const [healthFormRound, setHealthFormRound] = useState<HealthExamRound | null>(null);
  const [open, setOpen] = useState(false);

  const isBoLevel = sessionLevel === "bo";
  const needsPinToEdit = sessionLevel !== null && hierarchyNeedsEditPin(sessionLevel);
  const nvqsIsLocked = citizen?.militaryStatusLocked === true;
  const nvqsCanEdit = !nvqsIsLocked || nvqsUnlocked;

  const handleClose = useCallback(() => {
    setOpen(false);
    setNvqsUnlocked(false);
    setNvqsPin("");
    setNvqsVerifiedPin("");
    setNvqsPinError(null);
    window.setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!citizen) {
      setOpen(false);
      return;
    }
    setTab(sessionFunctionalRole === "y_te" ? "health" : initialTab);
    const t = window.setTimeout(() => setOpen(true), 10);
    return () => window.clearTimeout(t);
  }, [citizen, initialTab]);

  useEffect(() => {
    if (open) {
      document.body.setAttribute("data-admin-drawer-open", "true");
    } else {
      document.body.removeAttribute("data-admin-drawer-open");
    }
    return () => document.body.removeAttribute("data-admin-drawer-open");
  }, [open]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSessionLevel(data?.user?.hierarchyLevel ?? null);
        setSessionFunctionalRole(data?.user?.functionalRole ?? null);
        setSessionUserRole(data?.user?.role ?? null);
      })
      .catch(() => setSessionLevel(null));
  }, []);

  useEffect(() => {
    if (!citizen) {
      setHealthRecords([]);
      setHealthYear(null);
      setExpandedHealthId(null);
      setHealthFilterOpen(false);
      return;
    }
    setHealthLoading(true);
    setExpandedHealthId(null);
    fetch(`/api/admin/health?citizenId=${citizen.id}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const records: HealthRecord[] = data.data || [];
        setHealthRecords(records);
        const years = [...new Set(records.map((r) => r.year))].sort((a, b) => b - a);
        setHealthYear(years[0] ?? null);
      })
      .catch(() => setHealthRecords([]))
      .finally(() => setHealthLoading(false));
  }, [citizen?.id]);

  useEffect(() => {
    if (!citizen) {
      setEducationRecords([]);
      return;
    }
    setEducationLoading(true);
    fetch(`/api/admin/education?citizenId=${citizen.id}&limit=50`)
      .then((r) => r.json())
      .then((data) => setEducationRecords(data.data || []))
      .catch(() => setEducationRecords([]))
      .finally(() => setEducationLoading(false));
  }, [citizen?.id]);

  useEffect(() => {
    if (!citizen) {
      setResidenceRecords([]);
      return;
    }
    setResidenceLoading(true);
    fetch(`/api/admin/residence?citizenId=${citizen.id}&limit=50`)
      .then((r) => r.json())
      .then((data) => setResidenceRecords(data.data || []))
      .catch(() => setResidenceRecords([]))
      .finally(() => setResidenceLoading(false));
  }, [citizen?.id]);

  useEffect(() => {
    if (!citizen) {
      setNvqsCallChoice("unset");
      setNvqsReason("");
      setNvqsError(null);
      setNvqsUnlocked(false);
      setNvqsPin("");
      setNvqsVerifiedPin("");
      setNvqsPinError(null);
      return;
    }
    setNvqsCallChoice(citizenToNvqsChoice(citizen));
    setCampaignId(citizen.campaignId || "");
    setNvqsReason(citizen.militaryStatusReason || "");
    setNvqsError(null);
    setNvqsUnlocked(false);
    setNvqsPin("");
    setNvqsVerifiedPin("");
    setNvqsPinError(null);
  }, [citizen?.id, citizen?.militaryStatus, citizen?.militaryStatusReason, citizen?.militaryStatusLocked, citizen?.callIntent, citizen?.approvalStatus]);

  useEffect(() => {
    fetch("/api/admin/recruitment?limit=100")
      .then((res) => res.json())
      .then((data) => setCampaigns(data.data || []))
      .catch(() => setCampaigns([]));
  }, []);

  const handleVerifyNvqsPin = async () => {
    if (!nvqsPin.trim()) {
      setNvqsPinError("Vui lòng nhập mã PIN địa phương.");
      return;
    }

    setNvqsPinVerifying(true);
    setNvqsPinError(null);
    try {
      const res = await fetch("/api/admin/nvqs/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: nvqsPin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mã PIN không đúng");
      setNvqsVerifiedPin(nvqsPin.trim());
      setNvqsUnlocked(true);
      setNvqsPin("");
    } catch (err) {
      setNvqsPinError(err instanceof Error ? err.message : "Mã PIN không đúng");
    } finally {
      setNvqsPinVerifying(false);
    }
  };

  const handleSaveNvqs = async () => {
    if (!citizen) return;

    if (nvqsChoiceNeedsReason(nvqsCallChoice) && !nvqsReason.trim()) {
      setNvqsError("Vui lòng nhập lý do khi chọn Tạm hoãn.");
      return;
    }
    if (nvqsCallChoice === "du_kien_goi" && !campaignId) {
      setNvqsError("Vui lòng chọn đợt khám tuyển.");
      return;
    }

    setNvqsSaving(true);
    setNvqsError(null);
    try {
      const isSpecial = nvqsCallChoice === "tamhoan" || nvqsCallChoice === "miengoi";
      const res = await fetch(`/api/admin/citizens/${citizen.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isSpecial
            ? {
                militaryStatus: nvqsCallChoice,
                callIntent: "unset",
                militaryStatusReason:
                  nvqsCallChoice === "tamhoan" ? nvqsReason.trim() : "",
              }
            : {
                callIntent: nvqsCallChoice,
                  campaignId: nvqsCallChoice === "du_kien_goi" ? campaignId : null,
                militaryStatusReason: "",
              }),
          militaryStatusLocked: true,
          ...(nvqsVerifiedPin ? { editPin: nvqsVerifiedPin } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "save failed");
      const updated: Citizen = data;
      onCitizenUpdated?.(updated);
      setNvqsUnlocked(false);
      setNvqsVerifiedPin("");
    } catch (err) {
      setNvqsError(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật trạng thái NVQS. Vui lòng thử lại.",
      );
    } finally {
      setNvqsSaving(false);
    }
  };

  useEffect(() => {
    if (!citizen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [citizen, handleClose]);

  useEffect(() => {
    if (!healthFilterOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        healthFilterRef.current &&
        !healthFilterRef.current.contains(e.target as Node)
      ) {
        setHealthFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [healthFilterOpen]);

  const healthYears = useMemo(
    () => [...new Set(healthRecords.map((r) => r.year))].sort((a, b) => b - a),
    [healthRecords],
  );

  const filteredHealthRecords = useMemo(() => {
    const list =
      healthYear === null
        ? healthRecords
        : healthRecords.filter((r) => r.year === healthYear);
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [healthRecords, healthYear]);

  const examYear = healthYear ?? new Date().getFullYear();
  const canEnterHealth = canEnterHealthRecords(
    sessionFunctionalRole,
    sessionUserRole ?? undefined,
  );

  const reloadHealthRecords = useCallback(() => {
    if (!citizen) return;
    setHealthLoading(true);
    fetch(`/api/admin/health?citizenId=${citizen.id}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const records: HealthRecord[] = data.data || [];
        setHealthRecords(records);
        const years = [...new Set(records.map((r) => r.year))].sort((a, b) => b - a);
        setHealthYear(years[0] ?? examYear);
      })
      .catch(() => setHealthRecords([]))
      .finally(() => setHealthLoading(false));
  }, [citizen, examYear]);

  if (!citizen) return null;

  const renderCell = (
    label: string,
    value: string | undefined | null,
    colSpan: 1 | 2 = 1,
  ) => (
    <div className={colSpan === 2 ? "col-span-2 min-w-0" : "min-w-0"}>
      <p className="text-[14px] font-normal text-m3-on-surface-variant">{label}</p>
      <p className="mt-0.5 text-[17px] font-medium leading-snug text-m3-on-surface break-words">
        {value || "—"}
      </p>
    </div>
  );

  const renderSectionBlock = (title: string, children: ReactNode) => (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-[16px] font-medium text-m3-primary">
        <span className="h-3.5 w-1 rounded-full bg-m3-primary" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );

  const renderStackField = (label: string, value: string | undefined | null) => (
    <div className="min-w-0">
      <p className="text-[14px] font-medium text-m3-on-surface-variant">{label}</p>
      <p className="mt-1 text-[17px] font-semibold leading-snug text-m3-on-surface break-words">
        {value || "—"}
      </p>
    </div>
  );

  const conclusionStyle = (c: string) => {
    if (["Loại 1", "Loại 2", "Loại 3"].includes(c)) {
      return { bg: "color-mix(in srgb, var(--color-m3-success) 14%, transparent)", color: "var(--color-m3-success)" };
    }
    return { bg: "color-mix(in srgb, var(--m3-error, #ba1a1a) 10%, transparent)", color: "var(--m3-error, #ba1a1a)" };
  };

  const calcBmi = (height: number, weight: number) =>
    (weight / (height / 100) ** 2).toFixed(1);

  const renderScreeningExam = (r: HealthRecord) => (
    <div className="flex flex-col gap-3">
      <p className="rounded-[10px] bg-m3-primary/8 px-3 py-2 text-[13px] leading-snug text-m3-primary">
        <strong>Vòng 1</strong> · Sàng lọc thể lực, dị tật, dị dạng và bệnh lý thuộc
        diện miễn đăng ký NVQS tại Trạm Y tế xã.
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {renderCell(
          "Ngày khám",
          new Date(r.createdAt).toLocaleDateString("vi-VN"),
        )}
        {renderCell("Cơ sở khám", r.detail?.facility || "Trạm Y tế xã")}
        {renderCell("Chiều cao", `${r.height} cm`)}
        {renderCell("Cân nặng", `${r.weight} kg`)}
        {renderCell("BMI", calcBmi(r.height, r.weight))}
        {renderCell("Huyết áp", r.bloodPressure)}
        {renderCell("Thị lực (sơ bộ)", r.vision, 2)}
        {r.detail?.physicalDefects &&
          renderCell("Dị tật / bệnh lý", r.detail.physicalDefects, 2)}
        {renderCell("Kết luận phân loại", r.conclusion, 2)}
        {renderCell(
          "Ý nghĩa",
          getHealthConclusionMeaning(r.conclusion, r.phase),
          2,
        )}
        {renderCell("Bác sĩ khám", r.doctor, 2)}
        {r.note && renderCell("Ghi chú", r.note, 2)}
      </div>
    </div>
  );

  const renderDetailedExam = (r: HealthRecord) => (
    <DetailedHealthExamTabs record={r} />
  );

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Đóng hồ sơ"
        onClick={handleClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Drawer panel — trượt từ phải */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="citizen-drawer-title"
        className={`relative flex h-full w-full max-w-[820px] flex-col bg-m3-surface-lowest shadow-[-8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="citizen-drawer-title"
              className="truncate text-[20px] font-semibold text-m3-on-surface"
            >
              Hồ sơ lý lịch
            </h2>
          
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-[12px] p-2.5 text-m3-on-surface-variant hover:bg-black/[0.05]"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/[0.06] px-4">
          {TABS.filter((t) =>
            sessionFunctionalRole !== "y_te" || t.id === "health"
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-3 text-[15px] font-normal transition-colors ${
                tab === t.id
                  ? "border-m3-primary text-m3-primary"
                  : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "identity" && (
            <div className="flex flex-col gap-4">
              {/* Profile banner */}
              <div className="flex items-center gap-4 rounded-[16px] bg-gradient-to-r from-m3-primary/8 to-transparent p-4">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(citizen.fullName)}&background=007aff&color=fff&size=128&font-size=0.33`}
                  alt=""
                  className="h-30 w-24 shrink-0 rounded-[14px] object-cover shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[20px] font-medium text-m3-on-surface">{citizen.fullName}</p>
                  <p className="mt-1 text-[16px] text-m3-on-surface-variant">
                    {citizen.gender === "male" ? "Nam" : "Nữ"}
                    {" · "}
                    {new Date(citizen.dateOfBirth).toLocaleDateString("vi-VN")}
                    {citizen.phone ? ` · ${citizen.phone}` : ""}
                  </p>
                  
                </div>
              </div>

              {/* Unified detail card */}
              <div className="rounded-[16px] border border-black/[0.06] bg-m3-surface-lowest p-5">
                {renderSectionBlock(
                  "Thông tin cá nhân",
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {renderCell("Quốc tịch", citizen.nationality || "Việt Nam")}
                    {renderCell("Dân tộc", citizen.ethnicity || "Kinh")}
                    {renderCell("Tôn giáo", citizen.religion || "Không")}
                    {renderCell("Số điện thoại", citizen.phone)}
                    {renderCell("Quê quán", citizen.originPlace, 2)}
                    {renderCell(
                      "Đặc điểm nhận dạng",
                      citizen.identificationFeatures,
                      2,
                    )}
                  </div>,
                )}

                <div className="pt-5">
                  {renderSectionBlock(
                    "Thông tin CCCD",
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {renderCell("Số CCCD", citizen.cccd, 2)}
                      {renderCell(
                        "Ngày cấp",
                        citizen.issueDate
                          ? new Date(citizen.issueDate).toLocaleDateString("vi-VN")
                          : undefined,
                      )}
                      {renderCell(
                        "Ngày hết hạn",
                        citizen.expiryDate
                          ? new Date(citizen.expiryDate).toLocaleDateString("vi-VN")
                          : undefined,
                      )}
                      {renderCell("CMND/CCCD cũ", citizen.oldIdNumber, 2)}
                    </div>,
                  )}
                </div>

                <div className="pt-5">
                  {renderSectionBlock(
                    "Thông tin gia đình",
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {renderCell("Họ tên cha", citizen.fatherName)}
                      {renderCell("Họ tên mẹ", citizen.motherName)}
                    </div>,
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "education" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                <p className="text-[12px] font-medium text-m3-on-surface-variant">Trình độ hiện tại</p>
                <p className="mt-0.5 text-[16px] font-bold text-m3-on-surface">
                  {citizen.educationLevel}
                  {citizen.job ? (
                    <span className="font-semibold text-m3-on-surface-variant"> · {citizen.job}</span>
                  ) : null}
                </p>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold tracking-wide text-m3-primary">
                  <span className="h-3.5 w-1 rounded-full bg-m3-primary" aria-hidden />
                  Quá trình học tập
                </h3>

                {educationLoading ? (
                  <p className="py-6 text-center text-[14px] text-m3-on-surface-variant">
                    Đang tải lịch sử học vấn...
                  </p>
                ) : educationRecords.length === 0 ? (
                  <p className="rounded-[14px] border border-dashed border-black/[0.1] py-8 text-center text-[14px] text-m3-on-surface-variant">
                    Chưa có bằng cấp / chứng chỉ nào được ghi nhận.
                  </p>
                ) : (
                  <div className="relative">
                    <div
                      className="absolute left-[5px] top-5 bottom-5 w-[2px] rounded-full bg-m3-primary/25"
                      aria-hidden
                    />
                    <div className="flex flex-col gap-3">
                      {educationRecords.map((record) => {
                        const levelStyle =
                          EDUCATION_LEVEL_STYLE[record.level] ?? {
                            bg: "var(--m3-surface-container-high, #eef1f4)",
                            color: "var(--m3-on-surface-variant, #475569)",
                          };
                        const statusStyle = EDUCATION_STATUS[record.status];
                        const yearLabel =
                          record.status === "studying" && record.startYear
                            ? `Từ ${record.startYear} · đang học`
                            : record.graduationYear
                              ? `Tốt nghiệp ${record.graduationYear}`
                              : null;

                        return (
                          <div key={record.id} className="flex gap-3">
                            <div className="flex w-3 shrink-0 justify-center pt-5">
                              <span
                                className="relative z-10 h-2.5 w-2.5 rounded-full bg-m3-primary ring-[3px] ring-white"
                                aria-hidden
                              />
                            </div>
                            <div className="min-w-0 flex-1 rounded-[14px] border border-black/[0.06] bg-m3-surface-lowest px-4 py-3.5">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span
                                  className="rounded-[8px] px-2.5 py-1 text-[13px] font-bold"
                                  style={{
                                    background: levelStyle.bg,
                                    color: levelStyle.color,
                                  }}
                                >
                                  {record.level}
                                </span>
                                <span
                                  className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold"
                                  style={{
                                    background: statusStyle.bg,
                                    color: statusStyle.color,
                                  }}
                                >
                                  {statusStyle.label}
                                </span>
                              </div>
                              <p className="mt-2 text-[15px] font-bold text-m3-on-surface">
                                {record.institution}
                              </p>
                              {record.major && (
                                <p className="mt-0.5 text-[14px] text-m3-on-surface-variant">
                                  Ngành: {record.major}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-m3-on-surface-variant">
                                {yearLabel && <span>{yearLabel}</span>}
                                {record.certificateNo && (
                                  <span>Số bằng: {record.certificateNo}</span>
                                )}
                              </div>
                              {record.note && (
                                <p className="mt-2 text-[13px] italic text-m3-on-surface-variant">
                                  {record.note}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "health" && (
            <div className="flex flex-col gap-4">
              <HealthExamWorkflow
                year={examYear}
                records={healthRecords}
                canEnter={canEnterHealth}
                onEnterRound={setHealthFormRound}
              />

              <div className="rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                <p className="text-[12px] font-medium text-m3-on-surface-variant">
                  Phân loại sức khỏe (tóm tắt)
                </p>
                <p className="mt-0.5 text-[16px] font-bold text-m3-on-surface">
                  {citizen.healthStatus || "—"}
                </p>
                {citizen.healthStatus && (
                  <p className="mt-1 text-[13px] font-medium text-m3-success">
                    {getHealthConclusionMeaning(citizen.healthStatus, 'Khám tuyển cấp huyện')}
                  </p>
                )}
              </div>

              {healthLoading ? (
                <p className="py-6 text-center text-[14px] text-m3-on-surface-variant">
                  Đang tải lịch sử khám...
                </p>
              ) : healthRecords.length === 0 ? (
                <p className="rounded-[14px] border border-dashed border-black/[0.1] py-8 text-center text-[14px] text-m3-on-surface-variant">
                  Chưa có lần khám nào trong hệ thống.
                </p>
              ) : (
                <>
                  {healthYears.length > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[15px] font-bold text-m3-on-surface">
                        Lịch sử khám
                        {healthYear !== null && (
                          <span className="ml-1.5 font-semibold text-m3-on-surface-variant">
                            · {filteredHealthRecords.length} lần
                          </span>
                        )}
                      </h3>
                      <div className="relative shrink-0" ref={healthFilterRef}>
                        <button
                          type="button"
                          onClick={() => setHealthFilterOpen((v) => !v)}
                          className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${
                            healthFilterOpen
                              ? "border-m3-primary/30 bg-m3-primary/10 text-m3-primary"
                              : "border-black/[0.08] bg-m3-surface-lowest text-m3-on-surface hover:bg-m3-surface-high"
                          }`}
                        >
                          <Filter size={16} />
                          Năm {healthYear ?? "—"}
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${healthFilterOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {healthFilterOpen && (
                          <div
                            className="absolute right-0 z-20 mt-2 max-h-[240px] w-44 overflow-y-auto rounded-[14px] border border-black/[0.08] bg-m3-surface-lowest py-1.5 shadow-lg"
                            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
                          >
                            {healthYears.map((year) => {
                              const count = healthRecords.filter(
                                (r) => r.year === year,
                              ).length;
                              return (
                                <button
                                  key={year}
                                  type="button"
                                  onClick={() => {
                                    setHealthYear(year);
                                    setExpandedHealthId(null);
                                    setHealthFilterOpen(false);
                                  }}
                                  className={`flex w-full min-h-[42px] items-center justify-between gap-2 px-4 text-left text-[14px] font-medium transition-colors hover:bg-m3-surface-high ${
                                    healthYear === year
                                      ? "bg-m3-primary/8 font-bold text-m3-primary"
                                      : "text-m3-on-surface"
                                  }`}
                                >
                                  <span>{year}</span>
                                  <span className="text-[12px] font-semibold text-m3-on-surface-variant">
                                    {count} lần
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {filteredHealthRecords.length === 0 ? (
                    <p className="py-6 text-center text-[14px] text-m3-on-surface-variant">
                      Không có lần khám nào trong năm {healthYear}.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredHealthRecords.map((r) => {
                        const st = conclusionStyle(r.conclusion);
                        const isOpen = expandedHealthId === r.id;
                        return (
                          <div
                            key={r.id}
                            className="overflow-hidden rounded-[14px] border border-black/[0.06] bg-m3-surface-lowest"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedHealthId(isOpen ? null : r.id)
                              }
                              className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-black/[0.02]"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-[15px] font-bold text-m3-on-surface">
                                      {r.year} · {r.phase}
                                    </p>
                                    <span
                                      className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${
                                        isDetailedHealthPhase(r.phase)
                                          ? "bg-m3-warning/14 text-m3-error"
                                          : "bg-m3-surface-high text-m3-on-surface-variant"
                                      }`}
                                    >
                                      {isDetailedHealthPhase(r.phase) ? "Vòng 2" : "Vòng 1"}
                                    </span>
                                  </div>
                                  <span
                                    className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold"
                                    style={{ background: st.bg, color: st.color }}
                                  >
                                    {r.conclusion}
                                  </span>
                                </div>
                                <p className="mt-1.5 text-[13px] text-m3-on-surface-variant">
                                  {isDetailedHealthPhase(r.phase)
                                    ? `Khám chi tiết · Cao ${r.height} cm · Nặng ${r.weight} kg`
                                    : `Cao ${r.height} cm · Nặng ${r.weight} kg · Huyết áp ${r.bloodPressure} · Thị lực ${r.vision}`}
                                </p>
                              </div>
                              {isOpen ? (
                                <ChevronUp
                                  size={18}
                                  className="mt-1 shrink-0 text-m3-on-surface-variant"
                                />
                              ) : (
                                <ChevronDown
                                  size={18}
                                  className="mt-1 shrink-0 text-m3-on-surface-variant"
                                />
                              )}
                            </button>

                            {isOpen && (
                              <div className="border-t border-black/[0.06] bg-m3-surface-high px-4 py-4">
                                {isDetailedHealthPhase(r.phase)
                                  ? renderDetailedExam(r)
                                  : renderScreeningExam(r)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "residence" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                <p className="text-[12px] font-medium text-m3-on-surface-variant">Cư trú hiện tại</p>
                <p className="mt-0.5 text-[16px] font-bold text-m3-on-surface">
                  {citizen.address || "—"}
                </p>
                {citizen.originPlace && (
                  <p className="mt-1 text-[13px] text-m3-on-surface-variant">
                    Quê quán: {citizen.originPlace}
                    {citizen.phone ? ` · ${citizen.phone}` : ""}
                  </p>
                )}
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold tracking-wide text-m3-primary">
                  <span className="h-3.5 w-1 rounded-full bg-m3-primary" aria-hidden />
                  Lịch sử biến động cư trú
                </h3>

                {residenceLoading ? (
                  <p className="py-6 text-center text-[14px] text-m3-on-surface-variant">
                    Đang tải lịch sử cư trú...
                  </p>
                ) : residenceRecords.length === 0 ? (
                  <p className="rounded-[14px] border border-dashed border-black/[0.1] py-8 text-center text-[14px] text-m3-on-surface-variant">
                    Chưa có biến động cư trú nào được ghi nhận.
                  </p>
                ) : (
                  <div className="relative">
                    <div
                      className="absolute left-[5px] top-5 bottom-5 w-[2px] rounded-full bg-m3-primary/25"
                      aria-hidden
                    />
                    <div className="flex flex-col gap-3">
                      {residenceRecords.map((record) => {
                        const typeStyle =
                          RESIDENCE_TYPE_STYLE[record.type] ?? {
                            bg: "var(--m3-surface-container-high, #eef1f4)",
                            color: "var(--m3-on-surface-variant, #475569)",
                          };
                        const statusStyle = RESIDENCE_STATUS[record.status];
                        const periodLabel =
                          record.status === "current" && record.startYear
                            ? `Từ ${record.startYear} · đang cư trú`
                            : record.startYear && record.endYear
                              ? `${record.startYear} – ${record.endYear}`
                              : record.startYear
                                ? `Từ ${record.startYear}`
                                : null;

                        return (
                          <div key={record.id} className="flex gap-3">
                            <div className="flex w-3 shrink-0 justify-center pt-5">
                              <span
                                className="relative z-10 h-2.5 w-2.5 rounded-full bg-m3-primary ring-[3px] ring-white"
                                aria-hidden
                              />
                            </div>
                            <div className="min-w-0 flex-1 rounded-[14px] border border-black/[0.06] bg-m3-surface-lowest px-4 py-3.5">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span
                                  className="rounded-[8px] px-2.5 py-1 text-[13px] font-bold"
                                  style={{
                                    background: typeStyle.bg,
                                    color: typeStyle.color,
                                  }}
                                >
                                  {record.type}
                                </span>
                                <span
                                  className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold"
                                  style={{
                                    background: statusStyle.bg,
                                    color: statusStyle.color,
                                  }}
                                >
                                  {statusStyle.label}
                                </span>
                              </div>
                              <p className="mt-2 text-[15px] font-bold text-m3-on-surface">
                                {record.address}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-m3-on-surface-variant">
                                {periodLabel && <span>{periodLabel}</span>}
                                {record.decisionNo && (
                                  <span>QĐ: {record.decisionNo}</span>
                                )}
                              </div>
                              {record.note && (
                                <p className="mt-2 text-[13px] italic text-m3-on-surface-variant">
                                  {record.note}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "nvqs" && (
            <div className="rounded-[16px] bg-m3-surface-high p-4">
              {nvqsIsLocked && !nvqsUnlocked && (
                <div className="mb-4 flex items-start gap-3 rounded-[12px] border border-m3-warning/25 bg-m3-warning/8 px-3.5 py-3">
                  <Lock size={18} className="mt-0.5 shrink-0 text-m3-error" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-m3-on-surface">
                      Trạng thái NVQS đã được lưu và khóa
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-m3-on-surface-variant">
                      Không thể sửa trực tiếp. Dùng nút{" "}
                      <strong>Sửa hồ sơ</strong> bên dưới hoặc mở khóa tại đây
                      {needsPinToEdit ? " bằng mã PIN địa phương" : ""}.
                    </p>
                  </div>
                </div>
              )}

              {nvqsIsLocked && !nvqsUnlocked && (
                <div className="mb-4 rounded-[12px] border border-black/[0.06] bg-m3-surface-lowest p-4">
                  {isBoLevel ? (
                    <button
                      type="button"
                      onClick={() => setNvqsUnlocked(true)}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] bg-m3-primary px-5 text-[15px] font-bold text-white hover:bg-m3-primary"
                    >
                      Chỉnh sửa trạng thái
                    </button>
                  ) : needsPinToEdit ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-[14px] font-semibold text-m3-on-surface">
                        <KeyRound size={18} className="text-m3-primary" />
                        Nhập mã PIN địa phương để sửa
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          className={`${NVQS_INPUT_CLS} sm:max-w-[220px]`}
                          placeholder="Mã PIN (6 số)"
                          value={nvqsPin}
                          onChange={(e) => {
                            setNvqsPin(e.target.value);
                            setNvqsPinError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleVerifyNvqsPin();
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleVerifyNvqsPin}
                          disabled={nvqsPinVerifying}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-m3-primary px-5 text-[15px] font-bold text-white hover:bg-m3-primary disabled:opacity-40"
                        >
                          {nvqsPinVerifying ? "Đang xác minh..." : "Xác nhận PIN"}
                        </button>
                      </div>
                      {nvqsPinError && (
                        <p className="text-[13px] text-m3-error">{nvqsPinError}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <label
                    htmlFor="nvqs-status"
                    className="text-[14px] font-medium text-m3-on-surface-variant"
                  >
                    Dự kiến tuyển gọi
                  </label>
                  {nvqsCanEdit ? (
                    <select
                      id="nvqs-status"
                      className={`${NVQS_INPUT_CLS} mt-1.5`}
                      value={nvqsCallChoice}
                      onChange={(e) => {
                        const next = e.target.value as NvqsCallChoice;
                        setNvqsCallChoice(next);
                        setNvqsError(null);
                        if (!nvqsChoiceNeedsReason(next)) setNvqsReason("");
                      }}
                    >
                      {NVQS_CALL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1.5 text-[17px] font-semibold text-m3-on-surface">
                      {getCallDisplayLabel(citizen).label}
                    </p>
                  )}
                </div>

                {nvqsCanEdit && nvqsCallChoice === "du_kien_goi" && (
                  <div className="min-w-0">
                    <label htmlFor="nvqs-campaign" className="text-[14px] font-medium text-m3-on-surface-variant">
                      Đợt khám tuyển <span className="text-m3-error">*</span>
                    </label>
                    <select
                      id="nvqs-campaign"
                      className={`${NVQS_INPUT_CLS} mt-1.5`}
                      value={campaignId}
                      onChange={(e) => {
                        setCampaignId(e.target.value);
                        setNvqsError(null);
                      }}
                    >
                      <option value="">Chọn đợt khám tuyển...</option>
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name} ({campaign.year})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {nvqsChoiceNeedsReason(
                  nvqsCanEdit ? nvqsCallChoice : citizenToNvqsChoice(citizen),
                ) &&
                  (nvqsCanEdit ? (
                    <div className="min-w-0">
                      <label
                        htmlFor="nvqs-reason"
                        className="text-[14px] font-medium text-m3-on-surface-variant"
                      >
                        Lý do{" "}
                        <span className="text-m3-error">*</span>
                      </label>
                      <textarea
                        id="nvqs-reason"
                        rows={3}
                        className={`${NVQS_INPUT_CLS} mt-1.5 min-h-[88px] resize-y py-3`}
                        placeholder="Nhập lý do tạm hoãn (VD: đang theo học đại học...)"
                        value={nvqsReason}
                        onChange={(e) => {
                          setNvqsReason(e.target.value);
                          setNvqsError(null);
                        }}
                      />
                    </div>
                  ) : (
                    renderStackField("Lý do", citizen.militaryStatusReason)
                  ))}

                {renderStackField("Phân loại sức khỏe", citizen.healthStatus)}
              </div>

              {nvqsError && (
                <p className="mt-3 rounded-[12px] bg-m3-error/8 px-3 py-2.5 text-[13px] text-m3-error">
                  {nvqsError}
                </p>
              )}

              {nvqsCanEdit && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveNvqs}
                    disabled={
                      nvqsSaving ||
                      (nvqsCallChoice === citizenToNvqsChoice(citizen) &&
                        nvqsReason.trim() === (citizen.militaryStatusReason || "").trim())
                    }
                    className="inline-flex min-h-[44px] items-center rounded-[12px] bg-m3-primary px-5 text-[15px] font-bold text-white transition-opacity hover:bg-m3-primary disabled:opacity-40"
                  >
                    {nvqsSaving ? "Đang lưu..." : "Lưu trạng thái"}
                  </button>
                  {nvqsUnlocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setNvqsUnlocked(false);
                        setNvqsVerifiedPin("");
                        setNvqsCallChoice(citizenToNvqsChoice(citizen));
                        setNvqsReason(citizen.militaryStatusReason || "");
                        setNvqsError(null);
                      }}
                      className="inline-flex min-h-[44px] items-center rounded-[12px] border border-black/[0.08] bg-m3-surface-lowest px-4 text-[14px] font-semibold text-m3-on-surface-variant hover:bg-black/[0.03]"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              )}

              <p className="mt-4 text-[13px] text-m3-on-surface-variant">
                Hiện tại:{" "}
                <strong className="text-m3-on-surface">
                  {getCallDisplayLabel(citizen).label}
                </strong>
                {citizen.approvalStatus === "pending" &&
                  citizen.callIntent === "du_kien_goi" && (
                    <> — đang chờ xét duyệt tại mục Xét duyệt danh sách</>
                  )}
                {nvqsIsLocked && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-m3-warning/12 px-2 py-0.5 text-[12px] font-semibold text-m3-error">
                    <Lock size={12} />
                    Đã khóa
                  </span>
                )}
              </p>

              <p className="mt-4 rounded-[12px] bg-m3-primary/8 px-3 py-2.5 text-[13px] text-m3-primary">
                Sau khi lưu, trạng thái sẽ bị khóa. Cấp Bộ có thể sửa trực tiếp; cấp
                Tỉnh / Huyện / Xã cần mã PIN địa phương hoặc dùng{" "}
                <strong>Sửa hồ sơ</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-black/[0.06] bg-m3-surface-high/80 px-5 py-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold text-m3-on-surface-variant hover:bg-black/[0.05]"
          >
            <Printer size={18} />
            In hồ sơ
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] rounded-[12px] bg-m3-surface-lowest px-5 text-[15px] font-bold text-m3-on-surface"
              style={{ border: "1px solid rgba(0,0,0,0.1)" }}
            >
              Đóng
            </button>
            {onEdit && sessionFunctionalRole !== "y_te" && (
              <button
                type="button"
                onClick={() => {
                  onEdit(citizen);
                  handleClose();
                }}
                className="min-h-[44px] rounded-[12px] bg-m3-primary px-5 text-[15px] font-bold text-white"
              >
                Sửa hồ sơ
              </button>
            )}
          </div>
        </div>
      </aside>

      {healthFormRound && citizen && (
        <HealthExamFormModal
          citizenId={citizen.id}
          citizenName={citizen.fullName}
          round={healthFormRound}
          hierarchyLevel={sessionLevel || "xa"}
          year={examYear}
          onClose={() => setHealthFormRound(null)}
          onSaved={() => {
            reloadHealthRecords();
            onCitizenUpdated?.(citizen);
          }}
        />
      )}
    </div>
  );
}

type HealthDetailTabId =
  | "physical"
  | "eye"
  | "dental"
  | "ent"
  | "neuro"
  | "internal"
  | "derma"
  | "surgery"
  | "lab";

const HEALTH_DETAIL_TABS: { id: HealthDetailTabId; label: string }[] = [
  { id: "physical", label: "Thể lực" },
  { id: "eye", label: "Mắt" },
  { id: "dental", label: "RHM" },
  { id: "ent", label: "TMH" },
  { id: "neuro", label: "Thần kinh" },
  { id: "internal", label: "Nội khoa" },
  { id: "derma", label: "Da liễu" },
  { id: "surgery", label: "Ngoại khoa" },
  { id: "lab", label: "Xét nghiệm" },
];

function HealthDetailField({
  label,
  value,
  colSpan = 1,
}: {
  label: string;
  value: string | undefined | null;
  colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "col-span-2 min-w-0" : "min-w-0"}>
      <p className="text-[12px] font-medium text-m3-on-surface-variant">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold leading-snug text-m3-on-surface break-words">
        {value || "—"}
      </p>
    </div>
  );
}

function DetailedHealthExamTabs({ record }: { record: HealthRecord }) {
  const [tab, setTab] = useState<HealthDetailTabId>("physical");
  const d = record.detail;
  const bmi = (record.weight / (record.height / 100) ** 2).toFixed(1);

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[10px] bg-m3-primary/8 px-3 py-2 text-[13px] leading-snug text-m3-primary">
        <strong>Vòng 2</strong> · Khám sức khỏe chi tiết tại TTYT huyện / tỉnh.
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        <HealthDetailField
          label="Ngày khám"
          value={new Date(record.createdAt).toLocaleDateString("vi-VN")}
        />
        <HealthDetailField
          label="Cơ sở khám"
          value={d?.facility || record.phase}
        />
        <HealthDetailField label="Kết luận phân loại" value={record.conclusion} />
        <HealthDetailField
          label="Ý nghĩa"
          value={getHealthConclusionMeaning(record.conclusion, record.phase)}
        />
        <HealthDetailField label="Bác sĩ phụ trách" value={record.doctor} />
      </div>

      <div className="overflow-hidden rounded-[12px] border border-black/[0.06] bg-m3-surface-lowest">
        <div className="flex gap-1 overflow-x-auto border-b border-black/[0.06] px-2">
          {HEALTH_DETAIL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                tab === t.id
                  ? "border-m3-primary text-m3-primary"
                  : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "physical" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <HealthDetailField label="Chiều cao" value={`${record.height} cm`} />
              <HealthDetailField label="Cân nặng" value={`${record.weight} kg`} />
              <HealthDetailField
                label="Vòng ngực"
                value={d?.chestCircumference ? `${d.chestCircumference} cm` : undefined}
              />
              <HealthDetailField label="BMI" value={bmi} />
            </div>
          )}
          {tab === "eye" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <HealthDetailField label="Mắt trái" value={d?.visionLeft} />
              <HealthDetailField label="Mắt phải" value={d?.visionRight} />
              <HealthDetailField label="Thị lực (tóm tắt)" value={record.vision} colSpan={2} />
            </div>
          )}
          {tab === "dental" && (
            <HealthDetailField label="Kết quả khám răng – hàm – mặt" value={d?.dental} colSpan={2} />
          )}
          {tab === "ent" && (
            <HealthDetailField label="Kết quả khám tai – mũi – họng" value={d?.ent} colSpan={2} />
          )}
          {tab === "neuro" && (
            <HealthDetailField
              label="Kết quả khám tâm thần và thần kinh"
              value={d?.neurology}
              colSpan={2}
            />
          )}
          {tab === "internal" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <HealthDetailField label="Mạch" value={d?.pulse} />
              <HealthDetailField label="Huyết áp" value={record.bloodPressure} />
              <HealthDetailField label="Phổi – tim" value={d?.internalMedicine} colSpan={2} />
            </div>
          )}
          {tab === "derma" && (
            <HealthDetailField label="Kết quả khám da liễu" value={d?.dermatology} colSpan={2} />
          )}
          {tab === "surgery" && (
            <HealthDetailField label="Kết quả khám ngoại khoa" value={d?.surgery} colSpan={2} />
          )}
          {tab === "lab" && (
            <div className="grid grid-cols-1 gap-y-3">
              <HealthDetailField label="Xét nghiệm máu" value={d?.bloodTest || d?.labTests} colSpan={2} />
              <HealthDetailField label="Xét nghiệm nước tiểu" value={d?.urineTest} colSpan={2} />
              <HealthDetailField label="Siêu âm" value={d?.ultrasound} colSpan={2} />
              <HealthDetailField label="Điện tim" value={d?.ecg} colSpan={2} />
              <HealthDetailField label="X-quang phổi" value={d?.chestXray} colSpan={2} />
              <HealthDetailField label="Sàng lọc ma túy / HIV" value={d?.drugHivScreen} colSpan={2} />
            </div>
          )}
        </div>
      </div>

      {record.note && (
        <div className="rounded-[12px] border border-black/[0.05] bg-m3-surface-lowest p-3.5">
          <HealthDetailField label="Ghi chú" value={record.note} colSpan={2} />
        </div>
      )}
    </div>
  );
}

export type { TabId as CitizenDetailTab };
