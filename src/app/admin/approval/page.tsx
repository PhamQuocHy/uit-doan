"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { ApprovalRow } from "@/lib/enlistment-approval";
import type { HierarchyUnit } from "@/lib/data";
import {
  AdminListHeader,
  AdminStatusTabs,
  AdminListToolbar,
  AdminListShell,
  AdminTable,
  AdminTHead,
  ADMIN_TH_CLS,
  ADMIN_TD_CLS,
  adminRowClass,
  AdminHoverActions,
  AdminIconBtn,
  AdminPill,
  ADMIN_SELECT_CLS,
} from "@/components/admin/list-ui";

type CampaignOption = { id: string; name: string; year: number };

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "Chờ duyệt",
    color: "var(--color-m3-warning)",
    bg: "var(--color-m3-warning-container)",
  },
  approved: {
    label: "Đã duyệt",
    color: "var(--color-m3-success)",
    bg: "var(--color-m3-success-container)",
  },
  rejected: {
    label: "Không đạt",
    color: "var(--m3-error, #ba1a1a)",
    bg: "var(--m3-error-container, var(--m3-error-container, #ffdad6))",
  },
};

const TABLE_COLS = 6;

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async (opts?: { status?: string }) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      const status = opts?.status !== undefined ? opts.status : statusFilter;
      if (status) q.set("status", status);
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
          const res = await fetch(
            `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(code)}`,
          );
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
    fetch(
      `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(provinceCode)}`,
    )
      .then((res) => res.json())
      .then((data) => setWards(data.items || []))
      .catch(() => setWards([]));
  }, [provinceCode, sessionLevel]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, campaignId, unitCode]);

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

  const totalCount = counts.pending + counts.approved + counts.rejected;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const statusTabs = [
    { value: "", label: `Tất cả (${totalCount})` },
    { value: "pending", label: `Chờ duyệt (${counts.pending})` },
    { value: "approved", label: `Đã duyệt (${counts.approved})` },
    { value: "rejected", label: `Không đạt (${counts.rejected})` },
  ];

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  const campaignSelectTitle = selectedCampaign
    ? `${selectedCampaign.year} · ${selectedCampaign.name}`
    : "Chọn đợt tuyển quân";

  const headerFilters = (
    <>
      {campaigns.length > 0 && (
        <select
          className={`${ADMIN_SELECT_CLS} max-w-[min(100%,380px)] min-w-[220px]`}
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          aria-label="Đợt tuyển quân"
          title={campaignSelectTitle}
        >
          <option value="">Chọn đợt tuyển quân...</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.year} · {campaign.name}
            </option>
          ))}
        </select>
      )}
      {sessionLevel === "bo" && (
        <select
          className={`${ADMIN_SELECT_CLS} max-w-[180px]`}
          value={provinceCode}
          onChange={(e) => handleProvinceChange(e.target.value)}
          aria-label="Chọn tỉnh thành phố"
        >
          <option value="">Tỉnh / TP</option>
          {provinces.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      {sessionLevel === "bo" && provinceCode && (
        <select
          className={`${ADMIN_SELECT_CLS} max-w-[160px]`}
          value={unitCode === provinceCode ? "" : unitCode}
          onChange={(e) => handleWardChange(e.target.value)}
          aria-label="Chọn xã phường"
        >
          <option value="">Tất cả xã</option>
          {wards.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      {sessionLevel === "tinh" && (
        <select
          className={`${ADMIN_SELECT_CLS} max-w-[160px]`}
          value={unitCode === sessionUnitCode ? "" : unitCode}
          onChange={(e) => handleWardChange(e.target.value)}
          aria-label="Chọn xã phường"
        >
          <option value="">Tất cả xã</option>
          {wards.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      )}
    </>
  );

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Xét duyệt danh sách"
        countLabel={
          rows.length > 0
            ? `${rows.length.toLocaleString("vi-VN")} hồ sơ`
            : undefined
        }
        filters={headerFilters}
      />

      <p className="text-[14px] text-m3-on-surface-variant">
        Chỉ hiển thị hồ sơ được đánh dấu Dự kiến gọi từ mục Hồ sơ công dân
      </p>

      <AdminListShell
        page={page}
        totalPages={totalPages}
        loading={loading}
        tabs={
          <AdminStatusTabs
            tabs={statusTabs}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        }
        toolbar={
          <AdminListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tìm theo họ tên, số CCCD..."
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
        <AdminTable>
          <AdminTHead>
            <th className={ADMIN_TH_CLS}>Họ và Tên</th>
            <th className={ADMIN_TH_CLS}>Đơn vị</th>
            <th className={ADMIN_TH_CLS}>Kết quả SK</th>
            <th className={ADMIN_TH_CLS}>Kết quả CT</th>
            <th className={ADMIN_TH_CLS}>Trạng thái duyệt</th>
            <th className={ADMIN_TH_CLS}>Ghi chú</th>
          </AdminTHead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={TABLE_COLS}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  Đang tải...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={TABLE_COLS}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  Chưa có hồ sơ dự kiến gọi. Vào Hồ sơ công dân → tab NVQS → chọn
                  Dự kiến gọi.
                </td>
              </tr>
            ) : (
              pagedRows.map((row, idx) => {
                const s = statusConfig[row.status];
                return (
                  <tr key={row.id} className={adminRowClass(idx)}>
                    <td className={ADMIN_TD_CLS}>
                      <div className="text-[14px] font-bold text-m3-on-surface">
                        {row.fullName}
                      </div>
                      <div className="mt-0.5 font-mono text-[12px] text-m3-on-surface-variant">
                        {row.cccd}
                      </div>
                      <div className="mt-0.5 text-[12px] text-m3-on-surface-variant">
                        Sinh:{" "}
                        {new Date(row.dateOfBirth).toLocaleDateString("vi-VN")}
                      </div>
                    </td>
                    <td className={`${ADMIN_TD_CLS} text-m3-on-surface-variant`}>
                      {row.unitName}
                    </td>
                    <td className={`${ADMIN_TD_CLS} font-semibold`}>
                      {row.healthResult}
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill
                        label={row.politicalResult}
                        bg="var(--color-m3-success-container)"
                        color="var(--color-m3-success)"
                      />
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill label={s.label} bg={s.bg} color={s.color} />
                    </td>
                    <td className={`relative ${ADMIN_TD_CLS}`}>
                      <span className="block max-w-[180px] truncate text-[13px] text-m3-on-surface-variant">
                        —
                      </span>
                      {row.status === "pending" && (
                        <AdminHoverActions>
                          <AdminIconBtn
                            title="Duyệt gọi nhập ngũ"
                            tone="green"
                            disabled={busyId === row.id}
                            onClick={() => void handleAction(row.id, "approve")}
                          >
                            <Check size={15} />
                          </AdminIconBtn>
                          <AdminIconBtn
                            title="Không đạt"
                            tone="red"
                            disabled={busyId === row.id}
                            onClick={() => void handleAction(row.id, "reject")}
                          >
                            <X size={15} />
                          </AdminIconBtn>
                        </AdminHoverActions>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </AdminTable>
      </AdminListShell>
    </div>
  );
}
