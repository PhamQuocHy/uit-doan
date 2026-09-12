"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Citizen, HierarchyUnit } from "@/lib/data";
import { Search, Plus, Eye, Pencil, Trash2, SlidersHorizontal, CheckSquare, GraduationCap, HeartPulse, X, Bell, Check, ChevronLeft, ChevronRight } from "lucide-react";
import CitizenDetailModal from "@/components/admin/CitizenDetailModal";
import CitizenFormModal from "@/components/admin/CitizenFormModal";
import Hn212ScanButton from "@/components/admin/Hn212ScanButton";
import { ConfirmDialog } from "@/components/ui/Modal";
import { getCallDisplayLabel, RETURN_TAM_HOAN_MARKER } from "@/lib/enlistment-approval";
import {
  calcAgeYears,
  citizenRowAgeTone,
  NVQS_AGE_MAX,
} from "@/lib/nvqs-age";
import { buildPageItems } from "@/components/admin/list-ui";
import type { Hn212CitizenScan } from "@/lib/hn212";
import {
  publishCitizensChanged,
  subscribeCitizensChanged,
} from "@/lib/citizens-realtime";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { resolveCitizenAvatarSrc } from "@/lib/citizen-avatar";

const CALL_FILTER_OPTIONS = [
  { value: "", label: "Tất cả dự kiến" },
  { value: "du_kien_goi", label: "Dự kiến gọi" },
  { value: "du_bi", label: "Dự bị" },
  { value: "de_xuat_khong_goi", label: "Đề xuất không gọi" },
  { value: "khong_goi", label: "Không gọi" },
  { value: "unset", label: "Hồ sơ mới" },
] as const;

const EDUCATION_FILTER_OPTIONS = [
  { value: "", label: "Tất cả trình độ" },
  { value: "THPT", label: "THPT / phổ thông" },
  { value: "Trung cấp", label: "Trung cấp" },
  { value: "Cao đẳng", label: "Cao đẳng" },
  { value: "Đại học", label: "Đại học" },
  { value: "Sau đại học", label: "Sau đại học" },
] as const;

const HEALTH_FILTER_OPTIONS = [
  { value: "", label: "Tất cả phân loại" },
  { value: "1", label: "Loại 1" },
  { value: "2", label: "Loại 2" },
  { value: "3", label: "Loại 3" },
  { value: "4", label: "Loại 4" },
  { value: "5", label: "Loại 5" },
  { value: "6", label: "Loại 6" },
  { value: "none", label: "Chưa phân loại" },
] as const;

const SELECT_CLS =
  "h-9 min-w-0 rounded-full border border-black/[0.08] bg-white px-3.5 pr-8 text-[13px] font-medium text-m3-on-surface outline-none transition-colors hover:border-m3-primary/30 focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/10";

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "unset", label: "Hồ sơ mới" },
  { value: "du_kien_goi", label: "Dự kiến gọi" },
  { value: "du_bi", label: "Dự bị" },
  { value: "de_xuat_khong_goi", label: "Đề xuất không gọi" },
  { value: "__hoan__", label: "Tạm hoãn" },
  { value: "khong_goi", label: "Không gọi (khóa)" },
  { value: "khong_duyet_khong_goi", label: "Không duyệt không gọi" },
  { value: "khong_duyet_tam_hoan", label: "Không duyệt tạm hoãn" },
  { value: "__tai_ngu__", label: "Tại ngũ" },
  { value: "__tinh_tra_ve__", label: "Tỉnh trả về" },
] as const;

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type ScopeMeta = {
  code: string;
  name: string;
  level: string;
} | null;

type CampaignOption = {
  id: string;
  name: string;
  year: number;
  startDate: string;
};

type StatusSummary = {
  du_kien_goi: number;
  du_bi: number;
  hoan: number;
  khong_goi: number;
};

const STATUS_SUMMARY_BOXES = [
  {
    key: "du_kien_goi" as const,
    filter: "du_kien_goi",
    label: "Dự kiến gọi",
    color: "var(--color-m3-warning, #b26a00)",
    bg: "var(--color-m3-warning-container, #fff3cd)",
  },
  {
    key: "du_bi" as const,
    filter: "du_bi",
    label: "Dự bị",
    color: "var(--m3-tertiary, #5a5f6e)",
    bg: "color-mix(in srgb, var(--m3-tertiary, #5a5f6e) 12%, transparent)",
  },
  {
    key: "hoan" as const,
    filter: "__hoan__",
    label: "Hoãn",
    color: "var(--m3-primary, #1a73e8)",
    bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)",
  },
  {
    key: "khong_goi" as const,
    filter: "khong_goi",
    label: "Không gọi (khóa)",
    color: "var(--m3-error, #ba1a1a)",
    bg: "var(--m3-error-container, #ffdad6)",
  },
] as const;

