"use client";

import { useState, useEffect, useCallback } from "react";
import { RecruitmentCampaign } from "@/lib/data";
import {
  CalendarClock,
  Plus,
  Filter,
  Eye,
  Edit2,
  Users,
  CheckCircle2,
  Activity,
  ChevronLeft,
  Search,
  Shield,
  User2,
  XCircle,
  AlertTriangle,
  X,
} from "lucide-react";

// ── Mock youth candidates per campaign ──────────────────────────────────────
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

const mockCandidates: Record<string, Candidate[]> = {
  default: [
    {
      id: "c1",
      fullName: "Nguyễn Văn An",
      cccd: "079300012345",
      dob: "2002-03-14",
      unit: "Xã Hàng Bông",
      healthResult: "passed",
      score: 88,
      note: "",
    },
    {
      id: "c2",
      fullName: "Trần Minh Bảo",
      cccd: "079300076543",
      dob: "2003-07-22",
      unit: "Xã Hàng Đào",
      healthResult: "passed",
      score: 82,
      note: "",
    },
    {
      id: "c3",
      fullName: "Lê Thành Công",
      cccd: "079300034567",
      dob: "2001-08-08",
      unit: "Xã Khâm Thiên",
      healthResult: "failed",
      score: 54,
      note: "Thị lực kém",
    },
    {
      id: "c4",
      fullName: "Phạm Quốc Duy",
      cccd: "079300021098",
      dob: "2003-01-25",
      unit: "Xã Bình Hưng",
      healthResult: "passed",
      score: 91,
      note: "",
    },
    {
      id: "c5",
      fullName: "Hoàng Văn Em",
      cccd: "079300058432",
      dob: "2002-11-19",
      unit: "Xã Long Hòa",
      healthResult: "failed",
      score: 60,
      note: "Thiếu cân",
    },
    {
      id: "c6",
      fullName: "Vũ Thanh Phát",
      cccd: "079300098765",
      dob: "2004-05-03",
      unit: "Xã Hàng Bông",
      healthResult: "pending",
      score: 0,
      note: "Chưa khám",
    },
    {
      id: "c7",
      fullName: "Đặng Minh Quân",
      cccd: "079300043219",
      dob: "2002-09-30",
      unit: "Xã Hàng Đào",
      healthResult: "passed",
      score: 77,
      note: "",
    },
    {
      id: "c8",
      fullName: "Bùi Văn Hùng",
      cccd: "079300067890",
      dob: "2003-04-12",
      unit: "Xã Khâm Thiên",
      healthResult: "passed",
      score: 80,
      note: "",
    },
    {
      id: "c9",
      fullName: "Ngô Thành Nhân",
      cccd: "079300011112",
      dob: "2001-12-05",
      unit: "Xã Bình Hưng",
      healthResult: "failed",
      score: 45,
      note: "Huyết áp cao",
    },
    {
      id: "c10",
      fullName: "Đinh Văn Sĩ",
      cccd: "079300033322",
      dob: "2004-02-28",
      unit: "Xã Long Hòa",
      healthResult: "pending",
      score: 0,
      note: "Chưa khám",
    },
  ],
};

// ── Mock reserve list ────────────────────────────────────────────────────────
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
    bg: "var(--m3-error-container, var(--m3-error-container, #ffdad6))",
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

