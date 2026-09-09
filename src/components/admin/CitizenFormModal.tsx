"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Trash2 } from "lucide-react";
import type { Citizen, HealthRecord, HierarchyUnit } from "@/lib/data";
import { getHealthConclusionMeaning, hierarchyNeedsEditPin } from "@/lib/data";
import {
  HEALTH_CONCLUSIONS,
  defaultFacilityForRound,
  detailedRecordForYear,
  getYearExamStatusLabel,
  screeningRecordForYear,
} from "@/lib/health-exam";
import { getNvqsExamYearWindow } from "@/lib/nvqs-lifecycle";
import Hn212ScanButton from "@/components/admin/Hn212ScanButton";
import DateVnInput from "@/components/admin/DateVnInput";
import type { Hn212CitizenScan } from "@/lib/hn212";
import { toPortraitDataUrl } from "@/lib/hn212/normalize";
import { formatVnDate } from "@/lib/date-vn";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  isDiskAvatarPath,
  resolveCitizenAvatarSrc,
} from "@/lib/citizen-avatar";

type FormMode = "create" | "edit";

type CampaignOption = {
  id: string;
  name: string;
  year: number;
};

type FormTabId = "identity" | "education" | "health" | "residence" | "nvqs";

const FORM_TABS: { id: FormTabId; label: string }[] = [
  { id: "identity", label: "Định danh" },
  { id: "education", label: "Học vấn" },
  { id: "health", label: "Sức khỏe" },
  { id: "residence", label: "Cư trú" },
  { id: "nvqs", label: "NVQS" },
];

type ScreeningForm = {
  enabled: boolean;
  year: number;
  facility: string;
  height: string;
  weight: string;
  bloodPressure: string;
  vision: string;
  physicalDefects: string;
  conclusion: string;
  doctor: string;
  note: string;
};

function emptyScreening(year = new Date().getFullYear()): ScreeningForm {
  return {
    enabled: true,
    year,
    facility: defaultFacilityForRound("screening", "xa"),
    height: "",
    weight: "",
    bloodPressure: "",
    vision: "",
    physicalDefects: "",
    conclusion: "Loại 1",
    doctor: "",
    note: "",
  };
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
        return normalizeFormAvatar(data.avatar);
      }
      if (
        "portraitBase64" in data &&
        typeof data.portraitBase64 === "string" &&
        data.portraitBase64.trim()
      ) {
        return normalizeFormAvatar(data.portraitBase64);
      }
      return prev.avatar;
    })(),
  };
}

