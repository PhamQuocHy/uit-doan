"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Printer, ChevronDown, ChevronUp, Filter, Lock, KeyRound } from "lucide-react";
import type { Citizen, EducationRecord, HealthRecord, ResidenceRecord } from "@/lib/data";
import {
  getHealthConclusionMeaning,
  hierarchyNeedsEditPin,
  isDetailedHealthPhase,
} from "@/lib/data";

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
  completed: { label: "Đã tốt nghiệp", bg: "rgba(52,199,89,0.14)", color: "#248a3d" },
  studying: { label: "Đang học", bg: "rgba(0,122,255,0.12)", color: "#007aff" },
  dropped: { label: "Bỏ học", bg: "rgba(255,59,48,0.1)", color: "#ff3b30" },
};

const EDUCATION_LEVEL_STYLE: Record<string, { bg: string; color: string }> = {
  "9/12": { bg: "#f2f4f6", color: "#636366" },
  "12/12": { bg: "rgba(0,122,255,0.1)", color: "#007aff" },
  "Cao đẳng": { bg: "rgba(255,149,0,0.14)", color: "#c93400" },
  "Đại học": { bg: "rgba(52,199,89,0.14)", color: "#248a3d" },
  "Thạc sĩ": { bg: "rgba(175,82,222,0.12)", color: "#8944ab" },
  "Tiến sĩ": { bg: "rgba(255,59,48,0.1)", color: "#ff3b30" },
};

const RESIDENCE_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  "Quê quán": { bg: "#f2f4f6", color: "#636366" },
  "Thường trú": { bg: "rgba(0,122,255,0.1)", color: "#007aff" },
  "Tạm trú": { bg: "rgba(255,149,0,0.14)", color: "#c93400" },
  "Chuyển đi": { bg: "rgba(255,59,48,0.1)", color: "#ff3b30" },
};

const RESIDENCE_STATUS: Record<
  ResidenceRecord["status"],
  { label: string; bg: string; color: string }
