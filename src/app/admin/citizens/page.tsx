"use client";

import { useState, useEffect } from "react";
import { Citizen } from "@/lib/data";
import { Search, Plus, Filter, Eye, Edit2, Trash2 } from "lucide-react";
import CitizenDetailModal from "@/components/admin/CitizenDetailModal";

export default function CitizensPage() {
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [militaryStatusFilter, setMilitaryStatusFilter] = useState("");
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);

  const fetchCitizens = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
        ...(militaryStatusFilter && { militaryStatus: militaryStatusFilter }),
      });
      const res = await fetch(`/api/admin/citizens?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCitizens(data.data);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCitizens();
  }, [page, search, militaryStatusFilter]);

  const getMilitaryStatusLabel = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      chuakham: { label: "Chưa khám", color: "#6b7280", bg: "#f3f4f6" },
      dangkham: { label: "Đang khám", color: "#d97706", bg: "#fef3c7" },
      trungtuyen: { label: "Trúng tuyển", color: "#059669", bg: "#d1fae5" },
      tamhoan: { label: "Tạm hoãn", color: "#2563eb", bg: "#dbeafe" },
      miengoi: { label: "Miễn gọi", color: "#7c3aed", bg: "#ede9fe" },
      nhapngu: { label: "Nhập ngũ", color: "#dc2626", bg: "#fee2e2" },
    };
    return map[status] || { label: status, color: "#6b7280", bg: "#f3f4f6" };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
            Quản lý Công dân
          </h1>
          <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
            Quản lý thanh niên trong độ tuổi nghĩa vụ quân sự
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#748c2c] hover:bg-[#586c23] text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} />
          Thêm công dân
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#edf4dc] overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-[#edf4dc] flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, CCCD, SĐT..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#748c2c] transition-colors"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <select
                className="pl-10 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:border-[#748c2c] transition-colors bg-white cursor-pointer"
                value={militaryStatusFilter}
                onChange={(e) => {
                  setMilitaryStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả trạng thái NVQS</option>
                <option value="chuakham">Chưa khám</option>
                <option value="dangkham">Đang khám</option>
                <option value="trungtuyen">Trúng tuyển</option>
                <option value="tamhoan">Tạm hoãn</option>
                <option value="miengoi">Miễn gọi</option>
                <option value="nhapngu">Nhập ngũ</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fae8]/50 text-[#586c23] font-medium border-b border-[#edf4dc]">
              <tr>
                <th className="px-6 py-4">Họ và Tên</th>
                <th className="px-6 py-4">Ngày sinh</th>
                <th className="px-6 py-4">CCCD / Hộ chiếu</th>
                <th className="px-6 py-4">Học vấn & Việc làm</th>
                <th className="px-6 py-4">Trạng thái NVQS</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : citizens.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    Không tìm thấy công dân nào.
                  </td>
                </tr>
              ) : (
                citizens.map((citizen) => {
                  const statusInfo = getMilitaryStatusLabel(
                    citizen.militaryStatus,
                  );
                  return (
                    <tr
                      key={citizen.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {citizen.fullName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {citizen.gender === "male" ? "Nam" : "Nữ"} •{" "}
                          {citizen.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(citizen.dateOfBirth).toLocaleDateString(
                          "vi-VN",
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-mono text-xs">
                        {citizen.cccd}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">
                          {citizen.educationLevel}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {citizen.job}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: statusInfo.bg,
                            color: statusInfo.color,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                        {citizen.healthStatus && (
                          <div className="text-xs text-gray-500 mt-1">
                            Sức khỏe: {citizen.healthStatus}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedCitizen(citizen)}
                            className="p-1.5 text-gray-400 hover:text-olive-600 hover:bg-olive-50 rounded-lg transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
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

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-[#edf4dc] flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600"
              >
                Trước
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      <CitizenDetailModal
        citizen={selectedCitizen}
        onClose={() => setSelectedCitizen(null)}
      />
    </div>
  );
}
