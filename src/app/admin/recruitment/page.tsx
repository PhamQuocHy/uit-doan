"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RecruitmentCampaign } from "@/lib/data";
import {
  CalendarClock,
  Plus,
  Eye,
  Edit2,
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

const mockReserves = [
  {
    id: "r1",
    fullName: "Nguyễn Văn An",
    cccd: "079300012345",
    dob: "2002-03-14",
    unit: "Đại đội 1/Huyện Bình Chánh",
    discharged: "2024-12-31",
    reserveClass: "Hạng 1",
    specialty: "Bộ binh",
    lastTraining: "2025-08-15",
    status: "active",
  },
  {
    id: "r2",
    fullName: "Trần Văn Bảo",
    cccd: "079300076543",
    dob: "2000-05-20",
    unit: "Đại đội 2/Huyện Củ Chi",
    discharged: "2023-12-31",
    reserveClass: "Hạng 1",
    specialty: "Công binh",
    lastTraining: "2025-07-10",
    status: "active",
  },
  {
    id: "r3",
    fullName: "Lê Thành Công",
    cccd: "079300034567",
    dob: "2001-08-08",
    unit: "Đại đội 3/Huyện Hóc Môn",
    discharged: "2024-06-30",
    reserveClass: "Hạng 2",
    specialty: "Thông tin",
    lastTraining: "2025-06-20",
    status: "inactive",
  },
  {
    id: "r4",
    fullName: "Phạm Đức Duy",
    cccd: "079300021098",
    dob: "2003-01-25",
    unit: "Đại đội 1/Huyện Bình Chánh",
    discharged: "2025-12-31",
    reserveClass: "Hạng 1",
    specialty: "Bộ binh",
    lastTraining: "2025-09-01",
    status: "active",
  },
  {
    id: "r5",
    fullName: "Hoàng Mạnh Hùng",
    cccd: "079300055561",
    dob: "2001-06-15",
    unit: "Đại đội 2/Huyện Hoàn Kiếm",
    discharged: "2025-06-30",
    reserveClass: "Hạng 2",
    specialty: "Trinh sát",
    lastTraining: "2025-05-10",
    status: "active",
  },
];

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
    label: "Chưa khám",
    color: "var(--color-m3-warning)",
    bg: "var(--color-m3-warning-container)",
    icon: Activity,
  },
};

const mockReturnedSoldiers = [
  {
    id: "rs1",
    fullName: "Ngô Thành Nhân",
    cccd: "079300011112",
    dateOfBirth: "2001-12-05",
    province: "tinh-hcm",
    district: "huyen-bc",
    commune: "xa-bh",
    origin: "Xã Bình Hưng, Huyện Bình Chánh",
    unitReceived: "Sư đoàn 5 – Quân khu 7",
    reason: "Huyết áp cao không đảm bảo sức khỏe chiến đấu",
    reportDate: "2026-03-03",
  },
  {
    id: "rs2",
    fullName: "Trần Thế Khoa",
    cccd: "079300055533",
    dateOfBirth: "2003-08-15",
    province: "tinh-hcm",
    district: "huyen-bc",
    commune: "xa-lh",
    origin: "Xã Long Hòa, Huyện Bình Chánh",
    unitReceived: "Sư đoàn 5 – Quân khu 7",
    reason: "Suy nhược cơ thể",
    reportDate: "2026-03-03",
  },
  {
    id: "rs3",
    fullName: "Lê Minh Trí",
    cccd: "079300077744",
    dateOfBirth: "2002-01-20",
    province: "tinh-hn",
    district: "huyen-hk",
    commune: "xa-hb",
    origin: "Xã Hàng Bông, Quận Hoàn Kiếm",
    unitReceived: "Sư đoàn 1 – Quân khu 1",
    reason: "Thị lực giảm sút do chấn thương",
    reportDate: "2026-03-03",
  },
];

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
  { value: "pending", label: "Chưa khám" },
] as const;

