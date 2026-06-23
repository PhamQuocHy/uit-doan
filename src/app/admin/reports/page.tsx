"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  UserX,
  ShieldCheck,
  Download,
} from "lucide-react";

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("2026");
  const [userHierarchyLevel, setUserHierarchyLevel] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch User Info
        const meRes = await fetch("/api/auth/me");
        const meJson = await meRes.json();
        setUserHierarchyLevel(meJson.user?.hierarchyLevel || "");

        // Fetch Reports
        const res = await fetch("/api/admin/reports");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Đang tải báo cáo thống kê...
      </div>
    );
  }

  // View for Receiving Unit (Đơn vị nhận quân)
  if (userHierarchyLevel === "donvi") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Thống kê Đơn vị
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Báo cáo tiến độ tiếp nhận và tình hình quân số đơn vị
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl transition-all hover:bg-black text-sm font-medium">
            <Download size={16} />
            Xuất báo cáo
          </button>
        </div>

        {/* KPI Cards for Unit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Đã tiếp nhận</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">120</span>
                <span className="text-sm text-gray-400">/ 120 quân</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Sức khỏe đạt</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">116</span>
                <span className="text-sm text-green-500 font-medium">
                  (96.7%)
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <UserX size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Cần bổ sung</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">4</span>
                <span className="text-sm text-red-500 font-medium">
                  (Chờ xử lý)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Chart */}
          <div className="bg-white p-6 rounded-2xl border border-[#edf4dc] shadow-sm">
            <h2 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-[#748c2c]" />
              Tiến độ nhận quân theo ngày
            </h2>
            <div className="h-48 flex items-end gap-3 px-2">
              {[20, 35, 60, 80, 100, 100].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-2 group"
                >
                  <div
                    className="w-full bg-blue-100 rounded-lg relative transition-all duration-500 group-hover:bg-blue-200"
                    style={{ height: `${h}%` }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 bg-blue-500 rounded-lg transition-all"
                      style={{ height: `${h / 2}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Ngày {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Health Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-[#edf4dc] shadow-sm">
            <h2 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
              <PieChart size={20} className="text-[#748c2c]" />
              Phân loại sức khỏe quân nhân
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                <span className="text-sm text-gray-600">Loại 1 (Rất tốt)</span>
                <span className="font-bold text-gray-900">85 (70.8%)</span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                <span className="text-sm text-gray-600">Loại 2 (Tốt)</span>
                <span className="font-bold text-gray-900">31 (25.8%)</span>
              </div>
              <div className="flex justify-between items-center bg-red-50 p-3 rounded-xl">
                <span className="text-sm text-red-600 font-medium">
                  Loại 3 (Không đạt)
                </span>
                <span className="font-bold text-red-700">4 (3.4%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default Ministry View
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
            Báo cáo & Thống kê
          </h1>
          <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
            Tổng hợp dữ liệu, xu hướng và kết quả công tác Nghĩa vụ Quân sự
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:border-[#748c2c] transition-colors bg-white font-medium"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="2026">Báo cáo: Năm 2026</option>
            <option value="2025">Báo cáo: Năm 2025</option>
            <option value="2024">Báo cáo: Năm 2024</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl transition-colors text-sm font-medium">
            <Download size={16} />
            Xuất PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Tổng trong độ tuổi
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {data.overview.totalCitizens.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Sẵn sàng gọi khám
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {data.overview.availableForDraft.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <UserX size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Tạm hoãn / Miễn</p>
            <p className="text-2xl font-bold text-gray-900">
              {data.overview.deferred.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#edf4dc] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Đang tại ngũ</p>
            <p className="text-2xl font-bold text-gray-900">
              {data.overview.inService.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Recruitment Trends */}
        <div className="bg-white p-6 rounded-2xl border border-[#edf4dc] shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6 text-[#586c23]">
            <BarChart3 size={20} />
            <h2 className="font-bold text-lg">Biểu đồ kết quả gọi quân</h2>
          </div>
          <div className="flex-1 flex items-end gap-4 h-64 pt-4 border-b border-l border-gray-100 px-4">
            {data.recruitmentStatsByYear.map((stat: any, index: number) => {
              const max = Math.max(
                ...data.recruitmentStatsByYear.map((s: any) => s.called),
              );
              const calledHeight = (stat.called / max) * 100;
              const passedHeight = (stat.passed / max) * 100;

              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center justify-end h-full gap-2 group relative"
                >
                  <div className="w-full max-w-[40px] flex items-end justify-center gap-1 h-full">
                    <div
                      className="w-1/2 bg-blue-400 rounded-t-sm transition-all duration-500 group-hover:opacity-80 relative"
                      style={{ height: `${calledHeight}%` }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap transition-opacity">
                        Gọi: {stat.called}
                      </div>
                    </div>
                    <div
                      className="w-1/2 bg-green-500 rounded-t-sm transition-all duration-500 group-hover:opacity-80 relative"
                      style={{ height: `${passedHeight}%` }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap transition-opacity">
                        Trúng: {stat.passed}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-gray-500">
                    {stat.year}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-6 mt-4 opacity-80">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <span className="text-xs text-gray-600">Phát lệnh gọi</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-600">Trúng tuyển</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Deferment Reasons (Mocked as Bar due to lack of Recharts) */}
        <div className="bg-white p-6 rounded-2xl border border-[#edf4dc] shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6 text-[#586c23]">
            <PieChart size={20} />
            <h2 className="font-bold text-lg">
              Lý do Tạm hoãn / Miễn gọi {yearFilter}
            </h2>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-5">
            {data.defermentReasons.map((item: any, index: number) => (
              <div key={index}>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {item.reason}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {item.value.toLocaleString()}{" "}
                    <span className="text-gray-400 text-xs font-normal">
                      ({item.percentage}%)
                    </span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-1000"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor:
                        index === 0
                          ? "#3b82f6"
                          : index === 1
                            ? "#f59e0b"
                            : index === 2
                              ? "#ec4899"
                              : "#8b5cf6",
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
