"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target,
  Plus,
  Edit2,
  CheckCircle2,
  TrendingUp,
  X,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

interface Quota {
  id: string;
  campaignId?: string;
  year: number;
  fromLevel: string;
  fromUnit: string;
  fromUnitName?: string;
  toLevel: string;
  toUnit: string;
  toUnitName: string;
  amount: number;
  filled: number;
  note: string;
  createdAt: string;
}
interface ChildUnit {
  code: string;
  name: string;
  level: string;
}
interface Session {
  unitCode: string;
  hierarchyLevel: string;
  name: string;
}
interface RecruitmentCampaignOption {
  id: string;
  name: string;
  year: number;
  status: string;
}

const levelLabel: Record<string, string> = {
  bo: "Bộ QP",
  tinh: "Tỉnh",
  huyen: "Huyện",
  xa: "Xã",
};

const unitNames: Record<string, string> = {
  bo: "Bộ Quốc phòng",
  "tinh-hn": "Tỉnh Hà Nội",
  "tinh-hcm": "Tỉnh TP. HCM",
  "tinh-dn": "Tỉnh Đà Nẵng",
  "huyen-hk": "Huyện Hoàn Kiếm",
  "huyen-dd": "Huyện Đống Đa",
  "huyen-bc": "Huyện Bình Chánh",
  "huyen-hm": "Huyện Hóc Môn",
  "xa-hb": "Xã Hàng Bông",
  "xa-hd": "Xã Hàng Đào",
  "xa-kt": "Xã Khâm Thiên",
  "xa-bh": "Xã Bình Hưng",
  "xa-lh": "Xã Long Hòa",
};