const RESERVE_TABS = [
  { value: "", label: "Tất cả" },
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Ngừng" },
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
  const [userHierarchyLevel, setUserHierarchyLevel] = useState<string>("tinh");
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<RecruitmentCampaign | null>(null);
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

  const [selectedCamp, setSelectedCamp] = useState<RecruitmentCampaign | null>(null);
  const [tab, setTab] = useState<"candidates" | "reserve" | "returned">("candidates");
  const [candidateFilter, setCandidateFilter] = useState<"" | "passed" | "failed" | "pending">("");
  const [search, setSearch] = useState("");
  const [reserveSearch, setReserveSearch] = useState("");
  const [reserveStatus, setReserveStatus] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(20);

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
      return;
    }
    fetch(`/api/admin/approval?campaignId=${encodeURIComponent(selectedCamp.id)}`)
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
            score: Number(row.healthResult.replace(/\D/g, "")) || 0,
            note: row.status === "pending" ? "Chờ xét duyệt" : "",
          }),
        );
        setCampaignCandidates(mapped);
      })
      .catch(() => setCampaignCandidates([]));
  }, [selectedCamp]);

  useEffect(() => {
    setDetailPage(1);
  }, [tab, candidateFilter, search, reserveSearch, reserveStatus, detailPageSize]);

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

    const filteredReserves = mockReserves.filter((r) => {
      const matchSearch =
        !reserveSearch ||
        r.fullName.toLowerCase().includes(reserveSearch.toLowerCase()) ||
        r.cccd.includes(reserveSearch);
      const matchStatus = !reserveStatus || r.status === reserveStatus;
      return matchSearch && matchStatus;
    });

    const returnedAggregateRows =
      userHierarchyLevel === "tinh"
        ? Array.from(new Set(mockReturnedSoldiers.map((s) => s.district))).map((district) => {
            const count = mockReturnedSoldiers.filter((s) => s.district === district).length;
            const sample = mockReturnedSoldiers.find((s) => s.district === district);
            return {
              id: district,
              label: sample ? sample.origin.split(", ")[1] || district : district,
              count,
            };
          })
        : userHierarchyLevel === "huyen"
          ? Array.from(new Set(mockReturnedSoldiers.map((s) => s.commune))).map((commune) => {
              const count = mockReturnedSoldiers.filter((s) => s.commune === commune).length;
              const sample = mockReturnedSoldiers.find((s) => s.commune === commune);
              return {
                id: commune,
                label: sample ? sample.origin.split(", ")[0] || commune : commune,
                count,
              };
            })
          : [];

    const returnedSoldierRows = mockReturnedSoldiers.map((s) => ({
      id: s.id,
      soldier: s,
    }));

    const pagedCandidates = paginateSlice(filteredCandidates, detailPage, detailPageSize);
    const pagedReserves = paginateSlice(filteredReserves, detailPage, detailPageSize);
    const pagedReturnedAggregate = paginateSlice(
      returnedAggregateRows,
      detailPage,
      detailPageSize,
    );
    const pagedReturnedSoldiers = paginateSlice(
      returnedSoldierRows,
      detailPage,
      detailPageSize,
    );

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
            { label: "Chưa khám", value: pendingCount, color: "var(--color-m3-warning)" },
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
              { key: "reserve", label: `Danh sách dự bị (${mockReserves.length})`, icon: Shield },
              { key: "returned", label: `Bị trả về (${mockReturnedSoldiers.length})`, icon: XCircle },
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
            tabs={
              <AdminStatusTabs
                tabs={[...RESERVE_TABS]}
                value={reserveStatus}
                onChange={setReserveStatus}
              />
            }
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
            <AdminTable minWidth="min-w-[960px]">
              <AdminTHead>
                <th className={ADMIN_TH_CLS}>Họ và Tên</th>
                <th className={ADMIN_TH_CLS}>Đơn vị dự bị</th>
                <th className={ADMIN_TH_CLS}>Xuất ngũ</th>
                <th className={ADMIN_TH_CLS}>Hạng</th>
                <th className={ADMIN_TH_CLS}>Chuyên ngành</th>
                <th className={ADMIN_TH_CLS}>Huấn luyện gần nhất</th>
                <th className={ADMIN_TH_CLS}>Trạng thái</th>
              </AdminTHead>
              <tbody>
                {pagedReserves.slice.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                      Không có kết quả
                    </td>
                  </tr>
                ) : (
                  pagedReserves.slice.map((r, idx) => (
                    <tr key={r.id} className={adminRowClass(idx)}>
                      <td className={ADMIN_TD_CLS}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-m3-surface-high flex items-center justify-center shrink-0">
                            <Shield size={12} className="text-m3-primary" />
                          </div>
                          <div>
                            <div className="font-semibold text-[14px]">{r.fullName}</div>
                            <div className="text-xs text-m3-on-surface-variant font-mono">{r.cccd}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`${ADMIN_TD_CLS} text-xs text-m3-on-surface-variant`}>{r.unit}</td>
                      <td className={ADMIN_TD_CLS}>
                        {new Date(r.discharged).toLocaleDateString("vi-VN")}
                      </td>
                      <td className={ADMIN_TD_CLS}>
                        <AdminPill
                          label={r.reserveClass}
                          bg={
                            r.reserveClass === "Hạng 1"
                              ? "var(--m3-primary-container, #dae9fb)"
                              : "var(--m3-surface-container-high, #eef1f4)"
                          }
                          color={
                            r.reserveClass === "Hạng 1"
                              ? "var(--m3-primary, #1a73e8)"
                              : "var(--m3-on-surface-variant, #475569)"
                          }
                        />
                      </td>
                      <td className={ADMIN_TD_CLS}>{r.specialty}</td>
                      <td className={ADMIN_TD_CLS}>
                        {new Date(r.lastTraining).toLocaleDateString("vi-VN")}
                      </td>
                      <td className={ADMIN_TD_CLS}>
                        <AdminPill
                          label={r.status === "active" ? "Hoạt động" : "Ngừng"}
                          bg={
                            r.status === "active"
                              ? "var(--color-m3-success-container)"
                              : "var(--m3-surface-container-high, #eef1f4)"
                          }
                          color={
                            r.status === "active"
                              ? "var(--color-m3-success)"
                              : "var(--m3-on-surface-variant, #475569)"
                          }
                        />
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
            page={
              userHierarchyLevel === "tinh" || userHierarchyLevel === "huyen"
                ? pagedReturnedAggregate.safePage
                : pagedReturnedSoldiers.safePage
            }
            totalPages={
              userHierarchyLevel === "tinh" || userHierarchyLevel === "huyen"
                ? pagedReturnedAggregate.totalPages
                : pagedReturnedSoldiers.totalPages
            }
            toolbar={
              <div className="flex items-center gap-2 border-b border-black/[0.05] bg-red-500/[0.04] px-4 py-3">
                <AlertTriangle size={18} className="text-m3-error" />
                <span className="text-[13px] font-semibold text-m3-error">
                  Danh sách quân nhân bị các đơn vị trả về
                </span>
              </div>
            }
          >
            <AdminTable minWidth="min-w-[720px]">
              {userHierarchyLevel === "tinh" || userHierarchyLevel === "huyen" ? (
                <>
                  <AdminTHead>
                    <th className={ADMIN_TH_CLS}>
                      {userHierarchyLevel === "tinh" ? "Quận / Huyện" : "Xã / Phường"}
                    </th>
                    <th className={`${ADMIN_TH_CLS} text-center`}>Số lượng bị trả về</th>
                  </AdminTHead>
                  <tbody>
                    {pagedReturnedAggregate.slice.map((row, idx) => (
                      <tr key={row.id} className={adminRowClass(idx, "hover:bg-red-50/50")}>
                        <td className={`${ADMIN_TD_CLS} font-semibold`}>{row.label}</td>
                        <td className={`${ADMIN_TD_CLS} text-center font-bold text-m3-error`}>
                          {row.count}
                        </td>
                      </tr>
                    ))}
                    {pagedReturnedAggregate.slice.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                          Không có kết quả
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              ) : (
                <>
                  <AdminTHead>
                    <th className={ADMIN_TH_CLS}>Quân nhân</th>
                    <th className={ADMIN_TH_CLS}>Đơn vị trả về</th>
                    <th className={ADMIN_TH_CLS}>Lý do từ chối</th>
                    <th className={`${ADMIN_TH_CLS} text-center`}>Ngày báo cáo</th>
                  </AdminTHead>
                  <tbody>
                    {pagedReturnedSoldiers.slice.map((row, idx) => {
                      const soldier = row.soldier;
                      return (
                        <tr key={row.id} className={adminRowClass(idx, "hover:bg-red-50/50")}>
                          <td className={ADMIN_TD_CLS}>
                            <div className="font-semibold">{soldier.fullName}</div>
                            <div className="text-xs text-m3-on-surface-variant font-mono mt-0.5">
                              {soldier.cccd}
                            </div>
                          </td>
                          <td className={`${ADMIN_TD_CLS} font-medium text-m3-on-surface-variant`}>
                            {soldier.unitReceived}
                          </td>
                          <td className={`${ADMIN_TD_CLS} font-medium italic text-m3-error`}>
                            {soldier.reason}
                          </td>
                          <td className={`${ADMIN_TD_CLS} text-center text-xs text-m3-on-surface-variant`}>
                            {new Date(soldier.reportDate).toLocaleDateString("vi-VN")}
                          </td>
                        </tr>
                      );
                    })}
                    {pagedReturnedSoldiers.slice.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
                          Không có kết quả
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}
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
          <AdminPrimaryBtn tone="blue" onClick={() => openCampaignForm()}>
            <Plus size={16} /> Tạo đợt khám mới
          </AdminPrimaryBtn>
        }
      />

      <p className="text-[14px] text-m3-on-surface-variant">
        Quản lý các đợt gọi khám sức khỏe và kết quả gọi quân
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-warning-container flex items-center justify-center text-m3-on-warning-container">
            <CalendarClock size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">Đợt đang diễn ra</p>
            <p className="text-2xl font-bold text-m3-on-surface">1</p>
          </div>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-primary-container flex items-center justify-center text-m3-primary">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">Tổng gọi khám</p>
            <p className="text-2xl font-bold text-m3-on-surface">3,200</p>
          </div>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-success-container flex items-center justify-center text-m3-on-success-container">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">Đã đạt sức khỏe</p>
            <p className="text-2xl font-bold text-m3-on-surface">450</p>
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
            <th className={ADMIN_TH_CLS}>Chỉ tiêu / Lên trạm</th>
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
                const regPct = Math.round((camp.registeredCount / camp.targetQuota) * 100);
                const passPct = Math.round((camp.passedCount / camp.targetQuota) * 100);
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
                        {camp.targetQuota} / {camp.registeredCount}
                      </div>
                      <div className="w-full bg-m3-surface-highest rounded-full h-1.5 mt-1.5">
                        <div
                          className="bg-m3-primary-container h-1.5 rounded-full"
                          style={{ width: `${Math.min(regPct, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <div className="font-semibold">
                        {camp.passedCount} ({passPct}%)
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
                        <AdminIconBtn
                          title="Chỉnh sửa"
                          tone="blue"
                          onClick={() => openCampaignForm(camp)}
                        >
                          <Edit2 size={15} />
                        </AdminIconBtn>
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
                  Chỉ tiêu
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
    </div>
  );
}