export default function RecruitmentPage() {
  const [campaigns, setCampaigns] = useState<RecruitmentCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userHierarchyLevel, setUserHierarchyLevel] = useState<string>("tinh");
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<RecruitmentCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({ name: "", year: new Date().getFullYear().toString(), startDate: "", endDate: "", status: "planning", targetQuota: "" });
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  const [campaignCandidates, setCampaignCandidates] = useState<Candidate[]>([]);

  // Detail view state
  const [selectedCamp, setSelectedCamp] = useState<RecruitmentCampaign | null>(
    null,
  );
  const [tab, setTab] = useState<"candidates" | "reserve" | "returned">(
    "candidates",
  );
  const [candidateFilter, setCandidateFilter] = useState<
    "" | "passed" | "failed" | "pending"
  >("");
  const [search, setSearch] = useState("");
  const [reserveSearch, setReserveSearch] = useState("");
  const [reserveStatus, setReserveStatus] = useState("");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: "10",
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
  }, [page, statusFilter, yearFilter]);

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
        const mapped: Candidate[] = (data.data || []).map((row: { id: string; fullName: string; cccd: string; dateOfBirth: string; unitName: string; status: string; healthResult: string }) => ({
          id: row.id,
          fullName: row.fullName,
          cccd: row.cccd,
          dob: row.dateOfBirth,
          unit: row.unitName,
          healthResult: row.status === "approved" ? "passed" : row.status === "rejected" ? "failed" : "pending",
          score: Number(row.healthResult.replace(/\D/g, "")) || 0,
          note: row.status === "pending" ? "Chờ xét duyệt" : "",
        }));
        setCampaignCandidates(mapped);
      })
      .catch(() => setCampaignCandidates([]));
  }, [selectedCamp]);

  const openCampaignForm = (campaign?: RecruitmentCampaign) => {
    setEditingCampaign(campaign || null);
    setCampaignForm(campaign ? { name: campaign.name, year: String(campaign.year), startDate: campaign.startDate, endDate: campaign.endDate, status: campaign.status, targetQuota: String(campaign.targetQuota) } : { name: "", year: new Date().getFullYear().toString(), startDate: "", endDate: "", status: "planning", targetQuota: "" });
    setCampaignError("");
    setCampaignFormOpen(true);
  };

  const saveCampaign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCampaignSaving(true);
    setCampaignError("");
    try {
      const response = await fetch(editingCampaign ? `/api/admin/recruitment/${editingCampaign.id}` : "/api/admin/recruitment", { method: editingCampaign ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...campaignForm, year: Number(campaignForm.year), targetQuota: Number(campaignForm.targetQuota) }) });
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
        planning: { label: "Kế hoạch", color: "var(--m3-on-surface-variant, #475569)", bg: "var(--m3-surface-container-high, #eef1f4)" },
        ongoing: { label: "Đang diễn ra", color: "var(--color-m3-warning)", bg: "var(--color-m3-warning-container)" },
        completed: { label: "Đã kết thúc", color: "var(--color-m3-success)", bg: "var(--color-m3-success-container)" },
      }) as Record<string, { label: string; color: string; bg: string }>
    )[status] || { label: status, color: "var(--m3-on-surface-variant, #475569)", bg: "var(--m3-surface-container-high, #eef1f4)" };

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (selectedCamp) {
    const candidates = campaignCandidates;
    const filteredCandidates = candidates.filter((c) => {
      const matchResult =
        !candidateFilter || c.healthResult === candidateFilter;
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

    const passedCount = candidates.filter(
      (c) => c.healthResult === "passed",
    ).length;
    const failedCount = candidates.filter(
      (c) => c.healthResult === "failed",
    ).length;
    const pendingCount = candidates.filter(
      (c) => c.healthResult === "pending",
    ).length;

    return (
      <div className="space-y-6">
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedCamp(null)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-surface-high rounded-xl border border-m3-outline-variant transition-colors"
          >
            <ChevronLeft size={16} /> Quay lại
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
              {selectedCamp.name}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--m3-primary, #1a73e8)" }}>
              {new Date(selectedCamp.startDate).toLocaleDateString("vi-VN")} –{" "}
              {new Date(selectedCamp.endDate).toLocaleDateString("vi-VN")} · Năm{" "}
              {selectedCamp.year}
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Tổng gọi khám",
              value: candidates.length,
              color: "var(--m3-on-surface, #1b1d20)",
            },
            { label: "Trúng tuyển", value: passedCount, color: "var(--color-m3-success)" },
            { label: "Không đạt", value: failedCount, color: "var(--m3-error, #ba1a1a)" },
            { label: "Chưa khám", value: pendingCount, color: "var(--color-m3-warning)" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-m3-surface-lowest rounded-2xl p-4 border border-m3-outline-variant shadow-sm"
            >
              <p className="text-xs text-m3-on-surface-variant">{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-m3-outline-variant pb-0">
          <button
            onClick={() => setTab("candidates")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "candidates" ? "border-m3-primary text-m3-primary" : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface-variant"}`}
          >
            <Users size={16} /> Danh sách thanh niên khám ({candidates.length})
          </button>
          <button
            onClick={() => setTab("reserve")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "reserve" ? "border-m3-primary text-m3-primary" : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface-variant"}`}
          >
            <Shield size={16} /> Danh sách dự bị ({mockReserves.length})
          </button>
          <button
            onClick={() => setTab("returned")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "returned" ? "border-m3-error text-m3-on-error-container" : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface-variant"}`}
          >
            <XCircle size={16} /> Bị trả về ({mockReturnedSoldiers.length})
          </button>
        </div>

        {/* TAB: Candidates */}
        {tab === "candidates" && (
          <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
            <div className="p-4 border-b border-m3-outline-variant flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Tìm họ tên, CCCD..."
                  className="w-full pl-9 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["", "passed", "failed", "pending"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setCandidateFilter(v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      candidateFilter === v
                        ? "bg-m3-primary text-white"
                        : "bg-m3-surface-container text-m3-on-surface-variant hover:bg-m3-surface-highest"
                    }`}
                  >
                    {
                      {
                        "": "Tất cả",
                        passed: "Trúng tuyển",
                        failed: "Không đạt",
                        pending: "Chưa khám",
                      }[v]
                    }
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
                  <tr>
                    <th className="px-5 py-3">Họ và Tên</th>
                    <th className="px-5 py-3">Đơn vị</th>
                    <th className="px-5 py-3 text-center">Điểm SK</th>
                    <th className="px-5 py-3">Kết quả</th>
                    <th className="px-5 py-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-outline-variant">
                  {filteredCandidates.map((c) => {
                    const cfg = resultConfig[c.healthResult];
                    const Icon = cfg.icon;
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-m3-surface-high/50 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-m3-surface-high flex items-center justify-center shrink-0">
                              <User2 size={12} style={{ color: "var(--m3-primary, #1a73e8)" }} />
                            </div>
                            <div>
                              <div className="font-medium text-m3-on-surface text-sm">
                                {c.fullName}
                              </div>
                              <div className="text-xs text-m3-on-surface-variant font-mono">
                                {c.cccd}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-m3-on-surface-variant">
                          {c.unit}
                        </td>
                        <td className="px-5 py-3 text-center font-semibold text-m3-on-surface">
                          {c.score > 0 ? c.score : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            <Icon size={11} /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-m3-on-surface-variant italic">
                          {c.note || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCandidates.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-8 text-center text-m3-on-surface-variant"
                      >
                        Không có kết quả
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Reserve */}
        {tab === "reserve" && (
          <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
            <div className="p-4 border-b border-m3-outline-variant flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Tìm họ tên, CCCD..."
                  className="w-full pl-9 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary"
                  value={reserveSearch}
                  onChange={(e) => setReserveSearch(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary bg-m3-surface-lowest"
                value={reserveStatus}
                onChange={(e) => setReserveStatus(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
                  <tr>
                    <th className="px-5 py-3">Họ và Tên</th>
                    <th className="px-5 py-3">Đơn vị dự bị</th>
                    <th className="px-5 py-3">Xuất ngũ</th>
                    <th className="px-5 py-3">Hạng</th>
                    <th className="px-5 py-3">Chuyên ngành</th>
                    <th className="px-5 py-3">Huấn luyện gần nhất</th>
                    <th className="px-5 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-m3-outline-variant">
                  {filteredReserves.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-m3-surface-high/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-m3-surface-high flex items-center justify-center shrink-0">
                            <Shield size={12} style={{ color: "var(--m3-primary, #1a73e8)" }} />
                          </div>
                          <div>
                            <div className="font-medium text-m3-on-surface text-sm">
                              {r.fullName}
                            </div>
                            <div className="text-xs text-m3-on-surface-variant font-mono">
                              {r.cccd}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-m3-on-surface-variant">
                        {r.unit}
                      </td>
                      <td className="px-5 py-3 text-m3-on-surface-variant text-sm">
                        {new Date(r.discharged).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={
                            r.reserveClass === "Hạng 1"
                              ? { background: "var(--m3-primary-container, #dae9fb)", color: "var(--m3-primary, #1a73e8)" }
                              : { background: "var(--m3-surface-container-high, #eef1f4)", color: "var(--m3-on-surface-variant, #475569)" }
                          }
                        >
                          {r.reserveClass}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-m3-on-surface-variant text-sm">
                        {r.specialty}
                      </td>
                      <td className="px-5 py-3 text-m3-on-surface-variant text-sm">
                        {new Date(r.lastTraining).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex px-2 py-1 rounded-full text-xs font-medium"
                          style={
                            r.status === "active"
                              ? { background: "var(--color-m3-success-container)", color: "var(--color-m3-success)" }
                              : { background: "var(--m3-surface-container-high, #eef1f4)", color: "var(--m3-on-surface-variant, #475569)" }
                          }
                        >
                          {r.status === "active" ? "Hoạt động" : "Ngừng"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredReserves.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-8 text-center text-m3-on-surface-variant"
                      >
                        Không có kết quả
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Returned */}
        {tab === "returned" && (
          <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-error overflow-hidden">
            <div className="p-4 border-b border-m3-error flex flex-col sm:flex-row gap-3 bg-m3-error-container/30">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-m3-on-error-container" />
                <span className="font-semibold text-m3-on-error-container">
                  Danh sách quân nhân bị các đơn vị trả về
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                {userHierarchyLevel === "tinh" ? (
                  <>
                    <thead className="bg-m3-surface-lowest text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
                      <tr>
                        <th className="px-6 py-4">Quận / Huyện</th>
                        <th className="px-6 py-4 text-center">
                          Số lượng bị trả về
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-m3-outline-variant">
                      {Array.from(
                        new Set(mockReturnedSoldiers.map((s) => s.district)),
                      ).map((district) => {
                        const count = mockReturnedSoldiers.filter(
                          (s) => s.district === district,
                        ).length;
                        const sample = mockReturnedSoldiers.find(
                          (s) => s.district === district,
                        );
                        const districtName = sample
                          ? sample.origin.split(", ")[1]
                          : district;
                        return (
                          <tr
                            key={district}
                            className="hover:bg-m3-error-container/20 transition-colors"
                          >
                            <td className="px-6 py-4 font-medium text-m3-on-surface">
                              {districtName || district}
                            </td>
                            <td className="px-6 py-4 text-center text-m3-on-error-container font-bold">
                              {count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </>
                ) : userHierarchyLevel === "huyen" ? (
                  <>
                    <thead className="bg-m3-surface-lowest text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
                      <tr>
                        <th className="px-6 py-4">Xã / Phường</th>
                        <th className="px-6 py-4 text-center">
                          Số lượng bị trả về
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-m3-outline-variant">
                      {Array.from(
                        new Set(mockReturnedSoldiers.map((s) => s.commune)),
                      ).map((commune) => {
                        const count = mockReturnedSoldiers.filter(
                          (s) => s.commune === commune,
                        ).length;
                        const sample = mockReturnedSoldiers.find(
                          (s) => s.commune === commune,
                        );
                        const communeName = sample
                          ? sample.origin.split(", ")[0]
                          : commune;
                        return (
                          <tr
                            key={commune}
                            className="hover:bg-m3-error-container/20 transition-colors"
                          >
                            <td className="px-6 py-4 font-medium text-m3-on-surface">
                              {communeName || commune}
                            </td>
                            <td className="px-6 py-4 text-center text-m3-on-error-container font-bold">
                              {count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead className="bg-m3-surface-lowest text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
                      <tr>
                        <th className="px-6 py-4">Quân nhân</th>
                        <th className="px-6 py-4">Đơn vị trả về</th>
                        <th className="px-6 py-4">Lý do từ chối</th>
                        <th className="px-6 py-4 text-center">Ngày báo cáo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-m3-outline-variant">
                      {mockReturnedSoldiers.map((soldier) => (
                        <tr
                          key={soldier.id}
                          className="hover:bg-m3-error-container/20 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-m3-on-surface">
                              {soldier.fullName}
                            </div>
                            <div className="text-xs text-m3-on-surface-variant font-mono mt-0.5">
                              {soldier.cccd}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-m3-on-surface-variant">
                            {soldier.unitReceived}
                          </td>
                          <td className="px-6 py-4 text-m3-on-error-container font-medium italic">
                            {soldier.reason}
                          </td>
                          <td className="px-6 py-4 text-center text-m3-on-surface-variant text-xs">
                            {new Date(soldier.reportDate).toLocaleDateString(
                              "vi-VN",
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
                {mockReturnedSoldiers.length === 0 && (
                  <tbody className="divide-y divide-m3-outline-variant">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-m3-on-surface-variant"
                      >
                        Không có kết quả
                      </td>
                    </tr>
                  </tbody>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Đợt khám tuyển
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            Quản lý các đợt gọi khám sức khỏe và kết quả gọi quân
          </p>
        </div>
        <button onClick={() => openCampaignForm()} className="flex items-center gap-2 px-4 py-2 bg-m3-primary hover:bg-m3-on-surface-variant text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} /> Tạo đợt khám mới
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-m3-surface-lowest p-5 rounded-2xl border border-m3-outline-variant shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-warning-container flex items-center justify-center text-m3-on-warning-container">
            <CalendarClock size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">
              Đợt đang diễn ra
            </p>
            <p className="text-2xl font-bold text-m3-on-surface">1</p>
          </div>
        </div>
        <div className="bg-m3-surface-lowest p-5 rounded-2xl border border-m3-outline-variant shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-primary-container flex items-center justify-center text-m3-primary">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">Tổng gọi khám</p>
            <p className="text-2xl font-bold text-m3-on-surface">3,200</p>
          </div>
        </div>
        <div className="bg-m3-surface-lowest p-5 rounded-2xl border border-m3-outline-variant shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-m3-success-container flex items-center justify-center text-m3-on-success-container">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-m3-on-surface-variant font-medium">Đã đạt sức khỏe</p>
            <p className="text-2xl font-bold text-m3-on-surface">450</p>
          </div>
        </div>
      </div>

      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex gap-3">
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={16}
            />
            <select
              className="pl-9 pr-8 py-2 border border-m3-outline-variant rounded-xl text-sm appearance-none focus:outline-none focus:border-m3-primary bg-m3-surface-lowest cursor-pointer"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả năm</option>
              <option value="2026">Năm 2026</option>
              <option value="2025">Năm 2025</option>
              <option value="2024">Năm 2024</option>
            </select>
          </div>
          <select
            className="px-3 pr-8 py-2 border border-m3-outline-variant rounded-xl text-sm appearance-none focus:outline-none focus:border-m3-primary bg-m3-surface-lowest cursor-pointer"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="planning">Kế hoạch</option>
            <option value="ongoing">Đang diễn ra</option>
            <option value="completed">Đã kết thúc</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
              <tr>
                <th className="px-6 py-4">Tên đợt khám</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Chỉ tiêu / Lên trạm</th>
                <th className="px-6 py-4">Đạt sức khỏe</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-m3-on-surface-variant"
                  >
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-m3-on-surface-variant"
                  >
                    Không tìm thấy đợt khám nào.
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => {
                  const statusInfo = getStatusInfo(camp.status);
                  const regPct = Math.round(
                    (camp.registeredCount / camp.targetQuota) * 100,
                  );
                  const passPct = Math.round(
                    (camp.passedCount / camp.targetQuota) * 100,
                  );
                  return (
                    <tr
                      key={camp.id}
                      className="hover:bg-m3-surface-high/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedCamp(camp)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-m3-on-surface">
                          {camp.name}
                        </div>
                        <div className="text-xs text-m3-on-surface-variant mt-0.5">
                          Năm {camp.year}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-m3-on-surface-variant text-sm">
                        {new Date(camp.startDate).toLocaleDateString("vi-VN")}
                        <br />
                        <span className="text-m3-on-surface-variant">→</span>{" "}
                        {new Date(camp.endDate).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-m3-on-surface">
                          {camp.targetQuota} / {camp.registeredCount}
                        </div>
                        <div className="w-full bg-m3-surface-highest rounded-full h-1.5 mt-1.5">
                          <div
                            className="bg-m3-primary-container h-1.5 rounded-full"
                            style={{ width: `${Math.min(regPct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-m3-on-surface">
                          {camp.passedCount} ({passPct}%)
                        </div>
                        <div className="w-full bg-m3-surface-highest rounded-full h-1.5 mt-1.5">
                          <div
                            className="bg-m3-success-container h-1.5 rounded-full"
                            style={{ width: `${Math.min(passPct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: statusInfo.bg,
                            color: statusInfo.color,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedCamp(camp)}
                            className="p-1.5 text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-surface-high rounded-lg transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openCampaignForm(camp)}
                            className="p-1.5 text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-primary-container rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-m3-outline-variant flex items-center justify-between text-sm">
            <span className="text-m3-on-surface-variant">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 border border-m3-outline-variant rounded-lg hover:bg-m3-surface-high disabled:opacity-50 transition-colors text-m3-on-surface-variant"
              >
                Trước
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 border border-m3-outline-variant rounded-lg hover:bg-m3-surface-high disabled:opacity-50 transition-colors text-m3-on-surface-variant"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {campaignFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveCampaign} className="w-full max-w-xl rounded-2xl bg-m3-surface-lowest p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-m3-on-surface">{editingCampaign ? "Sửa đợt khám" : "Tạo đợt khám mới"}</h2><button type="button" onClick={() => setCampaignFormOpen(false)} className="rounded-lg p-2 text-m3-on-surface-variant hover:bg-m3-surface-container"><X size={18} /></button></div>
            {campaignError && <p className="mb-3 rounded-xl bg-m3-error-container px-3 py-2 text-sm text-m3-on-error-container">{campaignError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Tên đợt khám</span><input required value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm" /></label>
              <label><span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Năm</span><input required type="number" min="2000" value={campaignForm.year} onChange={(event) => setCampaignForm({ ...campaignForm, year: event.target.value })} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm" /></label>
              <label><span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Chỉ tiêu</span><input required type="number" min="1" value={campaignForm.targetQuota} onChange={(event) => setCampaignForm({ ...campaignForm, targetQuota: event.target.value })} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm" /></label>
              <label><span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Ngày bắt đầu</span><input required type="date" value={campaignForm.startDate} onChange={(event) => setCampaignForm({ ...campaignForm, startDate: event.target.value })} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm" /></label>
              <label><span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Ngày kết thúc</span><input required type="date" value={campaignForm.endDate} onChange={(event) => setCampaignForm({ ...campaignForm, endDate: event.target.value })} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm" /></label>
              <label><span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Trạng thái</span><select value={campaignForm.status} onChange={(event) => setCampaignForm({ ...campaignForm, status: event.target.value })} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm"><option value="planning">Kế hoạch</option><option value="ongoing">Đang diễn ra</option><option value="completed">Đã kết thúc</option></select></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCampaignFormOpen(false)} className="rounded-xl border border-m3-outline-variant px-4 py-2 text-sm">Hủy</button><button disabled={campaignSaving} className="rounded-xl bg-m3-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{campaignSaving ? "Đang lưu..." : "Lưu đợt khám"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
