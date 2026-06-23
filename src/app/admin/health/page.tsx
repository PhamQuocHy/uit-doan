"use client";

import { useState, useEffect } from "react";
import { HealthRecord } from "@/lib/data";
import {
  Search,
  HeartPulse,
  Activity,
  Filter,
  Eye,
  Edit2,
  Plus,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function HealthPage() {
  const searchParams = useSearchParams();
  const initialYear = searchParams.get("year") || "2026";

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [yearFilter, setYearFilter] = useState(initialYear);
  const [conclusionFilter, setConclusionFilter] = useState("");

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(yearFilter && { year: yearFilter }),
        ...(conclusionFilter && { conclusion: conclusionFilter }),
      });
      const res = await fetch(`/api/admin/health?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRecords(data.data);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, yearFilter, conclusionFilter]);

  const getConclusionStyle = (conclusion: string) => {
    if (
      conclusion === "Loại 1" ||
      conclusion === "Loại 2" ||
      conclusion === "Loại 3"
    ) {
      return { bg: "#d1fae5", text: "#059669" }; // Green
    }
    return { bg: "#fee2e2", text: "#dc2626" }; // Red (Unfit)
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
            Hồ sơ Sức khỏe
          </h1>
          <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
            Quản lý lịch sử khám sức khỏe và phân loại vòng khám
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#748c2c] hover:bg-[#586c23] text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} />
          Thêm hồ sơ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <HeartPulse size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Đạt chuẩn (L1-L3)
            </p>
            <p className="text-2xl font-bold text-gray-900">450</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Không đạt (L4-L6)
            </p>
            <p className="text-2xl font-bold text-gray-900">120</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#edf4dc] overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-[#edf4dc] flex flex-col sm:flex-row gap-4">
          <div className="flex flex-1 gap-2">
            <div className="relative">
              <Filter
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <select
                className="pl-10 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:border-[#748c2c] transition-colors bg-white cursor-pointer"
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="2026">Năm 2026</option>
                <option value="2025">Năm 2025</option>
                <option value="2024">Năm 2024</option>
              </select>
            </div>
            <div className="relative">
              <select
                className="px-4 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:border-[#748c2c] transition-colors bg-white cursor-pointer"
                value={conclusionFilter}
                onChange={(e) => {
                  setConclusionFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả phân loại</option>
                <option value="Loại 1">Loại 1</option>
                <option value="Loại 2">Loại 2</option>
                <option value="Loại 3">Loại 3</option>
                <option value="Loại 4">Loại 4</option>
                <option value="Loại 5">Loại 5</option>
                <option value="Loại 6">Loại 6</option>
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
                <th className="px-6 py-4">Giai đoạn khám</th>
                <th className="px-6 py-4">Chiều cao/Cân nặng</th>
                <th className="px-6 py-4">Huyết áp/Thị lực</th>
                <th className="px-6 py-4">Phân loại</th>
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
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    Không tìm thấy hồ sơ nào.
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const style = getConclusionStyle(record.conclusion);
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {record.citizenName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          CCCD: {record.citizenCccd}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{record.phase}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Năm {record.year}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {record.height} cm / {record.weight} kg
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        HA: {record.bloodPressure}
                        <br />
                        Mắt: {record.vision}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: style.bg,
                            color: style.text,
                          }}
                        >
                          {record.conclusion}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {record.doctor}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-1.5 text-gray-400 hover:text-[#748c2c] hover:bg-[#f8fae8] rounded-lg transition-colors"
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
    </div>
  );
}
