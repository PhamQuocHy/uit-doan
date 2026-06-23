"use client";

import { useState } from "react";
import {
  MapPin,
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

const mockData = [
  {
    id: "1",
    fullName: "Nguyễn Văn An",
    cccd: "079300012345",
    oldAddress: "Xã Bình Thuận, Huyện Bình Chánh, TP. HCM",
    newAddress: "Phường 5, Quận 8, TP. HCM",
    changeDate: "2026-01-15",
    status: "confirmed",
    reason: "Đổi chỗ ở để làm việc",
  },
  {
    id: "2",
    fullName: "Trần Thị Bình",
    cccd: "079300056789",
    oldAddress: "Xã Long An, Huyện Long Thành, Đồng Nai",
    newAddress: "Phường 12, Quận Bình Thạnh, TP. HCM",
    changeDate: "2026-02-03",
    status: "pending",
    reason: "Học tập tại TPHCM",
  },
  {
    id: "3",
    fullName: "Lê Minh Cường",
    cccd: "079300098765",
    oldAddress: "Phường Tân Phú, Quận Tân Phú, TP. HCM",
    newAddress: "Xã Hòa Phú, Huyện Củ Chi, TP. HCM",
    changeDate: "2026-02-20",
    status: "confirmed",
    reason: "Về quê lập nghiệp",
  },
  {
    id: "4",
    fullName: "Phạm Văn Dũng",
    cccd: "079300043210",
    oldAddress: "Phường Bình Hưng Hòa, Quận Bình Tân, TP. HCM",
    newAddress: "Huyện Hóc Môn, TP. HCM",
    changeDate: "2026-03-01",
    status: "processing",
    reason: "Chuyển hộ khẩu gia đình",
  },
];

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  confirmed: {
    label: "Đã xác nhận",
    color: "#059669",
    bg: "#d1fae5",
    icon: CheckCircle2,
  },
  pending: {
    label: "Chờ xác nhận",
    color: "#d97706",
    bg: "#fef3c7",
    icon: Clock,
  },
  processing: {
    label: "Đang xử lý",
    color: "#2563eb",
    bg: "#dbeafe",
    icon: AlertCircle,
  },
};

export default function ResidencePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = mockData.filter((r) => {
    const matchSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.cccd.includes(search);
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
            Biến động Cư trú
          </h1>
          <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
            Theo dõi thay đổi địa chỉ cư trú của thanh niên trong diện NVQS
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#748c2c] hover:bg-[#586c23] text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} />
          Ghi nhận biến động
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Tổng biến động", value: mockData.length, color: "#748c2c" },
          {
            label: "Chờ xác nhận",
            value: mockData.filter((d) => d.status === "pending").length,
            color: "#d97706",
          },
          {
            label: "Đã xác nhận",
            value: mockData.filter((d) => d.status === "confirmed").length,
            color: "#059669",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-5 border border-[#edf4dc] shadow-sm"
          >
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p
              className="text-3xl font-bold mt-1"
              style={{ color: stat.color }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#edf4dc] overflow-hidden">
        {/* Filters */}
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
              <option value="confirmed">Đã xác nhận</option>
              <option value="pending">Chờ xác nhận</option>
              <option value="processing">Đang xử lý</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fae8]/50 text-[#586c23] font-medium border-b border-[#edf4dc]">
              <tr>
                <th className="px-6 py-4">Họ và Tên</th>
                <th className="px-6 py-4">Địa chỉ cũ</th>
                <th className="px-6 py-4">Địa chỉ mới</th>
                <th className="px-6 py-4">Ngày thay đổi</th>
                <th className="px-6 py-4">Lý do</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    Không tìm thấy kết quả nào.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
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
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs max-w-[180px]">
                        {row.oldAddress}
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-xs max-w-[180px] font-medium">
                        {row.newAddress}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(row.changeDate).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs max-w-[160px]">
                        {row.reason}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: s.bg, color: s.color }}
                        >
                          <Icon size={12} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-1.5 text-gray-400 hover:text-[#748c2c] hover:bg-[#f8fae8] rounded-lg transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={16} />
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
    </div>
  );
}
