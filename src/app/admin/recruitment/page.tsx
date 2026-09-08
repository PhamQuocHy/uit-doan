"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RecruitmentCampaign } from "@/lib/data";
import {
  CalendarClock,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  Activity,
  ChevronLeft,
  Shield,
  User2,
  XCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  AdminListHeader,
  AdminListShell,
  AdminListToolbar,
  AdminStatusTabs,
  AdminTable,
  AdminTHead,
  AdminHoverActions,
  AdminIconBtn,
  AdminPill,
  AdminPrimaryBtn,
  AdminGhostBtn,
  ADMIN_SELECT_CLS,
  ADMIN_TH_CLS,
  ADMIN_TD_CLS,
  adminRowClass,
} from "@/components/admin/list-ui";
import { M3ConfirmDialog } from "@/components/m3";

interface Candidate {
  id: string;
  fullName: string;
  cccd: string;
  dob: string;
  unit: string;
  healthResult: "passed" | "failed" | "pending";
  score: number;
  note: string;
}

interface ReserveRow {
  id: string;
  fullName: string;
  cccd: string;
  dob: string;
  unit: string;
  healthStatus: string;
  note: string;
}

const resultConfig = {
  passed: {
    label: "Trúng tuyển",
    color: "var(--color-m3-success)",
    bg: "var(--color-m3-success-container)",
    icon: CheckCircle2,
  },
  failed: {
    label: "Không đạt",
    color: "var(--m3-error, #ba1a1a)",
    bg: "var(--m3-error-container, #ffdad6)",
    icon: XCircle,
  },
  pending: {
    label: "Chờ duyệt",
    color: "var(--color-m3-warning)",
    bg: "var(--color-m3-warning-container)",
    icon: Activity,
  },
};

const CAMPAIGN_STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "planning", label: "Kế hoạch" },
  { value: "ongoing", label: "Đang diễn ra" },
  { value: "completed", label: "Đã kết thúc" },
] as const;

const CANDIDATE_TABS = [
  { value: "", label: "Tất cả" },
  { value: "passed", label: "Trúng tuyển" },
  { value: "failed", label: "Không đạt" },
  { value: "pending", label: "Chờ duyệt" },
] as const;

function paginateSlice<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    totalPages,
    safePage,
  };
}

