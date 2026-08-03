"use client";

import { useState } from "react";
import {
  Dumbbell,
  Plus,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";

const mockTrainings = [
  {
    id: "1",
    name: "Huấn luyện bổ sung 2026 – Đợt 1",
    type: "Huấn luyện định kỳ",
    location: "Trường Quân sự TP. HCM",
    startDate: "2026-03-10",
    endDate: "2026-03-20",
    participants: 45,
    registered: 42,
    status: "upcoming",
  },
  {
    id: "2",
    name: "Diễn tập PCCC & Cứu nạn 2026",
    type: "Diễn tập",
    location: "Huyện Bình Chánh",
    startDate: "2026-02-15",
    endDate: "2026-02-17",
    participants: 30,
    registered: 30,
    status: "completed",
  },
  {
    id: "3",
    name: "Huấn luyện chiến thuật tiểu đội",
    type: "Huấn luyện nâng cao",
    location: "Trường Quân sự TP. HCM",
    startDate: "2026-04-05",
    endDate: "2026-04-15",
    participants: 60,
    registered: 55,
    status: "upcoming",
  },
  {
    id: "4",
    name: "Kiểm tra sức khỏe định kỳ lực lượng dự bị",
    type: "Kiểm tra y tế",
    location: "Bệnh viện Quân y 175",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    participants: 120,
    registered: 118,
    status: "ongoing",
  },
];

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  upcoming: {
    label: "Sắp diễn ra",
    color: "#2563eb",
    bg: "#dbeafe",
    icon: Clock,
  },
  ongoing: {
    label: "Đang diễn ra",
    color: "#d97706",
    bg: "#fef3c7",
    icon: AlertCircle,
  },
  completed: {
    label: "Đã hoàn thành",
    color: "#059669",
    bg: "#d1fae5",
    icon: CheckCircle2,
  },
};

const typeColors: Record<string, string> = {
  "Huấn luyện định kỳ": "#007aff",
  "Diễn tập": "#7c3aed",
  "Huấn luyện nâng cao": "#2563eb",
  "Kiểm tra y tế": "#d97706",
};

export default function TrainingPage() {
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = typeFilter
    ? mockTrainings.filter((t) => t.type === typeFilter)
    : mockTrainings;

  const types = Array.from(new Set(mockTrainings.map((t) => t.type)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
            Huấn luyện & Diễn tập
          </h1>
          <p className="text-sm mt-1" style={{ color: "#007aff" }}>
            Quản lý lịch huấn luyện, diễn tập và kết quả của lực lượng dân quân,
            dự bị
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#007aff] hover:bg-[#636366] text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} />
          Tạo đợt huấn luyện
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng đợt", value: mockTrainings.length, color: "#1d1d1f" },
          {
            label: "Sắp diễn ra",
            value: mockTrainings.filter((t) => t.status === "upcoming").length,
            color: "#2563eb",
          },
          {
            label: "Đang diễn ra",
            value: mockTrainings.filter((t) => t.status === "ongoing").length,
            color: "#d97706",
          },
          {
            label: "Đã hoàn thành",
            value: mockTrainings.filter((t) => t.status === "completed").length,
            color: "#059669",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-5 border border-[#e5e5ea] shadow-sm"
          >
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTypeFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!typeFilter ? "bg-[#007aff] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#007aff]"}`}
        >
          Tất cả
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${typeFilter === t ? "bg-[#007aff] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#007aff]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((training) => {
          const s = statusConfig[training.status];
          const Icon = s.icon;
          const pct = Math.round(
            (training.registered / training.participants) * 100,
          );
          return (
            <div
              key={training.id}
              className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mb-2"
                    style={{
                      background: typeColors[training.type] + "20",
                      color: typeColors[training.type],
                    }}
                  >
                    {training.type}
                  </span>
                  <h3 className="font-semibold text-gray-900 leading-tight">
                    {training.name}
                  </h3>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={{ background: s.bg, color: s.color }}
                >
                  <Icon size={12} />
                  {s.label}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <span>
                    {new Date(training.startDate).toLocaleDateString("vi-VN")} –{" "}
                    {new Date(training.endDate).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Dumbbell size={14} className="text-gray-400" />
                  <span>{training.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-gray-400" />
                  <span>
                    {training.registered} / {training.participants} người đăng
                    ký
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Tỷ lệ đăng ký</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: "#007aff" }}
                  />
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-1.5 py-2 border border-[#e5e5ea] text-[#007aff] hover:bg-[#f5f5f7] rounded-xl text-sm font-medium transition-colors">
                <Eye size={15} />
                Xem chi tiết
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
