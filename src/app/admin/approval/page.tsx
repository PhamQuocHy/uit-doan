"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Filter,
  Check,
  X,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { ApprovalRow } from "@/lib/enlistment-approval";

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  pending: { label: "Chờ duyệt", color: "#d97706", bg: "#fef3c7", icon: Clock },
  approved: {
    label: "Đã duyệt",
    color: "#059669",
    bg: "#d1fae5",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Không đạt",
    color: "#dc2626",
    bg: "#fee2e2",
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      if (statusFilter) q.set("status", statusFilter);
      const res = await fetch(`/api/admin/approval?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.data || []);
        setCounts(data.counts || { pending: 0, approved: 0, rejected: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
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
        <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
          Xét duyệt danh sách nhập ngũ
        </h1>
        <p className="text-sm mt-1" style={{ color: "#007aff" }}>
          Chỉ hiển thị hồ sơ được đánh dấu Dự kiến gọi từ mục Hồ sơ công dân
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Chờ duyệt", value: counts.pending, color: "#d97706", bg: "#fef3c7" },
          { label: "Đã duyệt", value: counts.approved, color: "#059669", bg: "#d1fae5" },
          { label: "Không đạt", value: counts.rejected, color: "#dc2626", bg: "#fee2e2" },
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

      <div className="bg-white rounded-2xl shadow-sm border border-[#e5e5ea] overflow-hidden">
        <div className="p-4 border-b border-[#e5e5ea] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm theo họ tên, số CCCD..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#007aff]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <select
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white"
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
            <thead className="bg-[#f5f5f7]/50 text-[#636366] font-medium border-b border-[#e5e5ea]">
              <tr>
                <th className="px-6 py-4">Họ và Tên</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4">Kết quả SK</th>
                <th className="px-6 py-4">Kết quả CT</th>
                <th className="px-6 py-4">Trạng thái duyệt</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                    Chưa có hồ sơ dự kiến gọi. Vào Hồ sơ công dân → tab NVQS → chọn Dự kiến gọi.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const s = statusConfig[row.status];
                  const Icon = s.icon;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{row.fullName}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                          {row.cccd}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Sinh: {new Date(row.dateOfBirth).toLocaleDateString("vi-VN")}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{row.unitName}</td>
                      <td className="px-6 py-4 font-medium">{row.healthResult}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
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
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                                title="Duyệt gọi nhập ngũ"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => void handleAction(row.id, "reject")}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
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