> = {
  current: { label: "Đang cư trú", bg: "rgba(52,199,89,0.14)", color: "#248a3d" },
  past: { label: "Đã chuyển đi", bg: "#f2f4f6", color: "#636366" },
  pending: { label: "Chờ xác nhận", bg: "rgba(255,149,0,0.14)", color: "#c93400" },
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

const NVQS_STATUS_OPTIONS: { value: Citizen["militaryStatus"]; label: string }[] = [
  { value: "chuakham", label: "Chưa khám" },
  { value: "dangkham", label: "Đang khám" },
  { value: "trungtuyen", label: "Đậu" },
  { value: "truottuyen", label: "Rớt" },
  { value: "tamhoan", label: "Tạm hoãn" },
  { value: "miengoi", label: "Miễn gọi" },
  { value: "nhapngu", label: "Nhập ngũ" },
];

const NVQS_INPUT_CLS =
  "w-full min-h-[44px] rounded-[12px] border border-black/[0.08] bg-white px-4 text-[15px] text-[#1d1d1f] outline-none transition-colors focus:border-[#007aff]/40 focus:ring-2 focus:ring-[#007aff]/15";

function nvqsStatusNeedsReason(status: Citizen["militaryStatus"]) {
  return status === "truottuyen" || status === "tamhoan";
}

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
  const [nvqsStatus, setNvqsStatus] = useState<Citizen["militaryStatus"]>("chuakham");
  const [nvqsReason, setNvqsReason] = useState("");
  const [nvqsSaving, setNvqsSaving] = useState(false);
  const [nvqsError, setNvqsError] = useState<string | null>(null);
  const [nvqsUnlocked, setNvqsUnlocked] = useState(false);
  const [nvqsPin, setNvqsPin] = useState("");
  const [nvqsPinError, setNvqsPinError] = useState<string | null>(null);
  const [nvqsPinVerifying, setNvqsPinVerifying] = useState(false);
  const [nvqsVerifiedPin, setNvqsVerifiedPin] = useState("");
  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
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
    setTab(initialTab);
    const t = window.setTimeout(() => setOpen(true), 10);
    return () => window.clearTimeout(t);
  }, [citizen, initialTab]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSessionLevel(data?.user?.hierarchyLevel ?? null))
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
      setNvqsStatus("chuakham");
      setNvqsReason("");
      setNvqsError(null);
      setNvqsUnlocked(false);
      setNvqsPin("");
      setNvqsVerifiedPin("");
      setNvqsPinError(null);
      return;
    }
    setNvqsStatus(citizen.militaryStatus);
    setNvqsReason(citizen.militaryStatusReason || "");
    setNvqsError(null);
    setNvqsUnlocked(false);
    setNvqsPin("");
    setNvqsVerifiedPin("");
    setNvqsPinError(null);
  }, [citizen?.id, citizen?.militaryStatus, citizen?.militaryStatusReason, citizen?.militaryStatusLocked]);

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

    if (nvqsStatusNeedsReason(nvqsStatus) && !nvqsReason.trim()) {
      setNvqsError("Vui lòng nhập lý do khi chọn Rớt hoặc Tạm hoãn.");
      return;
    }

    setNvqsSaving(true);
    setNvqsError(null);
    try {
      const res = await fetch(`/api/admin/citizens/${citizen.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          militaryStatus: nvqsStatus,
          militaryStatusReason: nvqsStatusNeedsReason(nvqsStatus)
            ? nvqsReason.trim()
            : "",
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

  if (!citizen) return null;

  const renderCell = (
    label: string,
    value: string | undefined | null,
    colSpan: 1 | 2 = 1,
  ) => (
    <div className={colSpan === 2 ? "col-span-2 min-w-0" : "min-w-0"}>
      <p className="text-[14px] font-normal text-[#8e8e93]">{label}</p>
      <p className="mt-0.5 text-[17px] font-medium leading-snug text-[#1d1d1f] break-words">
        {value || "—"}
      </p>
    </div>
  );

  const renderSectionBlock = (title: string, children: ReactNode) => (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-[16px] font-medium text-[#007aff]">
        <span className="h-3.5 w-1 rounded-full bg-[#007aff]" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );

  const renderStackField = (label: string, value: string | undefined | null) => (
    <div className="min-w-0">
      <p className="text-[14px] font-medium text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[17px] font-semibold leading-snug text-[#1d1d1f] break-words">
        {value || "—"}
      </p>
    </div>
  );

  const conclusionStyle = (c: string) => {
    if (["Loại 1", "Loại 2", "Loại 3"].includes(c)) {
      return { bg: "rgba(52,199,89,0.14)", color: "#248a3d" };
    }
    return { bg: "rgba(255,59,48,0.1)", color: "#ff3b30" };
  };

  const calcBmi = (height: number, weight: number) =>
    (weight / (height / 100) ** 2).toFixed(1);

  const renderScreeningExam = (r: HealthRecord) => (
    <div className="flex flex-col gap-3">
      <p className="rounded-[10px] bg-[rgba(0,122,255,0.08)] px-3 py-2 text-[13px] leading-snug text-[#007aff]">
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
    <div className="fixed inset-0 z-50 flex justify-end">
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
        className={`relative flex h-full w-full max-w-[820px] flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="citizen-drawer-title"
              className="truncate text-[20px] font-semibold text-[#1d1d1f]"
            >
              Hồ sơ lý lịch
            </h2>
          
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-[12px] p-2.5 text-[#636366] hover:bg-black/[0.05]"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/[0.06] px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-3 text-[15px] font-normal transition-colors ${
                tab === t.id
                  ? "border-[#007aff] text-[#007aff]"
                  : "border-transparent text-[#6e6e73] hover:text-[#1d1d1f]"
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
              <div className="flex items-center gap-4 rounded-[16px] bg-gradient-to-r from-[rgba(0,122,255,0.08)] to-transparent p-4">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(citizen.fullName)}&background=007aff&color=fff&size=128&font-size=0.33`}
                  alt=""
                  className="h-30 w-24 shrink-0 rounded-[14px] object-cover shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[20px] font-medium text-[#1d1d1f]">{citizen.fullName}</p>
                  <p className="mt-1 text-[16px] text-[#6e6e73]">
                    {citizen.gender === "male" ? "Nam" : "Nữ"}
                    {" · "}
                    {new Date(citizen.dateOfBirth).toLocaleDateString("vi-VN")}
                    {citizen.phone ? ` · ${citizen.phone}` : ""}
                  </p>
                  
                </div>
              </div>

              {/* Unified detail card */}
              <div className="rounded-[16px] border border-black/[0.06] bg-white p-5">
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
              <div className="rounded-[14px] border border-black/[0.06] bg-[#f8fafb] px-4 py-3">
                <p className="text-[12px] font-medium text-[#8e8e93]">Trình độ hiện tại</p>
                <p className="mt-0.5 text-[16px] font-bold text-[#1d1d1f]">
                  {citizen.educationLevel}
                  {citizen.job ? (
                    <span className="font-semibold text-[#6e6e73]"> · {citizen.job}</span>
                  ) : null}
                </p>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold tracking-wide text-[#007aff]">
                  <span className="h-3.5 w-1 rounded-full bg-[#007aff]" aria-hidden />
                  Quá trình học tập
                </h3>

                {educationLoading ? (
                  <p className="py-6 text-center text-[14px] text-[#6e6e73]">
                    Đang tải lịch sử học vấn...
                  </p>
                ) : educationRecords.length === 0 ? (
                  <p className="rounded-[14px] border border-dashed border-black/[0.1] py-8 text-center text-[14px] text-[#6e6e73]">
                    Chưa có bằng cấp / chứng chỉ nào được ghi nhận.
                  </p>
                ) : (
                  <div className="relative">
                    <div
                      className="absolute left-[5px] top-5 bottom-5 w-[2px] rounded-full bg-[#007aff]/25"
                      aria-hidden
                    />
                    <div className="flex flex-col gap-3">
                      {educationRecords.map((record) => {
                        const levelStyle =
                          EDUCATION_LEVEL_STYLE[record.level] ?? {
                            bg: "#f2f4f6",
                            color: "#636366",
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
                                className="relative z-10 h-2.5 w-2.5 rounded-full bg-[#007aff] ring-[3px] ring-white"
                                aria-hidden
                              />
                            </div>
                            <div className="min-w-0 flex-1 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3.5">
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
                              <p className="mt-2 text-[15px] font-bold text-[#1d1d1f]">
                                {record.institution}
                              </p>
                              {record.major && (
                                <p className="mt-0.5 text-[14px] text-[#6e6e73]">
                                  Ngành: {record.major}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#8e8e93]">
                                {yearLabel && <span>{yearLabel}</span>}
                                {record.certificateNo && (
                                  <span>Số bằng: {record.certificateNo}</span>
                                )}
                              </div>
                              {record.note && (
                                <p className="mt-2 text-[13px] italic text-[#6e6e73]">
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
              <div className="rounded-[14px] border border-black/[0.06] bg-[#f8fafb] px-4 py-3">
                <p className="text-[12px] font-medium text-[#8e8e93]">
                  Phân loại sức khỏe (tóm tắt)
                </p>
                <p className="mt-0.5 text-[16px] font-bold text-[#1d1d1f]">
                  {citizen.healthStatus || "—"}
                </p>
                {citizen.healthStatus && (
                  <p className="mt-1 text-[13px] font-medium text-[#248a3d]">
                    {getHealthConclusionMeaning(citizen.healthStatus, 'Khám tuyển cấp huyện')}
                  </p>
                )}
              </div>

              {healthLoading ? (
                <p className="py-6 text-center text-[14px] text-[#6e6e73]">
                  Đang tải lịch sử khám...
                </p>
              ) : healthRecords.length === 0 ? (
                <p className="rounded-[14px] border border-dashed border-black/[0.1] py-8 text-center text-[14px] text-[#6e6e73]">
                  Chưa có lần khám nào trong hệ thống.
                </p>
              ) : (
                <>
                  {healthYears.length > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[15px] font-bold text-[#1d1d1f]">
                        Lịch sử khám
                        {healthYear !== null && (
                          <span className="ml-1.5 font-semibold text-[#6e6e73]">
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
                              ? "border-[#007aff]/30 bg-[rgba(0,122,255,0.1)] text-[#007aff]"
                              : "border-black/[0.08] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
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
                            className="absolute right-0 z-20 mt-2 max-h-[240px] w-44 overflow-y-auto rounded-[14px] border border-black/[0.08] bg-white py-1.5 shadow-lg"
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
                                  className={`flex w-full min-h-[42px] items-center justify-between gap-2 px-4 text-left text-[14px] font-medium transition-colors hover:bg-[#f5f5f7] ${
                                    healthYear === year
                                      ? "bg-[rgba(0,122,255,0.08)] font-bold text-[#007aff]"
                                      : "text-[#1d1d1f]"
                                  }`}
                                >
                                  <span>{year}</span>
                                  <span className="text-[12px] font-semibold text-[#8e8e93]">
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
                    <p className="py-6 text-center text-[14px] text-[#6e6e73]">
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
                            className="overflow-hidden rounded-[14px] border border-black/[0.06] bg-white"
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
                                    <p className="text-[15px] font-bold text-[#1d1d1f]">
                                      {r.year} · {r.phase}
                                    </p>
                                    <span
                                      className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${
                                        isDetailedHealthPhase(r.phase)
                                          ? "bg-[rgba(255,149,0,0.14)] text-[#c93400]"
                                          : "bg-[#f2f4f6] text-[#636366]"
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
                                <p className="mt-1.5 text-[13px] text-[#6e6e73]">
                                  {isDetailedHealthPhase(r.phase)
                                    ? `Khám chi tiết · Cao ${r.height} cm · Nặng ${r.weight} kg`
                                    : `Cao ${r.height} cm · Nặng ${r.weight} kg · Huyết áp ${r.bloodPressure} · Thị lực ${r.vision}`}
                                </p>
                              </div>
                              {isOpen ? (
                                <ChevronUp
                                  size={18}
                                  className="mt-1 shrink-0 text-[#8e8e93]"
                                />
                              ) : (
                                <ChevronDown
                                  size={18}
                                  className="mt-1 shrink-0 text-[#8e8e93]"
                                />
                              )}
                            </button>

                            {isOpen && (
                              <div className="border-t border-black/[0.06] bg-[#f8fafb] px-4 py-4">
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
              <div className="rounded-[14px] border border-black/[0.06] bg-[#f8fafb] px-4 py-3">
                <p className="text-[12px] font-medium text-[#8e8e93]">Cư trú hiện tại</p>
                <p className="mt-0.5 text-[16px] font-bold text-[#1d1d1f]">
                  {citizen.address || "—"}
                </p>
                {citizen.originPlace && (
                  <p className="mt-1 text-[13px] text-[#6e6e73]">
                    Quê quán: {citizen.originPlace}
                    {citizen.phone ? ` · ${citizen.phone}` : ""}
                  </p>
                )}
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold tracking-wide text-[#007aff]">
                  <span className="h-3.5 w-1 rounded-full bg-[#007aff]" aria-hidden />
                  Lịch sử biến động cư trú
                </h3>

                {residenceLoading ? (
                  <p className="py-6 text-center text-[14px] text-[#6e6e73]">
                    Đang tải lịch sử cư trú...
                  </p>
                ) : residenceRecords.length === 0 ? (
                  <p className="rounded-[14px] border border-dashed border-black/[0.1] py-8 text-center text-[14px] text-[#6e6e73]">
                    Chưa có biến động cư trú nào được ghi nhận.
                  </p>
                ) : (
                  <div className="relative">
                    <div
                      className="absolute left-[5px] top-5 bottom-5 w-[2px] rounded-full bg-[#007aff]/25"
                      aria-hidden
                    />
                    <div className="flex flex-col gap-3">
                      {residenceRecords.map((record) => {
                        const typeStyle =
                          RESIDENCE_TYPE_STYLE[record.type] ?? {
                            bg: "#f2f4f6",
                            color: "#636366",
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
                                className="relative z-10 h-2.5 w-2.5 rounded-full bg-[#007aff] ring-[3px] ring-white"
                                aria-hidden
                              />
                            </div>
                            <div className="min-w-0 flex-1 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3.5">
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
                              <p className="mt-2 text-[15px] font-bold text-[#1d1d1f]">
                                {record.address}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#8e8e93]">
                                {periodLabel && <span>{periodLabel}</span>}
                                {record.decisionNo && (
                                  <span>QĐ: {record.decisionNo}</span>
                                )}
                              </div>
                              {record.note && (
                                <p className="mt-2 text-[13px] italic text-[#6e6e73]">
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
            <div className="rounded-[16px] bg-[#f8fafb] p-4">
              {nvqsIsLocked && !nvqsUnlocked && (
                <div className="mb-4 flex items-start gap-3 rounded-[12px] border border-[rgba(255,149,0,0.25)] bg-[rgba(255,149,0,0.08)] px-3.5 py-3">
                  <Lock size={18} className="mt-0.5 shrink-0 text-[#c93400]" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">
                      Trạng thái NVQS đã được lưu và khóa
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-[#6e6e73]">
                      Không thể sửa trực tiếp. Dùng nút{" "}
                      <strong>Sửa hồ sơ</strong> bên dưới hoặc mở khóa tại đây
                      {needsPinToEdit ? " bằng mã PIN địa phương" : ""}.
                    </p>
                  </div>
                </div>
              )}

              {nvqsIsLocked && !nvqsUnlocked && (
                <div className="mb-4 rounded-[12px] border border-black/[0.06] bg-white p-4">
                  {isBoLevel ? (
                    <button
                      type="button"
                      onClick={() => setNvqsUnlocked(true)}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] bg-[#007aff] px-5 text-[15px] font-bold text-white hover:bg-[#0066d6]"
                    >
                      Chỉnh sửa trạng thái
                    </button>
                  ) : needsPinToEdit ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1d1d1f]">
                        <KeyRound size={18} className="text-[#007aff]" />
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
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[#007aff] px-5 text-[15px] font-bold text-white hover:bg-[#0066d6] disabled:opacity-40"
                        >
                          {nvqsPinVerifying ? "Đang xác minh..." : "Xác nhận PIN"}
                        </button>
                      </div>
                      {nvqsPinError && (
                        <p className="text-[13px] text-[#ff3b30]">{nvqsPinError}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <label
                    htmlFor="nvqs-status"
                    className="text-[14px] font-medium text-[#6e6e73]"
                  >
                    Tình trạng NVQS
                  </label>
                  {nvqsCanEdit ? (
                    <select
                      id="nvqs-status"
                      className={`${NVQS_INPUT_CLS} mt-1.5`}
                      value={nvqsStatus}
                      onChange={(e) => {
                        const next = e.target.value as Citizen["militaryStatus"];
                        setNvqsStatus(next);
                        setNvqsError(null);
                        if (!nvqsStatusNeedsReason(next)) setNvqsReason("");
                      }}
                    >
                      {NVQS_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1.5 text-[17px] font-semibold text-[#1d1d1f]">
                      {MILITARY_STATUS[citizen.militaryStatus] || citizen.militaryStatus}
                    </p>
                  )}
                </div>

                {nvqsStatusNeedsReason(
                  nvqsCanEdit ? nvqsStatus : citizen.militaryStatus,
                ) &&
                  (nvqsCanEdit ? (
                    <div className="min-w-0">
                      <label
                        htmlFor="nvqs-reason"
                        className="text-[14px] font-medium text-[#6e6e73]"
                      >
                        Lý do{" "}
                        <span className="text-[#ff3b30]">*</span>
                      </label>
                      <textarea
                        id="nvqs-reason"
                        rows={3}
                        className={`${NVQS_INPUT_CLS} mt-1.5 min-h-[88px] resize-y py-3`}
                        placeholder={
                          nvqsStatus === "truottuyen"
                            ? "Nhập lý do rớt tuyển (VD: không đủ tiêu chuẩn sức khỏe...)"
                            : "Nhập lý do tạm hoãn (VD: đang theo học đại học...)"
                        }
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
                <p className="mt-3 rounded-[12px] bg-[rgba(255,59,48,0.08)] px-3 py-2.5 text-[13px] text-[#ff3b30]">
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
                      (nvqsStatus === citizen.militaryStatus &&
                        nvqsReason.trim() === (citizen.militaryStatusReason || "").trim())
                    }
                    className="inline-flex min-h-[44px] items-center rounded-[12px] bg-[#007aff] px-5 text-[15px] font-bold text-white transition-opacity hover:bg-[#0066d6] disabled:opacity-40"
                  >
                    {nvqsSaving ? "Đang lưu..." : "Lưu trạng thái"}
                  </button>
                  {nvqsUnlocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setNvqsUnlocked(false);
                        setNvqsVerifiedPin("");
                        setNvqsStatus(citizen.militaryStatus);
                        setNvqsReason(citizen.militaryStatusReason || "");
                        setNvqsError(null);
                      }}
                      className="inline-flex min-h-[44px] items-center rounded-[12px] border border-black/[0.08] bg-white px-4 text-[14px] font-semibold text-[#6e6e73] hover:bg-black/[0.03]"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              )}

              <p className="mt-4 text-[13px] text-[#6e6e73]">
                Hiện tại:{" "}
                <strong className="text-[#1d1d1f]">
                  {MILITARY_STATUS[citizen.militaryStatus] || citizen.militaryStatus}
                </strong>
                {citizen.militaryStatusReason &&
                  nvqsStatusNeedsReason(citizen.militaryStatus) && (
                    <> — {citizen.militaryStatusReason}</>
                  )}
                {nvqsIsLocked && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[rgba(255,149,0,0.12)] px-2 py-0.5 text-[12px] font-semibold text-[#c93400]">
                    <Lock size={12} />
                    Đã khóa
                  </span>
                )}
              </p>

              <p className="mt-4 rounded-[12px] bg-[rgba(0,122,255,0.08)] px-3 py-2.5 text-[13px] text-[#007aff]">
                Sau khi lưu, trạng thái sẽ bị khóa. Cấp Bộ có thể sửa trực tiếp; cấp
                Tỉnh / Huyện / Xã cần mã PIN địa phương hoặc dùng{" "}
                <strong>Sửa hồ sơ</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-black/[0.06] bg-[#f8fafb]/80 px-5 py-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold text-[#6e6e73] hover:bg-black/[0.05]"
          >
            <Printer size={18} />
            In hồ sơ
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] rounded-[12px] bg-white px-5 text-[15px] font-bold text-[#1d1d1f]"
              style={{ border: "1px solid rgba(0,0,0,0.1)" }}
            >
              Đóng
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(citizen);
                  handleClose();
                }}
                className="min-h-[44px] rounded-[12px] bg-[#007aff] px-5 text-[15px] font-bold text-white"
              >
                Sửa hồ sơ
              </button>
            )}
          </div>
        </div>
      </aside>
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
      <p className="text-[12px] font-medium text-[#8e8e93]">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold leading-snug text-[#1d1d1f] break-words">
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
      <p className="rounded-[10px] bg-[rgba(0,122,255,0.08)] px-3 py-2 text-[13px] leading-snug text-[#007aff]">
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

      <div className="overflow-hidden rounded-[12px] border border-black/[0.06] bg-white">
        <div className="flex gap-1 overflow-x-auto border-b border-black/[0.06] px-2">
          {HEALTH_DETAIL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                tab === t.id
                  ? "border-[#007aff] text-[#007aff]"
                  : "border-transparent text-[#6e6e73] hover:text-[#1d1d1f]"
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
            <HealthDetailField label="Kết quả xét nghiệm" value={d?.labTests} colSpan={2} />
          )}
        </div>
      </div>

      {record.note && (
        <div className="rounded-[12px] border border-black/[0.05] bg-white p-3.5">
          <HealthDetailField label="Ghi chú" value={record.note} colSpan={2} />
        </div>
      )}
    </div>
  );
}

export type { TabId as CitizenDetailTab };
