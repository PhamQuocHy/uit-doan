"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  CheckSquare,
  Check,
  X,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const mockApprovals = [
  {
    id: "1",
    fullName: "Nguyễn Văn An",
    cccd: "079300012345",
    dob: "2002-03-14",
    unit: "Xã Bình Hưng",
    healthResult: "Loại 1",
    politicalResult: "Đạt",
    status: "pending",
  },
  {
    id: "2",
    fullName: "Trần Thị Bình",
    cccd: "079300056789",
    dob: "2003-07-22",
    unit: "Xã Long Hòa",
    healthResult: "Loại 2",
    politicalResult: "Đạt",
    status: "approved",
  },
  {
    id: "3",
    fullName: "Lê Minh Cường",
    cccd: "079300098765",
    dob: "2001-11-05",
    unit: "Xã Hiệp Phước",
    healthResult: "Loại 3",
    politicalResult: "Đạt",
    status: "rejected",
  },
  {
    id: "4",
    fullName: "Phạm Văn Dũng",
    cccd: "079300043210",
    dob: "2002-09-17",
    unit: "Xã Phú Hòa Đông",
    healthResult: "Loại 1",
    politicalResult: "Đạt",
    status: "pending",
  },
  {
    id: "5",
    fullName: "Hoàng Thị Em",
    cccd: "079300011111",
    dob: "2003-01-30",
    unit: "Xã Tân Thạnh Tây",
    healthResult: "Loại 2",
    politicalResult: "Đạt",
    status: "approved",
  },
];

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = mockApprovals.filter((r) => {
    const matchSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.cccd.includes(search);
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    pending: mockApprovals.filter((r) => r.status === "pending").length,
    approved: mockApprovals.filter((r) => r.status === "approved").length,
    rejected: mockApprovals.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
            Xét duyệt danh sách nhập ngũ
          </h1>
          <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
            Phê duyệt danh sách thanh niên đủ điều kiện nhập ngũ sau khám tuyển
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Chờ duyệt",
            value: counts.pending,
            color: "#d97706",
            bg: "#fef3c7",
          },
          {
            label: "Đã duyệt",
            value: counts.approved,
            color: "#059669",
            bg: "#d1fae5",
          },
          {
            label: "Không đạt",
            value: counts.rejected,
            color: "#dc2626",
            bg: "#fee2e2",
          },
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

      <div className="bg-white rounded-2xl shadow-sm border border-[#edf4dc] overflow-hidden">
        <div className="p-4 border-b border-[#edf4dc] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm theo họ tên, số CCCD..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#748c2c] transition-colors"
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
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:border-[#748c2c] bg-white cursor-pointer"
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
            <thead className="bg-[#f8fae8]/50 text-[#586c23] font-medium border-b border-[#edf4dc]">
              <tr>
                <th className="px-6 py-4">Họ và Tên</th>
                <th className="px-6 py-4">Đơn vị</th>
                <th className="px-6 py-4">Kết quả SK</th>
                <th className="px-6 py-4">Kết quả CT</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => {
                const s = statusConfig[row.status];
                const Icon = s.icon;
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {row.fullName}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {row.cccd}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Sinh: {new Date(row.dob).toLocaleDateString("vi-VN")}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{row.unit}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {row.healthResult}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                        style={
                          row.politicalResult === "Đạt"
                            ? { background: "#d1fae5", color: "#059669" }
                            : { background: "#fee2e2", color: "#dc2626" }
                        }
                      >
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
                        <button
                          className="p-1.5 text-gray-400 hover:text-[#748c2c] hover:bg-[#f8fae8] rounded-lg transition-colors"
                          title="Xem"
                        >
                          <Eye size={15} />
                        </button>
                        {row.status === "pending" && (
                          <>
                            <button
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Duyệt"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Từ chối"
                            >
                              <X size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