export default function QuotaPage() {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [childUnits, setChildUnits] = useState<ChildUnit[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionUnitName, setSessionUnitName] = useState("");
  const [campaigns, setCampaigns] = useState<RecruitmentCampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingQuota, setEditingQuota] = useState<Quota | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<"received" | "issued" | "all">("issued");

  const [form, setForm] = useState({
    campaignId: "",
    year: new Date().getFullYear(),
    toUnit: "",
    toUnitName: "",
    amount: "",
    note: "",
  });
  const [capacity, setCapacity] = useState<{
    eligible: number;
    totalCitizens: number;
  } | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, quotaRes, campaignRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/admin/quotas"),
      fetch("/api/admin/recruitment?limit=100"),
    ]);
    if (meRes.ok) {
      const d = await meRes.json();
      setSession(d.user);
    }
    if (quotaRes.ok) {
      const d = await quotaRes.json();
      setQuotas(d.data || []);
      setChildUnits(d.childUnits || []);
      setSessionUnitName(d.sessionUnitName || "");
    }
    if (campaignRes.ok) {
      const d = await campaignRes.json();
      setCampaigns(d.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  useEffect(() => {
    if (!form.toUnit) {
      void Promise.resolve().then(() => setCapacity(null));
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/admin/quotas?capacityFor=${encodeURIComponent(form.toUnit)}`,
      );
      if (!res.ok || cancelled) return;
      const d = await res.json();
      if (!cancelled && d.capacity) {
        setCapacity({
          eligible: d.capacity.eligible,
          totalCitizens: d.capacity.totalCitizens,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.toUnit]);

  const handleSubmit = async () => {
    if (!form.toUnit || !form.amount) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitWarning(null);
    const chosen = childUnits.find((c) => c.code === form.toUnit);
    const res = await fetch(editingQuota ? `/api/admin/quotas/${editingQuota.id}` : "/api/admin/quotas", {
      method: editingQuota ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUnit: form.toUnit,
        toUnitName: chosen?.name || form.toUnit,
        amount: Number(form.amount),
        note: form.note,
        year: form.year,
        campaignId: form.campaignId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.warning?.message) {
        setSubmitWarning(data.warning.message);
        // giữ modal mở vài giây để đọc cảnh báo rồi đóng
        await fetchData();
        window.setTimeout(() => {
          setShowModal(false);
          setEditingQuota(null);
          setForm({ campaignId: "", year: new Date().getFullYear(), toUnit: "", toUnitName: "", amount: "", note: "" });
          setCapacity(null);
          setSubmitWarning(null);
        }, 2800);
      } else {
        setShowModal(false);
        setEditingQuota(null);
        setForm({ campaignId: "", year: new Date().getFullYear(), toUnit: "", toUnitName: "", amount: "", note: "" });
        setCapacity(null);
        await fetchData();
      }
    } else {
      setSubmitError(data.error || "Không giao được chỉ tiêu");
    }
    setSubmitting(false);
  };

  const openEditQuota = (quota: Quota) => {
    setEditingQuota(quota);
    setForm({ campaignId: quota.campaignId || "", year: quota.year, toUnit: quota.toUnit, toUnitName: quota.toUnitName, amount: String(quota.amount), note: quota.note });
    setShowModal(true);
  };

  const deleteQuota = async (quota: Quota) => {
    if (!window.confirm(`Xóa chỉ tiêu giao cho ${quota.toUnitName}?`)) return;
    const res = await fetch(`/api/admin/quotas/${quota.id}`, { method: "DELETE" });
    if (res.ok) await fetchData();
    else setSubmitError((await res.json()).error || "Không thể xóa chỉ tiêu");
  };

  // Partition quotas
  const receivedQuotas = session
    ? quotas.filter((q) => q.toUnit === session.unitCode)
    : [];
  const issuedQuotas = session
    ? quotas.filter((q) => q.fromUnit === session.unitCode)
    : [];
  // For 'bo' level: always show issued only (bo is never a recipient)
  const isBo = session?.hierarchyLevel === "bo";

  const displayQuotas = isBo
    ? issuedQuotas
    : view === "received"
      ? receivedQuotas
      : view === "issued"
        ? issuedQuotas
        : quotas;

  const totalAssigned = issuedQuotas.reduce((s, q) => s + q.amount, 0);
  const totalReceived = receivedQuotas.reduce((s, q) => s + q.amount, 0);
  const totalFilled = receivedQuotas.reduce((s, q) => s + q.filled, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Giao chỉ tiêu tuyển quân
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            {session && (
              <span className="font-medium">
                Đơn vị: {sessionUnitName || unitNames[session.unitCode] || session.unitCode} (
                {levelLabel[session.hierarchyLevel] || session.hierarchyLevel})
              </span>
            )}
          </p>
          {!isBo && (
            <p className="text-xs mt-1 text-m3-on-surface-variant">
              Đã nhập ngũ / Đã hoàn thành = số hồ sơ trạng thái Nhập ngũ trong đơn vị nhận chỉ tiêu
            </p>
          )}
        </div>
        {session?.hierarchyLevel !== "xa" && (
          <button
            onClick={() => { setEditingQuota(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-m3-primary hover:bg-m3-on-surface-variant text-white rounded-xl transition-colors text-sm font-medium"
          >
            <Plus size={16} /> Giao chỉ tiêu
          </button>
        )}
      </div>

      {/* Stats — Bộ QP chỉ xem chỉ tiêu đã giao, không có phần nhận */}
      <div
        className={`grid grid-cols-1 gap-4 ${isBo ? "sm:grid-cols-1 max-w-xs" : "sm:grid-cols-3"}`}
      >
        {!isBo && (
          <div className="bg-m3-surface-lowest rounded-2xl p-5 border border-m3-outline-variant shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-m3-on-surface-variant">Chỉ tiêu được giao</p>
              <ArrowDown size={18} className="text-m3-primary" />
            </div>
            <p className="text-3xl font-bold mt-2 text-m3-primary">
              {totalReceived}
            </p>
            <p className="text-xs text-m3-on-surface-variant mt-1">Từ cấp trên</p>
          </div>
        )}
        {!isBo && (
          <div className="bg-m3-surface-lowest rounded-2xl p-5 border border-m3-outline-variant shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-m3-on-surface-variant">Đã nhập ngũ</p>
              <CheckCircle2 size={18} className="text-m3-on-success-container" />
            </div>
            <p className="text-3xl font-bold mt-2 text-m3-on-success-container">
              {totalFilled}
            </p>
            {totalReceived > 0 && (
              <div className="mt-2 h-1.5 bg-m3-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-m3-success-container rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((totalFilled / totalReceived) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
        <div className="bg-m3-surface-lowest rounded-2xl p-5 border border-m3-outline-variant shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-m3-on-surface-variant">Đã giao xuống</p>
            <ArrowUp size={18} style={{ color: "var(--m3-primary, #1a73e8)" }} />
          </div>
          <p className="text-3xl font-bold mt-2" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            {totalAssigned}
          </p>
          <p className="text-xs text-m3-on-surface-variant mt-1">Cho đơn vị cấp dưới</p>
        </div>
      </div>

      {/* View toggle — hide 'received' for bo level */}
      {!isBo && (
        <div className="flex gap-2">
          {(["all", "received", "issued"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                view === v
                  ? "bg-m3-primary text-white"
                  : "bg-m3-surface-lowest border border-m3-outline-variant text-m3-on-surface-variant hover:border-m3-primary"
              }`}
            >
              {{ all: "Tất cả", received: "Được giao", issued: "Đã giao" }[v]}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
              <tr>
                <th className="px-6 py-4">Từ đơn vị</th>
                <th className="px-6 py-4">Đến đơn vị</th>
                <th className="px-6 py-4 text-center">Chỉ tiêu</th>
                <th className="px-6 py-4 text-center">Đã hoàn thành</th>
                <th className="px-6 py-4">Tiến độ</th>
                <th className="px-6 py-4">Ghi chú</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-m3-on-surface-variant"
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : displayQuotas.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-m3-on-surface-variant"
                  >
                    Chưa có chỉ tiêu nào.
                  </td>
                </tr>
              ) : (
                displayQuotas.map((q) => {
                  const pct =
                    q.amount > 0 ? Math.round((q.filled / q.amount) * 100) : 0;
                  const done = q.filled >= q.amount;
                  return (
                    <tr
                      key={q.id}
                      className="hover:bg-m3-surface-high/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-m3-on-surface-variant text-xs">
                        {q.fromUnitName ||
                          unitNames[q.fromUnit] ||
                          (q.fromUnit === "bo" ? "Bộ Quốc phòng" : q.fromUnit)}
                      </td>
                      <td className="px-6 py-4 font-medium text-m3-on-surface">
                        <div>{q.toUnitName}</div>
                        {q.campaignId && (
                          <div className="mt-0.5 text-xs font-normal text-m3-primary">
                            {campaigns.find((campaign) => campaign.id === q.campaignId)?.name || "Đợt tuyển quân"}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-m3-on-surface">
                        {q.amount}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-m3-on-success-container">
                        {q.filled}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-m3-surface-container rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: done ? "var(--color-m3-success)" : "var(--m3-primary, #1a73e8)",
                              }}
                            />
                          </div>
                          <span className="text-xs text-m3-on-surface-variant w-8">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-m3-on-surface-variant text-xs">
                        {q.note || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={
                            done
                              ? { background: "var(--color-m3-success-container)", color: "var(--color-m3-success)" }
                              : { background: "var(--color-m3-warning-container)", color: "var(--color-m3-warning)" }
                          }
                        >
                          {done ? (
                            <>
                              <CheckCircle2 size={12} />
                              Hoàn thành
                            </>
                          ) : (
                            <>
                              <TrendingUp size={12} />
                              Đang thực hiện
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {q.fromUnit === session?.unitCode && (
                          <div className="flex justify-center gap-1">
                            <button type="button" onClick={() => openEditQuota(q)} className="rounded-lg p-1.5 text-m3-on-surface-variant hover:bg-m3-primary-container hover:text-m3-primary" title="Sửa chỉ tiêu"><Edit2 size={16} /></button>
                            <button type="button" onClick={() => void deleteQuota(q)} className="rounded-lg p-1.5 text-m3-on-surface-variant hover:bg-m3-error-container hover:text-m3-error" title="Xóa chỉ tiêu"><X size={16} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Quota Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-m3-surface-lowest rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-m3-outline-variant">
              <h2 className="text-lg font-semibold text-m3-on-surface">
                {editingQuota ? "Sửa chỉ tiêu" : "Giao chỉ tiêu"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-m3-surface-container rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {session && (
                <div className="p-3 rounded-xl bg-m3-surface-high border border-m3-outline-variant text-sm text-m3-on-surface-variant">
                  Giao từ:{" "}
                  <span className="font-semibold">
                    {unitNames[session.unitCode] || session.unitCode}
                  </span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-1">
                  Đợt khám tuyển *
                </label>
                <select
                  required
                  className="w-full border border-m3-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-m3-primary"
                  value={form.campaignId}
                  onChange={(e) => {
                    const campaign = campaigns.find((item) => item.id === e.target.value);
                    setForm({ ...form, campaignId: e.target.value, year: campaign?.year || form.year });
                  }}
                >
                  <option value="">Chọn đợt khám tuyển...</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} ({campaign.year})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-1">
                  Đơn vị nhận *
                </label>
                {childUnits.length > 0 ? (
                  <select
                    className="w-full border border-m3-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-m3-primary"
                    value={form.toUnit}
                    onChange={(e) =>
                      setForm({ ...form, toUnit: e.target.value })
                    }
                  >
                    <option value="">Chọn đơn vị nhận...</option>
                    {childUnits.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-m3-on-warning-container p-2 rounded-lg bg-m3-warning-container">
                    Không có đơn vị cấp dưới để giao chỉ tiêu.
                  </p>
                )}
                {capacity && form.toUnit && (
                  <p
                    className={`mt-2 rounded-xl px-3 py-2 text-[13px] ${
                      Number(form.amount) > capacity.eligible
                        ? "bg-m3-warning-container text-m3-on-warning-container"
                        : "bg-m3-primary-container text-m3-on-primary-container"
                    }`}
                  >
                    Nguồn tại đơn vị: {capacity.eligible} hồ sơ đủ điều kiện /
                    tổng {capacity.totalCitizens} hồ sơ
                    {Number(form.amount) > capacity.eligible
                      ? ` — thiếu ${Number(form.amount) - capacity.eligible}. Admin đơn vị sẽ nhận cảnh báo.`
                      : "."}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-1">
                  Số lượng chỉ tiêu *
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-m3-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-m3-primary"
                  placeholder="Ví dụ: 120"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-1">
                  Ghi chú
                </label>
                <textarea
                  className="w-full border border-m3-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-m3-primary resize-none"
                  rows={2}
                  placeholder="Ghi chú thêm (nếu có)..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
              {submitWarning && (
                <p className="rounded-xl bg-m3-warning-container px-3 py-2.5 text-[13px] text-m3-on-warning-container">
                  {submitWarning}
                </p>
              )}
              {submitError && (
                <p className="rounded-xl bg-m3-error-container px-3 py-2.5 text-[13px] text-m3-on-error-container">
                  {submitError}
                </p>
              )}
            </div>
            <div className="flex gap-2 p-5 border-t border-m3-outline-variant">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-high rounded-xl text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.campaignId || !form.toUnit || !form.amount}
                className="flex-1 py-2.5 bg-m3-primary hover:bg-m3-on-surface-variant disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              >
                <Target size={15} />
                {submitting ? "Đang lưu..." : "Xác nhận giao"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
