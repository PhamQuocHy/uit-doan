"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckSquare, Eye, Send, Sparkles, X } from "lucide-react";
import type { ApprovalKind, ApprovalRow } from "@/lib/enlistment-approval";
import { RETURN_TAM_HOAN_MARKER } from "@/lib/enlistment-approval";
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
import SearchableSelect from "@/components/ui/SearchableSelect";

type CampaignOption = { id: string; name: string; year: number };

const AI_SUGGEST_BATCH_MAX = 20;

type AiSuggestRow = {
  citizenId: string;
  action: "approve" | "reject";
  kind?: ApprovalKind;
  confidence: number;
  draftNote: string;
  reasons: string[];
  warnings: string[];
  label: string;
  source: string;
};

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
    label: "Không gọi",
    color: "var(--m3-error, #ba1a1a)",
    bg: "var(--m3-error-container, #ffdad6)",
  },
  returned: {
    label: "Không duyệt không gọi",
    color: "var(--m3-error, #ba1a1a)",
    bg: "var(--m3-error-container, #ffdad6)",
  },
  returned_tam_hoan: {
    label: "Không duyệt tạm hoãn",
    color: "var(--m3-error, #ba1a1a)",
    bg: "var(--m3-error-container, #ffdad6)",
  },
};

const TABLE_COLS = 8;

type CountsState = {
  pending: number;
  approved: number;
  rejected: number;
  khongDongY: number;
  khongDuyetTamHoan: number;
  khongGoi: number;
  pendingGoi: number;
  pendingKhongGoi: number;
  pendingTamHoan: number;
  localReady: number;
  provincePending: number;
  provinceOk: number;
  provinceReturned: number;
  qkPending: number;
};

/** Một hàng tab = một việc QK cần làm (không chồng 2 bộ lọc). */
type ApprovalView =
  | "pending_goi"
  | "pending_khong_goi"
  | "pending_tam_hoan"
  | "approved"
  | "khong_dong_y"
  | "khong_duyet_tam_hoan"
  | "khong_goi"
  | "all"
  | "local_ready"
  | "province_pending"
  | "province_ok"
  | "province_returned"
  | "qk_sent";

function viewToQuery(
  view: ApprovalView,
  role: "xa" | "tinh" | "qk" = "qk",
): {
  kind: ApprovalKind | "";
  status: string;
  pipeline: string;
} {
  const localPendingPipe =
    role === "tinh" ? "province_pending" : role === "xa" ? "local_ready" : "";

  switch (view) {
    case "pending_goi":
      return {
        kind: "goi",
        status: role === "qk" ? "pending" : "",
        pipeline: localPendingPipe,
      };
    case "pending_khong_goi":
      return {
        kind: "khong_goi",
        status: role === "qk" ? "pending" : "",
        pipeline: localPendingPipe,
      };
    case "pending_tam_hoan":
      return {
        kind: "tam_hoan",
        status: role === "qk" ? "pending" : "",
        pipeline: localPendingPipe,
      };
    case "approved":
      return { kind: "", status: "approved", pipeline: "" };
    case "khong_dong_y":
      return { kind: "", status: "khong_dong_y", pipeline: "" };
    case "khong_duyet_tam_hoan":
      return { kind: "", status: "khong_duyet_tam_hoan", pipeline: "" };
    case "khong_goi":
      return { kind: "", status: "khong_goi", pipeline: "" };
    case "local_ready":
      return { kind: "", status: "", pipeline: "local_ready" };
    case "province_pending":
      return { kind: "", status: "", pipeline: "province_pending" };
    case "province_ok":
      return { kind: "", status: "", pipeline: "province_ok" };
    case "province_returned":
      return { kind: "", status: "", pipeline: "province_returned" };
    case "qk_sent":
      return { kind: "", status: "", pipeline: "qk_pending" };
    default:
      return { kind: "", status: "", pipeline: "" };
  }
}

function viewDefaultKind(view: ApprovalView): ApprovalKind {
  if (view === "pending_khong_goi") return "khong_goi";
  if (view === "pending_tam_hoan") return "tam_hoan";
  return "goi";
}