export default function CitizensPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isArchive = pathname.includes("citizen-archive");
  const ageScope = isArchive ? "archive" : "active";
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusSummary, setStatusSummary] = useState<StatusSummary>({
    du_kien_goi: 0,
    du_bi: 0,
    hoan: 0,
    khong_goi: 0,
  });
  const [callIntentFilter, setCallIntentFilter] = useState("");
  const [viewCitizen, setViewCitizen] = useState<Citizen | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editCitizen, setEditCitizen] = useState<Citizen | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
  const [sessionUnitCode, setSessionUnitCode] = useState<string | null>(null);
  const [filterTinh, setFilterTinh] = useState("");
  const [filterXa, setFilterXa] = useState("");
  const [provinces, setProvinces] = useState<HierarchyUnit[]>([]);
  const [wards, setWards] = useState<HierarchyUnit[]>([]);
  const [scopeMeta, setScopeMeta] = useState<ScopeMeta>(null);
  const [dataSource, setDataSource] = useState<"mysql" | "memory" | null>(null);
  const [requiresUnitSelection, setRequiresUnitSelection] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCallIntent, setDraftCallIntent] = useState("");
  const [draftEducationLevel, setDraftEducationLevel] = useState("");
  const [draftHealthGrade, setDraftHealthGrade] = useState("");
  const [educationLevelFilter, setEducationLevelFilter] = useState("");
  const [healthGradeFilter, setHealthGradeFilter] = useState("");
  const [filterTab, setFilterTab] = useState<"status" | "education" | "health">(
    "status",
  );
  const [pendingCitizens, setPendingCitizens] = useState<Citizen[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<
    null | { mode: "all" } | { mode: "one"; citizen: Citizen }
  >(null);
  const [formPrefill, setFormPrefill] = useState<Hn212CitizenScan | null>(null);
  const [confirmCreateFromNfc, setConfirmCreateFromNfc] =
    useState<Hn212CitizenScan | null>(null);
  /** Bỏ qua refresh realtime ngay sau khi tự lưu (tránh nhấp nháy / mất danh sách). */
  const ignoreRealtimeUntilRef = useRef(0);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const effectiveUnitCode =
    sessionLevel === "bo"
      ? filterXa || filterTinh
      : sessionLevel === "tinh"
        ? filterXa || filterTinh || sessionUnitCode || ""
        : sessionUnitCode || "";

  const loadWards = useCallback(async (parentCode: string) => {
    if (!parentCode) {
      setWards([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(parentCode)}`,
      );
      if (!res.ok) throw new Error("wards failed");
      const data = await res.json();
      setWards(data.items || []);
    } catch {
      setWards([]);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        const level = data?.user?.hierarchyLevel ?? null;
        const unitCode = data?.user?.unitCode ?? null;
        setSessionLevel(level);
        setSessionUnitCode(unitCode);

        const scopeFromUrl = searchParams.get("scope");

        if (level === "bo") {
          const res = await fetch("/api/admin/hierarchy/children?parentCode=bo");
          const provData = res.ok ? await res.json() : { items: [] };
          setProvinces(provData.items || []);

          if (scopeFromUrl) {
            const unit = (provData.items || []).find(
              (p: HierarchyUnit) => p.code === scopeFromUrl,
            );
            if (unit) {
              setFilterTinh(scopeFromUrl);
              await loadWards(scopeFromUrl);
            } else {
              setFilterTinh(scopeFromUrl);
              await loadWards(scopeFromUrl);
            }
          }
        } else if (level === "tinh" && unitCode) {
          setFilterTinh(unitCode);
          await loadWards(unitCode);
          if (scopeFromUrl && scopeFromUrl.startsWith(`${unitCode}-`)) {
            setFilterXa(scopeFromUrl);
          }
        }
      })
      .catch(() => {
        setSessionLevel(null);
        setSessionUnitCode(null);
      });
  }, [searchParams, loadWards]);

  /** Tăng mỗi lần fetch — bỏ qua response cũ (tránh race / poll stale đổ “Tất cả”). */
  const fetchSeqRef = useRef(0);

  const fetchCitizens = useCallback(async (opts?: {
    silent?: boolean;
    search?: string;
    page?: number;
    /** Tra cứu CCCD (NFC): bỏ lọc đợt / dự kiến gọi, tìm theo phạm vi cấp */
    lookupCccd?: boolean;
  }): Promise<Citizen[] | null> => {
    const seq = ++fetchSeqRef.current;
    if (!opts?.silent) setLoading(true);
    try {
      const qSearch = opts?.search !== undefined ? opts.search : search;
      const qPage = opts?.page !== undefined ? opts.page : page;
      const lookup = Boolean(opts?.lookupCccd);
      const searchTrim = (qSearch || "").trim();
      // Cấp Bộ: chưa chọn tỉnh → chỉ search/NFC toàn quốc; không load sẵn 10k hồ sơ
      const nationwideBo =
        sessionLevel === "bo" &&
        !effectiveUnitCode &&
        (lookup || searchTrim.length > 0);

      if (sessionLevel === "bo" && !effectiveUnitCode && !nationwideBo) {
        if (seq !== fetchSeqRef.current) return null;
        setCitizens([]);
        setTotalPages(0);
        setTotalCount(0);
        setStatusSummary({
          du_kien_goi: 0,
          du_bi: 0,
          hoan: 0,
          khong_goi: 0,
        });
        setScopeMeta(null);
        setDataSource(null);
        setRequiresUnitSelection(true);
        return [];
      }

      const isTaiNgu = !lookup && !isArchive && callIntentFilter === "__tai_ngu__";
      const isHoan = !lookup && !isArchive && callIntentFilter === "__hoan__";
      const query = new URLSearchParams({
        page: String(qPage),
        limit: String(lookup ? Math.max(pageSize, 50) : pageSize),
        // Tại ngũ: danh sách không giới hạn tuổi; box số liệu vẫn theo tuổi NVQS (summaryAgeScope)
        ageScope: lookup || isTaiNgu ? "all" : ageScope,
        summaryAgeScope: ageScope === "archive" ? "archive" : "active",
        ...(searchTrim && { search: searchTrim }),
        // Tra cứu CCCD: không lọc đợt/dự kiến — tránh “không thấy” dù đã có hồ sơ
        ...(!lookup &&
          !isArchive &&
          callIntentFilter &&
          callIntentFilter !== "__tai_ngu__" &&
          callIntentFilter !== "__hoan__" && {
            callIntent: callIntentFilter,
          }),
        ...(isTaiNgu && { militaryStatus: "nhapngu" }),
        ...(isHoan && { militaryStatus: "tamhoan" }),
        ...(!lookup && !isArchive && campaignId && { campaignId }),
        ...(!lookup && !isArchive && educationLevelFilter && { educationLevel: educationLevelFilter }),
        ...(!lookup && !isArchive && healthGradeFilter && { healthGrade: healthGradeFilter }),
        ...(effectiveUnitCode && { unitCode: effectiveUnitCode }),
        ...(nationwideBo && { nationwide: "1" }),
      });
      const res = await fetch(`/api/admin/citizens?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (seq !== fetchSeqRef.current) return null;
      const list: Citizen[] = Array.isArray(data.data) ? data.data : [];
      setCitizens(list);
      setTotalPages(data.totalPages);
      setTotalCount(data.total ?? 0);
      if (data.summary) {
        setStatusSummary({
          du_kien_goi: Number(data.summary.du_kien_goi || 0),
          du_bi: Number(data.summary.du_bi || 0),
          hoan: Number(data.summary.hoan || 0),
          khong_goi: Number(data.summary.khong_goi || 0),
        });
      }
      setScopeMeta(data.meta?.scopeUnit ?? null);
      setRequiresUnitSelection(Boolean(data.meta?.requiresUnitSelection));
      setDataSource(
        data.meta?.source === "memory"
          ? "memory"
          : data.meta?.source === "mysql"
            ? "mysql"
            : null,
      );
      return list;
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      if (seq === fetchSeqRef.current && !opts?.silent) setLoading(false);
    }
  }, [
    search,
    page,
    pageSize,
    callIntentFilter,
    campaignId,
    educationLevelFilter,
    healthGradeFilter,
    effectiveUnitCode,
    sessionLevel,
    ageScope,
    isArchive,
  ]);

  const fetchPendingArchive = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isArchive || sessionLevel === null) return;
    // Cấp Bộ: chờ duyệt lưu trữ theo tỉnh đã chọn (không load toàn quốc)
    if (sessionLevel === "bo" && !effectiveUnitCode) {
      setPendingCitizens([]);
      setPendingCount(0);
      return;
    }
    if (!opts?.silent) setPendingLoading(true);
    try {
      const query = new URLSearchParams({
        page: "1",
        limit: "100",
        ageScope: "pending",
        ...(effectiveUnitCode && { unitCode: effectiveUnitCode }),
      });
      const res = await fetch(`/api/admin/citizens?${query.toString()}`);
      if (!res.ok) throw new Error("pending failed");
      const data = await res.json();
      setPendingCitizens(Array.isArray(data.data) ? data.data : []);
      setPendingCount(Number(data.total ?? 0));
    } catch {
      if (!opts?.silent) {
        setPendingCitizens([]);
        setPendingCount(0);
      }
    } finally {
      if (!opts?.silent) setPendingLoading(false);
    }
  }, [isArchive, sessionLevel, effectiveUnitCode]);

  const approveArchive = async (
    ids?: string[],
    approveAll = false,
    knownCitizens?: Citizen[],
  ) => {
    if (approveAll) setApprovingAll(true);
    else if (ids?.[0]) setApprovingId(ids[0]);

    const nowIso = new Date().toISOString();
    const moved: Citizen[] = approveAll
      ? [...pendingCitizens]
      : knownCitizens?.length
        ? knownCitizens
        : pendingCitizens.filter((c) => ids?.includes(c.id));
    const movedIds = new Set(moved.map((c) => c.id));
    const nextPendingCount = Math.max(
      0,
      pendingCount - (approveAll ? pendingCount : moved.length),
    );

    // Optimistic ngay lập tức
    if (moved.length) {
      setPendingCitizens((prev) => prev.filter((c) => !movedIds.has(c.id)));
      setPendingCount(nextPendingCount);
      if (isArchive) {
        if (page !== 1) setPage(1);
        setCitizens((prev) => {
          const stamped = moved.map((c) => ({ ...c, archivedAt: nowIso }));
          const withoutDup = prev.filter((c) => !movedIds.has(c.id));
          return [...stamped, ...withoutDup].slice(0, 10);
        });
        setTotalCount((n) => n + moved.length);
      }
    }
    setConfirmArchive(null);
    if (nextPendingCount <= 0) setPendingOpen(false);

    try {
      const res = await fetch("/api/admin/citizens/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(approveAll ? { approveAll: true } : { ids: ids || [...movedIds] }),
          ...(effectiveUnitCode && { unitCode: effectiveUnitCode }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || Number(data.archived || 0) <= 0) {
        await Promise.all([
          fetchPendingArchive({ silent: true }),
          fetchCitizens({ silent: true }),
        ]);
        alert(
          typeof data.error === "string"
            ? data.error
            : "Duyệt thất bại — hồ sơ chưa được chuyển lưu trữ",
        );
        return;
      }
      // Đồng bộ nền (không lọc campaign trên trang lưu trữ)
      await Promise.all([
        fetchPendingArchive({ silent: true }),
        fetchCitizens({ silent: true }),
      ]);
    } catch {
      await Promise.all([
        fetchPendingArchive({ silent: true }),
        fetchCitizens({ silent: true }),
      ]);
      alert("Lỗi kết nối khi duyệt lưu trữ");
    } finally {
      setApprovingAll(false);
      setApprovingId(null);
    }
  };

  const handleConfirmArchive = () => {
    if (!confirmArchive) return;
    if (confirmArchive.mode === "all") {
      void approveArchive(undefined, true);
      return;
    }
    void approveArchive(
      [confirmArchive.citizen.id],
      false,
      [confirmArchive.citizen],
    );
  };

  useEffect(() => {
    const q = searchParams.get("search");
    if (q !== null) {
      setSearch(q);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    const intent = searchParams.get("callIntent");
    if (intent === null) return;
    const allowed = new Set([
      "",
      "unset",
      "du_kien_goi",
      "du_bi",
      "de_xuat_khong_goi",
      "khong_goi",
      "khong_duyet_khong_goi",
      "khong_duyet_tam_hoan",
      "__tai_ngu__",
      "__hoan__",
      "__tinh_tra_ve__",
      "province_returned",
    ]);
    if (!allowed.has(intent)) return;
    setCallIntentFilter(intent);
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    if (sessionLevel === null) return;
    void fetchCitizens();
  }, [fetchCitizens, sessionLevel]);

  // Realtime / poll: luôn dùng fetchCitizens mới nhất (kèm tab lọc hiện tại)
  useEffect(() => {
    if (sessionLevel === null) return;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() < ignoreRealtimeUntilRef.current) return;
      void fetchCitizens({ silent: true });
    };
    const unsub = subscribeCitizensChanged(() => refresh());
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(refresh, 45_000);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [sessionLevel, fetchCitizens]);

  useEffect(() => {
    if (sessionLevel === null) return;
    fetchPendingArchive();
  }, [fetchPendingArchive, sessionLevel]);

  useEffect(() => {
    // Trang lưu trữ không dùng lọc đợt khám — tránh ẩn hồ sơ vừa duyệt
    if (isArchive) {
      setCampaignId("");
      setCallIntentFilter("");
      setEducationLevelFilter("");
      setHealthGradeFilter("");
      return;
    }
    fetch("/api/admin/recruitment?limit=100")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        const sorted = [...(data.data || [])].sort(
          (a: CampaignOption, b: CampaignOption) =>
            b.year - a.year || String(b.startDate).localeCompare(String(a.startDate)),
        );
        setCampaigns(sorted);
        // Mặc định "Tất cả đợt" — không tự chọn đợt để tránh ẩn hồ sơ
      })
      .catch(() => undefined);
  }, [isArchive]);

  const handleTinhChange = (code: string) => {
    setFilterTinh(code);
    setFilterXa("");
    setPage(1);
    loadWards(code);
  };

  const handleXaChange = (code: string) => {
    setFilterXa(code);
    setPage(1);
  };

  const openFilters = () => {
    setDraftCallIntent(callIntentFilter);
    setDraftEducationLevel(educationLevelFilter);
    setDraftHealthGrade(healthGradeFilter);
    setFilterTab("status");
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setCallIntentFilter(draftCallIntent);
    setEducationLevelFilter(draftEducationLevel);
    setHealthGradeFilter(draftHealthGrade);
    setPage(1);
    setFilterOpen(false);
  };

  const activeAdvancedFilterCount =
    Number(Boolean(callIntentFilter)) +
    Number(Boolean(educationLevelFilter)) +
    Number(Boolean(healthGradeFilter));

  const openCreate = (prefill?: Hn212CitizenScan | null) => {
    setFormMode("create");
    setEditCitizen(null);
    setFormPrefill(prefill ?? null);
    setFormOpen(true);
  };

  const openEdit = async (citizen: Citizen) => {
    if (
      citizen.approvalStatus === "approved" &&
      (citizen.militaryStatusLocked || citizen.militaryStatus === "nhapngu")
    ) {
      alert("Hồ sơ đã duyệt gọi nhập ngũ — không được sửa lại.");
      return;
    }
    setFormMode("edit");
    setFormPrefill(null);
    try {
      const res = await fetch(
        `/api/admin/citizens/${encodeURIComponent(citizen.id)}`,
      );
      const full = res.ok ? await res.json() : null;
      setEditCitizen(full && full.id ? (full as Citizen) : citizen);
    } catch {
      setEditCitizen(citizen);
    }
    setFormOpen(true);
  };

  const isApprovedLocked = (c: Citizen) =>
    c.approvalStatus === "approved" &&
    (c.militaryStatusLocked || c.militaryStatus === "nhapngu");

  const normalizeCccd = (value: unknown) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits.length === 11 ? digits.padStart(12, "0") : digits;
  };

  const handleNfcExistingCheck = async (data: Hn212CitizenScan) => {
    const cccd = normalizeCccd(data.cccd);
    if (!cccd) return false;
    const list = await fetchCitizens({
      search: cccd,
      page: 1,
      lookupCccd: true,
    });
    if (!list) return false;
    const existing = list.find((c) => normalizeCccd(c.cccd) === cccd);
    if (!existing) return false;
    setFormOpen(false);
    setFormPrefill(null);
    setViewCitizen(existing);
    return true;
  };

  const handleNfcSearch = async (data: Hn212CitizenScan) => {
    if (!data.cccd?.trim()) {
      if (data.fullName?.trim()) {
        openCreate(data);
        return;
      }
      alert(
        "Chip không trả về số CCCD. Thử quét lại (giữ thẻ trong khe đến khi ComQ báo xong) hoặc nhập tay.",
      );
      return;
    }
    const cccd = normalizeCccd(data.cccd);
    try {
      const list = await fetchCitizens({
        search: cccd,
        page: 1,
        lookupCccd: true,
      });
      if (!list) {
        alert("Không tra cứu được CCCD. Thử lại hoặc tìm thủ công.");
        return;
      }
      setSearch(cccd);
      setPage(1);
      const exact = list.filter(
        (c) => normalizeCccd(c.cccd) === cccd,
      );
      if (exact.length === 1) {
        setViewCitizen(exact[0]!);
        return;
      }
      if (exact.length === 0) {
        setConfirmCreateFromNfc(data);
      }
    } catch {
      alert("Không tra cứu được CCCD. Thử lại hoặc tìm thủ công.");
    }
  };

  const handleDelete = async (citizen: Citizen) => {
    const ok = window.confirm(
      `Xóa công dân "${citizen.fullName}"?\nThao tác này không hoàn lại được.`,
    );
    if (!ok) return;
    setBusyId(citizen.id);
    try {
      const res = await fetch(`/api/admin/citizens/${citizen.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Không xóa được. Cần tài khoản quản trị.");
        return;
      }
      await fetchCitizens();
    } catch {
      alert("Lỗi kết nối khi xóa");
    } finally {
      setBusyId(null);
    }
  };

  const getCallLabel = (citizen: Citizen) => getCallDisplayLabel(citizen);

  const getHealthStyle = (grade?: string) => {
    if (!grade) return { bg: "var(--m3-surface-container-high, #eef1f4)", color: "var(--m3-on-surface-variant, #475569)" };
    if (["Loại 1", "Loại 2", "Loại 3"].includes(grade)) {
      return { bg: "color-mix(in srgb, var(--color-m3-success) 14%, transparent)", color: "var(--color-m3-success)" };
    }
    if (grade === "Loại 4") {
      return { bg: "color-mix(in srgb, var(--color-m3-warning) 14%, transparent)", color: "var(--m3-error, #ba1a1a)" };
    }
    return { bg: "color-mix(in srgb, var(--m3-error, #ba1a1a) 10%, transparent)", color: "var(--m3-error, #ba1a1a)" };
  };

  const TABLE_COLS = 9;

  const pageItems = buildPageItems(page, totalPages);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  const campaignSelectTitle = selectedCampaign
    ? `${selectedCampaign.year} · ${selectedCampaign.name}`
    : "Tất cả đợt";

  return (
    <div className="space-y-4 pb-6">
      {dataSource === "memory" && (
        <div className="rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-950">
          Không kết nối được MySQL — đang xem dữ liệu demo tạm. Hồ sơ thật vẫn
          trong database. Hãy khởi động lại MySQL (XAMPP) rồi tải lại trang.
        </div>
      )}
      {/* Header kiểu hiện đại: tiêu đề + pill lọc + CTA */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className="text-[24px] font-bold tracking-tight text-m3-on-surface">
            {isArchive ? "Hồ sơ lưu trữ" : "Hồ sơ công dân"}
          </h1>
          {(sessionLevel === "bo" || sessionLevel === "tinh") && (
            <>
              {sessionLevel === "bo" && (
                <SearchableSelect
                  variant="compact"
                  className="max-w-[200px] min-w-[160px]"
                  value={filterTinh}
                  onChange={handleTinhChange}
                  ariaLabel="Chọn tỉnh thành phố"
                  placeholder="Tỉnh / TP"
                  options={[
                    { value: "", label: "Tỉnh / TP" },
                    ...provinces.map((p) => ({
                      value: p.code,
                      label: p.name,
                    })),
                  ]}
                />
              )}
              {filterTinh && (
                <SearchableSelect
                  variant="compact"
                  className="max-w-[180px] min-w-[140px]"
                  value={filterXa}
                  onChange={handleXaChange}
                  ariaLabel="Chọn xã phường"
                  placeholder="Tất cả xã"
                  options={[
                    { value: "", label: "Tất cả xã" },
                    ...wards.map((w) => ({
                      value: w.code,
                      label: w.name,
                    })),
                  ]}
                />
              )}
            </>
          )}
          {!isArchive && campaigns.length > 0 && (
            <select
              className={`${SELECT_CLS} max-w-[min(100%,380px)] min-w-[220px]`}
              value={campaignId}
              onChange={(e) => {
                setCampaignId(e.target.value);
                setPage(1);
              }}
              aria-label="Đợt khám"
              title={campaignSelectTitle}
            >
              <option value="">Tất cả đợt</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} · {c.name}
                </option>
              ))}
            </select>
          )}
          {!requiresUnitSelection && (
            <span className="rounded-full bg-m3-primary/10 px-3 py-1 text-[12px] font-semibold text-m3-primary">
              {totalCount.toLocaleString("vi-VN")} hồ sơ
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isArchive && (
            <>
              <button
                type="button"
                onClick={openFilters}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-semibold text-m3-on-surface hover:bg-m3-surface-high"
              >
                <SlidersHorizontal size={15} />
                Bộ lọc
                {(activeAdvancedFilterCount > 0 || campaignId) && (
                  <span className="rounded-full bg-m3-primary px-1.5 text-[10px] text-white">
                    {activeAdvancedFilterCount + Number(Boolean(campaignId))}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => openCreate()}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                <Plus size={16} />
                Thêm hồ sơ
              </button>
            </>
          )}
        </div>
      </div>

      {saveNotice && (
        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-800">
          {saveNotice}
        </div>
      )}

      {requiresUnitSelection && (
        <p className="text-[14px] text-m3-on-surface-variant">
          Chọn tỉnh / thành phố để xem danh sách, hoặc tìm CCCD / họ tên ở ô tìm kiếm (toàn quốc).
        </p>
      )}

      {isArchive && !requiresUnitSelection && pendingCount > 0 && (
        <div className="overflow-hidden rounded-[16px] border border-red-500/30 bg-red-500/[0.06]">
          <button
            type="button"
            onClick={() => setPendingOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-red-500/[0.06]"
          >
            <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
              <Bell size={18} />
              <span className="absolute -right-1 -top-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-red-700 ring-2 ring-red-600">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-red-700">
                Có {pendingCount.toLocaleString("vi-VN")} hồ sơ hết tuổi cần duyệt lưu trữ
              </p>
              <p className="mt-0.5 text-[13px] text-red-700/80">
                Tuổi = năm hiện tại − năm sinh &gt; {NVQS_AGE_MAX}. Bấm để xem danh sách chờ duyệt.
              </p>
            </div>
            <span className="text-[13px] font-semibold text-red-700">
              {pendingOpen ? "Thu gọn" : "Xem danh sách"}
            </span>
          </button>

          {pendingOpen && (
            <div className="border-t border-red-500/15 bg-white px-4 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-m3-on-surface">
                  Danh sách chờ duyệt — kiểm tra rồi chuyển lưu trữ
                </p>
                <button
                  type="button"
                  disabled={approvingAll || pendingLoading || pendingCitizens.length === 0}
                  onClick={() => setConfirmArchive({ mode: "all" })}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-red-600 px-4 text-[14px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  <CheckSquare size={16} />
                  {approvingAll ? "Đang duyệt..." : "Duyệt tất cả"}
                </button>
              </div>

              {pendingLoading ? (
                <p className="py-6 text-center text-[14px] text-m3-on-surface-variant">
                  Đang tải danh sách chờ duyệt...
                </p>
              ) : (
                <ul className="max-h-[360px] space-y-2 overflow-y-auto">
                  {pendingCitizens.map((c) => {
                    const age = calcAgeYears(c.dateOfBirth);
                    return (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-black/[0.08] border-l-[3px] border-l-red-500 bg-white px-3.5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-m3-on-surface">
                            {c.fullName}
                            <span className="ml-2 rounded-full bg-red-500/12 px-2 py-0.5 text-[12px] font-bold text-red-700">
                              {age} tuổi
                            </span>
                          </p>
                          <p className="mt-0.5 text-[13px] text-m3-on-surface-variant">
                            {new Date(c.dateOfBirth).toLocaleDateString("vi-VN")} · CCCD {c.cccd}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={approvingId === c.id || approvingAll}
                          onClick={() => setConfirmArchive({ mode: "one", citizen: c })}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-red-600 px-3.5 text-[13px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
                        >
                          <Check size={15} />
                          {approvingId === c.id ? "Đang duyệt..." : "Duyệt"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {!isArchive && !requiresUnitSelection && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_SUMMARY_BOXES.map((box) => {
            const active = callIntentFilter === box.filter;
            const count = statusSummary[box.key];
            return (
              <button
                key={box.key}
                type="button"
                onClick={() => {
                  setCallIntentFilter(active ? "" : box.filter);
                  setPage(1);
                }}
                className={`rounded-[16px] border bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all ${
                  active
                    ? "border-m3-primary/40 ring-2 ring-m3-primary/15"
                    : "border-black/[0.06] hover:border-black/[0.12]"
                }`}
              >
                <p className="text-[13px] font-medium text-m3-on-surface-variant">
                  {box.label}
                </p>
                <p
                  className="mt-1.5 text-2xl font-bold tabular-nums"
                  style={{ color: box.color }}
                >
                  {count.toLocaleString("vi-VN")}
                </p>
                <span
                  className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ color: box.color, background: box.bg }}
                >
                  hồ sơ
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs trạng thái + tìm kiếm */}
      <div className="rounded-[16px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {!isArchive && (
          <div className="flex flex-wrap items-center gap-1 border-b border-black/[0.05] px-3 pt-2">
            {STATUS_TABS.map((tab) => {
              const active = callIntentFilter === tab.value;
              return (
                <button
                  key={tab.value || "all"}
                  type="button"
                  onClick={() => {
                    setCallIntentFilter(tab.value);
                    setPage(1);
                  }}
                  className={`relative min-h-[42px] px-3.5 text-[13px] font-semibold transition-colors ${
                    active
                      ? "text-m3-primary"
                      : "text-m3-on-surface-variant hover:text-m3-on-surface"
                  }`}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-m3-primary" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-black/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
                size={16}
              />
              <input
                type="text"
                placeholder="Tìm tên, CCCD, SĐT..."
                className="h-9 w-full rounded-full border border-black/[0.08] bg-m3-surface-high/60 py-2 pl-9 pr-4 text-[13px] text-m3-on-surface outline-none placeholder:text-m3-on-surface-variant focus:border-m3-primary/35 focus:bg-white focus:ring-2 focus:ring-m3-primary/10"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            {!isArchive && (
              <Hn212ScanButton
                compact
                label="Quét NFC"
                onScanned={handleNfcSearch}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-[13px] text-m3-on-surface-variant">
              Hiển thị
              <select
                className="h-9 rounded-lg border border-black/[0.08] bg-white px-2 text-[13px] font-semibold text-m3-on-surface outline-none"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              dòng
            </label>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] text-m3-on-surface disabled:opacity-35"
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>
                {pageItems.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`e-${idx}`}
                      className="inline-flex h-8 min-w-8 items-center justify-center px-1 text-[13px] font-semibold text-m3-on-surface-variant"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-semibold ${
                        item === page
                          ? "bg-m3-primary text-white"
                          : "border border-black/[0.08] text-m3-on-surface hover:bg-m3-surface-high"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] text-m3-on-surface disabled:opacity-35"
                  aria-label="Trang sau"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-h-[min(62vh,640px)] overflow-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-black/[0.06] text-[12px] font-semibold text-m3-on-surface-variant">
                <th className="bg-[#f1f5f9] px-3 py-3 font-semibold w-14">Ảnh</th>
                <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">Họ và tên</th>
                <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">Mã / CCCD</th>
                <th className="hidden bg-[#f1f5f9] px-4 py-3 font-semibold sm:table-cell">Ngày sinh</th>
                <th className="hidden bg-[#f1f5f9] px-4 py-3 font-semibold lg:table-cell">Học vấn</th>
                <th className="hidden bg-[#f1f5f9] px-4 py-3 font-semibold md:table-cell">Địa chỉ</th>
                <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">Sức khỏe</th>
                <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">Dự kiến gọi</th>
                <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {loading && citizens.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : citizens.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                    {requiresUnitSelection
                      ? "Chọn tỉnh / thành phố để xem hồ sơ, hoặc nhập từ khóa tìm kiếm."
                      : "Không có hồ sơ phù hợp."}
                  </td>
                </tr>
              ) : (
                citizens.map((citizen, idx) => {
                  const statusInfo = getCallLabel(citizen);
                  const healthStyle = getHealthStyle(citizen.healthStatus);
                  const ageTone = !isArchive
                    ? citizenRowAgeTone(citizen.dateOfBirth)
                    : null;
                  const age = calcAgeYears(citizen.dateOfBirth);
                  const stripe = idx % 2 === 1 ? "bg-[#f8fafc]" : "bg-white";
                  const ageBar =
                    ageTone === "danger"
                      ? "shadow-[inset_3px_0_0_0_#ef4444]"
                      : ageTone === "warn"
                        ? "shadow-[inset_3px_0_0_0_#f59e0b]"
                        : "";
                  const rawReason = citizen.militaryStatusReason?.trim() || "";
                  const noteText =
                    citizen.provinceComment?.trim() ||
                    citizen.approvalComment?.trim() ||
                    (rawReason && rawReason !== RETURN_TAM_HOAN_MARKER
                      ? rawReason
                      : "");
                  return (
                    <tr
                      key={citizen.id}
                      className={`group border-b border-black/[0.04] transition-colors hover:bg-sky-50/70 ${stripe} ${ageBar}`}
                    >
                      <td className="px-3 py-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveCitizenAvatarSrc(
                            citizen.avatar,
                            citizen.fullName,
                          )}
                          alt=""
                          className="h-11 w-9 rounded-lg object-cover shadow-sm ring-1 ring-black/[0.06]"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setViewCitizen(citizen)}
                          className="text-left"
                        >
                          <div className="text-[14px] font-bold text-m3-on-surface hover:text-m3-primary">
                            {citizen.fullName}
                          </div>
                          <div className="mt-0.5 text-[12px] text-m3-on-surface-variant">
                            {citizen.gender === "male" ? "Nam" : "Nữ"}
                            {citizen.phone ? ` · ${citizen.phone}` : ""}
                            <span
                              className={
                                ageTone === "danger"
                                  ? "ml-1 font-semibold text-red-600"
                                  : ageTone === "warn"
                                    ? "ml-1 font-semibold text-amber-600"
                                    : "ml-1"
                              }
                            >
                              · {age} tuổi
                            </span>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setViewCitizen(citizen)}
                          className="font-mono text-[13px] font-semibold text-sky-600 hover:underline"
                        >
                          {citizen.cccd}
                        </button>
                      </td>
                      <td className="hidden px-4 py-3.5 text-[13px] text-m3-on-surface sm:table-cell">
                        {new Date(citizen.dateOfBirth).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="hidden px-4 py-3.5 lg:table-cell">
                        <div className="text-[13px] font-semibold text-m3-on-surface">
                          {citizen.educationLevel}
                        </div>
                        <div className="text-[12px] text-m3-on-surface-variant">
                          {citizen.job || "—"}
                        </div>
                      </td>
                      <td className="hidden max-w-[200px] px-4 py-3.5 md:table-cell">
                        <CellTruncate text={citizen.address} maxW="max-w-[200px]" />
                      </td>
                      <td className="px-4 py-3.5">
                        {citizen.healthStatus ? (
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold"
                            style={{
                              backgroundColor: healthStyle.bg,
                              color: healthStyle.color,
                            }}
                          >
                            {citizen.healthStatus}
                          </span>
                        ) : (
                          <span className="text-[13px] text-m3-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold"
                          style={{
                            backgroundColor: statusInfo.bg,
                            color: statusInfo.color,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="relative px-4 py-3.5">
                        <span
                          className={`block max-w-[180px] truncate text-[13px] ${
                            noteText ? "text-m3-on-surface" : "text-m3-on-surface-variant"
                          }`}
                          title={noteText || undefined}
                        >
                          {noteText || "—"}
                        </span>
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                          <div className="flex items-center gap-0.5 rounded-lg border border-black/[0.06] bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
                            <button
                              type="button"
                              title="Xem"
                              onClick={() => setViewCitizen(citizen)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-m3-on-surface-variant hover:bg-m3-primary/10 hover:text-m3-primary"
                            >
                              <Eye size={15} />
                            </button>
                            {!isArchive && (
                              <>
                                {!isApprovedLocked(citizen) && (
                                  <button
                                    type="button"
                                    title="Sửa nhanh"
                                    onClick={() => openEdit(citizen)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-m3-on-surface-variant hover:bg-sky-50 hover:text-sky-600"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                )}
                                {isApprovedLocked(citizen) && (
                                  <span
                                    title="Đã duyệt gọi — khóa sửa"
                                    className="inline-flex h-8 items-center px-1 text-[11px] font-semibold text-m3-on-surface-variant"
                                  >
                                    Khóa
                                  </span>
                                )}
                                <button
                                  type="button"
                                  title="Xóa"
                                  disabled={busyId === citizen.id || isApprovedLocked(citizen)}
                                  onClick={() => handleDelete(citizen)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-m3-on-surface-variant hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 0 && (
          <div className="border-t border-black/[0.05] px-4 py-3 text-[13px]">
            <span className="font-medium text-m3-on-surface-variant">
              Trang {page} / {totalPages}
            </span>
          </div>
        )}
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setFilterOpen(false); }}>
          <div className="w-full max-w-[760px] overflow-hidden rounded-[22px] border border-m3-outline-variant bg-m3-surface-lowest shadow-2xl">
          <div className="flex items-center justify-between border-b border-m3-outline-variant px-5 py-4">
            <div className="flex items-center gap-2"><SlidersHorizontal size={20} className="text-m3-primary" /><h2 className="text-lg font-bold text-m3-on-surface">Bộ lọc nâng cao</h2></div>
            <button type="button" onClick={() => setFilterOpen(false)} className="rounded-lg p-2 text-m3-on-surface-variant hover:bg-m3-surface-container"><X size={19} /></button>
          </div>
          <div className="grid max-h-[calc(100vh-190px)] overflow-y-auto md:grid-cols-[280px_1fr] md:overflow-hidden">
            <div className="border-b border-m3-outline-variant bg-m3-surface-container-low p-4 md:border-b-0 md:border-r">
              <button type="button" onClick={() => setFilterTab("status")} className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left text-[15px] font-semibold ${filterTab === "status" ? "bg-m3-primary-container text-m3-on-primary-container" : "text-m3-on-surface-variant hover:bg-m3-surface-container"}`}><CheckSquare size={19} /> Trạng thái gọi</button>
              <button type="button" onClick={() => setFilterTab("education")} className={`mt-2 flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left text-[15px] font-semibold ${filterTab === "education" ? "bg-m3-primary-container text-m3-on-primary-container" : "text-m3-on-surface-variant hover:bg-m3-surface-container"}`}><GraduationCap size={19} /> Trình độ học vấn</button>
              <button type="button" onClick={() => setFilterTab("health")} className={`mt-2 flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left text-[15px] font-semibold ${filterTab === "health" ? "bg-m3-primary-container text-m3-on-primary-container" : "text-m3-on-surface-variant hover:bg-m3-surface-container"}`}><HeartPulse size={19} /> Sức khỏe</button>
            </div>
            <div className="min-h-[230px] p-6">
              {filterTab === "status" && (
                <div>
                  <label className="mb-3 block text-[15px] font-semibold text-m3-on-surface">Trạng thái dự kiến gọi</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {CALL_FILTER_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value || "all"}
                        onClick={() => setDraftCallIntent(option.value)}
                        className={`min-h-[48px] rounded-xl border px-4 text-left text-[15px] transition-colors ${draftCallIntent === option.value ? "border-m3-primary bg-m3-primary-container font-semibold text-m3-on-primary-container" : "border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-container"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filterTab === "education" && (
                <div>
                  <label className="mb-3 block text-[15px] font-semibold text-m3-on-surface">Trình độ học vấn</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {EDUCATION_FILTER_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value || "all-edu"}
                        onClick={() => setDraftEducationLevel(option.value)}
                        className={`min-h-[48px] rounded-xl border px-4 text-left text-[15px] transition-colors ${draftEducationLevel === option.value ? "border-m3-primary bg-m3-primary-container font-semibold text-m3-on-primary-container" : "border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-container"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filterTab === "health" && (
                <div>
                  <label className="mb-3 block text-[15px] font-semibold text-m3-on-surface">Phân loại sức khỏe</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {HEALTH_FILTER_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option.value || "all-health"}
                        onClick={() => setDraftHealthGrade(option.value)}
                        className={`min-h-[48px] rounded-xl border px-4 text-left text-[15px] transition-colors ${draftHealthGrade === option.value ? "border-m3-primary bg-m3-primary-container font-semibold text-m3-on-primary-container" : "border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-container"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-m3-outline-variant px-5 py-4"><button type="button" onClick={() => setFilterOpen(false)} className="rounded-xl px-5 py-2.5 text-[15px] font-semibold text-m3-on-surface-variant hover:bg-m3-surface-container">Hủy bỏ</button><button type="button" onClick={applyFilters} className="rounded-xl bg-m3-primary px-6 py-2.5 text-[15px] font-semibold text-white hover:opacity-90">Áp dụng</button></div>
          </div>
        </div>
      )}

      <CitizenDetailModal
        citizen={viewCitizen}
        onClose={() => setViewCitizen(null)}
        onCitizenUpdated={(updated) => {
          setViewCitizen(updated);
          setCitizens((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          );
        }}
      />
      <CitizenFormModal
        open={formOpen}
        mode={formMode}
        citizen={editCitizen}
        prefill={formMode === "create" ? formPrefill : null}
        defaultUnitCode={
          formMode === "create"
            ? filterXa ||
              (sessionLevel === "xa" ? sessionUnitCode : null) ||
              null
            : null
        }
        defaultCampaignId={formMode === "create" ? campaignId || null : null}
        onScannedExisting={
          formMode === "create" ? handleNfcExistingCheck : undefined
        }
        onClose={() => {
          setFormOpen(false);
          setFormPrefill(null);
        }}
        onSaved={async (result) => {
          const name = result?.citizen?.fullName?.trim();
          const saved = result?.citizen;
          setSaveNotice(
            result?.mode === "edit"
              ? "Đã cập nhật hồ sơ công dân."
              : `Đã thêm hồ sơ${name ? ` “${name}”` : ""} thành công.`,
          );
          // Tránh BroadcastChannel + fetch lọc CCCD làm danh sách nhấp nháy / mất tạm
          ignoreRealtimeUntilRef.current = Date.now() + 3000;
          if (result?.mode === "edit" && saved) {
            setCitizens((prev) =>
              prev.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)),
            );
            setViewCitizen((cur) =>
              cur?.id === saved.id ? { ...cur, ...saved } : cur,
            );
            publishCitizensChanged({
              type: "citizen-updated",
              id: saved?.id,
            });
            void fetchCitizens({ silent: true });
          } else if (saved) {
            // Chuyển tab Hồ sơ mới — useEffect theo callIntentFilter sẽ tải lại danh sách
            const alreadyOnNewTab = callIntentFilter === "unset";
            setCallIntentFilter("unset");
            setPage(1);
            setCitizens((prev) => [
              saved,
              ...prev.filter((c) => c.id !== saved.id),
            ]);
            setTotalCount((n) => n + 1);
            publishCitizensChanged({
              type: "citizen-created",
              id: saved?.id,
            });
            if (alreadyOnNewTab) {
              void fetchCitizens({ silent: true });
            }
          }
          window.setTimeout(() => setSaveNotice(null), 6000);
        }}
      />

      <ConfirmDialog
        isOpen={confirmCreateFromNfc !== null}
        onClose={() => setConfirmCreateFromNfc(null)}
        onConfirm={() => {
          const scan = confirmCreateFromNfc;
          setConfirmCreateFromNfc(null);
          if (scan) openCreate(scan);
        }}
        title="Chưa có hồ sơ"
        message={
          confirmCreateFromNfc
            ? `Không tìm thấy hồ sơ CCCD ${confirmCreateFromNfc.cccd}${
                confirmCreateFromNfc.fullName
                  ? ` (${confirmCreateFromNfc.fullName})`
                  : ""
              }. Thêm hồ sơ mới từ dữ liệu chip?`
            : ""
        }
        confirmLabel="Thêm hồ sơ"
      />

      <ConfirmDialog
        isOpen={confirmArchive !== null}
        onClose={() => {
          if (approvingAll || approvingId) return;
          setConfirmArchive(null);
        }}
        onConfirm={handleConfirmArchive}
        title={
          confirmArchive?.mode === "all"
            ? "Duyệt tất cả hồ sơ hết tuổi"
            : "Duyệt chuyển lưu trữ"
        }
        message={
          confirmArchive?.mode === "all"
            ? `Chuyển ${pendingCount} hồ sơ hết tuổi NVQS sang Hồ sơ lưu trữ? Sau khi duyệt, hồ sơ chỉ còn xem trong mục lưu trữ.`
            : confirmArchive?.mode === "one"
              ? `Chuyển hồ sơ "${confirmArchive.citizen.fullName}" (${calcAgeYears(confirmArchive.citizen.dateOfBirth)} tuổi) sang Hồ sơ lưu trữ?`
              : ""
        }
        confirmLabel={
          confirmArchive?.mode === "all" ? "Duyệt tất cả" : "Duyệt hồ sơ"
        }
        loading={approvingAll || approvingId !== null}
      />
    </div>
  );
}

function CellTruncate({
  text,
  maxW = "max-w-[180px]",
  muted,
}: {
  text?: string | null;
  maxW?: string;
  muted?: boolean;
}) {
  if (!text) {
    return <span className="text-[14px] text-m3-on-surface-variant">—</span>;
  }
  return (
    <span
      className={`block truncate text-[14px] ${maxW} ${muted ? "text-m3-on-surface-variant" : "text-m3-on-surface"}`}
      title={text}
    >
      {text}
    </span>
  );
}
