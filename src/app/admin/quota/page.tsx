"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target,
  Plus,
  Edit2,
  CheckCircle2,
  Clock,
  TrendingUp,
  X,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

interface Quota {
  id: string;
  year: number;
  fromLevel: string;
  fromUnit: string;
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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<"received" | "issued" | "all">("issued");

  const [form, setForm] = useState({
    toUnit: "",
    toUnitName: "",
    amount: "",
    note: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, quotaRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/admin/quotas"),
    ]);
    if (meRes.ok) {
      const d = await meRes.json();
      setSession(d.user);
    }
    if (quotaRes.ok) {
      const d = await quotaRes.json();
      setQuotas(d.data || []);
      setChildUnits(d.childUnits || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!form.toUnit || !form.amount) return;
    setSubmitting(true);
    const chosen = childUnits.find((c) => c.code === form.toUnit);
    const res = await fetch("/api/admin/quotas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUnit: form.toUnit,
        toUnitName: chosen?.name || form.toUnit,
        amount: Number(form.amount),
        note: form.note,
        year: new Date().getFullYear(),
      }),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({ toUnit: "", toUnitName: "", amount: "", note: "" });
      await fetchData();
    }
    setSubmitting(false);
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
          <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
            Giao chỉ tiêu tuyển quân
          </h1>
          <p className="text-sm mt-1" style={{ color: "#007aff" }}>
            {session && (
              <span className="font-medium">
                Đơn vị: {unitNames[session.unitCode] || session.unitCode} (
                {levelLabel[session.hierarchyLevel] || session.hierarchyLevel})
              </span>
            )}
          </p>
        </div>
        {session?.hierarchyLevel !== "xa" && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#007aff] hover:bg-[#636366] text-white rounded-xl transition-colors text-sm font-medium"
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
          <div className="bg-white rounded-2xl p-5 border border-[#e5e5ea] shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Chỉ tiêu được giao</p>
              <ArrowDown size={18} className="text-blue-500" />
            </div>
            <p className="text-3xl font-bold mt-2 text-blue-600">
              {totalReceived}
            </p>
            <p className="text-xs text-gray-400 mt-1">Từ cấp trên</p>
          </div>
        )}
        {!isBo && (
          <div className="bg-white rounded-2xl p-5 border border-[#e5e5ea] shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Đã nhập ngũ</p>
              <CheckCircle2 size={18} className="text-green-600" />
            </div>
            <p className="text-3xl font-bold mt-2 text-green-600">
              {totalFilled}
            </p>
            {totalReceived > 0 && (
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((totalFilled / totalReceived) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
        <div className="bg-white rounded-2xl p-5 border border-[#e5e5ea] shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Đã giao xuống</p>
            <ArrowUp size={18} style={{ color: "#007aff" }} />
          </div>
          <p className="text-3xl font-bold mt-2" style={{ color: "#007aff" }}>
            {totalAssigned}
          </p>
          <p className="text-xs text-gray-400 mt-1">Cho đơn vị cấp dưới</p>
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
                  ? "bg-[#007aff] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#007aff]"
              }`}
            >
              {{ all: "Tất cả", received: "Được giao", issued: "Đã giao" }[v]}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#e5e5ea] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f5f5f7]/50 text-[#636366] font-medium border-b border-[#e5e5ea]">
              <tr>
                <th className="px-6 py-4">Từ đơn vị</th>
                <th className="px-6 py-4">Đến đơn vị</th>
                <th className="px-6 py-4 text-center">Chỉ tiêu</th>
                <th className="px-6 py-4 text-center">Đã hoàn thành</th>
                <th className="px-6 py-4">Tiến độ</th>
                <th className="px-6 py-4">Ghi chú</th>
                <th className="px-6 py-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : displayQuotas.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-400"
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
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        {unitNames[q.fromUnit] || q.fromUnit}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {q.toUnitName}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-900">
                        {q.amount}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-green-600">
                        {q.filled}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: done ? "#059669" : "#007aff",
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {q.note || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={
                            done
                              ? { background: "#d1fae5", color: "#059669" }
                              : { background: "#fef3c7", color: "#d97706" }
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Giao chỉ tiêu
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {session && (
                <div className="p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-sm text-[#636366]">
                  Giao từ:{" "}
                  <span className="font-semibold">
                    {unitNames[session.unitCode] || session.unitCode}
                  </span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Đơn vị nhận *
                </label>
                {childUnits.length > 0 ? (
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#007aff]"
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
                  <p className="text-sm text-amber-600 p-2 rounded-lg bg-amber-50">
                    Không có đơn vị cấp dưới để giao chỉ tiêu.
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Số lượng chỉ tiêu *
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#007aff]"
                  placeholder="Ví dụ: 120"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Ghi chú
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#007aff] resize-none"
                  rows={2}
                  placeholder="Ghi chú thêm (nếu có)..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.toUnit || !form.amount}
                className="flex-1 py-2.5 bg-[#007aff] hover:bg-[#636366] disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
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
