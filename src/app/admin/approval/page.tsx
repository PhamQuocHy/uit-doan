"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Filter,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { ApprovalRow } from "@/lib/enlistment-approval";
import type { HierarchyUnit } from "@/lib/data";

type CampaignOption = { id: string; name: string; year: number };

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  pending: { label: "Chờ duyệt", color: "var(--color-m3-warning)", bg: "var(--color-m3-warning-container)", icon: Clock },
  approved: {
    label: "Đã duyệt",
    color: "var(--color-m3-success)",
    bg: "var(--color-m3-success-container)",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Không đạt",
    color: "var(--m3-error, #ba1a1a)",
    bg: "var(--m3-error-container, var(--m3-error-container, #ffdad6))",
    icon: AlertCircle,
  },
};

export default function ApprovalPage() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [sessionLevel, setSessionLevel] = useState("");
  const [sessionUnitCode, setSessionUnitCode] = useState("");
  const [provinces, setProvinces] = useState<HierarchyUnit[]>([]);
  const [wards, setWards] = useState<HierarchyUnit[]>([]);
  const [provinceCode, setProvinceCode] = useState("");
  const [unitCode, setUnitCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      if (statusFilter) q.set("status", statusFilter);
      if (campaignId) q.set("campaignId", campaignId);
      if (unitCode) q.set("unitCode", unitCode);
      const res = await fetch(`/api/admin/approval?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.data || []);
        setCounts(data.counts || { pending: 0, approved: 0, rejected: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, campaignId, unitCode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/admin/recruitment?limit=100")
      .then((res) => res.json())
      .then((data) => setCampaigns(data.data || []))
      .catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(async (data) => {
        const level = data.user?.hierarchyLevel || "";
        const code = data.user?.unitCode || "";
        setSessionLevel(level);
        setSessionUnitCode(code);
        if (level === "bo") {
          const res = await fetch("/api/admin/hierarchy/children?parentCode=bo");
          const json = await res.json();
          setProvinces(json.items || []);
        } else if (level === "tinh") {
          const res = await fetch(`/api/admin/hierarchy/children?parentCode=${encodeURIComponent(code)}`);
          const json = await res.json();
          setWards(json.items || []);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (sessionLevel !== "bo" || !provinceCode) {
      if (sessionLevel === "bo") setWards([]);
      return;
    }
    fetch(`/api/admin/hierarchy/children?parentCode=${encodeURIComponent(provinceCode)}`)
      .then((res) => res.json())
      .then((data) => setWards(data.items || []))
      .catch(() => setWards([]));
  }, [provinceCode, sessionLevel]);

  const handleProvinceChange = (value: string) => {
    setProvinceCode(value);
    setUnitCode(value);
  };

  const handleWardChange = (value: string) => {
    setUnitCode(value || (sessionLevel === "bo" ? provinceCode : sessionUnitCode));
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    if (!campaignId) {
      alert("Vui lòng chọn đợt tuyển quân trước khi duyệt");
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, campaignId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thực hiện được");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
          Xét duyệt danh sách nhập ngũ
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
          Chỉ hiển thị hồ sơ được đánh dấu Dự kiến gọi từ mục Hồ sơ công dân
        </p>
          <div className="mt-4 max-w-md">
            <label className="mb-1 block text-sm font-medium text-m3-on-surface-variant">Đợt tuyển quân</label>
            <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="w-full rounded-xl border border-m3-outline-variant bg-m3-surface-lowest px-3 py-2 text-sm">
              <option value="">Chọn đợt để xét duyệt...</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} ({campaign.year})</option>)}
            </select>
          </div>
          {sessionLevel === "bo" && (
            <div className="mt-3 flex max-w-2xl flex-wrap gap-2">
              <select value={provinceCode} onChange={(e) => handleProvinceChange(e.target.value)} className="rounded-xl border border-m3-outline-variant bg-m3-surface-lowest px-3 py-2 text-sm">
                <option value="">Tất cả tỉnh / thành phố</option>
                {provinces.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
              {provinceCode && <select value={unitCode === provinceCode ? "" : unitCode} onChange={(e) => handleWardChange(e.target.value)} className="rounded-xl border border-m3-outline-variant bg-m3-surface-lowest px-3 py-2 text-sm"><option value="">Tất cả xã / phường</option>{wards.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>}
            </div>
          )}
          {sessionLevel === "tinh" && <div className="mt-3 max-w-md"><select value={unitCode === sessionUnitCode ? "" : unitCode} onChange={(e) => handleWardChange(e.target.value)} className="w-full rounded-xl border border-m3-outline-variant bg-m3-surface-lowest px-3 py-2 text-sm"><option value="">Tất cả xã / phường</option>{wards.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Chờ duyệt", value: counts.pending, color: "var(--color-m3-warning)", bg: "var(--color-m3-warning-container)" },
          { label: "Đã duyệt", value: counts.approved, color: "var(--color-m3-success)", bg: "var(--color-m3-success-container)" },
          { label: "Không đạt", value: counts.rejected, color: "var(--m3-error, #ba1a1a)", bg: "var(--m3-error-container, var(--m3-error-container, #ffdad6))" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-5 border shadow-sm"
            style={{ background: s.bg, borderColor: s.color + "33" }}
          >
            <p className="text-sm font-medium" style={{ color: s.color }}>
              {s.label}
            </p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm theo họ tên, số CCCD..."
              className="w-full pl-10 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={18}
            />
            <select
              className="pl-10 pr-8 py-2 border border-m3-outline-variant rounded-xl text-sm appearance-none bg-m3-surface-lowest"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Không đạt</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
              <tr>
                <th className="px-6 py-4">Họ và Tên</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4">Kết quả SK</th>
                <th className="px-6 py-4">Kết quả CT</th>
                <th className="px-6 py-4">Trạng thái duyệt</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-m3-on-surface-variant">
                    Đang tải...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-m3-on-surface-variant">
                    Chưa có hồ sơ dự kiến gọi. Vào Hồ sơ công dân → tab NVQS → chọn Dự kiến gọi.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const s = statusConfig[row.status];
                  const Icon = s.icon;
                  return (
                    <tr key={row.id} className="hover:bg-m3-surface-high/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-m3-on-surface">{row.fullName}</div>
                        <div className="text-xs text-m3-on-surface-variant font-mono mt-0.5">
                          {row.cccd}
                        </div>
                        <div className="text-xs text-m3-on-surface-variant mt-0.5">
                          Sinh: {new Date(row.dateOfBirth).toLocaleDateString("vi-VN")}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-m3-on-surface-variant">{row.unitName}</td>
                      <td className="px-6 py-4 font-medium">{row.healthResult}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-m3-success-container text-m3-on-success-container">
                          {row.politicalResult}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: s.bg, color: s.color }}
                        >
                          <Icon size={12} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          {row.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => void handleAction(row.id, "approve")}
                                className="p-1.5 text-m3-on-surface-variant hover:text-m3-on-success-container hover:bg-m3-success-container rounded-lg"
                                title="Duyệt gọi nhập ngũ"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => void handleAction(row.id, "reject")}
                                className="p-1.5 text-m3-on-surface-variant hover:text-m3-on-error-container hover:bg-m3-error-container rounded-lg"
                                title="Không gọi"
                              >
                                <X size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