/** Giữ path /uploads hoặc data URL; chỉ convert base64 chip qua toPortraitDataUrl. */
function normalizeFormAvatar(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (
    s.startsWith("data:") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:")
  ) {
    return s;
  }
  if (s.startsWith("/uploads/") || s.startsWith("uploads/")) {
    return s.startsWith("/") ? s : `/${s}`;
  }
  return toPortraitDataUrl(s) || s;
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
  const [provinceLabel, setProvinceLabel] = useState("");
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignHistory, setCampaignHistory] = useState<
    {
      id: number;
      campaignId: string;
      campaignName?: string | null;
      campaignYear?: number | null;
      callIntent: string | null;
      militaryStatus: string | null;
      isCurrent: boolean;
    }[]
  >([]);
  const [editPin, setEditPin] = useState("");
  const [tab, setTab] = useState<FormTabId>("identity");
  const [panelOpen, setPanelOpen] = useState(false);
  const [screening, setScreening] = useState<ScreeningForm>(() =>
    emptyScreening(),
  );
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const needsPin =
    sessionLevel !== null && hierarchyNeedsEditPin(sessionLevel);

  const examYearOptions = useMemo(() => {
    const win = getNvqsExamYearWindow(form.dateOfBirth || undefined);
    if (win?.years?.length) return win.years;
    const y = new Date().getFullYear();
    return [y, y - 1];
  }, [form.dateOfBirth]);

  const existingScreening = useMemo(
    () => screeningRecordForYear(healthRecords, screening.year),
    [healthRecords, screening.year],
  );
  const existingDetailed = useMemo(
    () => detailedRecordForYear(healthRecords, screening.year),
    [healthRecords, screening.year],
  );
  const yearExamLabel = useMemo(
    () => getYearExamStatusLabel(healthRecords, screening.year),
    [healthRecords, screening.year],
  );
  const canAddScreening =
    !existingScreening &&
    (mode === "create" ||
      sessionLevel === "xa" ||
      sessionLevel === "bo");

  const setScreeningField = <K extends keyof ScreeningForm>(
    key: K,
    value: ScreeningForm[K],
  ) => {
    setScreening((prev) => ({ ...prev, [key]: value }));
  };

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
    if (!open) {
      setPanelOpen(false);
      document.body.removeAttribute("data-admin-drawer-open");
      return;
    }
    document.body.setAttribute("data-admin-drawer-open", "true");
    const t = requestAnimationFrame(() => setPanelOpen(true));
    return () => {
      cancelAnimationFrame(t);
      document.body.removeAttribute("data-admin-drawer-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHealthRecords([]);
      return;
    }
    if (mode !== "edit" || !citizen?.id) {
      setHealthRecords([]);
      return;
    }
    let cancelled = false;
    setHealthLoading(true);
    fetch(
      `/api/admin/health?citizenId=${encodeURIComponent(citizen.id)}&limit=50`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`health ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const records: HealthRecord[] = Array.isArray(data?.data)
          ? data.data
          : [];
        setHealthRecords(records);
        const years = [...new Set(records.map((r) => r.year))].sort(
          (a, b) => b - a,
        );
        const prefer =
          years.find((y) => !screeningRecordForYear(records, y)) ??
          years[0] ??
          new Date().getFullYear();
        setScreening((prev) => ({
          ...prev,
          year: prefer,
          enabled: false,
        }));
      })
      .catch(() => {
        if (!cancelled) setHealthRecords([]);
      })
      .finally(() => {
        if (!cancelled) setHealthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, citizen?.id]);

  useEffect(() => {
    if (!open) return;
    if (!examYearOptions.includes(screening.year)) {
      setScreening((prev) => ({
        ...prev,
        year: examYearOptions[0] ?? new Date().getFullYear(),
      }));
    }
  }, [open, examYearOptions, screening.year]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEditPin("");
    setTab("identity");
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

      {
        const defaultYear =
          getNvqsExamYearWindow(
            mode === "edit" && citizen?.dateOfBirth
              ? citizen.dateOfBirth
              : undefined,
          )?.years[0] ?? new Date().getFullYear();
        setScreening({
          ...emptyScreening(defaultYear),
          enabled:
            mode === "create" && (level === "xa" || level === "bo"),
        });
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

      if (mode === "edit" && citizen?.id) {
        try {
          const histRes = await fetch(
            `/api/admin/citizens/${encodeURIComponent(citizen.id)}/campaigns`,
          );
          if (histRes.ok) {
            const histJson = await histRes.json();
            setCampaignHistory(Array.isArray(histJson.data) ? histJson.data : []);
          } else {
            setCampaignHistory([]);
          }
        } catch {
          setCampaignHistory([]);
        }
      } else {
        setCampaignHistory([]);
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
          avatar: citizen.avatar ? normalizeFormAvatar(citizen.avatar) : "",
          unitCode: citizen.unitCode || "",
          campaignId: citizen.campaignId || "",
        };
      } else {
        nextForm = {
          ...emptyForm,
          militaryStatus: "chuakham",
          campaignId: defaultCampaignId || "",
        };
        if (prefill) {
          nextForm = applyScanToForm(nextForm, prefill);
        }
      }

      try {
        if (level === "bo") {
          let provItems: HierarchyUnit[] = [];
          const provRes = await fetch("/api/admin/hierarchy/provinces");
          if (provRes.ok) {
            const provData = await provRes.json();
            provItems = (provData.items || []) as HierarchyUnit[];
            setProvinces(provItems);
          } else {
            setProvinces([]);
          }
          if (defaultUnitCode?.includes("-")) {
            const parent = defaultUnitCode.split("-")[0];
            setFormTinh(parent);
            await loadWards(parent);
            nextForm.unitCode = defaultUnitCode;
            setProvinceLabel(
              provItems.find((x) => x.code === parent)?.name || parent,
            );
          } else if (defaultUnitCode) {
            setFormTinh(defaultUnitCode);
            await loadWards(defaultUnitCode);
            nextForm.unitCode = "";
            setProvinceLabel(
              provItems.find((x) => x.code === defaultUnitCode)?.name ||
                defaultUnitCode,
            );
          } else {
            setFormTinh("");
            setProvinceLabel("");
            setWards([]);
          }
        } else if (level === "tinh" && unitCode) {
          setFormTinh(unitCode);
          setProvinceLabel(unitName || unitCode);
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
          const parent = unitCode.includes("-")
            ? unitCode.split("-")[0]
            : "";
          setFormTinh(parent);
          setProvinces([]);
          setWards([]);
          let pName = parent;
          if (parent) {
            try {
              const unitsRes = await fetch("/api/auth/units");
              if (unitsRes.ok) {
                const all = (await unitsRes.json()) as HierarchyUnit[];
                const list = Array.isArray(all) ? all : [];
                pName =
                  list.find((u) => u.code === parent)?.name || parent;
              }
            } catch {
              // keep parent code
            }
          }
          setProvinceLabel(pName);
        } else {
          setProvinceLabel("");
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

  const uploadAvatarFile = async (file: File) => {
    if (mode !== "edit" || !citizen?.id) {
      // Tạo mới: giữ preview tạm bằng object URL / data URL đến khi lưu hồ sơ
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          set("avatar", reader.result);
        }
      };
      reader.readAsDataURL(file);
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const body = new FormData();
      body.set("citizenId", citizen.id);
      body.set("file", file);
      const res = await fetch("/api/admin/citizen-avatar", {
        method: "POST",
        body,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(
          typeof data.error === "string" ? data.error : "Không tải được ảnh",
        );
        return;
      }
      if (typeof data.avatar === "string") {
        set("avatar", data.avatar);
      } else if (data.data?.avatar) {
        set("avatar", String(data.data.avatar));
      }
    } catch {
      setAvatarError("Lỗi kết nối khi tải ảnh");
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatarFile = async () => {
    if (mode === "edit" && citizen?.id && isDiskAvatarPath(form.avatar)) {
      setAvatarUploading(true);
      setAvatarError(null);
      try {
        const res = await fetch(
          `/api/admin/citizen-avatar?citizenId=${encodeURIComponent(citizen.id)}`,
          { method: "DELETE", cache: "no-store" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAvatarError(
            typeof data.error === "string" ? data.error : "Không xóa được ảnh",
          );
          return;
        }
        set("avatar", "");
      } catch {
        setAvatarError("Lỗi kết nối khi xóa ảnh");
      } finally {
        setAvatarUploading(false);
      }
      return;
    }
    set("avatar", "");
  };

  const handleScanned = (data: Hn212CitizenScan) => {
    setForm((prev) => applyScanToForm(prev, data));
    setTab("identity");
    setError(null);
  };

  const handleClose = () => {
    setPanelOpen(false);
    window.setTimeout(onClose, 220);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.fullName.trim() || !form.cccd.trim() || !form.dateOfBirth) {
        setTab("identity");
        throw new Error("Vui lòng nhập Họ tên, CCCD và Ngày sinh");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
        setTab("identity");
        throw new Error("Ngày sinh không hợp lệ (dd/mm/yyyy)");
      }
      const unitCode =
        sessionLevel === "xa" ? sessionUnitCode || form.unitCode : form.unitCode;
      if (!unitCode?.trim()) {
        setTab("identity");
        throw new Error("Vui lòng chọn địa phương đăng ký");
      }
      if (!form.campaignId.trim()) {
        setTab("identity");
        throw new Error("Vui lòng chọn đợt đăng ký");
      }
      if (needsPin && !editPin.trim()) {
        setTab("nvqs");
        throw new Error("Vui lòng nhập mã PIN địa phương để lưu hồ sơ");
      }

      let heightNum = 0;
      let weightNum = 0;
      const willSaveScreening =
        screening.enabled &&
        canAddScreening &&
        !existingScreening;
      if (willSaveScreening) {
        heightNum = parseFloat(screening.height);
        weightNum = parseFloat(screening.weight);
        if (!heightNum || !weightNum || !screening.doctor.trim()) {
          setTab("health");
          throw new Error(
            "Vòng 1: vui lòng nhập chiều cao, cân nặng và bác sĩ khám (hoặc tắt nhập Vòng 1)",
          );
        }
      }

      const militaryStatus =
        mode === "create" ? "chuakham" : form.militaryStatus;
      const healthStatus = willSaveScreening
        ? screening.conclusion
        : existingScreening?.conclusion ||
          existingDetailed?.conclusion ||
          form.healthStatus;

      const url =
        mode === "edit" && citizen
          ? `/api/admin/citizens/${citizen.id}`
          : "/api/admin/citizens";
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          healthStatus,
          militaryStatus,
          ...(mode === "create" ? { callIntent: "unset" } : {}),
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

      let savedCitizen = data as Citizen;

      if (willSaveScreening && savedCitizen?.id) {
        const healthRes = await fetch("/api/admin/health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            citizenId: savedCitizen.id,
            year: screening.year,
            phase: "Sơ tuyển cấp xã",
            height: heightNum,
            weight: weightNum,
            bloodPressure: screening.bloodPressure.trim() || "—",
            vision: screening.vision.trim() || "—",
            conclusion: screening.conclusion,
            doctor: screening.doctor.trim(),
            note: screening.note.trim() || undefined,
            detail: {
              facility:
                screening.facility.trim() ||
                defaultFacilityForRound("screening", sessionLevel || "xa"),
              physicalDefects: screening.physicalDefects.trim() || undefined,
            },
          }),
        });
        const healthData = await healthRes.json();
        if (!healthRes.ok) {
          throw new Error(
            healthData.error ||
              "Đã tạo hồ sơ công dân nhưng chưa lưu được Vòng 1. Mở hồ sơ để nhập lại khám.",
          );
        }
        if (healthData.citizen) {
          savedCitizen = healthData.citizen as Citizen;
        } else {
          savedCitizen = {
            ...savedCitizen,
            healthStatus: screening.conclusion,
          };
        }
      }

      onSaved({ mode, citizen: savedCitizen });
      handleClose();
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
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="Đóng form"
        onClick={handleClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          panelOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="citizen-form-drawer-title"
        className={`relative flex h-full w-full max-w-[820px] flex-col bg-m3-surface-lowest shadow-[-8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <h2
            id="citizen-form-drawer-title"
            className="truncate text-[20px] font-semibold text-m3-on-surface"
          >
            {mode === "edit" ? "Sửa hồ sơ" : "Thêm công dân mới"}
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
              onClick={handleClose}
              className="rounded-[12px] p-2.5 text-m3-on-surface-variant hover:bg-black/[0.05]"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/[0.06] px-4">
          {FORM_TABS.map((t) => (
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error && (
              <div className="rounded-[14px] bg-m3-error-container px-4 py-3 text-[14px] font-semibold text-m3-error">
                {error}
              </div>
            )}

            {tab === "identity" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-[16px] border border-sky-100 bg-sky-50/70 p-4 space-y-3">
                  <Field label="Đợt đang làm việc *">
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
                    <p className="mt-1.5 text-[12px] leading-snug text-m3-on-surface-variant">
                      Một hồ sơ có thể có nhiều đợt trong lịch sử. Chọn đợt đang
                      thao tác — đợt cũ (vd. 2026) vẫn giữ khi gắn thêm 2027.
                    </p>
                  </Field>
                  {campaignHistory.length > 0 && (
                    <div className="rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-m3-on-surface-variant">
                        Lịch sử đợt khám
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {campaignHistory.map((h) => (
                          <li
                            key={`${h.campaignId}-${h.id}`}
                            className="flex flex-wrap items-center gap-2 text-[13px] text-m3-on-surface"
                          >
                            <span className="font-semibold">
                              {h.campaignYear
                                ? `${h.campaignYear} · `
                                : ""}
                              {h.campaignName || h.campaignId}
                            </span>
                            {h.isCurrent ? (
                              <span className="rounded-full bg-m3-primary-container px-2 py-0.5 text-[11px] font-semibold text-m3-on-primary-container">
                                Đang làm
                              </span>
                            ) : null}
                            <span className="text-[12px] text-m3-on-surface-variant">
                              {[h.militaryStatus, h.callIntent]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="mb-1.5 text-[14px] font-bold text-m3-on-surface">
                      Địa phương đăng ký *
                    </p>
                    {loadingUnits ? (
                      <p className="text-[13px] text-m3-on-surface-variant">
                        Đang tải…
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0">
                          {showTinhSelect ? (
                            <SearchableSelect
                              className="w-full"
                              ariaLabel="Tỉnh / Thành phố"
                              value={formTinh}
                              onChange={(code) => {
                                setFormTinh(code);
                                set("unitCode", "");
                                setProvinceLabel(
                                  provinces.find((p) => p.code === code)
                                    ?.name || code,
                                );
                                void loadWards(code);
                              }}
                              placeholder="— Chọn tỉnh/thành —"
                              options={[
                                { value: "", label: "— Chọn tỉnh/thành —" },
                                ...provinces.map((p) => ({
                                  value: p.code,
                                  label: p.name,
                                })),
                              ]}
                            />
                          ) : (
                            <input
                              className={`${inputCls} w-full bg-m3-surface-high`}
                              value={
                                provinceLabel ||
                                provinces.find((p) => p.code === formTinh)
                                  ?.name ||
                                formTinh ||
                                "—"
                              }
                              readOnly
                              aria-label="Tỉnh / Thành phố"
                              title="Theo phạm vi tài khoản đăng nhập"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          {xaLocked ? (
                            <input
                              className={`${inputCls} w-full bg-m3-surface-high`}
                              value={
                                sessionUnitName
                                  ? `${sessionUnitName}`
                                  : sessionUnitCode || form.unitCode || "—"
                              }
                              readOnly
                              aria-label="Xã / Phường"
                            />
                          ) : showXaSelect ? (
                            <SearchableSelect
                              className="w-full"
                              ariaLabel="Xã / Phường"
                              value={form.unitCode}
                              disabled={showTinhSelect && !formTinh}
                              onChange={(code) => set("unitCode", code)}
                              placeholder="— Chọn xã/phường —"
                              options={[
                                { value: "", label: "— Chọn xã/phường —" },
                                ...wards.map((w) => ({
                                  value: w.code,
                                  label: w.name,
                                })),
                              ]}
                            />
                          ) : (
                            <input
                              className={`${inputCls} w-full bg-m3-surface-high`}
                              value={form.unitCode || "—"}
                              readOnly
                              aria-label="Xã / Phường"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-start gap-5 rounded-[16px] bg-gradient-to-r from-m3-primary/8 to-transparent p-4">
                  <div className="shrink-0">
                    <p className="mb-1.5 text-[14px] font-bold text-m3-on-surface">
                      Ảnh 3×4
                    </p>
                    <div className="relative h-[240px] w-[180px] overflow-hidden rounded-[14px] border border-black/[0.08] bg-m3-surface-high shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveCitizenAvatarSrc(
                          form.avatar,
                          form.fullName,
                        )}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <input
                        ref={avatarFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                        className="hidden"
                        disabled={avatarUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadAvatarFile(file);
                        }}
                      />
                      <button
                        type="button"
                        disabled={avatarUploading}
                        onClick={() => avatarFileRef.current?.click()}
                        title={avatarUploading ? "Đang tải…" : "Tải ảnh 3×4"}
                        aria-label="Tải ảnh 3×4"
                        className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-center gap-1.5 bg-black/55 text-white backdrop-blur-[2px] transition hover:bg-black/70 disabled:opacity-60"
                      >
                        <Upload size={16} />
                        <span className="text-[12px] font-semibold">
                          {avatarUploading ? "…" : "Tải ảnh"}
                        </span>
                      </button>
                      {(isDiskAvatarPath(form.avatar) ||
                        Boolean(form.avatar?.startsWith("data:"))) && (
                        <button
                          type="button"
                          disabled={avatarUploading}
                          onClick={() => void removeAvatarFile()}
                          title="Xóa ảnh"
                          aria-label="Xóa ảnh"
                          className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white hover:bg-m3-error disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {avatarError && (
                      <p className="mt-1 max-w-[180px] text-[11px] leading-snug text-m3-error">
                        {avatarError}
                      </p>
                    )}
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  </div>
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

                <Field label="Đặc điểm nhận dạng">
                  <input
                    className={inputCls}
                    value={form.identificationFeatures}
                    onChange={(e) =>
                      set("identificationFeatures", e.target.value)
                    }
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
              </div>
            )}

            {tab === "education" && (
              <div className="flex flex-col gap-4">
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
              </div>
            )}

            {tab === "health" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-[14px] border border-m3-primary/15 bg-m3-primary/6 px-4 py-3">
                  <p className="text-[13px] font-bold text-m3-primary">
                    Hồ sơ khám sức khỏe (đồng bộ)
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-m3-on-surface-variant">
                    Kết quả do y tế / địa phương nhập ở màn Khám sức khỏe sẽ hiện
                    tại đây. Phân loại tóm tắt hiện tại:{" "}
                    <strong className="text-m3-on-surface">
                      {form.healthStatus ||
                        existingDetailed?.conclusion ||
                        existingScreening?.conclusion ||
                        "Chưa phân loại"}
                    </strong>
                  </p>
                </div>

                <Field label="Năm khám">
                  <select
                    className={inputCls}
                    value={screening.year}
                    onChange={(e) => {
                      setScreeningField("year", Number(e.target.value));
                      setScreeningField("enabled", false);
                    }}
                  >
                    {examYearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </Field>

                {healthLoading ? (
                  <p className="py-4 text-center text-[13px] text-m3-on-surface-variant">
                    Đang tải lịch sử khám…
                  </p>
                ) : (
                  <div className="rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                    <p className="text-[12px] font-medium text-m3-on-surface-variant">
                      Năm {screening.year}
                    </p>
                    <p className="mt-0.5 text-[15px] font-bold text-m3-on-surface">
                      {yearExamLabel}
                    </p>
                    <div className="mt-3 space-y-2">
                      {existingScreening ? (
                        <ExamSummaryCard
                          title="Vòng 1 — Sơ tuyển cấp xã"
                          record={existingScreening}
                        />
                      ) : (
                        <p className="rounded-[12px] border border-dashed border-black/[0.08] px-3 py-2.5 text-[13px] text-m3-on-surface-variant">
                          Chưa có Vòng 1 năm {screening.year}.
                        </p>
                      )}
                      {existingDetailed ? (
                        <ExamSummaryCard
                          title="Vòng 2 — Khám chi tiết"
                          record={existingDetailed}
                        />
                      ) : existingScreening ? (
                        <p className="rounded-[12px] border border-dashed border-black/[0.08] px-3 py-2.5 text-[13px] text-m3-on-surface-variant">
                          Chưa có Vòng 2 năm {screening.year}
                          {["Loại 1", "Loại 2", "Loại 3"].includes(
                            existingScreening.conclusion,
                          )
                            ? " — chờ y tế cấp tỉnh nhập."
                            : "."}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                {canAddScreening && (
                  <>
                    <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-m3-primary"
                        checked={screening.enabled}
                        onChange={(e) =>
                          setScreeningField("enabled", e.target.checked)
                        }
                      />
                      <span>
                        <span className="block text-[14px] font-bold text-m3-on-surface">
                          Nhập kết quả Vòng 1 kèm hồ sơ
                        </span>
                        <span className="mt-0.5 block text-[12px] text-m3-on-surface-variant">
                          {mode === "edit"
                            ? "Chỉ bật khi năm này chưa có sơ tuyển."
                            : "Tắt nếu chỉ tạo hồ sơ, nhập khám sau."}
                        </span>
                      </span>
                    </label>

                    {screening.enabled ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Cơ sở khám">
                          <input
                            className={inputCls}
                            value={screening.facility}
                            onChange={(e) =>
                              setScreeningField("facility", e.target.value)
                            }
                          />
                        </Field>
                        <div className="hidden sm:block" />
                        <Field label="Chiều cao (cm) *">
                          <input
                            className={inputCls}
                            type="number"
                            min={0}
                            step="0.1"
                            value={screening.height}
                            onChange={(e) =>
                              setScreeningField("height", e.target.value)
                            }
                          />
                        </Field>
                        <Field label="Cân nặng (kg) *">
                          <input
                            className={inputCls}
                            type="number"
                            min={0}
                            step="0.1"
                            value={screening.weight}
                            onChange={(e) =>
                              setScreeningField("weight", e.target.value)
                            }
                          />
                        </Field>
                        <Field label="Huyết áp">
                          <input
                            className={inputCls}
                            placeholder="120/80"
                            value={screening.bloodPressure}
                            onChange={(e) =>
                              setScreeningField(
                                "bloodPressure",
                                e.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label="Thị lực (sơ bộ)">
                          <input
                            className={inputCls}
                            placeholder="10/10"
                            value={screening.vision}
                            onChange={(e) =>
                              setScreeningField("vision", e.target.value)
                            }
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Dị tật / bệnh lý phát hiện">
                            <textarea
                              className={`${inputCls} min-h-[72px] resize-y py-3`}
                              placeholder="Không phát hiện dị tật, dị dạng thuộc diện miễn NVQS"
                              value={screening.physicalDefects}
                              onChange={(e) =>
                                setScreeningField(
                                  "physicalDefects",
                                  e.target.value,
                                )
                              }
                            />
                          </Field>
                        </div>
                        <Field label="Phân loại sức khỏe *">
                          <select
                            className={inputCls}
                            value={screening.conclusion}
                            onChange={(e) =>
                              setScreeningField("conclusion", e.target.value)
                            }
                          >
                            {HEALTH_CONCLUSIONS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Bác sĩ khám *">
                          <input
                            className={inputCls}
                            value={screening.doctor}
                            onChange={(e) =>
                              setScreeningField("doctor", e.target.value)
                            }
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Ghi chú / kết luận">
                            <textarea
                              className={`${inputCls} min-h-[64px] resize-y py-3`}
                              value={screening.note}
                              onChange={(e) =>
                                setScreeningField("note", e.target.value)
                              }
                            />
                          </Field>
                        </div>
                        {screening.conclusion ? (
                          <div className="sm:col-span-2 rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                            <p className="text-[12px] font-medium text-m3-on-surface-variant">
                              Ý nghĩa phân loại
                            </p>
                            <p className="mt-1 text-[15px] font-semibold text-m3-on-surface">
                              {getHealthConclusionMeaning(
                                screening.conclusion,
                                "Sơ tuyển cấp xã",
                              )}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}

                {!canAddScreening &&
                  !healthLoading &&
                  existingScreening &&
                  mode === "edit" && (
                    <p className="text-[12px] text-m3-on-surface-variant">
                      Năm {screening.year} đã có kết quả khám — dữ liệu đồng bộ
                      từ màn Khám sức khỏe. Xem chi tiết đầy đủ bằng nút xem hồ
                      sơ (biểu tượng mắt) trên danh sách.
                    </p>
                  )}
              </div>
            )}

            {tab === "residence" && (
              <div className="flex flex-col gap-4">
                <Field label="Địa chỉ thường trú / hiện tại">
                  <input
                    className={inputCls}
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </Field>
                <Field label="Quê quán">
                  <input
                    className={inputCls}
                    value={form.originPlace}
                    onChange={(e) => set("originPlace", e.target.value)}
                  />
                </Field>
              </div>
            )}

            {tab === "nvqs" && (
              <div className="flex flex-col gap-4">
                {mode === "create" ? (
                  <div className="rounded-[14px] border border-black/[0.06] bg-m3-surface-high px-4 py-3">
                    <p className="text-[12px] font-medium text-m3-on-surface-variant">
                      Trạng thái hồ sơ
                    </p>
                    <p className="mt-1 text-[16px] font-bold text-m3-on-surface">
                      Hồ sơ mới
                    </p>
                    <p className="mt-1 text-[12px] text-m3-on-surface-variant">
                      Hồ sơ mới tạo sẽ nằm ở tab «Hồ sơ mới». Có thể cập nhật dự
                      kiến gọi sau khi hoàn thiện hồ sơ.
                    </p>
                  </div>
                ) : (
                  <Field label="Trạng thái NVQS">
                    <select
                      className={inputCls}
                      value={form.militaryStatus}
                      onChange={(e) => set("militaryStatus", e.target.value)}
                    >
                      <option value="chuakham">Hồ sơ mới</option>
                      <option value="dangkham">Đang khám</option>
                      <option value="trungtuyen">Đậu</option>
                      <option value="truottuyen">Rớt</option>
                      <option value="tamhoan">Tạm hoãn</option>
                      <option value="miengoi">Miễn gọi</option>
                      <option value="nhapngu">Nhập ngũ</option>
                    </select>
                  </Field>
                )}

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
            )}
          </div>

          <div className="flex shrink-0 gap-3 border-t border-black/[0.06] bg-m3-surface-high/80 px-5 py-4">
            <button
              type="button"
              onClick={handleClose}
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
              {saving
                ? "Đang lưu..."
                : mode === "edit"
                  ? "Lưu thay đổi"
                  : "Thêm công dân"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function ExamSummaryCard({
  title,
  record,
}: {
  title: string;
  record: HealthRecord;
}) {
  const meaning = getHealthConclusionMeaning(record.conclusion, record.phase);
  return (
    <div className="rounded-[12px] border border-black/[0.06] bg-m3-surface-lowest px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[13px] font-bold text-m3-on-surface">{title}</p>
        <span className="rounded-full bg-m3-primary/10 px-2.5 py-0.5 text-[12px] font-bold text-m3-primary">
          {record.conclusion}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-m3-on-surface-variant">{meaning}</p>
      <p className="mt-2 text-[13px] text-m3-on-surface">
        Cao {record.height} cm · Nặng {record.weight} kg
        {record.bloodPressure && record.bloodPressure !== "—"
          ? ` · HA ${record.bloodPressure}`
          : ""}
        {record.vision && record.vision !== "—"
          ? ` · Thị lực ${record.vision}`
          : ""}
      </p>
      {record.doctor ? (
        <p className="mt-1 text-[12px] text-m3-on-surface-variant">
          Bác sĩ: {record.doctor}
          {record.createdAt
            ? ` · ${formatVnDate(record.createdAt.slice(0, 10))}`
            : ""}
        </p>
      ) : null}
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
