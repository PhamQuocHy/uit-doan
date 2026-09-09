"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Printer, ChevronDown, ChevronUp, Filter, Lock, Plus } from "lucide-react";
import type { Citizen, EducationRecord, HealthRecord, ResidenceRecord, ResidenceType } from "@/lib/data";
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
  mergeHealthYearOptions,
  yearHasOpenExamSlot,
  type HealthExamRound,
} from "@/lib/health-exam";
import { calcAgeYears, NVQS_AGE_MAX, NVQS_AGE_MIN } from "@/lib/nvqs-age";
import {
  getNvqsExamYearWindow,
  lifecycleStageLabel,
  resolveLifecycleStage,
} from "@/lib/nvqs-lifecycle";
import DateVnInput from "@/components/admin/DateVnInput";
import { formatVnDate } from "@/lib/date-vn";

type TabId = "identity" | "education" | "health" | "residence" | "nvqs" | "comments";

const TABS: { id: TabId; label: string }[] = [
  { id: "identity", label: "Định danh" },
  { id: "education", label: "Học vấn" },
  { id: "health", label: "Sức khỏe" },
  { id: "residence", label: "Cư trú" },
  { id: "nvqs", label: "NVQS" },
  { id: "comments", label: "Nhận xét" },
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
  { value: "du_bi", label: "Dự bị" },
  { value: "khong_goi", label: "Đề xuất không gọi" },
  { value: "tamhoan", label: "Tạm hoãn (chờ Quân khu duyệt)" },
  { value: "miengoi", label: "Miễn gọi" },
];

function citizenToNvqsChoice(c: Citizen): NvqsCallChoice {
  if (c.militaryStatus === "tamhoan") return "tamhoan";
  if (c.militaryStatus === "miengoi") return "miengoi";
  if (c.callIntent === "du_kien_goi") return "du_kien_goi";
  if (c.callIntent === "du_bi") return "du_bi";
  if (c.callIntent === "khong_goi" || c.callIntent === "de_xuat_khong_goi") {
    return "khong_goi";
  }
  return "unset";
}

function nvqsChoiceNeedsReason(choice: NvqsCallChoice) {
  return choice === "tamhoan" || choice === "khong_goi";
}

function nvqsChoiceNeedsFiles(choice: NvqsCallChoice): "khong_goi" | "tam_hoan" | null {
  if (choice === "khong_goi") return "khong_goi";
  if (choice === "tamhoan") return "tam_hoan";
  return null;
}

const NVQS_INPUT_CLS =
  "w-full min-h-[44px] rounded-[12px] border border-black/[0.08] bg-m3-surface-lowest px-4 text-[15px] text-m3-on-surface outline-none transition-colors focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/15";

const PROFILE_INPUT_CLS =
  "mt-0.5 w-full min-h-[40px] rounded-[10px] border border-black/[0.08] bg-m3-surface-lowest px-3 text-[17px] font-medium text-m3-on-surface outline-none transition-colors focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/15";

const EDU_LEVEL_OPTIONS = [
  "9/12",
  "12/12",
  "Cao đẳng",
  "Đại học",
  "Thạc sĩ",
  "Tiến sĩ",
] as const;

const RESIDENCE_TYPE_OPTIONS: ResidenceType[] = [
  "Thường trú",
  "Tạm trú",
  "Quê quán",
  "Chuyển đi",
];

type EduAddForm = {
  institution: string;
  level: string;
  major: string;
  graduationYear: string;
  gpa: string;
};

type ResAddForm = {
  type: ResidenceType;
  address: string;
  startYear: string;
  endYear: string;
  status: ResidenceRecord["status"];
  decisionNo: string;
  note: string;
};

function emptyEduAddForm(): EduAddForm {
  return {
    institution: "",
    level: "Đại học",
    major: "",
    graduationYear: "",
    gpa: "",
  };
}

function emptyResAddForm(): ResAddForm {
  return {
    type: "Thường trú",
    address: "",
    startYear: String(new Date().getFullYear()),
    endYear: "",
    status: "current",
    decisionNo: "",
    note: "",
  };
}

type ProfileDraft = {
  fullName: string;
  phone: string;
  nationality: string;
  ethnicity: string;
  religion: string;
  originPlace: string;
  identificationFeatures: string;
  cccd: string;
  issueDate: string;
  expiryDate: string;
  oldIdNumber: string;
  fatherName: string;
  motherName: string;
  educationLevel: string;
  job: string;
  schoolName: string;
  healthStatus: string;
  address: string;
  gender: string;
  dateOfBirth: string;
};

type ProfileDraftField = keyof ProfileDraft;

function emptyProfileDraft(): ProfileDraft {
  return {
    fullName: "",
    phone: "",
    nationality: "",
    ethnicity: "",
    religion: "",
    originPlace: "",
    identificationFeatures: "",
    cccd: "",
    issueDate: "",
    expiryDate: "",
    oldIdNumber: "",
    fatherName: "",
    motherName: "",
    educationLevel: "",
    job: "",
    schoolName: "",
    healthStatus: "",
    address: "",
    gender: "",
    dateOfBirth: "",
  };
}

interface CitizenDetailModalProps {
  citizen: Citizen | null;
  onClose: () => void;
  onEdit?: (citizen: Citizen) => void;
  onCitizenUpdated?: (citizen: Citizen) => void;
  initialTab?: TabId;
  /**
   * Chế độ xét duyệt (Quân khu): xem đủ hồ sơ như công dân,
   * footer chỉ còn Duyệt gọi / Không gọi thay vì Sửa hồ sơ.
   */
  approvalReview?: boolean;
  approvalCampaignId?: string;
  onApprovalDecision?: (action: "approve" | "reject") => void | Promise<void>;
}

