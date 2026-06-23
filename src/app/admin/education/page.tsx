"use client";

import { useState, useEffect } from "react";
import { Citizen } from "@/lib/data";
import {
  Search,
  GraduationCap,
  Building,
  Filter,
  CheckCircle,
} from "lucide-react";

export default function EducationPage() {
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchCitizens = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
        ...(statusFilter && { militaryStatus: statusFilter }),
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
  }, [page, search, statusFilter]);

  const handleDefer = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xét duyệt tạm hoãn cho công dân này?"))
      return;
    try {
      // In a real app, this would be a PUT/PATCH request
      alert("Đã cập nhật trạng thái tạm hoãn thành công (Demo)");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
            Học vấn & Việc làm
          </h1>
          <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
            Quản lý và xét duyệt tạm hoãn NVQS cho diện đi học / đi làm
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Đang đi học</p>
            <p className="text-2xl font-bold text-gray-900">124</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Building size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Đang làm việc</p>
            <p className="text-2xl font-bold text-gray-900">86</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Đã duyệt hoãn</p>
            <p className="text-2xl font-bold text-gray-900">45</p>
          </div>
        </div>
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
              placeholder="Tìm kiếm theo tên, trường học, công ty..."
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
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả diện</option>
                <option value="tamhoan">Đang tạm hoãn</option>
                <option value="chuakham">Chờ xét duyệt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fae8]/50 text-[#586c23] font-medium border-b border-[#edf4dc]">
              <tr>
                <th className="px-6 py-4">Công dân</th>
                <th className="px-6 py-4">Ngày sinh</th>
                <th className="px-6 py-4">Trình độ / Nơi thường trú</th>
                <th className="px-6 py-4">Đơn vị Học tập / Công tác</th>
                <th className="px-6 py-4">Trạng thái NVQS</th>
                <th className="px-6 py-4 text-center">Xét duyệt</th>
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
                citizens.map((citizen) => (
                  <tr
                    key={citizen.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {citizen.fullName}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        CCCD: {citizen.cccd}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(citizen.dateOfBirth).toLocaleDateString(
                        "vi-VN",
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-medium">
                        {citizen.educationLevel}
                      </div>
                      <div
                        className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate"
                        title={citizen.address}
                      >
                        {citizen.address}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 flex items-center gap-2">
                        {citizen.job.toLowerCase().includes("sinh viên") ||
                        citizen.job.toLowerCase().includes("học sinh") ? (
                          <GraduationCap size={14} className="text-blue-500" />
                        ) : (
                          <Building size={14} className="text-orange-500" />
                        )}
                        {citizen.job}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {citizen.militaryStatus === "tamhoan" ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Tạm hoãn
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Chưa duyệt
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDefer(citizen.id)}
                        disabled={citizen.militaryStatus === "tamhoan"}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background:
                            citizen.militaryStatus === "tamhoan"
                              ? "#f3f4f6"
                              : "#f8fae8",
                          color:
                            citizen.militaryStatus === "tamhoan"
                              ? "#9ca3af"
                              : "#586c23",
                          border:
                            citizen.militaryStatus === "tamhoan"
                              ? "1px solid transparent"
                              : "1px solid #dce7ba",
                        }}
                      >
                        {citizen.militaryStatus === "tamhoan"
                          ? "Đã duyệt"
                          : "Duyệt hoãn"}
                      </button>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}
