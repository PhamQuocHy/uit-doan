"use client";

import { useState } from "react";
import {
  Archive,
  Search,
  Filter,
  Download,
  Eye,
  FileText,
  BookOpen,
  ClipboardList,
  FileCheck,
} from "lucide-react";

const mockArchive = [
  {
    id: "1",
    code: "TT-2025/015",
    title: "Thông tư 15/2025/TT-BQP hướng dẫn đăng ký NVQS",
    category: "Thông tư",
    issuer: "Bộ Quốc phòng",
    year: 2025,
    tags: ["tuyển quân", "đăng ký"],
  },
  {
    id: "2",
    code: "ND-2024/132",
    title: "Nghị định 132/2024/NĐ-CP về Luật NVQS sửa đổi",
    category: "Nghị định",
    issuer: "Chính phủ",
    year: 2024,
    tags: ["pháp lý", "nvqs"],
  },
  {
    id: "3",
    code: "QD-2025/08",
    title: "Quyết định về chỉ tiêu tuyển quân năm 2026 toàn quốc",
    category: "Quyết định",
    issuer: "Bộ Quốc phòng",
    year: 2025,
    tags: ["chỉ tiêu", "2026"],
  },
  {
    id: "4",
    code: "HD-2026/01",
    title: "Hướng dẫn lập hồ sơ khám sức khỏe nghĩa vụ quân sự",
    category: "Hướng dẫn",
    issuer: "Cục Quân y",
    year: 2026,
    tags: ["sức khỏe", "khám tuyển"],
  },
  {
    id: "5",
    code: "BC-2025/TQ",
    title: "Báo cáo tổng kết công tác NVQS năm 2025",
    category: "Báo cáo",
    issuer: "Ban CHQS Tỉnh",
    year: 2025,
    tags: ["tổng kết", "2025"],
  },
  {
    id: "6",
    code: "QC-2024/05",
    title: "Quy chế quản lý hồ sơ quân nhân dự bị",
    category: "Quy chế",
    issuer: "Bộ Quốc phòng",
    year: 2024,
    tags: ["dự bị", "hồ sơ"],
  },
];

const categoryConfig: Record<
  string,
  { color: string; bg: string; icon: React.ElementType }
> = {
  "Thông tư": { color: "#7c3aed", bg: "#ede9fe", icon: FileText },
  "Nghị định": { color: "#dc2626", bg: "#fee2e2", icon: FileCheck },
  "Quyết định": { color: "#2563eb", bg: "#dbeafe", icon: ClipboardList },
  "Hướng dẫn": { color: "#059669", bg: "#d1fae5", icon: BookOpen },
  "Báo cáo": { color: "#d97706", bg: "#fef3c7", icon: FileText },
  "Quy chế": { color: "#007aff", bg: "#f5f5f7", icon: Archive },
};

export default function DocumentArchivePage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const filtered = mockArchive.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || d.category === categoryFilter;
    const matchYear = !yearFilter || d.year.toString() === yearFilter;
    return matchSearch && matchCategory && matchYear;
  });

  const categories = Array.from(new Set(mockArchive.map((d) => d.category)));
  const years = Array.from(new Set(mockArchive.map((d) => d.year))).sort(
    (a, b) => b - a,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
          Kho văn bản
        </h1>
        <p className="text-sm mt-1" style={{ color: "#007aff" }}>
          Lưu trữ và tra cứu thông tư, nghị định, quyết định về nghĩa vụ quân sự
        </p>
      </div>

      {/* Category stat chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!categoryFilter ? "bg-[#007aff] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#007aff]"}`}
        >
          Tất cả ({mockArchive.length})
        </button>
        {categories.map((cat) => {
          const cfg = categoryConfig[cat] || {
            color: "#6b7280",
            bg: "#f3f4f6",
            icon: FileText,
          };
          const count = mockArchive.filter((d) => d.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${categoryFilter === cat ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#007aff]"}`}
              style={categoryFilter === cat ? { background: cfg.color } : {}}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#e5e5ea] overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-[#e5e5ea] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề, mã văn bản..."
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
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="">Tất cả năm</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Document list */}
        <div className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <Archive size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Không tìm thấy văn bản nào.</p>
            </div>
          ) : (
            filtered.map((doc) => {
              const cfg = categoryConfig[doc.category] || {
                color: "#6b7280",
                bg: "#f3f4f6",
                icon: FileText,
              };
              const Icon = cfg.icon;
              return (
                <div
                  key={doc.id}
                  className="px-6 py-4 hover:bg-gray-50/50 transition-colors flex items-start gap-4"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: cfg.bg }}
                  >
                    <Icon size={20} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {doc.category}
                      </span>
                      <span className="text-xs font-mono text-gray-500">
                        {doc.code}
                      </span>
                      <span className="text-xs text-gray-400">
                        • {doc.year}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {doc.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ban hành bởi: {doc.issuer}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="p-1.5 text-gray-400 hover:text-[#007aff] hover:bg-[#f5f5f7] rounded-lg transition-colors"
                      title="Xem"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Tải về"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
