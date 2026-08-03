"use client";

import { useState } from "react";
import { Shield, Search, Filter, Eye, Edit2, Plus, User2 } from "lucide-react";

const mockReserves = [
  {
    id: "1",
    fullName: "Nguyễn Văn An",
    cccd: "079300012345",
    dob: "2002-03-14",
    unit: "Đại đội 1/Huyện Bình Chánh",
    discharged: "2024-12-31",
    reserveClass: "Hạng 1",
    specialty: "Bộ binh",
    lastTraining: "2025-08-15",
    status: "active",
  },
  {
    id: "2",
    fullName: "Trần Văn Bảo",
    cccd: "079300076543",
    dob: "2000-05-20",
    unit: "Đại đội 2/Huyện Củ Chi",
    discharged: "2023-12-31",
    reserveClass: "Hạng 1",
    specialty: "Công binh",
    lastTraining: "2025-07-10",
    status: "active",
  },
  {
    id: "3",
    fullName: "Lê Thành Công",
    cccd: "079300034567",
    dob: "2001-08-08",
    unit: "Đại đội 3/Huyện Hóc Môn",
    discharged: "2024-06-30",
    reserveClass: "Hạng 2",
    specialty: "Thông tin",
    lastTraining: "2025-06-20",
    status: "inactive",
  },
  {
    id: "4",
    fullName: "Phạm Đức Duy",
    cccd: "079300021098",
    dob: "2003-01-25",
    unit: "Đại đội 1/Huyện Bình Chánh",
    discharged: "2025-12-31",
    reserveClass: "Hạng 1",
    specialty: "Bộ binh",
    lastTraining: "2025-09-01",
    status: "active",
  },
];

export default function ReservePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = mockReserves.filter((r) => {
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
          <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
            Quân nhân dự bị
          </h1>
          <p className="text-sm mt-1" style={{ color: "#007aff" }}>
            Quản lý danh sách quân nhân dự bị động viên và sẵn sàng chiến đấu
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#007aff] hover:bg-[#636366] text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} />
          Thêm quân nhân dự bị
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Tổng quân nhân dự bị",
            value: mockReserves.length,
            color: "#1d1d1f",
          },
          {
            label: "Đang hoạt động",
            value: mockReserves.filter((r) => r.status === "active").length,
            color: "#059669",
          },
          {
            label: "Ngừng hoạt động",
            value: mockReserves.filter((r) => r.status === "inactive").length,
            color: "#9ca3af",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-5 border border-[#e5e5ea] shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield size={18} style={{ color: s.color }} />
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
            <p className="text-3xl font-bold" style={{ color: s.color }}>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#007aff] transition-colors"
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
              className="pl-10 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:border-[#007aff] bg-white cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f5f5f7]/50 text-[#636366] font-medium border-b border-[#e5e5ea]">
              <tr>
                <th className="px-6 py-4">Họ và Tên</th>
                <th className="px-6 py-4">Đơn vị dự bị</th>
                <th className="px-6 py-4">Xuất ngũ</th>
                <th className="px-6 py-4">Hạng dự bị</th>
                <th className="px-6 py-4">Chuyên ngành</th>
                <th className="px-6 py-4">Huấn luyện gần nhất</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center shrink-0">
                        <User2 size={14} style={{ color: "#007aff" }} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {row.fullName}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {row.cccd}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-xs">
                    {row.unit}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(row.discharged).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={
                        row.reserveClass === "Hạng 1"
                          ? { background: "#dbeafe", color: "#2563eb" }
                          : { background: "#f3f4f6", color: "#6b7280" }
                      }
                    >
                      {row.reserveClass}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{row.specialty}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(row.lastTraining).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium"
                      style={
                        row.status === "active"
                          ? { background: "#d1fae5", color: "#059669" }
                          : { background: "#f3f4f6", color: "#9ca3af" }
                      }
                    >
                      {row.status === "active" ? "Hoạt động" : "Ngừng"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1.5 text-gray-400 hover:text-[#007aff] hover:bg-[#f5f5f7] rounded-lg transition-colors">
                        <Eye size={15} />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
