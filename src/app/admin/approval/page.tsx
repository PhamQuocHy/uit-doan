"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckSquare, Eye, X } from "lucide-react";
import type { ApprovalKind, ApprovalRow } from "@/lib/enlistment-approval";
import type { Citizen, HierarchyUnit } from "@/lib/data";
import CitizenDetailModal from "@/components/admin/CitizenDetailModal";
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
  AdminPrimaryBtn,
  ADMIN_SELECT_CLS,
} from "@/components/admin/list-ui";
import { M3ConfirmDialog, M3Snackbar, type M3SnackbarTone } from "@/components/m3";
import {
  getProvincesForMilitaryRegion,
  isQuanKhuOrBtl,
} from "@/lib/military-regions";

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
    bg: "var(--m3-error-container, #ffdad6)",
  },
};

const TABLE_COLS = 7;

type CountsState = {
  pending: number;
  approved: number;
  rejected: number;
  pendingGoi: number;
  pendingKhongGoi: number;
  pendingTamHoan: number;
};

/** Một hàng tab = một việc QK cần làm (không chồng 2 bộ lọc). */
type ApprovalView =
  | "pending_goi"
  | "pending_khong_goi"
  | "pending_tam_hoan"
  | "approved"
  | "rejected"
  | "all";

function viewToQuery(view: ApprovalView): {
  kind: ApprovalKind | "";
  status: string;
} {
  switch (view) {
    case "pending_goi":
      return { kind: "goi", status: "pending" };
    case "pending_khong_goi":
      return { kind: "khong_goi", status: "pending" };
    case "pending_tam_hoan":
      return { kind: "tam_hoan", status: "pending" };
    case "approved":
      return { kind: "", status: "approved" };
    case "rejected":
      return { kind: "", status: "rejected" };
    default:
      return { kind: "", status: "" };
  }
}

function viewDefaultKind(view: ApprovalView): ApprovalKind {
  if (view === "pending_khong_goi") return "khong_goi";
  if (view === "pending_tam_hoan") return "tam_hoan";
  return "goi";
}

function emptyMessageForView(view: ApprovalView): string {
  switch (view) {
    case "pending_goi":
      return "Chưa có hồ sơ chờ duyệt gọi. Vào Hồ sơ công dân → NVQS → chọn Dự kiến gọi.";
    case "pending_khong_goi":
      return "Chưa có đề xuất không gọi chờ đồng tình. Địa phương chọn Đề xuất không gọi và đính kèm minh chứng.";
    case "pending_tam_hoan":
      return "Chưa có hồ sơ tạm hoãn chờ duyệt. Địa phương chọn Tạm hoãn và tải giấy tạm hoãn.";
    case "approved":
      return "Chưa có hồ sơ đã duyệt trong phạm vi lọc.";
    case "rejected":
      return "Chưa có hồ sơ không đạt trong phạm vi lọc.";
    default:
      return "Chưa có hồ sơ xét duyệt trong phạm vi lọc.";
  }
}

