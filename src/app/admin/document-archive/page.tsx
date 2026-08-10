"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ExternalLink,
  X,
  Loader2,
} from "lucide-react";

type ArchiveDoc = {
  id: string;
  code: string;
  title: string;
  issuer: string;
  issued_date: string;
  effective_date: string;
  category: string;
  year: number;
  summary: string;
  source_url: string;
  public_url: string;
  tags: string[];
  content?: string;
};

const categoryConfig: Record<
  string,
  { color: string; bg: string; icon: React.ElementType }
> = {
  Luật: { color: "#dc2626", bg: "#fee2e2", icon: FileCheck },
  "Thông tư": { color: "#7c3aed", bg: "#ede9fe", icon: FileText },
  "Văn bản hợp nhất": { color: "#059669", bg: "#d1fae5", icon: BookOpen },
  "Nghị định": { color: "#d97706", bg: "#fef3c7", icon: ClipboardList },
  "Quyết định": { color: "#2563eb", bg: "#dbeafe", icon: ClipboardList },
  Khác: { color: "#007aff", bg: "#f5f5f7", icon: Archive },
};

export default function DocumentArchivePage() {
  const [docs, setDocs] = useState<ArchiveDoc[]>([]);
  const [source, setSource] = useState<"mysql" | "disk" | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [viewDoc, setViewDoc] = useState<ArchiveDoc | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/document-archive");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không tải được kho văn bản");
      setDocs(json.data || []);
      setSource(json.source || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openView = async (id: string) => {
    setViewLoading(true);
    setViewDoc(null);
    try {
      const res = await fetch(`/api/admin/document-archive/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không mở được văn bản");
      setViewDoc(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi xem văn bản");
    } finally {
      setViewLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.summary?.toLowerCase().includes(q);
      const matchCategory = !categoryFilter || d.category === categoryFilter;
      const matchYear = !yearFilter || d.year.toString() === yearFilter;
      return matchSearch && matchCategory && matchYear;
    });
  }, [docs, search, categoryFilter, yearFilter]);

  const categories = useMemo(
    () => Array.from(new Set(docs.map((d) => d.category))),
    [docs],
  );
  const years = useMemo(
    () =>
      Array.from(new Set(docs.map((d) => d.year).filter(Boolean))).sort(
        (a, b) => b - a,
      ),
    [docs],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
          Kho văn bản
        </h1>
        <p className="text-sm mt-1" style={{ color: "#007aff" }}>
          Luật, thông tư NVQS mới nhất — lưu file + DB, phục vụ tra cứu và AI
        </p>
        {source && (
          <p className="text-xs mt-1 text-gray-400">
            Nguồn: {source === "mysql" ? "MySQL" : "File trong source"} ·{" "}
            {docs.length} văn bản
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!categoryFilter ? "bg-[#007aff] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#007aff]"}`}
        >
          Tất cả ({docs.length})
        </button>
        {categories.map((cat) => {
          const cfg = categoryConfig[cat] || {
            color: "#6b7280",
            bg: "#f3f4f6",
            icon: FileText,
          };
          const count = docs.filter((d) => d.category === cat).length;
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
        <div className="p-4 border-b border-[#e5e5ea] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề, số hiệu, nội dung tóm tắt..."
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

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-sm">Đang tải kho văn bản...</p>
            </div>
          ) : filtered.length === 0 ? (
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
                        • {doc.year || "—"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {doc.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ban hành bởi: {doc.issuer}
                      {doc.issued_date ? ` · ${doc.issued_date}` : ""}
                    </p>
                    {doc.summary && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {doc.summary}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(doc.tags || []).map((tag) => (
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
                      onClick={() => void openView(doc.id)}
                      className="p-1.5 text-gray-400 hover:text-[#007aff] hover:bg-[#f5f5f7] rounded-lg transition-colors"
                      title="Xem"
                    >
                      <Eye size={16} />
                    </button>
                    <a
                      href={doc.public_url}
                      download
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Tải file"
                    >
                      <Download size={16} />
                    </a>
                    {doc.source_url && (
                      <a
                        href={doc.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Nguồn chính thức"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {(viewLoading || viewDoc) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {viewDoc?.code || "Đang tải..."}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {viewDoc?.title || ""}
                </p>
              </div>
              <button
                onClick={() => {
                  setViewDoc(null);
                  setViewLoading(false);
                }}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {viewLoading && !viewDoc ? (
                <div className="py-16 text-center text-gray-400">
                  <Loader2 className="mx-auto animate-spin mb-2" size={28} />
                  <p className="text-sm">Đang mở văn bản...</p>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                  {viewDoc?.content || viewDoc?.summary || "Không có nội dung."}
                </pre>
              )}
            </div>
            {viewDoc && (
              <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
                <a
                  href={viewDoc.public_url}
                  download
                  className="px-3 py-1.5 rounded-lg text-sm bg-[#007aff] text-white hover:bg-[#0066d6]"
                >
                  Tải file
                </a>
                {viewDoc.source_url && (
                  <a
                    href={viewDoc.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Nguồn gốc
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
