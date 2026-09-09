"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  Globe,
  Loader2,
  Save,
  Send,
  Target,
} from "lucide-react";
import {
  AdminListHeader,
  AdminListShell,
  AdminTable,
  AdminTHead,
  ADMIN_TH_CLS,
  ADMIN_TD_CLS,
  adminRowClass,
  AdminPill,
  AdminStatusTabs,
  AdminPrimaryBtn,
  ADMIN_SELECT_CLS,
} from "@/components/admin/list-ui";
import {
  M3Card,
  M3Snackbar,
  M3ConfirmDialog,
  type M3SnackbarTone,
} from "@/components/m3";
import type { HierarchyUnit } from "@/lib/data";
import SearchableSelect from "@/components/ui/SearchableSelect";

const SELECT_CLS =
  "h-9 min-w-[200px] rounded-full border border-black/[0.08] bg-white px-3.5 text-[13px] font-medium outline-none";
const STAT =
  "rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

interface Session {
  hierarchyLevel: string;
  unitCode: string;
  name: string;
}
interface Campaign {
  id: string;
  name: string;
  year: number;
  status: string;
}

function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  useEffect(() => {
    fetch("/api/admin/recruitment?limit=50")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = (d?.data || []) as Campaign[];
        setCampaigns(list);
        const ongoing = list.find((c) => c.status === "ongoing");
        setCampaignId(ongoing?.id || list[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);
  return { campaigns, campaignId, setCampaignId };
}

function CampaignSelect({
  campaigns,
  value,
  onChange,
}: {
  campaigns: Campaign[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select className={SELECT_CLS} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Chọn đợt tuyển quân —</option>
      {campaigns.map((c) => (
        <option key={c.id} value={c.id}>
          {c.year} · {c.name}
        </option>
      ))}
    </select>
  );
}

function pill(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    chua_phan_quan: {
      label: "Chưa phân",
      bg: "var(--color-m3-warning-container)",
      color: "var(--color-m3-warning)",
    },
    da_phan_quan: {
      label: "Đã phân đơn vị",
      bg: "color-mix(in srgb, #0d9488 14%, white)",
      color: "#0f766e",
    },
    submitted_to_bo: {
      label: "Chờ Bộ duyệt",
      bg: "color-mix(in srgb, var(--m3-primary) 14%, white)",
      color: "var(--m3-primary)",
    },
    bo_approved: {
      label: "Bộ đã duyệt",
      bg: "var(--color-m3-success-container)",
      color: "var(--color-m3-success)",
    },
    published: {
      label: "Đã công bố",
      bg: "var(--color-m3-success-container)",
      color: "var(--color-m3-success)",
    },
  };
  return map[status] || map.chua_phan_quan;
}

/** Bộ: giao chỉ tiêu QK + duyệt + công bố */
function BoView({ session }: { session: Session }) {
  const { campaigns, campaignId, setCampaignId } = useCampaigns();
  const [tab, setTab] = useState<"quota" | "final">("final");
  const [quotas, setQuotas] = useState<
    {
      id: string;
      receivingUnitCode: string;
      receivingUnitName: string;
      amount: number;
      filled: number;
      recruitmentAmount?: number | null;
    }[]
  >([]);
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);
  const [formUnit, setFormUnit] = useState("");
  const [rows, setRows] = useState<
    { id: string; fullName: string; cccd: string; unitName: string; receivingUnitName: string; receivingStatus: string }[]
  >([]);
  const [counts, setCounts] = useState({
    submitted_to_bo: 0,
    bo_approved: 0,
    published: 0,
  });
  const [statusFilter, setStatusFilter] = useState("submitted_to_bo");
  const [quanKhuCode, setQuanKhuCode] = useState("");
  const [militaryRegions, setMilitaryRegions] = useState<
    { code: string; name: string }[]
  >([]);
  const [toast, setToast] = useState<{ message: string; tone: M3SnackbarTone } | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<"approve" | "publish" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const loadQuota = useCallback(async () => {
    if (!campaignId) return;
    const res = await fetch(
      `/api/admin/receiving-quotas?campaignId=${encodeURIComponent(campaignId)}`,
    );
    if (!res.ok) return;
    const d = await res.json();
    setQuotas(d.data || []);
    const regs = (d.regions || []).map((r: { code: string; name: string }) => r);
    setRegions(regs);
    if (regs.length) setMilitaryRegions(regs);
  }, [campaignId]);

  const loadList = useCallback(async () => {
    if (!campaignId) return;
    const params = new URLSearchParams({ campaignId, status: statusFilter });
    if (quanKhuCode) params.set("quanKhuCode", quanKhuCode);
    const res = await fetch(`/api/admin/receiving?${params}`);
    if (!res.ok) return;
    const d = await res.json();
    setRows(d.data || []);
    setCounts({
      submitted_to_bo: d.counts?.submitted_to_bo || 0,
      bo_approved: d.counts?.bo_approved || 0,
      published: d.counts?.published || 0,
    });
    if (Array.isArray(d.militaryRegions) && d.militaryRegions.length) {
      setMilitaryRegions(d.militaryRegions);
    }
  }, [campaignId, statusFilter, quanKhuCode]);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);
  useEffect(() => {
    if (campaignId) void loadList();
  }, [campaignId, loadList]);

  const syncAll = async () => {
    if (!campaignId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/receiving-quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_from_recruitment",
          campaignId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: d.error || "Không đồng bộ được", tone: "error" });
      } else {
        setToast({
          message: d.message || "Đã đồng bộ chỉ tiêu nhận quân",
          tone: "success",
        });
      }
      await loadQuota();
    } finally {
      setBusy(false);
    }
  };

  const saveQuota = async () => {
    if (!formUnit) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/receiving-quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          campaignId,
          receivingUnitCode: formUnit,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: d.error || "Không lưu được", tone: "error" });
      } else {
        setToast({
          message: `Đã đồng bộ ${d.data?.amount ?? ""} chỉ tiêu nhận quân (= tuyển quân)`,
          tone: "success",
        });
        setFormUnit("");
      }
      await loadQuota();
    } finally {
      setBusy(false);
    }
  };

  const runFinal = async (action: "approve" | "publish") => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          campaignId,
          ...(quanKhuCode && { quanKhuCode }),
        }),
      });
      const d = await res.json().catch(() => ({}));
      setConfirmAction(null);
      if (!res.ok) {
        setToast({ message: d.error || "Không thực hiện được", tone: "error" });
      } else {
        setToast({ message: d.message || "Thành công", tone: "success" });
        setStatusFilter(action === "approve" ? "bo_approved" : "published");
        await loadList();
      }
    } finally {
      setBusy(false);
    }
  };

  const selectedQuanKhuName =
    militaryRegions.find((r) => r.code === quanKhuCode)?.name || "";

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Chỉ tiêu QK · Duyệt & công bố"
        countLabel={session.name}
        filters={
          <>
            <CampaignSelect campaigns={campaigns} value={campaignId} onChange={setCampaignId} />
            {tab === "final" && (
              <select
                className={ADMIN_SELECT_CLS}
                value={quanKhuCode}
                onChange={(e) => setQuanKhuCode(e.target.value)}
                aria-label="Lọc theo quân khu gửi lên"
              >
                <option value="">Tất cả quân khu</option>
                {militaryRegions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </>
        }
        actions={
          <>
            <AdminPrimaryBtn
              tone="green"
              disabled={busy || !campaignId}
              onClick={() => setConfirmAction("approve")}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Duyệt ({counts.submitted_to_bo})
            </AdminPrimaryBtn>
            <AdminPrimaryBtn
              tone="blue"
              disabled={busy || !campaignId}
              onClick={() => setConfirmAction("publish")}
            >
              <Globe size={14} />
              Công bố ({counts.bo_approved})
            </AdminPrimaryBtn>
          </>
        }
      />
      <AdminStatusTabs
        tabs={[
          { value: "quota", label: "Giao chỉ tiêu quân khu" },
          { value: "final", label: "Duyệt & công bố" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as "quota" | "final")}
      />
      {!campaignId ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-m3-on-surface-variant">
          Chọn đợt tuyển quân
        </div>
      ) : tab === "quota" ? (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4">
            <label className="text-[12px] text-m3-on-surface-variant">
              Quân khu / BTL
              <select
                className={`${SELECT_CLS} mt-1 block`}
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
              >
                <option value="">— Chọn —</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <AdminPrimaryBtn
              tone="blue"
              onClick={() => void saveQuota()}
              disabled={busy || !formUnit}
            >
              <Target size={14} /> Đồng bộ từ tuyển quân
            </AdminPrimaryBtn>
            <AdminPrimaryBtn
              tone="green"
              onClick={() => void syncAll()}
              disabled={busy || !campaignId}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Đồng bộ tất cả quân khu
            </AdminPrimaryBtn>
          </div>
          <AdminListShell page={1} totalPages={1}>
            <AdminTable>
              <AdminTHead>
                <th className={ADMIN_TH_CLS}>Quân khu</th>
                <th className={`${ADMIN_TH_CLS} !text-right`}>Tuyển quân</th>
                <th className={`${ADMIN_TH_CLS} !text-right`}>Nhận quân</th>
                <th className={`${ADMIN_TH_CLS} !text-right`}>Đã phân</th>
              </AdminTHead>
              <tbody>
                {quotas.map((q, i) => {
                  const tuyen = q.recruitmentAmount ?? q.amount;
                  const synced = tuyen === q.amount;
                  return (
                    <tr key={q.id} className={adminRowClass(i)}>
                      <td className={ADMIN_TD_CLS}>{q.receivingUnitName}</td>
                      <td
                        className={`${ADMIN_TD_CLS} text-right font-semibold tabular-nums`}
                      >
                        {tuyen.toLocaleString("vi-VN")}
                      </td>
                      <td className={`${ADMIN_TD_CLS} text-right tabular-nums`}>
                        <span className="font-semibold">
                          {q.amount.toLocaleString("vi-VN")}
                        </span>
                        {!synced ? (
                          <span className="ml-1.5 text-[11px] font-medium text-amber-700">
                            lệch
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`${ADMIN_TD_CLS} text-right tabular-nums`}
                      >
                        {q.filled.toLocaleString("vi-VN")}/
                        {q.amount.toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  );
                })}
                {quotas.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-m3-on-surface-variant"
                    >
                      Chưa có chỉ tiêu — giao tuyển quân tại menu Giao chỉ tiêu, rồi
                      đồng bộ tại đây.
                    </td>
                  </tr>
                )}
              </tbody>
            </AdminTable>
          </AdminListShell>
        </>
      ) : (
        <AdminListShell
          page={1}
          totalPages={1}
          tabs={
            <AdminStatusTabs
              tabs={[
                { value: "submitted_to_bo", label: `Chờ duyệt (${counts.submitted_to_bo})` },
                { value: "bo_approved", label: `Đã duyệt (${counts.bo_approved})` },
                { value: "published", label: `Đã công bố (${counts.published})` },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
        >
          <AdminTable>
            <AdminTHead>
              <th className={ADMIN_TH_CLS}>Họ tên</th>
              <th className={ADMIN_TH_CLS}>Đơn vị quản lý</th>
              <th className={ADMIN_TH_CLS}>Đơn vị nhận</th>
              <th className={ADMIN_TH_CLS}>TT</th>
            </AdminTHead>
            <tbody>
              {rows.map((r, i) => {
                const p = pill(r.receivingStatus);
                return (
                  <tr key={r.id} className={adminRowClass(i)}>
                    <td className={ADMIN_TD_CLS}>
                      <div className="font-bold">{r.fullName}</div>
                      <div className="font-mono text-[12px] text-m3-on-surface-variant">
                        {r.cccd}
                      </div>
                    </td>
                    <td className={ADMIN_TD_CLS}>{r.unitName}</td>
                    <td className={ADMIN_TD_CLS}>{r.receivingUnitName}</td>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill label={p.label} bg={p.bg} color={p.color} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        </AdminListShell>
      )}
      <M3Snackbar
        open={!!toast}
        message={toast?.message || ""}
        tone={toast?.tone || "info"}
        onClose={() => setToast(null)}
      />
      <M3ConfirmDialog
        open={confirmAction === "approve"}
        title="Duyệt danh sách?"
        description={
          selectedQuanKhuName
            ? `Duyệt ${counts.submitted_to_bo} hồ sơ ${selectedQuanKhuName} đã gửi lên.`
            : `Duyệt ${counts.submitted_to_bo} hồ sơ quân khu đã gửi lên (tất cả quân khu trong đợt).`
        }
        confirmLabel="Duyệt"
        tone="success"
        busy={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runFinal("approve")}
      />
      <M3ConfirmDialog
        open={confirmAction === "publish"}
        title="Công bố danh sách?"
        description={
          selectedQuanKhuName
            ? `Công bố ${counts.bo_approved} hồ sơ ${selectedQuanKhuName} đã duyệt — công dân tra cứu tại /tra-cuu.`
            : `Công bố ${counts.bo_approved} hồ sơ đã duyệt (tất cả quân khu trong đợt) — công dân tra cứu tại /tra-cuu.`
        }
        confirmLabel="Công bố"
        tone="primary"
        busy={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runFinal("publish")}
      />
    </div>
  );
}

/** Quân khu: giao chỉ tiêu ĐV nhận + phân quân + chốt */
function QuanKhuView({ session }: { session: Session }) {
  const { campaigns, campaignId, setCampaignId } = useCampaigns();
  const [tab, setTab] = useState<"alloc" | "assign">("alloc");
  const [parentQuota, setParentQuota] = useState<{ amount: number; filled: number } | null>(
    null,
  );
  const [provinceOptions, setProvinceOptions] = useState<
    { code: string; name: string }[]
  >([]);
  const [receivingUnitOptions, setReceivingUnitOptions] = useState<
    { code: string; name: string; kind?: string }[]
  >([]);
  const [subQuotas, setSubQuotas] = useState<
    { toUnit: string; toUnitName: string; amount: number; filled?: number }[]
  >([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<
    {
      id: string;
      fullName: string;
      cccd: string;
      unitName: string;
      receivingStatus: string;
      receivingUnitCode: string | null;
    }[]
  >([]);
  const [assignable, setAssignable] = useState<{ code: string; name: string }[]>(
    [],
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState({
    chua_phan_quan: 0,
    da_phan_quan: 0,
    submitted_to_bo: 0,
    all: 0,
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: M3SnackbarTone } | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [provinceCode, setProvinceCode] = useState("");
  const [wardCode, setWardCode] = useState("");
  const [wards, setWards] = useState<HierarchyUnit[]>([]);

  const localityFilter = wardCode || provinceCode;

  const loadAlloc = useCallback(async () => {
    if (!campaignId) return;
    const res = await fetch(
      `/api/admin/receiving-quotas?campaignId=${encodeURIComponent(campaignId)}`,
    );
    if (!res.ok) return;
    const d = await res.json();
    setParentQuota(d.data?.[0] ? { amount: d.data[0].amount, filled: d.data[0].filled } : null);
    setProvinceOptions(d.provinceOptions || []);
    setReceivingUnitOptions(d.receivingUnitOptions || []);
    setSubQuotas(d.subQuotas || []);
    const next: Record<string, number> = {};
    for (const s of d.subQuotas || []) next[s.toUnit] = s.amount;
    setAmounts(next);
  }, [campaignId]);

  const loadAssign = useCallback(async () => {
    if (!campaignId) return;
    const params = new URLSearchParams({ campaignId });
    if (statusFilter) params.set("status", statusFilter);
    if (localityFilter) params.set("unitCode", localityFilter);
    const res = await fetch(`/api/admin/receiving?${params}`);
    if (!res.ok) return;
    const d = await res.json();
    setRows(d.data || []);
    setAssignable(d.assignableUnits || []);
    setCounts({
      chua_phan_quan: d.counts?.chua_phan_quan || 0,
      da_phan_quan: d.counts?.da_phan_quan || 0,
      submitted_to_bo: d.counts?.submitted_to_bo || 0,
      all:
        (d.counts?.chua_phan_quan || 0) +
        (d.counts?.da_phan_quan || 0) +
        (d.counts?.submitted_to_bo || 0) +
        (d.counts?.bo_approved || 0) +
        (d.counts?.published || 0) +
        (d.counts?.unit_confirmed || 0),
    });
    const next: Record<string, string> = {};
    for (const r of d.data || []) if (r.receivingUnitCode) next[r.id] = r.receivingUnitCode;
    setDraft(next);
  }, [campaignId, statusFilter, localityFilter]);

  useEffect(() => {
    void loadAlloc();
  }, [loadAlloc]);
  useEffect(() => {
    if (tab === "assign") void loadAssign();
  }, [tab, loadAssign]);

  useEffect(() => {
    if (!provinceCode) {
      setWards([]);
      return;
    }
    fetch(
      `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(provinceCode)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setWards(
          ((d?.items || []) as HierarchyUnit[]).filter((i) => i.level === "xa"),
        ),
      )
      .catch(() => setWards([]));
  }, [provinceCode]);

  const saveAlloc = async (toUnit: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/receiving-quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "allocate_unit",
          campaignId,
          toUnit,
          amount: Number(amounts[toUnit] || 0),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: d.error || "Không lưu được", tone: "error" });
      } else {
        setToast({
          message: `Đã giao ${amounts[toUnit] || 0} chỉ tiêu nhận quân`,
          tone: "success",
        });
      }
      await loadAlloc();
    } finally {
      setBusy(false);
    }
  };

  const assignOne = async (id: string) => {
    const receivingUnitCode = draft[id];
    if (!receivingUnitCode) return;
    const res = await fetch("/api/admin/receiving", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", campaignId, id, receivingUnitCode }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast({ message: d.error || "Không phân được", tone: "error" });
    } else {
      setToast({ message: d.message || "Đã phân quân", tone: "success" });
    }
    await loadAssign();
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", campaignId }),
      });
      const d = await res.json().catch(() => ({}));
      setConfirmOpen(false);
      if (!res.ok) {
        setToast({ message: d.error || "Không chốt được", tone: "error" });
      } else {
        setToast({ message: d.message || "Đã gửi Bộ", tone: "success" });
        setStatusFilter("submitted_to_bo");
        await loadAssign();
      }
    } finally {
      setBusy(false);
    }
  };

  const localityFilters = (
    <>
      <CampaignSelect campaigns={campaigns} value={campaignId} onChange={setCampaignId} />
      {tab === "assign" && (
        <>
          <SearchableSelect
            variant="compact"
            className="max-w-[220px] min-w-[180px]"
            value={provinceCode}
            onChange={(code) => {
              setProvinceCode(code);
              setWardCode("");
              setStatusFilter("");
            }}
            ariaLabel="Lọc tỉnh thành"
            placeholder="Tất cả tỉnh / TP"
            options={[
              { value: "", label: "Tất cả tỉnh / TP" },
              ...provinceOptions.map((p) => ({
                value: p.code,
                label: p.name,
              })),
            ]}
          />
          {provinceCode && (
            <SearchableSelect
              variant="compact"
              className="max-w-[220px] min-w-[160px]"
              value={wardCode}
              onChange={(code) => {
                setWardCode(code);
                setStatusFilter("");
              }}
              ariaLabel="Lọc xã phường"
              placeholder="Tất cả xã / phường"
              options={[
                { value: "", label: "Tất cả xã / phường" },
                ...wards.map((w) => ({
                  value: w.code,
                  label: w.name,
                })),
              ]}
            />
          )}
        </>
      )}
    </>
  );

  return (
    <div className="space-y-5 pb-8">
      <AdminListHeader
        title="Chỉ tiêu ĐV nhận · Phân quân · Chốt"
        countLabel={session.name}
        filters={localityFilters}
        actions={
          tab === "assign" ? (
            <AdminPrimaryBtn tone="blue" onClick={() => setConfirmOpen(true)}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Chốt danh sách & gửi Bộ ({counts.da_phan_quan})
            </AdminPrimaryBtn>
          ) : undefined
        }
      />

      {parentQuota && (
        <div className="flex flex-wrap items-baseline gap-2 rounded-[16px] border border-black/[0.06] bg-white px-5 py-4">
          <span className="text-[13px] text-m3-on-surface-variant">
            Chỉ tiêu Bộ giao
          </span>
          <span className="text-[22px] font-bold tracking-tight text-m3-on-surface">
            {parentQuota.filled}
            <span className="text-[15px] font-semibold text-m3-on-surface-variant">
              /{parentQuota.amount}
            </span>
          </span>
        </div>
      )}

      <AdminStatusTabs
        tabs={[
          { value: "alloc", label: "Giao chỉ tiêu ĐV nhận" },
          { value: "assign", label: "Phân quân & chốt" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as "alloc" | "assign")}
      />

      {!campaignId ? (
        <M3Card variant="outlined" rounding="large" className="!p-8 text-center">
          <p className="text-sm text-m3-on-surface-variant">Chọn đợt tuyển quân</p>
        </M3Card>
      ) : tab === "alloc" ? (
        <AdminListShell page={1} totalPages={1}>
          <AdminTable>
            <AdminTHead>
              <th className={ADMIN_TH_CLS}>Đơn vị nhận</th>
              <th className={ADMIN_TH_CLS}>Chỉ tiêu</th>
              <th className={ADMIN_TH_CLS}>Đã phân</th>
              <th className={ADMIN_TH_CLS}>Lưu</th>
            </AdminTHead>
            <tbody>
              {receivingUnitOptions.map((u, i) => {
                const filled =
                  subQuotas.find((s) => s.toUnit === u.code)?.filled ?? 0;
                return (
                  <tr key={u.code} className={adminRowClass(i)}>
                    <td className={ADMIN_TD_CLS}>
                      <div className="font-semibold">{u.name}</div>
                      {u.kind && (
                        <div className="text-[12px] text-m3-on-surface-variant">
                          {u.kind}
                        </div>
                      )}
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <input
                        type="number"
                        min={0}
                        className="h-10 w-28 rounded-full border border-black/[0.08] bg-white px-3.5 text-sm outline-none focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/15"
                        value={amounts[u.code] ?? 0}
                        onChange={(e) =>
                          setAmounts((a) => ({
                            ...a,
                            [u.code]: Number(e.target.value),
                          }))
                        }
                      />
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      {filled}/{amounts[u.code] ?? 0}
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <button
                        type="button"
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1 rounded-full bg-emerald-600 px-3.5 text-[13px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                        onClick={() => void saveAlloc(u.code)}
                      >
                        <Save size={14} /> Lưu
                      </button>
                    </td>
                  </tr>
                );
              })}
              {receivingUnitOptions.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-m3-on-surface-variant"
                  >
                    Chưa có sư đoàn / trung đoàn thuộc quân khu
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
        </AdminListShell>
      ) : (
        <AdminListShell
          page={1}
          totalPages={1}
          tabs={
            <AdminStatusTabs
              tabs={[
                { value: "", label: `Tất cả (${counts.all})` },
                { value: "chua_phan_quan", label: `Chưa phân (${counts.chua_phan_quan})` },
                { value: "da_phan_quan", label: `Đã phân (${counts.da_phan_quan})` },
                { value: "submitted_to_bo", label: `Đã gửi Bộ (${counts.submitted_to_bo})` },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
        >
          <AdminTable>
            <AdminTHead>
              <th className={ADMIN_TH_CLS}>Họ tên</th>
              <th className={ADMIN_TH_CLS}>Địa phương</th>
              <th className={ADMIN_TH_CLS}>Đơn vị nhận</th>
              <th className={ADMIN_TH_CLS}></th>
            </AdminTHead>
            <tbody>
              {rows.map((r, i) => {
                const can =
                  r.receivingStatus === "chua_phan_quan" ||
                  r.receivingStatus === "da_phan_quan";
                return (
                  <tr key={r.id} className={adminRowClass(i)}>
                    <td className={ADMIN_TD_CLS}>
                      <div className="font-bold">{r.fullName}</div>
                      <div className="font-mono text-[12px]">{r.cccd}</div>
                    </td>
                    <td className={ADMIN_TD_CLS}>{r.unitName}</td>
                    <td className={ADMIN_TD_CLS}>
                      {can ? (
                        <select
                          className="h-10 w-full min-w-[180px] rounded-full border border-black/[0.08] bg-white px-3 text-sm outline-none focus:border-m3-primary/40"
                          value={draft[r.id] || ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [r.id]: e.target.value }))
                          }
                        >
                          <option value="">— Sư đoàn / Trung đoàn —</option>
                          {assignable.map((u) => (
                            <option key={u.code} value={u.code}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        draft[r.id] || r.receivingUnitCode || "—"
                      )}
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      {can && (
                        <button
                          type="button"
                          className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-emerald-700"
                          onClick={() => void assignOne(r.id)}
                        >
                          Phân quân
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-m3-on-surface-variant"
                  >
                    {wardCode
                      ? "Không có hồ sơ nhập ngũ tại xã/phường này (chỉ hiện người đã duyệt gọi)."
                      : provinceCode
                        ? "Không có hồ sơ nhập ngũ theo bộ lọc hiện tại."
                        : "Không có hồ sơ trong phạm vi lọc"}
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
        </AdminListShell>
      )}

      <M3Snackbar
        open={!!toast}
        message={toast?.message || ""}
        tone={toast?.tone || "info"}
        onClose={() => setToast(null)}
      />
      <M3ConfirmDialog
        open={confirmOpen}
        title="Chốt & gửi Bộ?"
        description={`Sẽ gửi ${counts.da_phan_quan} hồ sơ đã phân quân lên Bộ duyệt và công bố.`}
        confirmLabel="Chốt gửi Bộ"
        tone="primary"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submit()}
      />
    </div>
  );
}

function ReceivingOpsView({ session }: { session: Session }) {
  const { campaigns, campaignId, setCampaignId } = useCampaigns();
  const [rows, setRows] = useState<
    {
      id: string;
      fullName: string;
      cccd: string;
      unitName: string;
      receivingStatus: string;
      receivingUnitName: string;
    }[]
  >([]);
  const [counts, setCounts] = useState({
    da_phan_quan: 0,
    submitted_to_bo: 0,
    bo_approved: 0,
    published: 0,
    unit_confirmed: 0,
  });
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: M3SnackbarTone } | null>(
    null,
  );
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ campaignId });
      if (tab) qs.set("status", tab);
      const res = await fetch(`/api/admin/receiving?${qs}`);
      const d = await res.json();
      setRows(d.data || []);
      setCounts({
        da_phan_quan: d.counts?.da_phan_quan || 0,
        submitted_to_bo: d.counts?.submitted_to_bo || 0,
        bo_approved: d.counts?.bo_approved || 0,
        published: d.counts?.published || 0,
        unit_confirmed: d.counts?.unit_confirmed || 0,
      });
    } finally {
      setLoading(false);
    }
  }, [campaignId, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending =
    counts.da_phan_quan +
    counts.submitted_to_bo +
    counts.bo_approved +
    counts.published;
  const confirmed = counts.unit_confirmed;

  const confirmOne = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", campaignId, id }),
      });
      const d = await res.json();
      if (!res.ok) setToast({ message: d.error || "Lỗi", tone: "error" });
      else {
        setToast({ message: d.message || "Đã xác nhận", tone: "success" });
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmAllPending = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", campaignId }),
      });
      const d = await res.json();
      setConfirmAll(false);
      if (!res.ok) setToast({ message: d.error || "Lỗi", tone: "error" });
      else {
        setToast({ message: d.message || "Đã xác nhận", tone: "success" });
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === "unit_confirmed") return "Đã nhận";
    if (s === "published") return "Đã công bố";
    if (s === "bo_approved") return "Bộ đã duyệt";
    if (s === "submitted_to_bo") return "Chờ Bộ";
    if (s === "da_phan_quan") return "Đã phân về đơn vị";
    return s;
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Quân số được phân · Xác nhận nhận quân"
        countLabel={session.name}
        filters={
          <CampaignSelect
            campaigns={campaigns}
            value={campaignId}
            onChange={setCampaignId}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={STAT}>
          <p className="text-[12px] text-m3-on-surface-variant">Chờ xác nhận</p>
          <p className="text-[28px] font-bold text-amber-700">{pending}</p>
        </div>
        <div className={STAT}>
          <p className="text-[12px] text-m3-on-surface-variant">Đã nhận quân</p>
          <p className="text-[28px] font-bold text-emerald-700">{confirmed}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AdminStatusTabs
          tabs={[
            { value: "", label: "Tất cả" },
            { value: "da_phan_quan", label: "Đã phân" },
            { value: "published", label: "Công bố" },
            { value: "unit_confirmed", label: "Đã nhận" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {pending > 0 && (
          <button
            type="button"
            disabled={busy || !campaignId}
            onClick={() => setConfirmAll(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check size={16} /> Xác nhận tất cả đang chờ
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin text-m3-primary" />
        </div>
      ) : (
        <AdminListShell page={1} totalPages={1}>
          <AdminTable>
            <AdminTHead>
              <th className={ADMIN_TH_CLS}>Họ tên / CCCD</th>
              <th className={ADMIN_TH_CLS}>Địa phương</th>
              <th className={ADMIN_TH_CLS}>Đơn vị nhận</th>
              <th className={ADMIN_TH_CLS}>Trạng thái</th>
              <th className={ADMIN_TH_CLS} />
            </AdminTHead>
            <tbody>
              {rows.map((r, i) => {
                const canConfirm = r.receivingStatus !== "unit_confirmed" &&
                  r.receivingStatus !== "chua_phan_quan";
                return (
                  <tr key={r.id} className={adminRowClass(i)}>
                    <td className={ADMIN_TD_CLS}>
                      <div className="font-bold">{r.fullName}</div>
                      <div className="font-mono text-[12px]">{r.cccd}</div>
                    </td>
                    <td className={ADMIN_TD_CLS}>{r.unitName}</td>
                    <td className={ADMIN_TD_CLS}>{r.receivingUnitName}</td>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill
                        label={statusLabel(r.receivingStatus)}
                        bg={
                          r.receivingStatus === "unit_confirmed"
                            ? "color-mix(in srgb, #059669 14%, transparent)"
                            : "color-mix(in srgb, #d97706 14%, transparent)"
                        }
                        color={
                          r.receivingStatus === "unit_confirmed"
                            ? "#047857"
                            : "#b45309"
                        }
                      />
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      {canConfirm && (
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                          onClick={() => void confirmOne(r.id)}
                        >
                          Xác nhận nhận
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-m3-on-surface-variant"
                  >
                    Chưa có quân nhân được phân về đơn vị trong đợt này
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
        </AdminListShell>
      )}
      <M3Snackbar
        open={!!toast}
        message={toast?.message || ""}
        tone={toast?.tone || "info"}
        onClose={() => setToast(null)}
      />
      <M3ConfirmDialog
        open={confirmAll}
        title="Xác nhận nhận quân?"
        description={`Xác nhận đã nhận toàn bộ ${pending} quân nhân đang chờ trong đợt này.`}
        confirmLabel="Xác nhận tất cả"
        tone="success"
        busy={busy}
        onCancel={() => setConfirmAll(false)}
        onConfirm={() => void confirmAllPending()}
      />
    </div>
  );
}

function TinhView({ session }: { session: Session }) {
  const { campaigns, campaignId, setCampaignId } = useCampaigns();
  const [rows, setRows] = useState<
    {
      id: string;
      fullName: string;
      cccd: string;
      unitName: string;
      receivingStatus: string;
      receivingUnitName?: string;
    }[]
  >([]);
  const [statusFilter, setStatusFilter] = useState("published");
  const [counts, setCounts] = useState({
    bo_approved: 0,
    published: 0,
    unit_confirmed: 0,
  });

  const load = useCallback(async () => {
    if (!campaignId) return;
    const params = new URLSearchParams({ campaignId, status: statusFilter });
    const res = await fetch(`/api/admin/receiving?${params}`);
    if (!res.ok) return;
    const d = await res.json();
    setRows(d.data || []);
    setCounts({
      bo_approved: d.counts?.bo_approved || 0,
      published: d.counts?.published || 0,
      unit_confirmed: d.counts?.unit_confirmed || 0,
    });
  }, [campaignId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusLabel: Record<string, string> = {
    bo_approved: "Bộ đã duyệt",
    published: "Đã công bố",
    unit_confirmed: "ĐV nhận đã xác nhận",
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Vị trí nhận quân công dân"
        countLabel={session.name}
        filters={
          <CampaignSelect campaigns={campaigns} value={campaignId} onChange={setCampaignId} />
        }
      />
      {!campaignId ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-m3-on-surface-variant">
          Chọn đợt tuyển quân
        </div>
      ) : (
        <AdminListShell
          page={1}
          totalPages={1}
          tabs={
            <AdminStatusTabs
              tabs={[
                { value: "bo_approved", label: `Bộ duyệt (${counts.bo_approved})` },
                { value: "published", label: `Công bố (${counts.published})` },
                {
                  value: "unit_confirmed",
                  label: `ĐV nhận xác nhận (${counts.unit_confirmed})`,
                },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
        >
          <AdminTable>
            <AdminTHead>
              <th className={ADMIN_TH_CLS}>Họ tên</th>
              <th className={ADMIN_TH_CLS}>Địa phương</th>
              <th className={ADMIN_TH_CLS}>Đơn vị nhận</th>
              <th className={ADMIN_TH_CLS}>Trạng thái</th>
            </AdminTHead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={adminRowClass(i)}>
                  <td className={ADMIN_TD_CLS}>
                    <div className="font-bold">{r.fullName}</div>
                    <div className="font-mono text-[12px]">{r.cccd}</div>
                  </td>
                  <td className={ADMIN_TD_CLS}>{r.unitName}</td>
                  <td className={ADMIN_TD_CLS}>
                    {r.receivingUnitName || "—"}
                  </td>
                  <td className={ADMIN_TD_CLS}>
                    {statusLabel[r.receivingStatus] || r.receivingStatus}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-m3-on-surface-variant"
                  >
                    Chưa có công dân địa bàn ở trạng thái này (sau Bộ duyệt)
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
        </AdminListShell>
      )}
    </div>
  );
}

export default function ReceivingUnitPage() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSession(d?.user || null))
      .catch(() => setSession(null));
  }, []);

  if (!session) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-m3-on-surface-variant">
        Đang tải...
      </div>
    );
  }

  if (session.hierarchyLevel === "bo") return <BoView session={session} />;
  if (session.hierarchyLevel === "donvi") {
    const isQk =
      /^(dv-qk\d+|dv-btl-hn)$/.test(session.unitCode);
    if (isQk) return <QuanKhuView session={session} />;
    return <ReceivingOpsView session={session} />;
  }
  if (session.hierarchyLevel === "tinh" || session.hierarchyLevel === "xa") {
    return <TinhView session={session} />;
  }

  return null;
}