export default function ApprovalPage() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [counts, setCounts] = useState<CountsState>({
    pending: 0,
    approved: 0,
    rejected: 0,
    pendingGoi: 0,
    pendingKhongGoi: 0,
    pendingTamHoan: 0,
  });
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ApprovalView>("pending_goi");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  const [toast, setToast] = useState<{
    message: string;
    tone: M3SnackbarTone;
  } | null>(null);
  const [viewCitizen, setViewCitizen] = useState<Citizen | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{
    ids: string[];
    labels: string[];
    kind: ApprovalKind;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const isQkSession =
    sessionLevel === "donvi" && isQuanKhuOrBtl(sessionUnitCode);
  const canDecide = sessionLevel === "bo" || isQkSession;
  const showProvinceFilter = sessionLevel === "bo" || isQkSession;
  const showWardFilter =
    (sessionLevel === "bo" && !!provinceCode) ||
    isQkSession ||
    sessionLevel === "tinh";

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const { kind, status } = viewToQuery(view);
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      if (status) q.set("status", status);
      if (kind) q.set("kind", kind);
      if (campaignId) q.set("campaignId", campaignId);
      if (unitCode) q.set("unitCode", unitCode);
      const res = await fetch(`/api/admin/approval?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.data || []);
        setCounts({
          pending: Number(data.counts?.pending || 0),
          approved: Number(data.counts?.approved || 0),
          rejected: Number(data.counts?.rejected || 0),
          pendingGoi: Number(data.counts?.pendingGoi || 0),
          pendingKhongGoi: Number(data.counts?.pendingKhongGoi || 0),
          pendingTamHoan: Number(data.counts?.pendingTamHoan || 0),
        });
        setSelectedIds(new Set());
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [search, view, campaignId, unitCode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, view, campaignId, unitCode]);

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
          setProvinces(
            ((json.items || []) as HierarchyUnit[]).filter(
              (i) => i.level === "tinh",
            ),
          );
        } else if (level === "tinh") {
          const res = await fetch(
            `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(code)}`,
          );
          const json = await res.json();
          setWards(
            ((json.items || []) as HierarchyUnit[]).filter(
              (i) => i.level === "xa",
            ),
          );
        } else if (level === "donvi" && isQuanKhuOrBtl(code)) {
          const res = await fetch(
            "/api/admin/hierarchy/children?parentCode=bo",
          );
          const json = res.ok ? await res.json() : { items: [] };
          let items = ((json.items || []) as HierarchyUnit[]).filter(
            (i) => i.level === "tinh",
          );

          if (items.length === 0) {
            const codes = new Set(getProvincesForMilitaryRegion(code));
            const unitsRes = await fetch("/api/auth/units");
            const allUnits = unitsRes.ok ? await unitsRes.json() : [];
            items = (
              Array.isArray(allUnits) ? (allUnits as HierarchyUnit[]) : []
            ).filter((i) => i.level === "tinh" && codes.has(String(i.code)));
          }

          setProvinces(items);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!showProvinceFilter) return;
    if (!provinceCode) {
      setWards([]);
      return;
    }
    fetch(
      `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(provinceCode)}`,
    )
      .then((res) => res.json())
      .then((data) =>
        setWards(
          ((data.items || []) as HierarchyUnit[]).filter((i) => i.level === "xa"),
        ),
      )
      .catch(() => setWards([]));
  }, [provinceCode, showProvinceFilter]);

  const handleProvinceChange = (value: string) => {
    setProvinceCode(value);
    setUnitCode(value);
  };

  const handleWardChange = (value: string) => {
    if (value) {
      setUnitCode(value);
      return;
    }
    if (showProvinceFilter) {
      setUnitCode(provinceCode);
      return;
    }
    setUnitCode(sessionLevel === "tinh" ? sessionUnitCode : "");
  };

  const postApproval = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Không thực hiện được");
    }
    return data as { message?: string; processed?: number };
  };

  const ensureCampaignForGoi = (kind: ApprovalKind) => {
    if (kind === "goi" && !campaignId) {
      setToast({
        message: "Vui lòng chọn đợt tuyển quân trước khi duyệt gọi",
        tone: "warning",
      });
      return false;
    }
    return true;
  };

  const resolveRowKind = (row: ApprovalRow): ApprovalKind =>
    row.kind || "goi";

  const handleApproveIds = async (ids: string[], kind: ApprovalKind) => {
    if (!ensureCampaignForGoi(kind) || ids.length === 0) return false;
    setBusy(true);
    try {
      const data = await postApproval({
        action: "approve",
        kind,
        campaignId,
        ids,
        ...(unitCode && { unitCode }),
      });
      setToast({
        message: data.message || `Đã duyệt ${ids.length} hồ sơ`,
        tone: "success",
      });
      await load({ silent: true });
      return true;
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Không thực hiện được",
        tone: "error",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleApproveAll = async () => {
    if (!ensureCampaignForGoi("goi")) return;
    setBusy(true);
    try {
      const data = await postApproval({
        action: "approve",
        kind: "goi",
        campaignId,
        approveAll: true,
        ...(unitCode && { unitCode }),
      });
      setToast({
        message: data.message || "Đã duyệt tất cả hồ sơ chờ gọi",
        tone: "success",
      });
      setApproveAllOpen(false);
      await load({ silent: true });
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Không thực hiện được",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const openReject = (
    ids: string[],
    labels: string[],
    kind: ApprovalKind,
  ) => {
    if (!ensureCampaignForGoi(kind) || ids.length === 0) return;
    setRejectReason("");
    setRejectDialog({ ids, labels, kind });
  };

  const confirmReject = async () => {
    if (!rejectDialog) return;
    const note = rejectReason.trim();
    if (!note) {
      setToast({
        message: "Vui lòng nhập nhận xét / lý do",
        tone: "warning",
      });
      return;
    }
    setBusy(true);
    try {
      const data = await postApproval({
        action: "reject",
        kind: rejectDialog.kind,
        campaignId,
        ids: rejectDialog.ids,
        note,
        ...(unitCode && { unitCode }),
      });
      setToast({
        message: data.message || "Đã xử lý",
        tone: "info",
      });
      setRejectDialog(null);
      setRejectReason("");
      if (viewCitizen && rejectDialog.ids.includes(viewCitizen.id)) {
        setViewCitizen(null);
      }
      await load({ silent: true });
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Không thực hiện được",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoadingId(id);
    try {
      const res = await fetch(`/api/admin/citizens/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setToast({
          message: data.error || "Không tải được hồ sơ",
          tone: "error",
        });
        return;
      }
      setViewCitizen(data as Citizen);
    } catch {
      setToast({ message: "Không tải được hồ sơ", tone: "error" });
    } finally {
      setDetailLoadingId(null);
    }
  };

  const totalCount = counts.pending + counts.approved + counts.rejected;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const pendingOnPage = useMemo(
    () => pagedRows.filter((r) => r.status === "pending"),
    [pagedRows],
  );
  const allPendingOnPageSelected =
    pendingOnPage.length > 0 &&
    pendingOnPage.every((r) => selectedIds.has(r.id));

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of pendingOnPage) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  };

  const selectedPending = useMemo(
    () => rows.filter((r) => r.status === "pending" && selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  const selectedKind: ApprovalKind =
    viewDefaultKind(view) ||
    (selectedPending[0] ? resolveRowKind(selectedPending[0]) : "goi");

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const viewTabs = [
    {
      value: "pending_goi",
      label: `Chờ duyệt gọi (${counts.pendingGoi.toLocaleString("vi-VN")})`,
    },
    {
      value: "pending_khong_goi",
      label: `Đề xuất không gọi (${counts.pendingKhongGoi.toLocaleString("vi-VN")})`,
    },
    {
      value: "pending_tam_hoan",
      label: `Tạm hoãn (${counts.pendingTamHoan.toLocaleString("vi-VN")})`,
    },
    {
      value: "approved",
      label: `Đã duyệt (${counts.approved.toLocaleString("vi-VN")})`,
    },
    {
      value: "rejected",
      label: `Không đạt (${counts.rejected.toLocaleString("vi-VN")})`,
    },
    {
      value: "all",
      label: `Tất cả (${totalCount.toLocaleString("vi-VN")})`,
    },
  ];

  const actionApproveLabel = (kind: ApprovalKind) =>
    kind === "goi"
      ? "Duyệt gọi"
      : kind === "khong_goi"
        ? "Đồng tình không gọi"
        : "Duyệt tạm hoãn";

  const actionRejectLabel = (kind: ApprovalKind) =>
    kind === "goi"
      ? "Không gọi"
      : kind === "khong_goi"
        ? "Không đồng tình"
        : "Hủy tạm hoãn";

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
      {showProvinceFilter && (
        <select
          className={`${ADMIN_SELECT_CLS} max-w-[200px]`}
          value={provinceCode}
          onChange={(e) => handleProvinceChange(e.target.value)}
          aria-label="Chọn tỉnh thành phố"
        >
          <option value="">Tất cả tỉnh / TP</option>
          {provinces.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      {showWardFilter && (sessionLevel === "tinh" || provinceCode) && (
        <select
          className={`${ADMIN_SELECT_CLS} max-w-[200px]`}
          value={
            unitCode && unitCode !== provinceCode && unitCode !== sessionUnitCode
              ? unitCode
              : ""
          }
          onChange={(e) => handleWardChange(e.target.value)}
          aria-label="Chọn xã phường"
        >
          <option value="">Tất cả xã / phường</option>
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
    <div className="space-y-5 pb-8">
      <AdminListHeader
        title="Xét duyệt danh sách"
        countLabel={
          totalCount > 0
            ? `${totalCount.toLocaleString("vi-VN")} hồ sơ`
            : undefined
        }
        filters={headerFilters}
        actions={
          canDecide ? (
            <div className="flex flex-wrap items-center gap-2">
              {selectedPending.length > 0 && (
                <>
                  <AdminPrimaryBtn
                    tone="green"
                    disabled={busy}
                    onClick={() =>
                      void handleApproveIds(
                        selectedPending.map((r) => r.id),
                        selectedKind,
                      )
                    }
                  >
                    <Check size={16} />
                    {actionApproveLabel(selectedKind)} ({selectedPending.length})
                  </AdminPrimaryBtn>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      openReject(
                        selectedPending.map((r) => r.id),
                        selectedPending.map((r) => r.fullName),
                        selectedKind,
                      )
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-red-600 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    <X size={16} />
                    {actionRejectLabel(selectedKind)}
                  </button>
                </>
              )}
              <AdminPrimaryBtn
                tone="blue"
                disabled={busy || counts.pendingGoi === 0}
                onClick={() => setApproveAllOpen(true)}
              >
                <CheckSquare size={16} />
                Duyệt tất cả gọi ({counts.pendingGoi})
              </AdminPrimaryBtn>
            </div>
          ) : undefined
        }
      />

      <AdminListShell
        page={page}
        totalPages={totalPages}
        loading={loading && rows.length === 0}
        tabs={
          <AdminStatusTabs
            tabs={viewTabs}
            value={view}
            onChange={(v) => {
              setView(v as ApprovalView);
              setPage(1);
            }}
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
            <th className={`${ADMIN_TH_CLS} w-10`}>
              {canDecide ? (
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-black/20"
                  checked={allPendingOnPageSelected}
                  disabled={pendingOnPage.length === 0}
                  onChange={(e) => toggleSelectPage(e.target.checked)}
                  aria-label="Chọn tất cả trên trang"
                />
              ) : null}
            </th>
            <th className={ADMIN_TH_CLS}>Họ và Tên</th>
            <th className={ADMIN_TH_CLS}>Đơn vị</th>
            <th className={ADMIN_TH_CLS}>Kết quả SK</th>
            <th className={ADMIN_TH_CLS}>Kết quả CT</th>
            <th className={ADMIN_TH_CLS}>Trạng thái duyệt</th>
            <th className={ADMIN_TH_CLS}>Ghi chú</th>
          </AdminTHead>
          <tbody>
            {loading && rows.length === 0 ? (
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
                  {emptyMessageForView(view)}
                </td>
              </tr>
            ) : (
              pagedRows.map((row, idx) => {
                const s = statusConfig[row.status];
                return (
                  <tr key={row.id} className={adminRowClass(idx)}>
                    <td className={ADMIN_TD_CLS}>
                      {canDecide && row.status === "pending" ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-black/20"
                          checked={selectedIds.has(row.id)}
                          onChange={(e) =>
                            toggleSelect(row.id, e.target.checked)
                          }
                          aria-label={`Chọn ${row.fullName}`}
                        />
                      ) : null}
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => void openDetail(row.id)}
                      >
                        <div className="text-[14px] font-bold text-m3-primary hover:underline">
                          {row.fullName}
                          {detailLoadingId === row.id ? "…" : ""}
                        </div>
                        <div className="mt-0.5 font-mono text-[12px] text-m3-on-surface-variant">
                          {row.cccd}
                        </div>
                        <div className="mt-0.5 text-[12px] text-m3-on-surface-variant">
                          Sinh:{" "}
                          {new Date(row.dateOfBirth).toLocaleDateString("vi-VN")}
                        </div>
                      </button>
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
                      <AdminPill
                        label={
                          row.status === "pending"
                            ? row.kind === "khong_goi"
                              ? "Chờ đồng tình"
                              : row.kind === "tam_hoan"
                                ? "Chờ duyệt hoãn"
                                : "Chờ duyệt gọi"
                            : row.status === "approved"
                              ? row.kind === "khong_goi"
                                ? "Đã đồng tình"
                                : row.kind === "tam_hoan"
                                  ? "Đã duyệt hoãn"
                                  : "Đã duyệt gọi"
                              : s.label
                        }
                        bg={s.bg}
                        color={s.color}
                      />
                    </td>
                    <td className={`relative ${ADMIN_TD_CLS}`}>
                      <span
                        className="block max-w-[200px] truncate text-[13px] text-m3-on-surface-variant"
                        title={row.note || undefined}
                      >
                        {row.note || "—"}
                      </span>
                      <AdminHoverActions>
                        <AdminIconBtn
                          title="Xem chi tiết hồ sơ"
                          disabled={detailLoadingId === row.id}
                          onClick={() => void openDetail(row.id)}
                        >
                          <Eye size={15} />
                        </AdminIconBtn>
                        {canDecide && row.status === "pending" && (
                          <>
                            <AdminIconBtn
                              title={actionApproveLabel(resolveRowKind(row))}
                              tone="green"
                              disabled={busy}
                              onClick={() =>
                                void handleApproveIds(
                                  [row.id],
                                  resolveRowKind(row),
                                )
                              }
                            >
                              <Check size={15} />
                            </AdminIconBtn>
                            <AdminIconBtn
                              title={actionRejectLabel(resolveRowKind(row))}
                              tone="red"
                              disabled={busy}
                              onClick={() =>
                                openReject(
                                  [row.id],
                                  [row.fullName],
                                  resolveRowKind(row),
                                )
                              }
                            >
                              <X size={15} />
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

      <CitizenDetailModal
        citizen={viewCitizen}
        initialTab="nvqs"
        approvalReview
        approvalCampaignId={campaignId}
        onClose={() => setViewCitizen(null)}
        onCitizenUpdated={(updated) => setViewCitizen(updated)}
        onApprovalDecision={async (action) => {
          if (!viewCitizen) return;
          const row = rows.find((r) => r.id === viewCitizen.id);
          const kind = row ? resolveRowKind(row) : "goi";
          if (action === "reject") {
            openReject([viewCitizen.id], [viewCitizen.fullName], kind);
            return;
          }
          const ok = await handleApproveIds([viewCitizen.id], kind);
          if (ok) setViewCitizen(null);
        }}
      />

      <M3ConfirmDialog
        open={approveAllOpen}
        title="Duyệt tất cả hồ sơ chờ gọi?"
        description={`Sẽ duyệt gọi ${counts.pendingGoi.toLocaleString("vi-VN")} hồ sơ dự kiến gọi đang chờ trong phạm vi lọc hiện tại.`}
        confirmLabel={busy ? "Đang duyệt..." : "Duyệt tất cả gọi"}
        cancelLabel="Hủy"
        tone="success"
        busy={busy}
        onConfirm={() => void handleApproveAll()}
        onCancel={() => {
          if (!busy) setApproveAllOpen(false);
        }}
      />

      {rejectDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-[18px] font-bold text-m3-on-surface">
              {rejectDialog.kind === "goi"
                ? "Không duyệt gọi — lý do"
                : rejectDialog.kind === "khong_goi"
                  ? "Không đồng tình đề xuất không gọi"
                  : "Hủy tạm hoãn — nhận xét"}
            </h3>
            <p className="mt-2 text-[13px] text-m3-on-surface-variant">
              {rejectDialog.kind === "goi"
                ? rejectDialog.ids.length === 1
                  ? `Đánh không gọi “${rejectDialog.labels[0]}”.`
                  : `Đánh không gọi ${rejectDialog.ids.length} hồ sơ.`
                : `${rejectDialog.ids.length === 1 ? `“${rejectDialog.labels[0]}”` : `${rejectDialog.ids.length} hồ sơ`} sẽ chuyển về Chưa xác định, khóa hồ sơ và thông báo tỉnh/xã bổ sung minh chứng rồi gửi duyệt lại.`}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-semibold text-m3-on-surface-variant">
                Nhận xét / lý do *
              </span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Nhập lý do Quân khu không chấp nhận / yêu cầu bổ sung..."
                className="w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-[14px] outline-none focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/15"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRejectDialog(null);
                  setRejectReason("");
                }}
                className="rounded-xl border border-black/[0.08] px-4 py-2.5 text-[14px] font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || !rejectReason.trim()}
                onClick={() => void confirmReject()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      <M3Snackbar
        open={!!toast}
        message={toast?.message || ""}
        tone={toast?.tone || "info"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