export default function CitizenDetailModal({
  citizen: citizenProp,
  onClose,
  onEdit: _onEdit,
  onCitizenUpdated,
  initialTab = "identity",
  approvalReview = false,
  approvalCampaignId = "",
  onApprovalDecision,
}: CitizenDetailModalProps) {
  const [citizen, setCitizen] = useState<Citizen | null>(citizenProp);
  const [detailLoading, setDetailLoading] = useState(false);
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
  const [nvqsError, setNvqsError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; year: number }[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
  const [sessionFunctionalRole, setSessionFunctionalRole] = useState<string | null>(null);
  const [sessionUserRole, setSessionUserRole] = useState<string | null>(null);
  const [healthFormRound, setHealthFormRound] = useState<HealthExamRound | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profilePin, setProfilePin] = useState("");
  const [listsTick, setListsTick] = useState(0);
  const [showEduForm, setShowEduForm] = useState(false);
  const [eduForm, setEduForm] = useState<EduAddForm>(emptyEduAddForm);
  const [eduSaving, setEduSaving] = useState(false);
  const [eduError, setEduError] = useState<string | null>(null);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [editingEduInstitution, setEditingEduInstitution] = useState("");
  const [eduPatchSaving, setEduPatchSaving] = useState(false);
  const [showResForm, setShowResForm] = useState(false);
  const [resForm, setResForm] = useState<ResAddForm>(emptyResAddForm);
  const [resSaving, setResSaving] = useState(false);
  const [resError, setResError] = useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [nvqsAttachments, setNvqsAttachments] = useState<
    { id: string; fileName: string; url: string; purpose: string }[]
  >([]);
  const [nvqsUploading, setNvqsUploading] = useState(false);

  const needsPinToEdit = sessionLevel !== null && hierarchyNeedsEditPin(sessionLevel);
  const nvqsIsLocked = citizen?.militaryStatusLocked === true;
  const approvedEnlisted =
    citizen?.approvalStatus === "approved" &&
    (citizen.militaryStatusLocked || citizen.militaryStatus === "nhapngu");
  /** Chỉ sửa NVQS khi đang chế độ Sửa hồ sơ (nút footer). */
  const nvqsCanEdit = editing && !approvedEnlisted && !approvalReview;
  const canDecideApproval =
    approvalReview &&
    citizen?.approvalStatus === "pending" &&
    typeof onApprovalDecision === "function";

  const runApprovalDecision = async (action: "approve" | "reject") => {
    if (!onApprovalDecision || approvalBusy) return;
    setApprovalBusy(true);
    setNvqsError(null);
    try {
      await onApprovalDecision(action);
    } catch (e) {
      setNvqsError(e instanceof Error ? e.message : "Không thực hiện được");
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    setEditing(false);
    setSaveError(null);
    setProfilePin("");
    setNvqsError(null);
    window.setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!citizenProp) {
      setCitizen(null);
      setOpen(false);
      setEditing(false);
      setSaveError(null);
      setProfilePin("");
      return;
    }
    setCitizen(citizenProp);
    setEditing(false);
    setSaveError(null);
    setProfilePin("");
    setShowEduForm(false);
    setShowResForm(false);
    setEduError(null);
    setResError(null);
    setEduForm(emptyEduAddForm());
    setResForm(emptyResAddForm());
    setDetailLoading(true);
    let cancelled = false;
    const ac = new AbortController();
    fetch(`/api/admin/citizens/${encodeURIComponent(citizenProp.id)}`, {
      signal: ac.signal,
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.id) return;
        // Merge so list snapshot fields never wipe freshly loaded detail
        setCitizen((prev) => ({ ...(prev || citizenProp), ...data }));
        onCitizenUpdated?.(data);
      })
      .catch(() => {
        /* keep list snapshot */
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [citizenProp?.id]);

  useEffect(() => {
    if (!citizenProp) {
      setOpen(false);
      return;
    }
    setTab(sessionFunctionalRole === "y_te" ? "health" : initialTab);
    const t = window.setTimeout(() => setOpen(true), 10);
    return () => window.clearTimeout(t);
  }, [citizenProp?.id, initialTab, sessionFunctionalRole]);

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
    const citizenId = citizen.id;
    setHealthLoading(true);
    setExpandedHealthId(null);
    const ac = new AbortController();
    fetch(`/api/admin/health?citizenId=${encodeURIComponent(citizenId)}&limit=50`, {
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`health ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const records: HealthRecord[] = Array.isArray(data?.data) ? data.data : [];
        setHealthRecords(records);
        const years = [...new Set(records.map((r) => r.year))];
        const options = mergeHealthYearOptions(citizen.dateOfBirth, years);
        const open = options.find((y) => yearHasOpenExamSlot(records, y));
        setHealthYear(open ?? options[0] ?? new Date().getFullYear());
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setHealthRecords([]);
      })
      .finally(() => setHealthLoading(false));
    return () => ac.abort();
  }, [citizen?.id]);

  useEffect(() => {
    if (!citizen) {
      setEducationRecords([]);
      return;
    }
    const citizenId = citizen.id;
    const snapshot = citizen;
    setEducationLoading(true);
    const ac = new AbortController();
    fetch(`/api/admin/education?citizenId=${encodeURIComponent(citizenId)}&limit=50`, {
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`education ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const records: EducationRecord[] = Array.isArray(data?.data) ? data.data : [];
        if (records.length > 0) {
          setEducationRecords(records);
          return;
        }
        // Fallback from citizen summary so tab never looks empty when level exists
        if (snapshot.educationLevel || snapshot.schoolName) {
          setEducationRecords([
            {
              id: `syn-edu-${citizenId}`,
              citizenId,
              level: snapshot.educationLevel || "THPT",
              institution:
                snapshot.schoolName ||
                "Theo hồ sơ công dân (chưa có chi tiết trường)",
              major: snapshot.job || undefined,
              status: "completed",
              createdAt: snapshot.updatedAt || new Date().toISOString(),
              updatedAt: snapshot.updatedAt || new Date().toISOString(),
            },
          ]);
        } else {
          setEducationRecords([]);
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setEducationRecords([]);
      })
      .finally(() => setEducationLoading(false));
    return () => ac.abort();
  }, [citizen?.id, listsTick]);

  useEffect(() => {
    if (!citizen) {
      setResidenceRecords([]);
      return;
    }
    const citizenId = citizen.id;
    const snapshot = citizen;
    setResidenceLoading(true);
    const ac = new AbortController();
    fetch(`/api/admin/residence?citizenId=${encodeURIComponent(citizenId)}&limit=50`, {
      signal: ac.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`residence ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const records: ResidenceRecord[] = Array.isArray(data?.data) ? data.data : [];
        if (records.length > 0) {
          setResidenceRecords(records);
          return;
        }
        const fallback: ResidenceRecord[] = [];
        if (snapshot.originPlace) {
          fallback.push({
            id: `syn-origin-${citizenId}`,
            citizenId,
            type: "Quê quán",
            address: snapshot.originPlace,
            status: "past",
            createdAt: snapshot.updatedAt || new Date().toISOString(),
            updatedAt: snapshot.updatedAt || new Date().toISOString(),
          });
        }
        if (snapshot.address) {
          fallback.push({
            id: `syn-addr-${citizenId}`,
            citizenId,
            type: "Thường trú",
            address: snapshot.address,
            status: "current",
            createdAt: snapshot.updatedAt || new Date().toISOString(),
            updatedAt: snapshot.updatedAt || new Date().toISOString(),
          });
        }
        setResidenceRecords(fallback);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setResidenceRecords([]);
      })
      .finally(() => setResidenceLoading(false));
    return () => ac.abort();
  }, [citizen?.id, listsTick]);

  useEffect(() => {
    if (!citizen) {
      setNvqsCallChoice("unset");
      setNvqsReason("");
      setNvqsError(null);
      setNvqsAttachments([]);
      return;
    }
    setNvqsCallChoice(citizenToNvqsChoice(citizen));
    setCampaignId(citizen.campaignId || "");
    setNvqsReason(citizen.militaryStatusReason || "");
    setNvqsError(null);
  }, [citizen?.id, citizen?.militaryStatus, citizen?.militaryStatusReason, citizen?.militaryStatusLocked, citizen?.callIntent, citizen?.approvalStatus]);

  useEffect(() => {
    if (!citizen?.id) {
      setNvqsAttachments([]);
      return;
    }
    const ac = new AbortController();
    fetch(`/api/admin/citizens/${encodeURIComponent(citizen.id)}/nvqs-attachments`, {
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        setNvqsAttachments(
          (data.data || []).map(
            (a: { id: string; fileName: string; url: string; purpose: string }) => ({
              id: a.id,
              fileName: a.fileName,
              url: a.url,
              purpose: a.purpose,
            }),
          ),
        );
      })
      .catch(() => {
        if (!ac.signal.aborted) setNvqsAttachments([]);
      });
    return () => ac.abort();
  }, [citizen?.id, listsTick]);

  const uploadNvqsFiles = async (files: FileList) => {
    if (!citizen) return;
    const purpose = nvqsChoiceNeedsFiles(nvqsCallChoice);
    if (!purpose) return;
    setNvqsUploading(true);
    setNvqsError(null);
    try {
      const form = new FormData();
      form.set("purpose", purpose);
      Array.from(files).forEach((f) => form.append("files", f));
      const res = await fetch(
        `/api/admin/citizens/${encodeURIComponent(citizen.id)}/nvqs-attachments`,
        { method: "POST", body: form },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNvqsError(
          typeof data.error === "string" ? data.error : "Không tải lên được",
        );
        return;
      }
      setListsTick((t) => t + 1);
    } catch {
      setNvqsError("Lỗi kết nối khi tải minh chứng");
    } finally {
      setNvqsUploading(false);
    }
  };

  const removeNvqsFile = async (attachmentId: string) => {
    if (!citizen) return;
    try {
      const res = await fetch(
        `/api/admin/citizens/${encodeURIComponent(citizen.id)}/nvqs-attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNvqsError(
          typeof data.error === "string" ? data.error : "Không xóa được tệp",
        );
        return;
      }
      setListsTick((t) => t + 1);
    } catch {
      setNvqsError("Lỗi kết nối khi xóa tệp");
    }
  };

  useEffect(() => {
    fetch("/api/admin/recruitment?limit=100")
      .then((res) => res.json())
      .then((data) => setCampaigns(data.data || []))
      .catch(() => setCampaigns([]));
  }, []);

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

  const lifecycleStage = useMemo(() => {
    if (!citizen) return null;
    return resolveLifecycleStage(citizen.dateOfBirth, citizen.archivedAt);
  }, [citizen?.dateOfBirth, citizen?.archivedAt]);

  const examWindow = useMemo(
    () => getNvqsExamYearWindow(citizen?.dateOfBirth),
    [citizen?.dateOfBirth],
  );

  const citizenAge = useMemo(
    () => (citizen ? calcAgeYears(citizen.dateOfBirth) : 0),
    [citizen?.dateOfBirth],
  );

  const healthYearsFromRecords = useMemo(
    () => [...new Set(healthRecords.map((r) => r.year))].sort((a, b) => b - a),
    [healthRecords],
  );

  const healthYearOptions = useMemo(
    () => mergeHealthYearOptions(citizen?.dateOfBirth, healthYearsFromRecords),
    [citizen?.dateOfBirth, healthYearsFromRecords],
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

  const examYear =
    healthYear ?? healthYearOptions[0] ?? new Date().getFullYear();
  const canEnterHealth = canEnterHealthRecords(
    sessionFunctionalRole,
    sessionUserRole ?? undefined,
  );

  const reloadHealthRecords = useCallback(() => {
    if (!citizen) return;
    const keepYear = healthYear;
    setHealthLoading(true);
    fetch(`/api/admin/health?citizenId=${encodeURIComponent(citizen.id)}&limit=50`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`health ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const records: HealthRecord[] = Array.isArray(data?.data) ? data.data : [];
        setHealthRecords(records);
        const years = [...new Set(records.map((r) => r.year))].sort((a, b) => b - a);
        const options = mergeHealthYearOptions(citizen.dateOfBirth, years);
        if (keepYear != null && options.includes(keepYear)) {
          setHealthYear(keepYear);
        } else {
          const open = options.find((y) => yearHasOpenExamSlot(records, y));
          setHealthYear(open ?? options[0] ?? new Date().getFullYear());
        }
      })
      .catch(() => setHealthRecords([]))
      .finally(() => setHealthLoading(false));
  }, [citizen, healthYear]);

  const startEdit = useCallback(() => {
    if (!citizen) return;
    if (
      citizen.approvalStatus === "approved" &&
      (citizen.militaryStatusLocked || citizen.militaryStatus === "nhapngu")
    ) {
      setSaveError(
        "Hồ sơ đã duyệt gọi nhập ngũ — không được sửa lại.",
      );
      return;
    }
    const sliceDate = (d?: string) => (d ? d.slice(0, 10) : "");
    setDraft({
      fullName: citizen.fullName || "",
      phone: citizen.phone || "",
      nationality: citizen.nationality || "",
      ethnicity: citizen.ethnicity || "",
      religion: citizen.religion || "",
      originPlace: citizen.originPlace || "",
      identificationFeatures: citizen.identificationFeatures || "",
      cccd: citizen.cccd || "",
      issueDate: sliceDate(citizen.issueDate),
      expiryDate: sliceDate(citizen.expiryDate),
      oldIdNumber: citizen.oldIdNumber || "",
      fatherName: citizen.fatherName || "",
      motherName: citizen.motherName || "",
      educationLevel: citizen.educationLevel || "",
      job: citizen.job || "",
      schoolName: citizen.schoolName || "",
      healthStatus: citizen.healthStatus || "",
      address: citizen.address || "",
      gender: citizen.gender || "",
      dateOfBirth: sliceDate(citizen.dateOfBirth),
    });
    setSaveError(null);
    setProfilePin("");
    setEditing(true);
    // Khi sửa: ưu tiên năm còn chỗ nhập (vd. năm hiện tại chưa khám)
    setHealthRecords((records) => {
      const years = [...new Set(records.map((r) => r.year))];
      const options = mergeHealthYearOptions(citizen.dateOfBirth, years);
      const open = options.find((y) => yearHasOpenExamSlot(records, y));
      if (open != null) setHealthYear(open);
      return records;
    });
  }, [citizen]);

  const saveProfile = useCallback(async () => {
    if (!citizen) return;

    const nvqsChanged =
      nvqsCallChoice !== citizenToNvqsChoice(citizen) ||
      nvqsReason.trim() !== (citizen.militaryStatusReason || "").trim() ||
      ((nvqsCallChoice === "du_kien_goi" ||
        nvqsCallChoice === "du_bi" ||
        nvqsCallChoice === "khong_goi" ||
        nvqsCallChoice === "tamhoan") &&
        campaignId !== (citizen.campaignId || ""));

    if (nvqsChanged) {
      if (nvqsChoiceNeedsReason(nvqsCallChoice) && !nvqsReason.trim()) {
        setNvqsError(
          nvqsCallChoice === "tamhoan"
            ? "Vui lòng nhập ghi chú / lý do tạm hoãn."
            : "Vui lòng nhập ghi chú / lý do đề xuất không gọi.",
        );
        setSaveError("Vui lòng hoàn thiện thông tin tab NVQS trước khi lưu.");
        return;
      }
      const filePurpose = nvqsChoiceNeedsFiles(nvqsCallChoice);
      if (filePurpose && nvqsAttachments.filter((a) => a.purpose === filePurpose).length < 1) {
        setNvqsError(
          filePurpose === "tam_hoan"
            ? "Cần tải lên giấy tạm hoãn (minh chứng) trước khi lưu."
            : "Cần tải lên tệp minh chứng (giấy khám SK…) trước khi lưu đề xuất không gọi.",
        );
        setSaveError("Vui lòng hoàn thiện thông tin tab NVQS trước khi lưu.");
        return;
      }
      if (
        (nvqsCallChoice === "du_kien_goi" ||
          nvqsCallChoice === "du_bi" ||
          nvqsCallChoice === "khong_goi" ||
          nvqsCallChoice === "tamhoan") &&
        !campaignId
      ) {
        setNvqsError("Vui lòng chọn đợt khám tuyển.");
        setSaveError("Vui lòng hoàn thiện thông tin tab NVQS trước khi lưu.");
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    setNvqsError(null);
    try {
      const body: Record<string, unknown> = { ...draft };
      if (needsPinToEdit) {
        body.requireEditPin = true;
        body.editPin = profilePin;
      }
      if (nvqsChanged) {
        const isSpecial = nvqsCallChoice === "tamhoan" || nvqsCallChoice === "miengoi";
        const note = nvqsReason.trim();
        const needsCampaign =
          nvqsCallChoice === "du_kien_goi" ||
          nvqsCallChoice === "du_bi" ||
          nvqsCallChoice === "khong_goi" ||
          nvqsCallChoice === "tamhoan";
        if (needsCampaign && !campaignId) {
          setNvqsError("Vui lòng chọn đợt khám tuyển.");
          setSaveError("Vui lòng hoàn thiện thông tin tab NVQS trước khi lưu.");
          setSaving(false);
          return;
        }
        if (isSpecial) {
          body.militaryStatus = nvqsCallChoice;
          body.callIntent = "unset";
          body.militaryStatusReason = note || null;
          // Giữ đợt để QK lọc theo campaign
          if (nvqsCallChoice === "tamhoan") {
            body.campaignId = campaignId;
          }
        } else {
          body.callIntent = nvqsCallChoice;
          body.campaignId = needsCampaign ? campaignId : null;
          body.militaryStatusReason = note || null;
        }
        body.militaryStatusLocked = true;
        if (nvqsIsLocked) {
          body.unlockViaProfile = true;
        }
      }
      const res = await fetch(`/api/admin/citizens/${encodeURIComponent(citizen.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(
          typeof data.error === "string" ? data.error : "Không lưu được hồ sơ",
        );
        return;
      }
      setCitizen(data);
      onCitizenUpdated?.(data);
      setEditing(false);
      setProfilePin("");
      setSaveError(null);
      setShowEduForm(false);
      setShowResForm(false);
      setEduError(null);
      setResError(null);
      setEditingEduId(null);
      setListsTick((t) => t + 1);
    } catch {
      setSaveError("Lỗi kết nối khi lưu hồ sơ");
    } finally {
      setSaving(false);
    }
  }, [
    citizen,
    draft,
    needsPinToEdit,
    profilePin,
    onCitizenUpdated,
    nvqsCallChoice,
    nvqsReason,
    campaignId,
    nvqsIsLocked,
    nvqsAttachments,
  ]);

  const saveEducationHistory = useCallback(async () => {
    if (!citizen) return;
    if (!eduForm.institution.trim() || !eduForm.level.trim()) {
      setEduError("Nhập tên trường và trình độ");
      return;
    }
    setEduSaving(true);
    setEduError(null);
    try {
      const res = await fetch("/api/admin/education", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenId: citizen.id,
          institution: eduForm.institution.trim(),
          level: eduForm.level,
          major: eduForm.major.trim() || undefined,
          graduationYear: eduForm.graduationYear
            ? Number(eduForm.graduationYear)
            : undefined,
          gpa: eduForm.gpa ? Number(eduForm.gpa) : undefined,
          status: "completed",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEduError(
          typeof data.error === "string"
            ? data.error
            : "Không lưu được quá trình học tập",
        );
        return;
      }
      setShowEduForm(false);
      setEduForm(emptyEduAddForm());
      setCitizen((prev) =>
        prev
          ? {
              ...prev,
              educationLevel: eduForm.level || prev.educationLevel,
              job: eduForm.major.trim() || prev.job,
              schoolName: eduForm.institution.trim() || prev.schoolName,
            }
          : prev,
      );
      setDraft((d) => ({
        ...d,
        educationLevel: eduForm.level || d.educationLevel,
        job: eduForm.major.trim() || d.job,
        schoolName: eduForm.institution.trim() || d.schoolName,
      }));
      setListsTick((t) => t + 1);
    } catch {
      setEduError("Lỗi kết nối khi lưu quá trình học tập");
    } finally {
      setEduSaving(false);
    }
  }, [citizen, eduForm]);

  const saveEducationPatch = useCallback(
    async (recordId: string) => {
      if (!citizen) return;
      const institution = editingEduInstitution.trim();
      if (!institution) {
        setEduError("Nhập tên trường");
        return;
      }
      // Bản ghi đồng bộ từ hồ sơ (chưa có dòng education) → lưu qua PUT citizen
      if (recordId.startsWith("syn-")) {
        setEduPatchSaving(true);
        setEduError(null);
        try {
          const res = await fetch(
            `/api/admin/citizens/${encodeURIComponent(citizen.id)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ schoolName: institution }),
            },
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setEduError(
              typeof data.error === "string"
                ? data.error
                : "Không cập nhật được tên trường",
            );
            return;
          }
          setCitizen(data);
          onCitizenUpdated?.(data);
          setDraft((d) => ({ ...d, schoolName: institution }));
          setEditingEduId(null);
          setListsTick((t) => t + 1);
        } catch {
          setEduError("Lỗi kết nối khi cập nhật trường");
        } finally {
          setEduPatchSaving(false);
        }
        return;
      }

      setEduPatchSaving(true);
      setEduError(null);
      try {
        const res = await fetch("/api/admin/education", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: recordId, institution }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setEduError(
            typeof data.error === "string"
              ? data.error
              : "Không cập nhật được tên trường",
          );
          return;
        }
        setCitizen((prev) =>
          prev ? { ...prev, schoolName: institution } : prev,
        );
        setDraft((d) => ({ ...d, schoolName: institution }));
        setEditingEduId(null);
        setListsTick((t) => t + 1);
      } catch {
        setEduError("Lỗi kết nối khi cập nhật trường");
      } finally {
        setEduPatchSaving(false);
      }
    },
    [citizen, editingEduInstitution, onCitizenUpdated],
  );

  const saveResidenceHistory = useCallback(async () => {
    if (!citizen) return;
    if (!resForm.address.trim()) {
      setResError("Nhập địa chỉ cư trú");
      return;
    }
    setResSaving(true);
    setResError(null);
    try {
      const res = await fetch("/api/admin/residence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenId: citizen.id,
          type: resForm.type,
          address: resForm.address.trim(),
          startYear: resForm.startYear ? Number(resForm.startYear) : undefined,
          endYear: resForm.endYear ? Number(resForm.endYear) : undefined,
          status: resForm.status,
          decisionNo: resForm.decisionNo.trim() || undefined,
          note: resForm.note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResError(
          typeof data.error === "string"
            ? data.error
            : "Không lưu được nơi cư trú",
        );
        return;
      }
      setShowResForm(false);
      setResForm(emptyResAddForm());
      if (resForm.status === "current") {
        setCitizen((prev) =>
          prev ? { ...prev, address: resForm.address.trim() } : prev,
        );
        setDraft((d) => ({ ...d, address: resForm.address.trim() }));
      }
      if (resForm.type === "Quê quán") {
        setCitizen((prev) =>
          prev ? { ...prev, originPlace: resForm.address.trim() } : prev,
        );
        setDraft((d) => ({ ...d, originPlace: resForm.address.trim() }));
      }
      setListsTick((t) => t + 1);
    } catch {
      setResError("Lỗi kết nối khi lưu nơi cư trú");
    } finally {
      setResSaving(false);
    }
  }, [citizen, resForm]);

  if (!citizen) return null;

  const renderCell = (
    label: string,
    value: string | undefined | null,
    colSpan: 1 | 2 = 1,
    field?: ProfileDraftField,
    inputType: "text" | "date" = "text",
  ) => (
    <div className={colSpan === 2 ? "col-span-2 min-w-0" : "min-w-0"}>
      <p className="text-[14px] font-normal text-m3-on-surface-variant">{label}</p>
      {editing && field ? (
        inputType === "date" ? (
          <DateVnInput
            valueIso={draft[field]}
            onChangeIso={(iso) =>
              setDraft((d) => ({ ...d, [field]: iso }))
            }
            className={PROFILE_INPUT_CLS}
          />
        ) : (
          <input
            type="text"
            value={draft[field]}
            onChange={(e) =>
              setDraft((d) => ({ ...d, [field]: e.target.value }))
            }
            className={PROFILE_INPUT_CLS}
          />
        )
      ) : (
        <p className="mt-0.5 text-[17px] font-medium leading-snug text-m3-on-surface break-words">
          {value || "—"}
        </p>
      )}
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
          {TABS.filter((t) => {
            if (sessionFunctionalRole === "y_te") return t.id === "health";
            if (t.id === "comments") return Boolean(citizen?.approvalComment);
            return true;
          }).map((t) => (
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
                  src={
                    citizen.avatar
                      ? citizen.avatar.startsWith("data:") ||
                        citizen.avatar.startsWith("http")
                        ? citizen.avatar
                        : `data:image/jpeg;base64,${citizen.avatar}`
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(citizen.fullName)}&background=007aff&color=fff&size=128&font-size=0.33`
                  }
                  alt=""
                  className="h-30 w-24 shrink-0 rounded-[14px] object-cover shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={draft.fullName}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, fullName: e.target.value }))
                        }
                        placeholder="Họ và tên"
                        className={PROFILE_INPUT_CLS}
                      />
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={draft.gender}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, gender: e.target.value }))
                          }
                          className={`${PROFILE_INPUT_CLS} mt-0 max-w-[120px]`}
                        >
                          <option value="male">Nam</option>
                          <option value="female">Nữ</option>
                        </select>
                        <DateVnInput
                          valueIso={draft.dateOfBirth}
                          onChangeIso={(iso) =>
                            setDraft((d) => ({
                              ...d,
                              dateOfBirth: iso,
                            }))
                          }
                          className={`${PROFILE_INPUT_CLS} mt-0 max-w-[180px]`}
                        />
                        <input
                          type="text"
                          value={draft.phone}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, phone: e.target.value }))
                          }
                          placeholder="Số điện thoại"
                          className={`${PROFILE_INPUT_CLS} mt-0 min-w-[140px] flex-1`}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[20px] font-medium text-m3-on-surface">
                        {citizen.fullName}
                      </p>
                      <p className="mt-1 text-[16px] text-m3-on-surface-variant">
                        {citizen.gender === "male" ? "Nam" : "Nữ"}
                        {" · "}
                        {formatVnDate(citizen.dateOfBirth)}
                        {citizen.phone ? ` · ${citizen.phone}` : ""}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Unified detail card */}
              <div className="rounded-[16px] border border-black/[0.06] bg-m3-surface-lowest p-5">
                {detailLoading && (
                  <p className="mb-3 text-[13px] text-m3-on-surface-variant">
                    Đang tải đầy đủ hồ sơ từ hệ thống...
                  </p>
                )}
                {renderSectionBlock(
                  "Thông tin cá nhân",
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {renderCell(
                      "Quốc tịch",
                      citizen.nationality || "Việt Nam",
                      1,
                      "nationality",
                    )}
                    {renderCell(
                      "Dân tộc",
                      citizen.ethnicity || "Kinh",
                      1,
                      "ethnicity",
                    )}
                    {renderCell(
                      "Tôn giáo",
                      citizen.religion || "Không",
                      1,
                      "religion",
                    )}
                    {renderCell("Số điện thoại", citizen.phone, 1, "phone")}
                    {renderCell("Quê quán", citizen.originPlace, 2, "originPlace")}
                    {renderCell(
                      "Đặc điểm nhận dạng",
                      citizen.identificationFeatures,
                      2,
                      "identificationFeatures",
                    )}
                  </div>,
                )}

                <div className="pt-5">
                  {renderSectionBlock(
                    "Thông tin CCCD",
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {renderCell("Số CCCD", citizen.cccd, 2, "cccd")}
                      {renderCell(
                        "Ngày cấp",
                        formatVnDate(citizen.issueDate) || undefined,
                        1,
                        "issueDate",
                        "date",
                      )}
                      {renderCell(
                        "Ngày hết hạn",
                        formatVnDate(citizen.expiryDate) || undefined,
                        1,
                        "expiryDate",
                        "date",
                      )}
                      {renderCell(
                        "CMND/CCCD cũ",
                        citizen.oldIdNumber,
                        2,
                        "oldIdNumber",
                      )}
                    </div>,
                  )}
                </div>

                <div className="pt-5">
                  {renderSectionBlock(
                    "Thông tin gia đình",
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {renderCell(
                        "Họ tên cha",
                        citizen.fatherName,
                        1,
                        "fatherName",
                      )}
                      {renderCell(
                        "Họ tên mẹ",
                        citizen.motherName,
                        1,
                        "motherName",
                      )}
                    </div>,
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "education" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                {editing ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-m3-on-surface-variant">
                        Trình độ hiện tại
                      </p>
                      <input
                        type="text"
                        value={draft.educationLevel}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            educationLevel: e.target.value,
                          }))
                        }
                        className={PROFILE_INPUT_CLS}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-m3-on-surface-variant">
                        Nghề nghiệp
                      </p>
                      <input
                        type="text"
                        value={draft.job}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, job: e.target.value }))
                        }
                        className={PROFILE_INPUT_CLS}
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <p className="text-[12px] font-medium text-m3-on-surface-variant">
                        Trường / cơ sở đào tạo
                      </p>
                      <input
                        type="text"
                        value={draft.schoolName}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            schoolName: e.target.value,
                          }))
                        }
                        className={PROFILE_INPUT_CLS}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[12px] font-medium text-m3-on-surface-variant">
                      Trình độ hiện tại
                    </p>
                    <p className="mt-0.5 text-[16px] font-bold text-m3-on-surface">
                      {citizen.educationLevel}
                      {citizen.job ? (
                        <span className="font-semibold text-m3-on-surface-variant">
                          {" "}
                          · {citizen.job}
                        </span>
                      ) : null}
                    </p>
                    {citizen.schoolName ? (
                      <p className="mt-1 text-[14px] text-m3-on-surface-variant">
                        Trường: {citizen.schoolName}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-m3-primary">
                    <span className="h-3.5 w-1 rounded-full bg-m3-primary" aria-hidden />
                    Quá trình học tập
                  </h3>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowEduForm((v) => !v);
                        setEduError(null);
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-m3-primary/25 bg-m3-primary/8 px-3.5 text-[13px] font-bold text-m3-primary hover:bg-m3-primary/12"
                    >
                      <Plus size={15} />
                      Thêm quá trình học tập
                    </button>
                  )}
                </div>

                {editing && showEduForm && (
                  <div className="mb-4 rounded-[14px] border border-m3-primary/20 bg-m3-primary/5 px-4 py-3.5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Trường / cơ sở
                        </p>
                        <input
                          type="text"
                          value={eduForm.institution}
                          onChange={(e) =>
                            setEduForm((f) => ({
                              ...f,
                              institution: e.target.value,
                            }))
                          }
                          className={PROFILE_INPUT_CLS}
                          placeholder="Tên trường"
                        />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Trình độ
                        </p>
                        <select
                          value={eduForm.level}
                          onChange={(e) =>
                            setEduForm((f) => ({ ...f, level: e.target.value }))
                          }
                          className={PROFILE_INPUT_CLS}
                        >
                          {EDU_LEVEL_OPTIONS.map((lv) => (
                            <option key={lv} value={lv}>
                              {lv}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Ngành / nghề
                        </p>
                        <input
                          type="text"
                          value={eduForm.major}
                          onChange={(e) =>
                            setEduForm((f) => ({ ...f, major: e.target.value }))
                          }
                          className={PROFILE_INPUT_CLS}
                          placeholder="Ngành học"
                        />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Năm tốt nghiệp
                        </p>
                        <input
                          type="number"
                          min={1950}
                          max={2100}
                          value={eduForm.graduationYear}
                          onChange={(e) =>
                            setEduForm((f) => ({
                              ...f,
                              graduationYear: e.target.value,
                            }))
                          }
                          className={PROFILE_INPUT_CLS}
                          placeholder="VD: 2020"
                        />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          GPA (nếu có)
                        </p>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={4}
                          value={eduForm.gpa}
                          onChange={(e) =>
                            setEduForm((f) => ({ ...f, gpa: e.target.value }))
                          }
                          className={PROFILE_INPUT_CLS}
                        />
                      </div>
                    </div>
                    {eduError && (
                      <p className="mt-2 text-[13px] font-medium text-m3-error">
                        {eduError}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveEducationHistory}
                        disabled={eduSaving}
                        className="inline-flex min-h-[40px] items-center rounded-[10px] bg-m3-primary px-4 text-[14px] font-bold text-white disabled:opacity-40"
                      >
                        {eduSaving ? "Đang lưu..." : "Lưu quá trình"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEduForm(false);
                          setEduError(null);
                          setEduForm(emptyEduAddForm());
                        }}
                        className="inline-flex min-h-[40px] items-center rounded-[10px] border border-black/[0.1] bg-m3-surface-lowest px-4 text-[14px] font-semibold text-m3-on-surface"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                {eduError && !showEduForm && (
                  <p className="mb-3 text-[13px] font-medium text-m3-error">
                    {eduError}
                  </p>
                )}

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
                        const statusStyle =
                          EDUCATION_STATUS[record.status] ?? EDUCATION_STATUS.completed;
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
                              {editing &&
                                (record.id.startsWith("edu-") ||
                                  record.id.startsWith("syn-")) && (
                                <div className="mt-2">
                                  {editingEduId === record.id ? (
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                      <input
                                        type="text"
                                        value={editingEduInstitution}
                                        onChange={(e) =>
                                          setEditingEduInstitution(e.target.value)
                                        }
                                        className={`${PROFILE_INPUT_CLS} flex-1`}
                                        placeholder="Tên trường / cơ sở"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          disabled={eduPatchSaving}
                                          onClick={() =>
                                            void saveEducationPatch(record.id)
                                          }
                                          className="rounded-full bg-m3-primary px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
                                        >
                                          {eduPatchSaving ? "Đang lưu…" : "Lưu"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingEduId(null);
                                            setEduError(null);
                                          }}
                                          className="rounded-full border border-black/10 px-3 py-1.5 text-[12px] font-semibold"
                                        >
                                          Hủy
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingEduId(record.id);
                                        setEditingEduInstitution(
                                          record.institution.startsWith("Chưa") ||
                                            record.institution.startsWith("Theo hồ sơ")
                                            ? ""
                                            : record.institution,
                                        );
                                        setEduError(null);
                                      }}
                                      className="text-[12px] font-semibold text-m3-primary hover:underline"
                                    >
                                      Cập nhật trường học
                                    </button>
                                  )}
                                </div>
                              )}
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
              {lifecycleStage && examWindow && (
                <div className="rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                  <p className="text-[13px] font-bold text-m3-on-surface">
                    Vòng đời NVQS · {lifecycleStageLabel(lifecycleStage)}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-m3-on-surface-variant">
                    Tuổi hiện tại {citizenAge} (năm hiện tại − năm sinh). Cửa sổ
                    khám {NVQS_AGE_MIN}–{NVQS_AGE_MAX}: năm {examWindow.fromYear}
                    –{examWindow.toYear || "—"}. Hồ sơ lưu vĩnh viễn; hết tuổi
                    chuyển Hồ sơ lưu trữ sau khi duyệt — lịch sử khám các năm
                    vẫn giữ để đối chiếu.
                  </p>
                  {examWindow.years.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {examWindow.years
                        .slice()
                        .reverse()
                        .map((y) => {
                          const count = healthRecords.filter(
                            (r) => r.year === y,
                          ).length;
                          const open = yearHasOpenExamSlot(healthRecords, y);
                          const active = healthYear === y;
                          return (
                            <button
                              key={y}
                              type="button"
                              onClick={() => {
                                setHealthYear(y);
                                setExpandedHealthId(null);
                              }}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                active
                                  ? "bg-m3-primary text-white"
                                  : open
                                    ? "bg-m3-primary/12 text-m3-primary"
                                    : count > 0
                                      ? "bg-m3-success/14 text-m3-success"
                                      : "bg-black/[0.05] text-m3-on-surface-variant"
                              }`}
                              title={
                                open
                                  ? `${y}: còn nhập`
                                  : count > 0
                                    ? `${y}: đã có ${count} lần`
                                    : `${y}: chưa khám`
                              }
                            >
                              {y}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              <HealthExamWorkflow
                year={examYear}
                records={healthRecords}
                canEnter={editing}
                yearOptions={healthYearOptions}
                onYearChange={(y) => {
                  setHealthYear(y);
                  setExpandedHealthId(null);
                }}
                onEnterRound={setHealthFormRound}
              />

              <div className="rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                <p className="text-[12px] font-medium text-m3-on-surface-variant">
                  Phân loại sức khỏe (tóm tắt)
                </p>
                {editing ? (
                  <input
                    type="text"
                    value={draft.healthStatus}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, healthStatus: e.target.value }))
                    }
                    className={PROFILE_INPUT_CLS}
                  />
                ) : (
                  <>
                    <p className="mt-0.5 text-[16px] font-bold text-m3-on-surface">
                      {citizen.healthStatus || "—"}
                    </p>
                    {citizen.healthStatus && (
                      <p className="mt-1 text-[13px] font-medium text-m3-success">
                        {getHealthConclusionMeaning(
                          citizen.healthStatus,
                          "Khám tuyển cấp huyện",
                        )}
                      </p>
                    )}
                  </>
                )}
              </div>

              {healthLoading ? (
                <p className="py-6 text-center text-[14px] text-m3-on-surface-variant">
                  Đang tải lịch sử khám...
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-m3-on-surface">
                        Lịch sử khám
                        {healthYear !== null && (
                          <span className="ml-1.5 font-semibold text-m3-on-surface-variant">
                            · {filteredHealthRecords.length} lần
                          </span>
                        )}
                      </h3>
                      <p className="mt-0.5 text-[12px] text-m3-on-surface-variant">
                        Mỗi năm trong độ tuổi 18–27 là một chu kỳ khám riêng; giữ
                        các năm trước để đối chiếu.
                      </p>
                    </div>
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
                          className="absolute right-0 z-20 mt-2 max-h-[280px] w-52 overflow-y-auto rounded-[14px] border border-black/[0.08] bg-m3-surface-lowest py-1.5 shadow-lg"
                          style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
                        >
                          {healthYearOptions.map((year) => {
                            const count = healthRecords.filter(
                              (r) => r.year === year,
                            ).length;
                            const open = yearHasOpenExamSlot(
                              healthRecords,
                              year,
                            );
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
                                <span>
                                  {year}
                                  {open ? (
                                    <span className="ml-1 text-[11px] font-semibold text-m3-success">
                                      còn nhập
                                    </span>
                                  ) : null}
                                </span>
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

                  {filteredHealthRecords.length === 0 ? (
                    <p className="rounded-[14px] border border-dashed border-black/[0.1] py-8 text-center text-[14px] text-m3-on-surface-variant">
                      Chưa có lần khám năm {examYear}.
                      {editing
                        ? " Dùng «Nhập vòng 1» phía trên để thêm chu kỳ khám năm này."
                        : " Bấm Sửa hồ sơ để nhập khám cho năm này."}
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
                <p className="text-[12px] font-medium text-m3-on-surface-variant">
                  Cư trú hiện tại
                </p>
                {editing ? (
                  <div className="flex flex-col gap-3">
                    <div className="min-w-0">
                      <p className="mt-1 text-[12px] font-medium text-m3-on-surface-variant">
                        Địa chỉ
                      </p>
                      <input
                        type="text"
                        value={draft.address}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, address: e.target.value }))
                        }
                        className={PROFILE_INPUT_CLS}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-m3-on-surface-variant">
                        Quê quán
                      </p>
                      <input
                        type="text"
                        value={draft.originPlace}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            originPlace: e.target.value,
                          }))
                        }
                        className={PROFILE_INPUT_CLS}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-0.5 text-[16px] font-bold text-m3-on-surface">
                      {citizen.address || "—"}
                    </p>
                    {citizen.originPlace && (
                      <p className="mt-1 text-[13px] text-m3-on-surface-variant">
                        Quê quán: {citizen.originPlace}
                        {citizen.phone ? ` · ${citizen.phone}` : ""}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-m3-primary">
                    <span className="h-3.5 w-1 rounded-full bg-m3-primary" aria-hidden />
                    Lịch sử biến động cư trú
                  </h3>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowResForm((v) => !v);
                        setResError(null);
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-m3-primary/25 bg-m3-primary/8 px-3.5 text-[13px] font-bold text-m3-primary hover:bg-m3-primary/12"
                    >
                      <Plus size={15} />
                      Thêm nơi cư trú
                    </button>
                  )}
                </div>

                {editing && showResForm && (
                  <div className="mb-4 rounded-[14px] border border-m3-primary/20 bg-m3-primary/5 px-4 py-3.5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Địa chỉ
                        </p>
                        <input
                          type="text"
                          value={resForm.address}
                          onChange={(e) =>
                            setResForm((f) => ({ ...f, address: e.target.value }))
                          }
                          className={PROFILE_INPUT_CLS}
                          placeholder="Địa chỉ đầy đủ"
                        />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Loại cư trú
                        </p>
                        <select
                          value={resForm.type}
                          onChange={(e) =>
                            setResForm((f) => ({
                              ...f,
                              type: e.target.value as ResidenceType,
                            }))
                          }
                          className={PROFILE_INPUT_CLS}
                        >
                          {RESIDENCE_TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Trạng thái
                        </p>
                        <select
                          value={resForm.status}
                          onChange={(e) =>
                            setResForm((f) => ({
                              ...f,
                              status: e.target.value as ResidenceRecord["status"],
                            }))
                          }
                          className={PROFILE_INPUT_CLS}
                        >
                          <option value="current">Đang cư trú</option>
                          <option value="past">Đã chuyển đi</option>
                          <option value="pending">Chờ xác nhận</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Từ năm
                        </p>
                        <input
                          type="number"
                          min={1950}
                          max={2100}
                          value={resForm.startYear}
                          onChange={(e) =>
                            setResForm((f) => ({
                              ...f,
                              startYear: e.target.value,
                            }))
                          }
                          className={PROFILE_INPUT_CLS}
                        />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Đến năm (nếu đã chuyển)
                        </p>
                        <input
                          type="number"
                          min={1950}
                          max={2100}
                          value={resForm.endYear}
                          onChange={(e) =>
                            setResForm((f) => ({
                              ...f,
                              endYear: e.target.value,
                            }))
                          }
                          className={PROFILE_INPUT_CLS}
                          placeholder="Để trống nếu đang cư trú"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[12px] font-medium text-m3-on-surface-variant">
                          Số quyết định (nếu có)
                        </p>
                        <input
                          type="text"
                          value={resForm.decisionNo}
                          onChange={(e) =>
                            setResForm((f) => ({
                              ...f,
                              decisionNo: e.target.value,
                            }))
                          }
                          className={PROFILE_INPUT_CLS}
                        />
                      </div>
                    </div>
                    {resError && (
                      <p className="mt-2 text-[13px] font-medium text-m3-error">
                        {resError}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={saveResidenceHistory}
                        disabled={resSaving}
                        className="inline-flex min-h-[40px] items-center rounded-[10px] bg-m3-primary px-4 text-[14px] font-bold text-white disabled:opacity-40"
                      >
                        {resSaving ? "Đang lưu..." : "Lưu nơi cư trú"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowResForm(false);
                          setResError(null);
                          setResForm(emptyResAddForm());
                        }}
                        className="inline-flex min-h-[40px] items-center rounded-[10px] border border-black/[0.1] bg-m3-surface-lowest px-4 text-[14px] font-semibold text-m3-on-surface"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

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
                        const statusStyle =
                          RESIDENCE_STATUS[record.status] ?? RESIDENCE_STATUS.past;
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
              {nvqsIsLocked && !editing && (
                <div className="mb-4 flex items-start gap-3 rounded-[12px] border border-m3-warning/25 bg-m3-warning/8 px-3.5 py-3">
                  <Lock size={18} className="mt-0.5 shrink-0 text-m3-error" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-m3-on-surface">
                      Trạng thái NVQS đã được lưu và khóa
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-m3-on-surface-variant">
                      Không thể sửa trực tiếp. Bấm{" "}
                      <strong>Sửa hồ sơ</strong> bên dưới để chỉnh sửa, rồi{" "}
                      <strong>Lưu hồ sơ</strong>
                      {needsPinToEdit ? " (cần mã PIN địa phương)" : ""}.
                    </p>
                  </div>
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

                {nvqsCanEdit &&
                  (nvqsCallChoice === "du_kien_goi" ||
                    nvqsCallChoice === "du_bi" ||
                    nvqsCallChoice === "khong_goi" ||
                    nvqsCallChoice === "tamhoan") && (
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

                {renderStackField("Phân loại sức khỏe", citizen.healthStatus)}

                {nvqsCanEdit ? (
                  <div className="min-w-0">
                    <label
                      htmlFor="nvqs-note"
                      className="text-[14px] font-medium text-m3-on-surface-variant"
                    >
                      Ghi chú
                      {nvqsChoiceNeedsReason(nvqsCallChoice) && (
                        <span className="text-m3-error"> *</span>
                      )}
                    </label>
                    <textarea
                      id="nvqs-note"
                      rows={4}
                      className={`${NVQS_INPUT_CLS} mt-1.5 min-h-[110px] resize-y py-3`}
                      placeholder={
                        nvqsCallChoice === "tamhoan"
                          ? "Nhập lý do tạm hoãn và mô tả giấy tờ đính kèm..."
                          : nvqsCallChoice === "khong_goi"
                            ? "Nhập lý do đề xuất không gọi (kèm minh chứng giấy khám SK…)"
                          : nvqsCallChoice === "miengoi"
                            ? "VD: Thuộc diện miễn theo quy định..."
                            : "Ghi chú thêm về dự kiến tuyển gọi (không bắt buộc)"
                      }
                      value={nvqsReason}
                      onChange={(e) => {
                        setNvqsReason(e.target.value);
                        setNvqsError(null);
                      }}
                    />
                  </div>
                ) : (
                  renderStackField("Ghi chú", citizen.militaryStatusReason)
                )}

                {(nvqsCanEdit
                  ? nvqsChoiceNeedsFiles(nvqsCallChoice)
                  : citizen.callIntent === "de_xuat_khong_goi" ||
                      citizen.callIntent === "khong_goi" ||
                      citizen.militaryStatus === "tamhoan") && (
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-m3-on-surface-variant">
                      Minh chứng đính kèm
                      {nvqsCanEdit && nvqsChoiceNeedsFiles(nvqsCallChoice) ? (
                        <span className="text-m3-error"> *</span>
                      ) : null}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {nvqsAttachments
                        .filter((a) => {
                          const need = nvqsChoiceNeedsFiles(nvqsCallChoice);
                          if (nvqsCanEdit && need) return a.purpose === need;
                          if (citizen.militaryStatus === "tamhoan") {
                            return a.purpose === "tam_hoan";
                          }
                          return a.purpose === "khong_goi";
                        })
                        .map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center justify-between gap-2 rounded-[10px] border border-black/[0.06] bg-white px-3 py-2 text-[13px]"
                          >
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate font-medium text-m3-primary hover:underline"
                            >
                              {a.fileName}
                            </a>
                            {nvqsCanEdit && (
                              <button
                                type="button"
                                className="shrink-0 text-[12px] font-semibold text-m3-error"
                                onClick={() => void removeNvqsFile(a.id)}
                              >
                                Xóa
                              </button>
                            )}
                          </li>
                        ))}
                    </ul>
                    {nvqsCanEdit && nvqsChoiceNeedsFiles(nvqsCallChoice) && (
                      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[13px] font-semibold text-m3-on-surface hover:bg-m3-surface-high">
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                          disabled={nvqsUploading}
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files?.length) void uploadNvqsFiles(files);
                            e.target.value = "";
                          }}
                        />
                        {nvqsUploading ? "Đang tải..." : "Tải tệp minh chứng"}
                      </label>
                    )}
                  </div>
                )}
              </div>

              {nvqsError && (
                <p className="mt-3 rounded-[12px] bg-m3-error/8 px-3 py-2.5 text-[13px] text-m3-error">
                  {nvqsError}
                </p>
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
                {citizen.approvalStatus === "pending" &&
                  citizen.callIntent === "de_xuat_khong_goi" && (
                    <> — đề xuất không gọi đang chờ Quân khu đồng tình</>
                  )}
                {citizen.approvalStatus === "pending" &&
                  citizen.militaryStatus === "tamhoan" && (
                    <> — tạm hoãn đang chờ Quân khu duyệt</>
                  )}
                {nvqsIsLocked && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-m3-warning/12 px-2 py-0.5 text-[12px] font-semibold text-m3-error">
                    <Lock size={12} />
                    Đã khóa
                  </span>
                )}
              </p>

              {approvalReview ? (
                <p className="mt-4 rounded-[12px] bg-m3-primary/8 px-3 py-2.5 text-[13px] leading-relaxed text-m3-primary">
                  Quân khu xem đầy đủ hồ sơ (định danh, học vấn, sức khỏe, cư trú,
                  NVQS) rồi quyết định{" "}
                  <strong>Duyệt gọi nhập ngũ</strong> hoặc{" "}
                  <strong>Không gọi</strong>
                  {approvalCampaignId
                    ? " theo đợt đã chọn trên danh sách xét duyệt."
                    : "."}
                </p>
              ) : (
                <p className="mt-4 rounded-[12px] bg-m3-primary/8 px-3 py-2.5 text-[13px] text-m3-primary">
                  Sau khi lưu, trạng thái sẽ bị khóa. Dùng nút{" "}
                  <strong>Sửa hồ sơ</strong> / <strong>Lưu hồ sơ</strong> bên dưới
                  để cập nhật
                  {needsPinToEdit ? " (cấp Tỉnh / Huyện / Xã cần mã PIN)" : ""}.
                </p>
              )}
            </div>
          )}

          {tab === "comments" && (
            <div className="rounded-[16px] border border-m3-error/20 bg-m3-error/[0.04] p-4">
              <h3 className="text-[15px] font-bold text-m3-on-surface">
                Nhận xét Quân khu
              </h3>
              <p className="mt-1 text-[13px] text-m3-on-surface-variant">
                Lý do không chấp nhận đề xuất không gọi hoặc hủy tạm hoãn. Hồ sơ đã
                chuyển về Chưa xác định và bị khóa — cập nhật minh chứng rồi gửi duyệt
                lại.
              </p>
              <div className="mt-4 rounded-[12px] border border-black/[0.06] bg-white px-4 py-3">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-m3-on-surface">
                  {citizen.approvalComment || "—"}
                </p>
              </div>
              {nvqsIsLocked && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-m3-error">
                  <Lock size={14} /> Hồ sơ đang bị khóa sau khi Quân khu trả về
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] bg-m3-surface-high/80 px-5 py-4">
          {editing ? (
            <>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                {needsPinToEdit && (
                  <label className="flex min-w-0 flex-wrap items-center gap-2 text-[14px] font-medium text-m3-on-surface-variant">
                    <span className="shrink-0">Mã PIN xác thực</span>
                    <input
                      type="password"
                      value={profilePin}
                      onChange={(e) => setProfilePin(e.target.value)}
                      autoComplete="off"
                      className="min-h-[44px] w-[140px] rounded-[12px] border border-black/[0.08] bg-m3-surface-lowest px-3 text-[15px] text-m3-on-surface outline-none focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/15"
                    />
                  </label>
                )}
                {saveError && (
                  <p className="text-[13px] font-medium text-m3-error">{saveError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setSaveError(null);
                    setProfilePin("");
                    setShowEduForm(false);
                    setShowResForm(false);
                    setEduError(null);
                    setResError(null);
                    setHealthFormRound(null);
                    if (citizen) {
                      setNvqsCallChoice(citizenToNvqsChoice(citizen));
                      setCampaignId(citizen.campaignId || "");
                      setNvqsReason(citizen.militaryStatusReason || "");
                    }
                    setNvqsError(null);
                  }}
                  disabled={saving}
                  className="min-h-[44px] rounded-[12px] bg-m3-surface-lowest px-5 text-[15px] font-bold text-m3-on-surface disabled:opacity-50"
                  style={{ border: "1px solid rgba(0,0,0,0.1)" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void saveProfile()}
                  disabled={saving}
                  className="min-h-[44px] rounded-[12px] bg-m3-primary px-5 text-[15px] font-bold text-white disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu hồ sơ"}
                </button>
              </div>
            </>
          ) : approvalReview ? (
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold text-m3-on-surface-variant hover:bg-black/[0.05]"
              >
                <Printer size={18} />
                In hồ sơ
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={approvalBusy}
                  className="min-h-[44px] rounded-[12px] bg-m3-surface-lowest px-5 text-[15px] font-bold text-m3-on-surface disabled:opacity-50"
                  style={{ border: "1px solid rgba(0,0,0,0.1)" }}
                >
                  Đóng
                </button>
                {canDecideApproval ? (
                  <>
                    <button
                      type="button"
                      disabled={approvalBusy}
                      onClick={() => void runApprovalDecision("reject")}
                      className="min-h-[44px] rounded-[12px] px-5 text-[15px] font-bold text-white disabled:opacity-50"
                      style={{ background: "var(--m3-error, #ba1a1a)" }}
                    >
                      {approvalBusy ? "Đang xử lý..." : "Không gọi"}
                    </button>
                    <button
                      type="button"
                      disabled={approvalBusy}
                      onClick={() => void runApprovalDecision("approve")}
                      className="min-h-[44px] rounded-[12px] px-5 text-[15px] font-bold text-white disabled:opacity-50"
                      style={{ background: "var(--color-m3-success, #386a4a)" }}
                    >
                      {approvalBusy ? "Đang xử lý..." : "Duyệt gọi nhập ngũ"}
                    </button>
                  </>
                ) : (
                  <span className="inline-flex min-h-[44px] items-center rounded-[12px] bg-m3-surface-high px-4 text-[13px] font-semibold text-m3-on-surface-variant">
                    {citizen?.approvalStatus === "approved"
                      ? "Đã duyệt gọi"
                      : citizen?.approvalStatus === "rejected"
                        ? "Đã đánh dấu không gọi"
                        : "Không thể xét duyệt"}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
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
                {sessionFunctionalRole !== "y_te" &&
                  sessionFunctionalRole !== "nhan_quan" &&
                  !approvedEnlisted && (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="min-h-[44px] rounded-[12px] bg-m3-primary px-5 text-[15px] font-bold text-white"
                  >
                    Sửa hồ sơ
                  </button>
                )}
                {sessionFunctionalRole !== "y_te" && approvedEnlisted && (
                  <span className="inline-flex min-h-[44px] items-center rounded-[12px] bg-m3-surface-high px-4 text-[13px] font-semibold text-m3-on-surface-variant">
                    Đã duyệt gọi — khóa sửa
                  </span>
                )}
              </div>
            </>
          )}
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
          onSaved={(saved) => {
            reloadHealthRecords();
            if (saved.citizen) {
              setCitizen(saved.citizen);
              setDraft((d) => ({
                ...d,
                healthStatus: saved.citizen?.healthStatus || d.healthStatus,
              }));
              onCitizenUpdated?.(saved.citizen);
            } else {
              const nextStatus = saved.conclusion || citizen.healthStatus;
              setCitizen((prev) =>
                prev
                  ? { ...prev, healthStatus: nextStatus || prev.healthStatus }
                  : prev,
              );
              setDraft((d) => ({
                ...d,
                healthStatus: nextStatus || d.healthStatus,
              }));
              onCitizenUpdated?.({
                ...citizen,
                healthStatus: nextStatus || citizen.healthStatus,
              });
            }
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
