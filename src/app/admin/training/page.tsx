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
    color: "var(--m3-primary, #1a73e8)",
    bg: "var(--m3-primary-container, #dae9fb)",
    icon: Clock,
  },
  ongoing: {
    label: "Đang diễn ra",
    color: "var(--color-m3-warning)",
    bg: "var(--color-m3-warning-container)",
    icon: AlertCircle,
  },
  completed: {
    label: "Đã hoàn thành",
    color: "var(--color-m3-success)",
    bg: "var(--color-m3-success-container)",
    icon: CheckCircle2,
  },
};

const typeColors: Record<string, string> = {
  "Huấn luyện định kỳ": "var(--m3-primary, #1a73e8)",
  "Diễn tập": "var(--m3-tertiary, #5a5f6e)",
  "Huấn luyện nâng cao": "var(--m3-primary, #1a73e8)",
  "Kiểm tra y tế": "var(--color-m3-warning)",
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
          <h1 className="text-[22px] font-bold tracking-tight text-m3-on-surface">
            Huấn luyện & Diễn tập
          </h1>
          <p className="mt-1.5 text-[14px] text-m3-on-surface-variant">
            Quản lý lịch huấn luyện, diễn tập và kết quả của lực lượng dân quân,
            dự bị
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-m3-primary hover:bg-m3-on-surface-variant text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} />
          Tạo đợt huấn luyện
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng đợt", value: mockTrainings.length, color: "var(--m3-on-surface, #1b1d20)" },
          {
            label: "Sắp diễn ra",
            value: mockTrainings.filter((t) => t.status === "upcoming").length,
            color: "var(--m3-primary, #1a73e8)",
          },
          {
            label: "Đang diễn ra",
            value: mockTrainings.filter((t) => t.status === "ongoing").length,
            color: "var(--color-m3-warning)",
          },
          {
            label: "Đã hoàn thành",
            value: mockTrainings.filter((t) => t.status === "completed").length,
            color: "var(--color-m3-success)",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="macos-card p-5"
          >
            <p className="text-sm text-m3-on-surface-variant">{s.label}</p>
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
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!typeFilter ? "bg-m3-primary text-white" : "bg-m3-surface-lowest border border-m3-outline-variant text-m3-on-surface-variant hover:border-m3-primary"}`}
        >
          Tất cả
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${typeFilter === t ? "bg-m3-primary text-white" : "bg-m3-surface-lowest border border-m3-outline-variant text-m3-on-surface-variant hover:border-m3-primary"}`}
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
              className="macos-card p-5 space-y-4"
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
                  <h3 className="font-semibold text-m3-on-surface leading-tight">
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

              <div className="space-y-2 text-sm text-m3-on-surface-variant">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-m3-on-surface-variant" />
                  <span>
                    {new Date(training.startDate).toLocaleDateString("vi-VN")} –{" "}
                    {new Date(training.endDate).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Dumbbell size={14} className="text-m3-on-surface-variant" />
                  <span>{training.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-m3-on-surface-variant" />
                  <span>
                    {training.registered} / {training.participants} người đăng
                    ký
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-m3-on-surface-variant mb-1">
                  <span>Tỷ lệ đăng ký</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-m3-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: "var(--m3-primary, #1a73e8)" }}
                  />
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-1.5 py-2 border border-m3-outline-variant text-m3-primary hover:bg-m3-surface-high rounded-xl text-sm font-medium transition-colors">
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