export default function RecruitmentPage() {
  const [campaigns, setCampaigns] = useState<RecruitmentCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [listSearch, setListSearch] = useState("");
  const [userHierarchyLevel, setUserHierarchyLevel] = useState<string>("");
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<RecruitmentCampaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecruitmentCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    year: new Date().getFullYear().toString(),
    startDate: "",
    endDate: "",
    status: "planning",
    targetQuota: "",
  });
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  const [campaignCandidates, setCampaignCandidates] = useState<Candidate[]>([]);
  const [campaignReserves, setCampaignReserves] = useState<ReserveRow[]>([]);

  const [selectedCamp, setSelectedCamp] = useState<RecruitmentCampaign | null>(null);
  const [tab, setTab] = useState<"candidates" | "reserve" | "returned">("candidates");
  const [candidateFilter, setCandidateFilter] = useState<"" | "passed" | "failed" | "pending">("");
  const [search, setSearch] = useState("");
  const [reserveSearch, setReserveSearch] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(20);

  const isBo = userHierarchyLevel === "bo";

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(statusFilter && { status: statusFilter }),
        ...(yearFilter && { year: yearFilter }),
      });
      const res = await fetch(`/api/admin/recruitment?${query}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCampaigns(data.data);
      setTotalPages(data.totalPages);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, yearFilter]);

  useEffect(() => {
    fetchCampaigns();
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((d) => {
        if (d.user) setUserHierarchyLevel(d.user.hierarchyLevel);
      })
      .catch(() => {});
  }, [fetchCampaigns]);

  useEffect(() => {
    if (!selectedCamp) {
      setCampaignCandidates([]);
      setCampaignReserves([]);
      return;
    }
    const campId = selectedCamp.id;
    fetch(`/api/admin/approval?campaignId=${encodeURIComponent(campId)}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        const mapped: Candidate[] = (data.data || []).map(
          (row: {
            id: string;
            fullName: string;
            cccd: string;
            dateOfBirth: string;
            unitName: string;
            status: string;
            healthResult: string;
            note?: string;
          }) => ({
            id: row.id,
            fullName: row.fullName,
            cccd: row.cccd,
            dob: row.dateOfBirth,
            unit: row.unitName,
            healthResult:
              row.status === "approved"
                ? "passed"
                : row.status === "rejected"
                  ? "failed"
                  : "pending",
            score: Number(String(row.healthResult).replace(/\D/g, "")) || 0,
            note:
              row.status === "pending"
                ? "Chờ xét duyệt"
                : row.status === "rejected"
                  ? row.note || "Không đạt xét duyệt"
                  : row.note || "Đã duyệt gọi",
          }),
        );
        setCampaignCandidates(mapped);
      })
      .catch(() => setCampaignCandidates([]));

    const reserveQuery = new URLSearchParams({
      page: "1",
      limit: "500",
      ageScope: "active",
      callIntent: "du_bi",
      campaignId: campId,
      nationwide: "1",
    });
    fetch(`/api/admin/citizens?${reserveQuery}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        const mapped: ReserveRow[] = (data.data || []).map(
          (c: {
            id: string;
            fullName: string;
            cccd: string;
            dateOfBirth: string;
            address?: string;
            healthStatus?: string;
            militaryStatusReason?: string;
          }) => ({
            id: c.id,
            fullName: c.fullName,
            cccd: c.cccd,
            dob: c.dateOfBirth,
            unit: c.address || "—",
            healthStatus: c.healthStatus || "—",
            note: c.militaryStatusReason || "Dự bị theo đợt",
          }),
        );
        setCampaignReserves(mapped);
      })
      .catch(() => setCampaignReserves([]));
  }, [selectedCamp]);

  useEffect(() => {
    setDetailPage(1);
  }, [tab, candidateFilter, search, reserveSearch, detailPageSize]);

  const openCampaignForm = (campaign?: RecruitmentCampaign) => {
    setEditingCampaign(campaign || null);
    setCampaignForm(
      campaign
        ? {
            name: campaign.name,
            year: String(campaign.year),
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            status: campaign.status,
            targetQuota: String(campaign.targetQuota),
          }
        : {
            name: "",
            year: new Date().getFullYear().toString(),
            startDate: "",
            endDate: "",
            status: "planning",
            targetQuota: "",
          },
    );
    setCampaignError("");
    setCampaignFormOpen(true);
  };

  const saveCampaign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isBo) {
      setCampaignError("Chỉ cấp Bộ được tạo / sửa đợt khám tuyển");
      return;
    }
    setCampaignSaving(true);
    setCampaignError("");
    try {
      const response = await fetch(
        editingCampaign ? `/api/admin/recruitment/${editingCampaign.id}` : "/api/admin/recruitment",
        {
          method: editingCampaign ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...campaignForm,
            year: Number(campaignForm.year),
            targetQuota: Number(campaignForm.targetQuota),
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Không thể lưu đợt khám");
      setCampaignFormOpen(false);
      await fetchCampaigns();
    } catch (cause) {
      setCampaignError(cause instanceof Error ? cause.message : "Lỗi lưu đợt khám");
    } finally {
      setCampaignSaving(false);
    }
  };

  const confirmDeleteCampaign = async () => {
    if (!deleteTarget || !isBo) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/recruitment/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Không thể xóa đợt khám");
      setDeleteTarget(null);
      if (selectedCamp?.id === deleteTarget.id) setSelectedCamp(null);
      await fetchCampaigns();
    } catch (cause) {
      setCampaignError(
        cause instanceof Error ? cause.message : "Lỗi xóa đợt khám",
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusInfo = (status: string) =>
    (
      ({
        planning: {
          label: "Kế hoạch",
          color: "var(--m3-on-surface-variant, #475569)",
          bg: "var(--m3-surface-container-high, #eef1f4)",
        },
        ongoing: {
          label: "Đang diễn ra",
          color: "var(--color-m3-warning)",
          bg: "var(--color-m3-warning-container)",
        },
        completed: {
          label: "Đã kết thúc",
          color: "var(--color-m3-success)",
          bg: "var(--color-m3-success-container)",
        },
      }) as Record<string, { label: string; color: string; bg: string }>
    )[status] || {
      label: status,
      color: "var(--m3-on-surface-variant, #475569)",
      bg: "var(--m3-surface-container-high, #eef1f4)",
    };

  const filteredCampaigns = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => c.name.toLowerCase().includes(q));
  }, [campaigns, listSearch]);

  const summaryStats = useMemo(() => {
    const ongoing = campaigns.filter((c) => c.status === "ongoing").length;
    const totalApproved = campaigns.reduce(
      (sum, c) => sum + (c.registeredCount || 0),
      0,
    );
    const totalPassed = campaigns.reduce(
      (sum, c) => sum + (c.passedCount || 0),
      0,
    );
    const totalQuota = campaigns.reduce(
      (sum, c) => sum + (c.targetQuota || 0),
      0,
    );
    return { ongoing, totalApproved, totalPassed, totalQuota };
  }, [campaigns]);

  if (selectedCamp) {
    const candidates = campaignCandidates;
    const filteredCandidates = candidates.filter((c) => {
      const matchResult = !candidateFilter || c.healthResult === candidateFilter;
      const matchSearch =
        !search ||
        c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.cccd.includes(search);
      return matchResult && matchSearch;
    });

    const filteredReserves = campaignReserves.filter((r) => {
      return (
        !reserveSearch ||
        r.fullName.toLowerCase().includes(reserveSearch.toLowerCase()) ||
        r.cccd.includes(reserveSearch)
      );
    });

    const returnedRows = candidates.filter((c) => c.healthResult === "failed");
    const filteredReturned = returnedRows.filter((c) => {
      return (
        !search ||
        c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.cccd.includes(search)
      );
    });

    const pagedCandidates = paginateSlice(filteredCandidates, detailPage, detailPageSize);
    const pagedReserves = paginateSlice(filteredReserves, detailPage, detailPageSize);
    const pagedReturned = paginateSlice(filteredReturned, detailPage, detailPageSize);

    const passedCount = candidates.filter((c) => c.healthResult === "passed").length;
    const failedCount = candidates.filter((c) => c.healthResult === "failed").length;
    const pendingCount = candidates.filter((c) => c.healthResult === "pending").length;

    return (
      <div className="space-y-4 pb-6">
        <div className="flex items-center gap-3">
          <AdminGhostBtn onClick={() => setSelectedCamp(null)}>
            <ChevronLeft size={16} /> Quay lại
          </AdminGhostBtn>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-m3-on-surface">
              {selectedCamp.name}
            </h1>
            <p className="text-[13px] mt-0.5 text-m3-primary">
              {new Date(selectedCamp.startDate).toLocaleDateString("vi-VN")} –{" "}
              {new Date(selectedCamp.endDate).toLocaleDateString("vi-VN")} · Năm{" "}
              {selectedCamp.year}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tổng gọi khám", value: candidates.length, color: "var(--m3-on-surface, #1b1d20)" },
            { label: "Trúng tuyển", value: passedCount, color: "var(--color-m3-success)" },
            { label: "Không đạt", value: failedCount, color: "var(--m3-error, #ba1a1a)" },
            { label: "Chờ duyệt", value: pendingCount, color: "var(--color-m3-warning)" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <p className="text-xs text-m3-on-surface-variant">{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-black/[0.05] pb-0">
          {(
            [
              { key: "candidates", label: `Danh sách thanh niên khám (${candidates.length})`, icon: Users },
              { key: "reserve", label: `Danh sách dự bị (${campaignReserves.length})`, icon: Shield },
              { key: "returned", label: `Bị trả về (${returnedRows.length})`, icon: XCircle },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                tab === key
                  ? key === "returned"
                    ? "border-m3-error text-m3-error"
                    : "border-m3-primary text-m3-primary"
                  : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {tab === "candidates" && (
          <AdminListShell
            page={pagedCandidates.safePage}
            totalPages={pagedCandidates.totalPages}
            tabs={
              <AdminStatusTabs
                tabs={[...CANDIDATE_TABS]}
                value={candidateFilter}
                onChange={(v) => setCandidateFilter(v as typeof candidateFilter)}
              />
            }
            toolbar={
              <AdminListToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Tìm họ tên, CCCD..."
                page={pagedCandidates.safePage}
                pageSize={detailPageSize}
                totalPages={pagedCandidates.totalPages}
                onPageChange={setDetailPage}
                onPageSizeChange={(size) => {
                  setDetailPageSize(size);
                  setDetailPage(1);
                }}
              />
            }
          >
            <AdminTable minWidth="min-w-[880px]">
              <AdminTHead>
                <th className={ADMIN_TH_CLS}>Họ và Tên</th>
                <th className={ADMIN_TH_CLS}>Đơn vị</th>
                <th className={`${ADMIN_TH_CLS} text-center`}>Điểm SK</th>
                <th className={ADMIN_TH_CLS}>Kết quả</th>
                <th className={ADMIN_TH_CLS}>Ghi chú</th>
              </AdminTHead>
              <tbody>
                {pagedCandidates.slice.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                      Không có kết quả
                    </td>
                  </tr>
                ) : (
                  pagedCandidates.slice.map((c, idx) => {
                    const cfg = resultConfig[c.healthResult];
                    const Icon = cfg.icon;
                    return (
                      <tr key={c.id} className={adminRowClass(idx)}>
                        <td className={ADMIN_TD_CLS}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-m3-surface-high flex items-center justify-center shrink-0">
                              <User2 size={12} className="text-m3-primary" />
                            </div>
                            <div>
                              <div className="font-semibold text-[14px]">{c.fullName}</div>
                              <div className="text-xs text-m3-on-surface-variant font-mono">{c.cccd}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`${ADMIN_TD_CLS} text-xs text-m3-on-surface-variant`}>{c.unit}</td>
                        <td className={`${ADMIN_TD_CLS} text-center font-semibold`}>
                          {c.score > 0 ? c.score : "—"}
                        </td>
                        <td className={ADMIN_TD_CLS}>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            <Icon size={11} /> {cfg.label}
                          </span>
                        </td>
                        <td className={`${ADMIN_TD_CLS} text-xs italic text-m3-on-surface-variant`}>
                          {c.note || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </AdminTable>
          </AdminListShell>
        )}

        {tab === "reserve" && (
          <AdminListShell
            page={pagedReserves.safePage}
            totalPages={pagedReserves.totalPages}
            toolbar={
              <AdminListToolbar
                search={reserveSearch}
                onSearchChange={setReserveSearch}
                searchPlaceholder="Tìm họ tên, CCCD..."
                page={pagedReserves.safePage}
                pageSize={detailPageSize}
                totalPages={pagedReserves.totalPages}
                onPageChange={setDetailPage}
                onPageSizeChange={(size) => {
                  setDetailPageSize(size);
                  setDetailPage(1);
                }}
              />
            }
          >
            <AdminTable minWidth="min-w-[880px]">
              <AdminTHead>
                <th className={ADMIN_TH_CLS}>Họ và Tên</th>
                <th className={ADMIN_TH_CLS}>Ngày sinh</th>
                <th className={ADMIN_TH_CLS}>Địa chỉ / đơn vị</th>
                <th className={ADMIN_TH_CLS}>Sức khỏe</th>
                <th className={ADMIN_TH_CLS}>Ghi chú</th>
              </AdminTHead>
              <tbody>
                {pagedReserves.slice.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                      Chưa có thanh niên dự bị trong đợt này. Cập nhật trạng thái “Dự bị” tại Hồ sơ công dân.
                    </td>
                  </tr>
                ) : (
                  pagedReserves.slice.map((r, idx) => (
                    <tr key={r.id} className={adminRowClass(idx)}>
                      <td className={ADMIN_TD_CLS}>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-m3-surface-high">
                            <Shield size={12} className="text-m3-primary" />
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold">{r.fullName}</div>
                            <div className="font-mono text-xs text-m3-on-surface-variant">{r.cccd}</div>
                          </div>
                        </div>
                      </td>
                      <td className={ADMIN_TD_CLS}>
                        {r.dob ? new Date(r.dob).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td className={`${ADMIN_TD_CLS} text-xs text-m3-on-surface-variant`}>
                        {r.unit}
                      </td>
                      <td className={ADMIN_TD_CLS}>{r.healthStatus}</td>
                      <td className={`${ADMIN_TD_CLS} text-xs italic text-m3-on-surface-variant`}>
                        {r.note || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AdminTable>
          </AdminListShell>
        )}

        {tab === "returned" && (
          <AdminListShell
            page={pagedReturned.safePage}
            totalPages={pagedReturned.totalPages}
            toolbar={
              <div className="flex flex-col gap-2 border-b border-black/[0.05] bg-red-500/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-m3-error" />
                  <span className="text-[13px] font-semibold text-m3-error">
                    Thanh niên không đạt xét duyệt trong đợt này
                  </span>
                </div>
                <AdminListToolbar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Tìm họ tên, CCCD..."
                  page={pagedReturned.safePage}
                  pageSize={detailPageSize}
                  totalPages={pagedReturned.totalPages}
                  onPageChange={setDetailPage}
                  onPageSizeChange={(size) => {
                    setDetailPageSize(size);
                    setDetailPage(1);
                  }}
                />
              </div>
            }
          >
            <AdminTable minWidth="min-w-[880px]">
              <AdminTHead>
                <th className={ADMIN_TH_CLS}>Họ và Tên</th>
                <th className={ADMIN_TH_CLS}>Đơn vị</th>
                <th className={`${ADMIN_TH_CLS} text-center`}>Điểm SK</th>
                <th className={ADMIN_TH_CLS}>Trạng thái</th>
                <th className={ADMIN_TH_CLS}>Lý do / ghi chú</th>
              </AdminTHead>
              <tbody>
                {pagedReturned.slice.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                      Chưa có hồ sơ không đạt trong đợt này.
                    </td>
                  </tr>
                ) : (
                  pagedReturned.slice.map((c, idx) => {
                    const cfg = resultConfig.failed;
                    const Icon = cfg.icon;
                    return (
                      <tr key={c.id} className={adminRowClass(idx)}>
                        <td className={ADMIN_TD_CLS}>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-m3-surface-high">
                              <User2 size={12} className="text-m3-error" />
                            </div>
                            <div>
                              <div className="text-[14px] font-semibold">{c.fullName}</div>
                              <div className="font-mono text-xs text-m3-on-surface-variant">{c.cccd}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`${ADMIN_TD_CLS} text-xs text-m3-on-surface-variant`}>
                          {c.unit}
                        </td>
                        <td className={`${ADMIN_TD_CLS} text-center font-semibold`}>
                          {c.score > 0 ? c.score : "—"}
                        </td>
                        <td className={ADMIN_TD_CLS}>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            <Icon size={11} /> {cfg.label}
                          </span>
                        </td>
                        <td className={`${ADMIN_TD_CLS} text-xs italic text-m3-on-surface-variant`}>
                          {c.note || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </AdminTable>
          </AdminListShell>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Đợt khám tuyển"
        countLabel={
          filteredCampaigns.length > 0
            ? `${filteredCampaigns.length.toLocaleString("vi-VN")} đợt`
            : undefined
        }
        filters={
          <select
            className={`${ADMIN_SELECT_CLS} max-w-[140px]`}
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo năm"
          >
            <option value="">Tất cả năm</option>
            <option value="2026">Năm 2026</option>
            <option value="2025">Năm 2025</option>
            <option value="2024">Năm 2024</option>
          </select>
        }
        actions={
          isBo ? (
            <AdminPrimaryBtn tone="blue" onClick={() => openCampaignForm()}>
              <Plus size={16} /> Tạo đợt khám mới
            </AdminPrimaryBtn>
          ) : undefined
        }
      />

      <p className="text-[14px] text-m3-on-surface-variant">
        {isBo
          ? "Cấp Bộ tạo đợt, giao chỉ tiêu toàn quốc một lần. Tiến độ tính theo thanh niên đậu sức khỏe đã được quân khu duyệt gọi."
          : "Theo dõi đợt khám tuyển toàn quốc. Chỉ cấp Bộ được tạo / sửa / xóa đợt và giao chỉ tiêu."}
      </p>

      {campaignError && !campaignFormOpen && (
        <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800">
          {campaignError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-warning-container flex items-center justify-center text-m3-on-warning-container">
            <CalendarClock size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">Đợt đang diễn ra</p>
            <p className="text-2xl font-bold text-m3-on-surface">
              {summaryStats.ongoing.toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-primary-container flex items-center justify-center text-m3-primary">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">Đã duyệt gọi</p>
            <p className="text-2xl font-bold text-m3-on-surface">
              {summaryStats.totalApproved.toLocaleString("vi-VN")}
            </p>
            <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
              / {summaryStats.totalQuota.toLocaleString("vi-VN")} chỉ tiêu
            </p>
          </div>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-success-container flex items-center justify-center text-m3-on-success-container">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">Đã đạt sức khỏe</p>
            <p className="text-2xl font-bold text-m3-on-surface">
              {summaryStats.totalPassed.toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
      </div>

      <AdminListShell
        page={page}
        totalPages={totalPages}
        loading={loading}
        tabs={
          <AdminStatusTabs
            tabs={[...CAMPAIGN_STATUS_TABS]}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
        }
        toolbar={
          <AdminListToolbar
            search={listSearch}
            onSearchChange={(v) => {
              setListSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Tìm tên đợt khám..."
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        }
      >
        <AdminTable minWidth="min-w-[980px]">
          <AdminTHead>
            <th className={ADMIN_TH_CLS}>Tên đợt khám</th>
            <th className={ADMIN_TH_CLS}>Thời gian</th>
            <th className={ADMIN_TH_CLS}>Chỉ tiêu / Đã duyệt gọi</th>
            <th className={ADMIN_TH_CLS}>Đạt sức khỏe</th>
            <th className={ADMIN_TH_CLS}>Trạng thái</th>
            <th className={`${ADMIN_TH_CLS} text-center`}>Thao tác</th>
          </AdminTHead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                  Không tìm thấy đợt khám nào.
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((camp, idx) => {
                const statusInfo = getStatusInfo(camp.status);
                const quota = Math.max(0, camp.targetQuota || 0);
                // registeredCount = đã duyệt gọi (thanh niên đậu + QK trả về)
                const approved = Math.max(0, camp.registeredCount || 0);
                const passed = Math.max(0, camp.passedCount || 0);
                const fillPct =
                  quota > 0 ? Math.round((approved / quota) * 100) : 0;
                const passPct =
                  quota > 0 ? Math.round((passed / quota) * 100) : 0;
                return (
                  <tr
                    key={camp.id}
                    className={`${adminRowClass(idx)} cursor-pointer`}
                    onClick={() => setSelectedCamp(camp)}
                  >
                    <td className={ADMIN_TD_CLS}>
                      <div className="font-semibold">{camp.name}</div>
                      <div className="text-xs text-m3-on-surface-variant mt-0.5">Năm {camp.year}</div>
                    </td>
                    <td className={`${ADMIN_TD_CLS} text-m3-on-surface-variant`}>
                      {new Date(camp.startDate).toLocaleDateString("vi-VN")}
                      <br />
                      <span className="text-m3-on-surface-variant">→</span>{" "}
                      {new Date(camp.endDate).toLocaleDateString("vi-VN")}
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <div className="font-semibold">
                        {quota.toLocaleString("vi-VN")} / {approved.toLocaleString("vi-VN")}
                      </div>
                      <div className="mt-0.5 text-[11px] text-m3-on-surface-variant">
                        Duyệt gọi {quota > 0 ? `${Math.min(fillPct, 999)}% chỉ tiêu` : "—"}
                      </div>
                      <div className="w-full bg-m3-surface-highest rounded-full h-1.5 mt-1.5">
                        <div
                          className="bg-m3-primary-container h-1.5 rounded-full"
                          style={{ width: `${Math.min(fillPct, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <div className="font-semibold">
                        {passed.toLocaleString("vi-VN")}
                        {quota > 0 ? ` (${Math.min(passPct, 999)}%)` : ""}
                      </div>
                      <div className="mt-0.5 text-[11px] text-m3-on-surface-variant">
                        {passed > 0
                          ? `${approved.toLocaleString("vi-VN")} duyệt / ${passed.toLocaleString("vi-VN")} đậu SK`
                          : "Chưa có thanh niên đậu SK"}
                      </div>
                      <div className="w-full bg-m3-surface-highest rounded-full h-1.5 mt-1.5">
                        <div
                          className="bg-m3-success-container h-1.5 rounded-full"
                          style={{ width: `${Math.min(passPct, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill label={statusInfo.label} bg={statusInfo.bg} color={statusInfo.color} />
                    </td>
                    <td
                      className={`relative ${ADMIN_TD_CLS} text-center`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AdminHoverActions>
                        <AdminIconBtn
                          title="Xem chi tiết"
                          onClick={() => setSelectedCamp(camp)}
                        >
                          <Eye size={15} />
                        </AdminIconBtn>
                        {isBo && (
                          <>
                            <AdminIconBtn
                              title="Chỉnh sửa"
                              tone="blue"
                              onClick={() => openCampaignForm(camp)}
                            >
                              <Edit2 size={15} />
                            </AdminIconBtn>
                            <AdminIconBtn
                              title="Xóa đợt"
                              tone="red"
                              onClick={() => setDeleteTarget(camp)}
                            >
                              <Trash2 size={15} />
                            </AdminIconBtn>
                          </>
                        )}
                      </AdminHoverActions>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </AdminTable>
      </AdminListShell>

      {campaignFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveCampaign}
            className="w-full max-w-xl rounded-2xl bg-m3-surface-lowest p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-m3-on-surface">
                {editingCampaign ? "Sửa đợt khám" : "Tạo đợt khám mới"}
              </h2>
              <button
                type="button"
                onClick={() => setCampaignFormOpen(false)}
                className="rounded-lg p-2 text-m3-on-surface-variant hover:bg-m3-surface-container"
              >
                <X size={18} />
              </button>
            </div>
            {campaignError && (
              <p className="mb-3 rounded-xl bg-m3-error-container px-3 py-2 text-sm text-m3-on-error-container">
                {campaignError}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                  Tên đợt khám
                </span>
                <input
                  required
                  value={campaignForm.name}
                  onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })}
                  className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Năm</span>
                <input
                  required
                  type="number"
                  min="2000"
                  value={campaignForm.year}
                  onChange={(event) => setCampaignForm({ ...campaignForm, year: event.target.value })}
                  className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                  Chỉ tiêu toàn quốc
                </span>
                <input
                  required
                  type="number"
                  min="1"
                  value={campaignForm.targetQuota}
                  onChange={(event) =>
                    setCampaignForm({ ...campaignForm, targetQuota: event.target.value })
                  }
                  className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-[11px] text-m3-on-surface-variant">
                  Giao một lần cho cả nước. Tiến độ tính theo thanh niên đậu SK đã được duyệt gọi.
                </span>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                  Ngày bắt đầu
                </span>
                <input
                  required
                  type="date"
                  value={campaignForm.startDate}
                  onChange={(event) =>
                    setCampaignForm({ ...campaignForm, startDate: event.target.value })
                  }
                  className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                  Ngày kết thúc
                </span>
                <input
                  required
                  type="date"
                  value={campaignForm.endDate}
                  onChange={(event) =>
                    setCampaignForm({ ...campaignForm, endDate: event.target.value })
                  }
                  className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                  Trạng thái
                </span>
                <select
                  value={campaignForm.status}
                  onChange={(event) =>
                    setCampaignForm({ ...campaignForm, status: event.target.value })
                  }
                  className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm"
                >
                  <option value="planning">Kế hoạch</option>
                  <option value="ongoing">Đang diễn ra</option>
                  <option value="completed">Đã kết thúc</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCampaignFormOpen(false)}
                className="rounded-xl border border-m3-outline-variant px-4 py-2 text-sm"
              >
                Hủy
              </button>
              <button
                disabled={campaignSaving}
                className="rounded-xl bg-m3-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {campaignSaving ? "Đang lưu..." : "Lưu đợt khám"}
              </button>
            </div>
          </form>
        </div>
      )}

      <M3ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa đợt khám tuyển?"
        description={
          deleteTarget
            ? `Xóa “${deleteTarget.name}”? Chỉ tiêu và liên kết hồ sơ theo đợt sẽ được gỡ.`
            : undefined
        }
        confirmLabel="Xóa đợt"
        cancelLabel="Hủy"
        tone="danger"
        busy={deleting}
        onConfirm={() => {
          void confirmDeleteCampaign();
        }}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
