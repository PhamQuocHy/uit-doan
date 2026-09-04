"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Send,
} from "lucide-react";

interface Doc {
  id: string;
  code: string;
  title: string;
  content: string;
  type: string;
  fromUnit: string;
  toUnits: string[];
  date: string;
  status: string;
  urgent: boolean;
}
interface ChildUnit {
  code: string;
  name: string;
}
interface Session {
  unitCode: string;
  hierarchyLevel: string;
  name: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: { label: "Chờ xử lý", color: "var(--color-m3-warning)", bg: "var(--color-m3-warning-container)" },
  processed: { label: "Đã xử lý", color: "var(--color-m3-success)", bg: "var(--color-m3-success-container)" },
  sent: { label: "Đã gửi", color: "var(--m3-primary, #1a73e8)", bg: "var(--m3-primary-container, #dae9fb)" },
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

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [childUnits, setChildUnits] = useState<ChildUnit[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [viewDoc, setViewDoc] = useState<Doc | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    content: "",
    urgent: false,
    type: "outgoing",
    selectedUnits: [] as string[],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, docsRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/admin/documents"),
    ]);
    if (meRes.ok) {
      const d = await meRes.json();
      setSession(d.user);
    }
    if (docsRes.ok) {
      const d = await docsRes.json();
      setDocs(d.data || []);

      // fetch children for the form recipient dropdown
      const quotasRes = await fetch("/api/admin/quotas");
      if (quotasRes.ok) {
        const q = await quotasRes.json();
        setChildUnits(q.childUnits || []);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!form.title || form.selectedUnits.length === 0) return;
    setSubmitting(true);
    const res = await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        content: form.content,
        toUnits: form.selectedUnits,
        urgent: form.urgent,
        type: form.type,
      }),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({
        title: "",
        content: "",
        urgent: false,
        type: "outgoing",
        selectedUnits: [],
      });
      await fetchData();
    }
    setSubmitting(false);
  };

  const filtered = docs.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || d.type === typeFilter;
    return matchSearch && matchType;
  });

  const incomingCount = docs.filter((d) => d.type === "incoming").length;
  const outgoingCount = docs.filter((d) => d.type === "outgoing").length;
  const pendingCount = docs.filter((d) => d.status === "pending").length;

  const levelLabel: Record<string, string> = {
    bo: "Bộ QP",
    tinh: "Tỉnh",
    huyen: "Huyện",
    xa: "Xã",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Công văn đến / đi
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            {session && (
              <span className="font-medium">
                Đơn vị: {unitNames[session.unitCode] || session.unitCode} (
                {levelLabel[session.hierarchyLevel] || session.hierarchyLevel})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-m3-primary hover:bg-m3-on-surface-variant text-white rounded-xl transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Soạn công văn
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Công văn đến",
            value: incomingCount,
            color: "var(--m3-primary, #1a73e8)",
            icon: ArrowDownCircle,
          },
          {
            label: "Công văn đi",
            value: outgoingCount,
            color: "var(--m3-primary, #1a73e8)",
            icon: ArrowUpCircle,
          },
          {
            label: "Chờ xử lý",
            value: pendingCount,
            color: "var(--color-m3-warning)",
            icon: Clock,
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-m3-surface-lowest rounded-2xl p-5 border border-m3-outline-variant shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-m3-on-surface-variant">{s.label}</p>
                <Icon size={18} style={{ color: s.color }} />
              </div>
              <p className="text-3xl font-bold mt-2" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề, số hiệu..."
              className="w-full pl-10 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary transition-colors"
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
              className="pl-10 pr-8 py-2 border border-m3-outline-variant rounded-xl text-sm appearance-none focus:outline-none focus:border-m3-primary bg-m3-surface-lowest cursor-pointer"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="incoming">Công văn đến</option>
              <option value="outgoing">Công văn đi</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
              <tr>
                <th className="px-6 py-4">Loại</th>
                <th className="px-6 py-4">Số hiệu</th>
                <th className="px-6 py-4">Tiêu đề</th>
                <th className="px-6 py-4">Từ đơn vị</th>
                <th className="px-6 py-4">Đơn vị nhận</th>
                <th className="px-6 py-4">Ngày</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-m3-on-surface-variant"
                  >
                    Không có công văn nào.
                  </td>
                </tr>
              ) : (
                filtered.map((doc) => {
                  const s = statusConfig[doc.status] || {
                    label: doc.status,
                    color: "var(--m3-on-surface-variant, #475569)",
                    bg: "var(--m3-surface-container-high, #eef1f4)",
                  };
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-m3-surface-high/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {doc.type === "incoming" ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                background: "var(--m3-primary-container, #dae9fb)",
                                color: "var(--m3-primary, #1a73e8)",
                              }}
                            >
                              <ArrowDownCircle size={12} /> Đến
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                background: "var(--m3-surface-container-high, #eef1f4)",
                                color: "var(--m3-primary, #1a73e8)",
                              }}
                            >
                              <ArrowUpCircle size={12} /> Đi
                            </span>
                          )}
                          {doc.urgent && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-bold"
                              style={{
                                background: "var(--m3-error-container, var(--m3-error-container, #ffdad6))",
                                color: "var(--m3-error, #ba1a1a)",
                              }}
                            >
                              !
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-m3-on-surface-variant">
                        {doc.code}
                      </td>
                      <td className="px-6 py-4 text-m3-on-surface max-w-[240px] truncate">
                        {doc.title}
                      </td>
                      <td className="px-6 py-4 text-m3-on-surface-variant text-xs">
                        {unitNames[doc.fromUnit] || doc.fromUnit}
                      </td>
                      <td className="px-6 py-4 text-m3-on-surface-variant text-xs max-w-[160px]">
                        {doc.toUnits.map((u) => unitNames[u] || u).join(", ")}
                      </td>
                      <td className="px-6 py-4 text-m3-on-surface-variant">
                        {new Date(doc.date).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {doc.status === "pending" ? (
                            <Clock size={12} />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewDoc(doc)}
                            className="p-1.5 text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-surface-high rounded-lg transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          <button className="p-1.5 text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-primary-container rounded-lg transition-colors">
                            <Download size={15} />
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
      </div>

      {/* Create Document Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-m3-surface-lowest rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-m3-outline-variant">
              <h2 className="text-lg font-semibold text-m3-on-surface">
                Soạn công văn mới
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-m3-surface-container rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-1">
                  Loại công văn
                </label>
                <select
                  className="w-full border border-m3-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-m3-primary"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="outgoing">
                    Công văn đi (Gửi xuống cấp dưới)
                  </option>
                  <option value="incoming">Báo cáo lên (Gửi cấp trên)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-1">
                  Tiêu đề *
                </label>
                <input
                  type="text"
                  className="w-full border border-m3-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-m3-primary"
                  placeholder="Nhập tiêu đề công văn..."
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-1">
                  Nội dung tóm tắt
                </label>
                <textarea
                  className="w-full border border-m3-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-m3-primary resize-none"
                  rows={3}
                  placeholder="Tóm tắt nội dung..."
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-2">
                  Đơn vị nhận *
                  {childUnits.length === 0 && (
                    <span className="ml-2 text-xs text-m3-on-warning-container font-normal">
                      (Không có đơn vị cấp dưới)
                    </span>
                  )}
                </label>
                {childUnits.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {childUnits.map((unit) => (
                      <label
                        key={unit.code}
                        className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-m3-surface-high"
                      >
                        <input
                          type="checkbox"
                          checked={form.selectedUnits.includes(unit.code)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...form.selectedUnits, unit.code]
                              : form.selectedUnits.filter(
                                  (u) => u !== unit.code,
                                );
                            setForm({ ...form, selectedUnits: next });
                          }}
                          className="accent-m3-primary"
                        />
                        <span className="text-sm text-m3-on-surface-variant">
                          {unit.name}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-m3-on-surface-variant italic">
                    Bạn ở cấp thấp nhất hoặc chưa có đơn vị trực thuộc.
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.urgent}
                  onChange={(e) =>
                    setForm({ ...form, urgent: e.target.checked })
                  }
                  className="accent-m3-error-container"
                />
                <span className="text-sm text-m3-on-error-container font-medium">
                  Đánh dấu KHẨN
                </span>
              </label>
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
                disabled={
                  submitting || !form.title || form.selectedUnits.length === 0
                }
                className="flex-1 py-2.5 bg-m3-primary hover:bg-m3-on-surface-variant disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              >
                <Send size={15} />
                {submitting ? "Đang gửi..." : "Gửi công văn"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Document Modal */}
      {viewDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-m3-surface-lowest rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-m3-outline-variant">
              <div>
                <span className="font-mono text-xs text-m3-on-surface-variant">
                  {viewDoc.code}
                </span>
                <h2 className="text-base font-semibold text-m3-on-surface mt-0.5">
                  {viewDoc.title}
                </h2>
              </div>
              <button
                onClick={() => setViewDoc(null)}
                className="p-1.5 hover:bg-m3-surface-container rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {viewDoc.urgent && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-m3-error-container text-m3-on-error-container text-sm font-medium">
                  <AlertCircle size={16} /> Công văn KHẨN
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-m3-on-surface-variant text-xs">Loại</p>
                  <p className="font-medium">
                    {viewDoc.type === "incoming" ? "Đến" : "Đi"}
                  </p>
                </div>
                <div>
                  <p className="text-m3-on-surface-variant text-xs">Ngày</p>
                  <p className="font-medium">
                    {new Date(viewDoc.date).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <div>
                  <p className="text-m3-on-surface-variant text-xs">Từ đơn vị</p>
                  <p className="font-medium">
                    {unitNames[viewDoc.fromUnit] || viewDoc.fromUnit}
                  </p>
                </div>
                <div>
                  <p className="text-m3-on-surface-variant text-xs">Đơn vị nhận</p>
                  <p className="font-medium">
                    {viewDoc.toUnits.map((u) => unitNames[u] || u).join(", ")}
                  </p>
                </div>
              </div>
              {viewDoc.content && (
                <div>
                  <p className="text-m3-on-surface-variant text-xs mb-1">Nội dung</p>
                  <p className="text-sm text-m3-on-surface-variant bg-m3-surface-high p-3 rounded-xl">
                    {viewDoc.content}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