function emptyMessageForView(view: ApprovalView, role?: string): string {
  switch (view) {
    case "pending_goi":
      return role === "tinh"
        ? "Chưa có hồ sơ dự kiến gọi chờ tỉnh đồng tình."
        : role === "xa"
          ? "Chưa có hồ sơ dự kiến gọi chờ gửi tỉnh."
          : "Chưa có hồ sơ chờ duyệt gọi. Vào Hồ sơ công dân → NVQS → chọn Dự kiến gọi.";
    case "pending_khong_goi":
      return role === "tinh"
        ? "Chưa có đề xuất không gọi chờ tỉnh đồng tình."
        : role === "xa"
          ? "Chưa có đề xuất không gọi chờ gửi tỉnh."
          : "Chưa có đề xuất không gọi chờ đồng tình. Địa phương chọn Đề xuất không gọi và đính kèm minh chứng.";
    case "pending_tam_hoan":
      return role === "tinh"
        ? "Chưa có hồ sơ tạm hoãn chờ tỉnh đồng tình."
        : role === "xa"
          ? "Chưa có hồ sơ tạm hoãn chờ gửi tỉnh."
          : "Chưa có hồ sơ tạm hoãn chờ duyệt. Địa phương chọn Tạm hoãn và tải giấy tạm hoãn.";
    case "approved":
      return "Chưa có hồ sơ đã duyệt trong phạm vi lọc.";
    case "khong_dong_y":
      return "Chưa có hồ sơ không duyệt không gọi trong phạm vi lọc.";
    case "khong_duyet_tam_hoan":
      return "Chưa có hồ sơ không duyệt tạm hoãn trong phạm vi lọc.";
    case "khong_goi":
      return "Chưa có hồ sơ không duyệt gọi trong phạm vi lọc.";
    case "local_ready":
      return "Chưa có hồ sơ chờ gửi tỉnh. Lưu NVQS (dự kiến gọi / không gọi / tạm hoãn) rồi gửi lên.";
    case "province_pending":
      return "Chưa có hồ sơ chờ tỉnh đồng tình.";
    case "province_ok":
      return "Chưa có hồ sơ tỉnh đã đồng tình.";
    case "province_returned":
      return "Không có hồ sơ tỉnh trả về.";
    case "qk_sent":
      return "Chưa có hồ sơ đã gửi Quân khu.";
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
    khongDongY: 0,
    khongDuyetTamHoan: 0,
    khongGoi: 0,
    pendingGoi: 0,
    pendingKhongGoi: 0,
    pendingTamHoan: 0,
    localReady: 0,
    provincePending: 0,
    provinceOk: 0,
    provinceReturned: 0,
    qkPending: 0,
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
  const [provinceReturnDialog, setProvinceReturnDialog] = useState<{
    ids: string[];
    labels: string[];
  } | null>(null);
  const [provinceReturnReason, setProvinceReturnReason] = useState("");
  const [aiSuggestBusy, setAiSuggestBusy] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<
    Record<string, AiSuggestRow>
  >({});

  const isQkSession =
    sessionLevel === "donvi" && isQuanKhuOrBtl(sessionUnitCode);
  const isLocalRole = sessionLevel === "xa" || sessionLevel === "tinh";
  const canDecide = sessionLevel === "bo" || isQkSession;
  const canXaForward = sessionLevel === "xa";
  const canTinhForward = sessionLevel === "tinh" || sessionLevel === "bo";
  const showProvinceFilter = sessionLevel === "bo" || isQkSession;
  const showWardFilter =
    (sessionLevel === "bo" && !!provinceCode) ||
    isQkSession ||
    sessionLevel === "tinh";

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!sessionLevel) {
      if (!opts?.silent) setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const role =
        sessionLevel === "xa"
          ? "xa"
          : sessionLevel === "tinh"
            ? "tinh"
            : "qk";
      const { kind, status, pipeline } = viewToQuery(view, role);
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      if (status) q.set("status", status);
      if (kind) q.set("kind", kind);
      if (pipeline) q.set("pipeline", pipeline);
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
          khongDongY: Number(data.counts?.khongDongY || 0),
          khongDuyetTamHoan: Number(data.counts?.khongDuyetTamHoan || 0),
          khongGoi: Number(data.counts?.khongGoi || 0),
          pendingGoi: Number(data.counts?.pendingGoi || 0),
          pendingKhongGoi: Number(data.counts?.pendingKhongGoi || 0),
          pendingTamHoan: Number(data.counts?.pendingTamHoan || 0),
          localReady: Number(data.counts?.localReady || 0),
          provincePending: Number(data.counts?.provincePending || 0),
          provinceOk: Number(data.counts?.provinceOk || 0),
          provinceReturned: Number(data.counts?.provinceReturned || 0),
          qkPending: Number(data.counts?.qkPending || 0),
        });
        setSelectedIds(new Set());
        if (!opts?.silent) setAiSuggestions({});
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [search, view, campaignId, unitCode, sessionLevel]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setAiSuggestions({});
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
        if (level === "xa") setView("pending_goi");
        else if (level === "tinh") setView("pending_goi");
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

  const pendingStatusStyle = (kind: ApprovalKind) => {
    if (kind === "khong_goi") {
      return {
        color: "#9a3412",
        bg: "#ffedd5",
      };
    }
    if (kind === "tam_hoan") {
      return {
        color: "var(--m3-primary, #1a73e8)",
        bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 14%, white)",
      };
    }
    return {
      color: "var(--color-m3-warning)",
      bg: "var(--color-m3-warning-container)",
    };
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

  const totalCount = isLocalRole
    ? counts.localReady +
      counts.provincePending +
      counts.provinceOk +
      counts.provinceReturned +
      counts.qkPending
    : counts.pending +
      counts.approved +
      counts.khongDongY +
      counts.khongDuyetTamHoan +
      counts.khongGoi;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const pendingOnPage = useMemo(
    () =>
      sessionLevel === "xa"
        ? pagedRows.filter(
            (r) =>
              r.pipelineStatus === "local_ready" ||
              r.pipelineStatus === "province_returned",
          )
        : sessionLevel === "tinh"
          ? pagedRows.filter(
              (r) =>
                r.pipelineStatus === "province_pending" ||
                r.pipelineStatus === "province_ok",
            )
          : pagedRows.filter((r) => r.status === "pending"),
    [pagedRows, sessionLevel],
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

  const isPendingView =
    view === "pending_goi" ||
    view === "pending_khong_goi" ||
    view === "pending_tam_hoan";

  const requestAiSuggestBatch = async () => {
    if ((!canDecide && !canTinhForward) || aiSuggestBusy) return;
    const targets = pendingOnPage.length
      ? pendingOnPage.filter((r) =>
          canDecide
            ? r.status === "pending"
            : r.pipelineStatus === "province_pending",
        )
      : rows
          .filter((r) =>
            canDecide
              ? r.status === "pending"
              : r.pipelineStatus === "province_pending",
          )
          .slice(0, AI_SUGGEST_BATCH_MAX);
    if (targets.length === 0) {
      setToast({
        message: "Không có hồ sơ chờ để gợi ý",
        tone: "warning",
      });
      return;
    }
    setAiSuggestBusy(true);
    try {
      const kind = viewDefaultKind(view);
      const ids = targets
        .map((r) => r.id)
        .slice(0, AI_SUGGEST_BATCH_MAX);
      const res = await fetch("/api/admin/ai/approval-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenIds: ids,
          mode: canDecide ? "qk" : "local",
          kind,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không tạo được gợi ý AI");
      }
      const next: Record<string, AiSuggestRow> = { ...aiSuggestions };
      for (const item of data.items || []) {
        if (!item?.citizenId || !item?.action) continue;
        next[item.citizenId] = {
          citizenId: item.citizenId,
          action: item.action === "reject" ? "reject" : "approve",
          kind: item.kind || kind,
          confidence: Number(item.confidence) || 0,
          draftNote: String(item.draftNote || ""),
          reasons: Array.isArray(item.reasons) ? item.reasons.map(String) : [],
          warnings: Array.isArray(item.warnings)
            ? item.warnings.map(String)
            : [],
          label: String(item.label || item.action),
          source: String(item.source || "rules"),
        };
      }
      setAiSuggestions(next);
      setToast({
        message: `Đã gợi ý AI cho ${(data.items || []).length} hồ sơ`,
        tone: "success",
      });
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Không tạo được gợi ý AI",
        tone: "error",
      });
    } finally {
      setAiSuggestBusy(false);
    }
  };

  const applyAiSuggestSelected = async () => {
    const withSuggest = selectedPending.filter((r) => aiSuggestions[r.id]);
    if (withSuggest.length === 0) {
      setToast({
        message: "Chọn hồ sơ đã có gợi ý AI (bấm Gợi ý AI trước)",
        tone: "warning",
      });
      return;
    }
    const toApprove = withSuggest.filter(
      (r) => aiSuggestions[r.id]?.action === "approve",
    );
    const toReject = withSuggest.filter(
      (r) => aiSuggestions[r.id]?.action === "reject",
    );

    if (toApprove.length > 0) {
      const kind =
        aiSuggestions[toApprove[0].id]?.kind ||
        resolveRowKind(toApprove[0]);
      const ok = await handleApproveIds(
        toApprove.map((r) => r.id),
        kind,
      );
      if (!ok) return;
    }

    if (toReject.length > 0) {
      const kind =
        aiSuggestions[toReject[0].id]?.kind || resolveRowKind(toReject[0]);
      const notes = toReject
        .map((r) => aiSuggestions[r.id]?.draftNote?.trim())
        .filter(Boolean);
      const uniqueNotes = [...new Set(notes)];
      openReject(
        toReject.map((r) => r.id),
        toReject.map((r) => r.fullName),
        kind,
      );
      setRejectReason(
        uniqueNotes.length === 1
          ? uniqueNotes[0]
          : uniqueNotes.join("\n---\n") || "",
      );
    }
  };

  const postForward = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/approval/forward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Không thực hiện được");
    return data as { message?: string; processed?: number };
  };

  const handleForward = async (
    action: string,
    ids: string[],
    note?: string,
  ) => {
    if (
      ids.length === 0 &&
      action !== "province_approve_all" &&
      action !== "xa_send_province"
    )
      return;
    setBusy(true);
    try {
      const data = await postForward({
        action,
        ids,
        note,
        campaignId,
        ...(unitCode && { unitCode }),
        ...(action === "province_approve_all" && {
          kind: viewDefaultKind(view),
        }),
      });
      setToast({
        message: data.message || "Đã xử lý",
        tone: "success",
      });
      setSelectedIds(new Set());
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

  const confirmProvinceReturn = async () => {
    if (!provinceReturnDialog) return;
    const note = provinceReturnReason.trim();
    if (!note) {
      setToast({
        message: "Vui lòng nhập lý do trả về (cần bổ sung gì)",
        tone: "warning",
      });
      return;
    }
    setBusy(true);
    try {
      await postForward({
        action: "province_return",
        ids: provinceReturnDialog.ids,
        note,
        ...(unitCode && { unitCode }),
      });
      setToast({ message: "Đã trả về xã bổ sung", tone: "info" });
      setProvinceReturnDialog(null);
      setProvinceReturnReason("");
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

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const viewTabs = isLocalRole
    ? sessionLevel === "xa"
      ? [
          {
            value: "pending_goi",
            label: `Chờ gửi gọi (${counts.pendingGoi.toLocaleString("vi-VN")})`,
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
            value: "province_returned",
            label: `Tỉnh trả về (${counts.provinceReturned.toLocaleString("vi-VN")})`,
          },
          {
            value: "province_pending",
            label: `Đã gửi tỉnh (${counts.provincePending.toLocaleString("vi-VN")})`,
          },
          {
            value: "province_ok",
            label: `Tỉnh đồng tình (${counts.provinceOk.toLocaleString("vi-VN")})`,
          },
          {
            value: "qk_sent",
            label: `Đã lên QK (${counts.qkPending.toLocaleString("vi-VN")})`,
          },
        ]
      : [
          {
            value: "pending_goi",
            label: `Chờ đồng tình gọi (${counts.pendingGoi.toLocaleString("vi-VN")})`,
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
            value: "province_ok",
            label: `Đã đồng tình (${counts.provinceOk.toLocaleString("vi-VN")})`,
          },
          {
            value: "province_returned",
            label: `Đã trả về (${counts.provinceReturned.toLocaleString("vi-VN")})`,
          },
          {
            value: "qk_sent",
            label: `Đã gửi QK (${counts.qkPending.toLocaleString("vi-VN")})`,
          },
          {
            value: "local_ready",
            label: `Chờ xã gửi (${counts.localReady.toLocaleString("vi-VN")})`,
          },
          {
            value: "all",
            label: `Tất cả (${totalCount.toLocaleString("vi-VN")})`,
          },
        ]
    : [
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
      value: "khong_dong_y",
      label: `Không duyệt không gọi (${counts.khongDongY.toLocaleString("vi-VN")})`,
    },
    {
      value: "khong_duyet_tam_hoan",
      label: `Không duyệt tạm hoãn (${counts.khongDuyetTamHoan.toLocaleString("vi-VN")})`,
    },
    {
      value: "khong_goi",
      label: `Không gọi (${counts.khongGoi.toLocaleString("vi-VN")})`,
    },
    {
      value: "all",
      label: `Tất cả (${totalCount.toLocaleString("vi-VN")})`,
    },
  ];

  const selectedForwardable = useMemo(() => {
    return rows.filter((r) => selectedIds.has(r.id));
  }, [rows, selectedIds]);

  const selectedLocalReady = selectedForwardable.filter(
    (r) =>
      r.pipelineStatus === "local_ready" ||
      r.pipelineStatus === "province_returned",
  );
  const selectedProvincePending = selectedForwardable.filter(
    (r) => r.pipelineStatus === "province_pending",
  );
  const selectedProvinceOk = selectedForwardable.filter(
    (r) => r.pipelineStatus === "province_ok",
  );

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
        ? "Không duyệt không gọi"
        : "Không duyệt tạm hoãn";

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
        <SearchableSelect
          variant="compact"
          className="max-w-[220px] min-w-[180px]"
          value={provinceCode}
          onChange={handleProvinceChange}
          ariaLabel="Chọn tỉnh thành phố"
          placeholder="Tất cả tỉnh / TP"
          options={[
            { value: "", label: "Tất cả tỉnh / TP" },
            ...provinces.map((item) => ({
              value: item.code,
              label: item.name,
            })),
          ]}
        />
      )}
      {showWardFilter && (sessionLevel === "tinh" || provinceCode) && (
        <SearchableSelect
          variant="compact"
          className="max-w-[220px] min-w-[160px]"
          value={
            unitCode && unitCode !== provinceCode && unitCode !== sessionUnitCode
              ? unitCode
              : ""
          }
          onChange={handleWardChange}
          ariaLabel="Chọn xã phường"
          placeholder="Tất cả xã / phường"
          options={[
            { value: "", label: "Tất cả xã / phường" },
            ...wards.map((item) => ({
              value: item.code,
              label: item.name,
            })),
          ]}
        />
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
          <div className="flex flex-wrap items-center gap-2">
            {canXaForward && counts.localReady > 0 && (
              <AdminPrimaryBtn
                tone="blue"
                disabled={busy}
                onClick={() => void handleForward("xa_send_province", [])}
              >
                <Send size={16} />
                Gửi về Tỉnh ({counts.localReady.toLocaleString("vi-VN")})
              </AdminPrimaryBtn>
            )}
            {canTinhForward && isPendingView && (
              <AdminPrimaryBtn
                tone="green"
                disabled={
                  busy ||
                  (view === "pending_goi"
                    ? counts.pendingGoi === 0
                    : view === "pending_khong_goi"
                      ? counts.pendingKhongGoi === 0
                      : counts.pendingTamHoan === 0)
                }
                onClick={() => void handleForward("province_approve_all", [])}
              >
                <CheckSquare size={16} />
                Đồng tình toàn bộ (
                {view === "pending_goi"
                  ? counts.pendingGoi
                  : view === "pending_khong_goi"
                    ? counts.pendingKhongGoi
                    : counts.pendingTamHoan}
                )
              </AdminPrimaryBtn>
            )}
            {canTinhForward && view === "province_ok" && (
              <AdminPrimaryBtn
                tone="blue"
                disabled={busy || counts.provinceOk === 0}
                onClick={() =>
                  void handleForward(
                    "province_send_qk",
                    rows
                      .filter((r) => r.pipelineStatus === "province_ok")
                      .map((r) => r.id),
                  )
                }
              >
                <Send size={16} />
                Gửi Quân khu ({counts.provinceOk})
              </AdminPrimaryBtn>
            )}
            {(canDecide || canTinhForward) && isPendingView && (
              <AdminPrimaryBtn
                tone="blue"
                disabled={aiSuggestBusy || busy || pendingOnPage.length === 0}
                onClick={() => void requestAiSuggestBatch()}
              >
                <Sparkles size={16} />
                {aiSuggestBusy
                  ? "Đang gợi ý…"
                  : `Gợi ý AI (${pendingOnPage.length})`}
              </AdminPrimaryBtn>
            )}
            {canDecide && (view === "pending_goi" || view === "all") && (
              <AdminPrimaryBtn
                tone="green"
                disabled={busy || counts.pendingGoi === 0}
                onClick={() => setApproveAllOpen(true)}
              >
                <CheckSquare size={16} />
                Duyệt tất cả gọi
                {counts.pendingGoi > 0
                  ? ` (${counts.pendingGoi.toLocaleString("vi-VN")})`
                  : ""}
              </AdminPrimaryBtn>
            )}
          </div>
        }
      />

      {canXaForward && selectedLocalReady.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-[min(100%,920px)] flex-nowrap items-center justify-center gap-2 overflow-x-auto rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
            <span className="shrink-0 text-[13px] font-semibold">
              Đã chọn {selectedLocalReady.length}
            </span>
            <AdminPrimaryBtn
              tone="blue"
              disabled={busy}
              onClick={() =>
                void handleForward(
                  "xa_send_province",
                  selectedLocalReady.map((r) => r.id),
                )
              }
            >
              <Send size={16} />
              {view === "province_returned"
                ? "Đẩy lại tỉnh"
                : "Gửi về Tỉnh"}
            </AdminPrimaryBtn>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex h-10 items-center rounded-full border border-black/[0.08] px-3.5 text-[13px] font-semibold"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {canTinhForward && selectedProvincePending.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-[min(100%,920px)] flex-nowrap items-center justify-center gap-2 overflow-x-auto rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
            <span className="shrink-0 text-[13px] font-semibold">
              Đã chọn {selectedProvincePending.length}
            </span>
            <AdminPrimaryBtn
              tone="green"
              disabled={busy}
              onClick={() =>
                void handleForward(
                  "province_approve",
                  selectedProvincePending.map((r) => r.id),
                )
              }
            >
              <Check size={16} />
              Đồng tình
            </AdminPrimaryBtn>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setProvinceReturnDialog({
                  ids: selectedProvincePending.map((r) => r.id),
                  labels: selectedProvincePending.map((r) => r.fullName),
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-full bg-red-600 px-4 text-[13px] font-bold text-white"
            >
              <X size={16} />
              Trả về bổ sung
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex h-10 items-center rounded-full border border-black/[0.08] px-3.5 text-[13px] font-semibold"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {canTinhForward && selectedProvinceOk.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-[min(100%,920px)] flex-nowrap items-center justify-center gap-2 overflow-x-auto rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
            <span className="shrink-0 text-[13px] font-semibold">
              Đã chọn {selectedProvinceOk.length}
            </span>
            <AdminPrimaryBtn
              tone="blue"
              disabled={busy}
              onClick={() =>
                void handleForward(
                  "province_send_qk",
                  selectedProvinceOk.map((r) => r.id),
                )
              }
            >
              <Send size={16} />
              Gửi Quân khu
            </AdminPrimaryBtn>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex h-10 items-center rounded-full border border-black/[0.08] px-3.5 text-[13px] font-semibold"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {canDecide && selectedPending.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
          <div
            role="dialog"
            aria-label="Thao tác hồ sơ đã chọn"
            className="pointer-events-auto flex max-w-[min(100%,920px)] flex-nowrap items-center justify-center gap-2 overflow-x-auto rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
          >
            <span className="shrink-0 text-[13px] font-semibold text-m3-on-surface">
              Đã chọn {selectedPending.length.toLocaleString("vi-VN")}
            </span>
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
              {actionApproveLabel(selectedKind)}
            </AdminPrimaryBtn>
            <button
              type="button"
              disabled={busy || aiSuggestBusy}
              onClick={() => void applyAiSuggestSelected()}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-m3-primary/30 bg-m3-primary-container px-4 text-[13px] font-bold text-m3-on-primary-container hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles size={16} />
              Áp dụng gợi ý
            </button>
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
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex h-10 items-center rounded-full border border-black/[0.08] bg-white px-3.5 text-[13px] font-semibold text-m3-on-surface-variant hover:bg-m3-surface-high disabled:opacity-50"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

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
              {canDecide || canXaForward || canTinhForward ? (
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
            <th className={ADMIN_TH_CLS}>Đạt SK</th>
            <th className={ADMIN_TH_CLS}>Trạng thái duyệt</th>
            <th className={ADMIN_TH_CLS}>AI gợi ý</th>
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
                  {emptyMessageForView(view, sessionLevel)}
                </td>
              </tr>
            ) : (
              pagedRows.map((row, idx) => {
                const s = statusConfig[row.status];
                return (
                  <tr key={row.id} className={adminRowClass(idx)}>
                    <td className={ADMIN_TD_CLS}>
                      {(canDecide && row.status === "pending") ||
                      (canXaForward &&
                        (row.pipelineStatus === "local_ready" ||
                          row.pipelineStatus === "province_returned")) ||
                      (canTinhForward &&
                        (row.pipelineStatus === "province_pending" ||
                          row.pipelineStatus === "province_ok")) ? (
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
                        bg={
                          row.politicalResult === "Đạt"
                            ? "var(--color-m3-success-container)"
                            : row.politicalResult === "Không đạt"
                              ? "var(--m3-error-container, #ffdad6)"
                              : "var(--m3-surface-container, #eef0f2)"
                        }
                        color={
                          row.politicalResult === "Đạt"
                            ? "var(--color-m3-success)"
                            : row.politicalResult === "Không đạt"
                              ? "var(--m3-error, #ba1a1a)"
                              : "var(--m3-on-surface-variant, #5a5f6e)"
                        }
                      />
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      {(() => {
                        if (isLocalRole && row.pipelineStatus) {
                          const pipeLabel =
                            row.pipelineStatus === "local_ready"
                              ? "Chờ gửi tỉnh"
                              : row.pipelineStatus === "province_pending"
                                ? sessionLevel === "tinh"
                                  ? "Chờ đồng tình"
                                  : "Đã gửi tỉnh"
                                : row.pipelineStatus === "province_ok"
                                  ? "Tỉnh đồng tình"
                                  : row.pipelineStatus === "province_returned"
                                    ? "Tỉnh trả về"
                                    : row.pipelineStatus === "qk_pending"
                                      ? "Đã lên QK"
                                      : "—";
                          const pipeColor =
                            row.pipelineStatus === "province_returned"
                              ? {
                                  color: "var(--m3-error, #ba1a1a)",
                                  bg: "var(--m3-error-container, #ffdad6)",
                                }
                              : row.pipelineStatus === "province_ok" ||
                                  row.pipelineStatus === "qk_pending"
                                ? {
                                    color: "var(--color-m3-success)",
                                    bg: "var(--color-m3-success-container)",
                                  }
                                : {
                                    color: "var(--color-m3-warning)",
                                    bg: "var(--color-m3-warning-container)",
                                  };
                          return (
                            <AdminPill
                              label={pipeLabel}
                              bg={pipeColor.bg}
                              color={pipeColor.color}
                            />
                          );
                        }
                        const pendingStyle =
                          row.status === "pending"
                            ? pendingStatusStyle(row.kind)
                            : null;
                        const pillBg = pendingStyle?.bg ?? s.bg;
                        const pillColor = pendingStyle?.color ?? s.color;
                        return (
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
                                  : row.status === "returned"
                                    ? "Không duyệt không gọi"
                                    : row.status === "returned_tam_hoan"
                                      ? "Không duyệt tạm hoãn"
                                      : row.callIntent === "khong_goi"
                                        ? "Không gọi"
                                        : s.label
                            }
                            bg={pillBg}
                            color={pillColor}
                          />
                        );
                      })()}
                    </td>
                    <td className={`${ADMIN_TD_CLS} min-w-[200px] max-w-[280px]`}>
                      {(() => {
                        const ai = aiSuggestions[row.id];
                        if (!ai) {
                          return (
                            <span className="text-[13px] text-m3-outline">
                              —
                            </span>
                          );
                        }
                        return (
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex w-fit max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                ai.action === "approve"
                                  ? "bg-m3-success-container text-m3-on-success-container"
                                  : "bg-m3-error-container text-m3-on-error-container"
                              }`}
                            >
                              <Sparkles size={11} />
                              {ai.label} ({Math.round(ai.confidence * 100)}%)
                            </span>
                            {ai.reasons.length > 0 && (
                              <ul className="list-disc space-y-0.5 pl-3.5 text-[12px] leading-snug text-m3-on-surface">
                                {ai.reasons.slice(0, 3).map((r) => (
                                  <li key={r}>{r}</li>
                                ))}
                              </ul>
                            )}
                            {ai.warnings.length > 0 && (
                              <p
                                className="text-[11px] leading-snug text-m3-warning"
                                title={ai.warnings.join("\n")}
                              >
                                ⚠ {ai.warnings[0]}
                                {ai.warnings.length > 1
                                  ? ` (+${ai.warnings.length - 1})`
                                  : ""}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className={`relative ${ADMIN_TD_CLS}`}>
                      <span
                        className="block max-w-[200px] truncate text-[13px] text-m3-on-surface-variant"
                        title={
                          row.provinceComment ||
                          row.approvalComment ||
                          (row.note && row.note !== RETURN_TAM_HOAN_MARKER
                            ? row.note
                            : undefined)
                        }
                      >
                        {row.provinceComment ||
                          row.approvalComment ||
                          (row.note && row.note !== RETURN_TAM_HOAN_MARKER
                            ? row.note
                            : "—")}
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

      {/* Dialog từ chối đề xuất / không duyệt gọi */}
      {rejectDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-[18px] font-bold text-m3-on-surface">
              {rejectDialog.kind === "goi"
                ? "Không duyệt gọi — lý do"
                : rejectDialog.kind === "khong_goi"
                  ? "Không duyệt không gọi — lý do"
                  : "Không duyệt tạm hoãn — lý do"}
            </h3>
            <p className="mt-2 text-[13px] text-m3-on-surface-variant">
              {rejectDialog.kind === "goi"
                ? rejectDialog.ids.length === 1
                  ? `Đánh không gọi “${rejectDialog.labels[0]}”.`
                  : `Đánh không gọi ${rejectDialog.ids.length} hồ sơ.`
                : `${rejectDialog.ids.length === 1 ? `“${rejectDialog.labels[0]}”` : `${rejectDialog.ids.length} hồ sơ`} sẽ chuyển về Hồ sơ mới, khóa hồ sơ và thông báo tỉnh/xã bổ sung minh chứng rồi gửi duyệt lại.`}
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

      {provinceReturnDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-[18px] font-bold text-m3-on-surface">
              Trả về xã — cập nhật bổ sung
            </h3>
            <p className="mt-2 text-[13px] text-m3-on-surface-variant">
              {provinceReturnDialog.ids.length === 1
                ? `“${provinceReturnDialog.labels[0]}” sẽ về mục Tỉnh trả về để xã bổ sung rồi đẩy lại.`
                : `${provinceReturnDialog.ids.length} hồ sơ sẽ trả về xã bổ sung.`}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-semibold text-m3-on-surface-variant">
                Lý do trả về / cần bổ sung *
              </span>
              <textarea
                value={provinceReturnReason}
                onChange={(e) => setProvinceReturnReason(e.target.value)}
                rows={4}
                placeholder="Ví dụ: bổ sung giấy khám SK, cập nhật ghi chú tạm hoãn…"
                className="w-full rounded-xl border border-black/[0.08] px-3 py-2.5 text-[14px] outline-none focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/15"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setProvinceReturnDialog(null);
                  setProvinceReturnReason("");
                }}
                className="rounded-xl border border-black/[0.08] px-4 py-2.5 text-[14px] font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || !provinceReturnReason.trim()}
                onClick={() => void confirmProvinceReturn()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "Đang xử lý..." : "Trả về"}
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
