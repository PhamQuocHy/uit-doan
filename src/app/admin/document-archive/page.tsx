"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
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
  file_name: string;
  tags: string[];
  content?: string;
};

type DocumentForm = {
  code: string;
  title: string;
  issuer: string;
  issuedDate: string;
  effectiveDate: string;
  docType: string;
  summary: string;
  sourceUrl: string;
  file: File | null;
};

const emptyForm: DocumentForm = {
  code: "",
  title: "",
  issuer: "",
  issuedDate: "",
  effectiveDate: "",
  docType: "khac",
  summary: "",
  sourceUrl: "",
  file: null,
};

const categoryConfig: Record<
  string,
  { color: string; bg: string; icon: React.ElementType }
> = {
  Luật: { color: "var(--m3-error, #ba1a1a)", bg: "var(--m3-error-container, var(--m3-error-container, #ffdad6))", icon: FileCheck },
  "Thông tư": { color: "var(--m3-tertiary, #5a5f6e)", bg: "#ede9fe", icon: FileText },
  "Văn bản hợp nhất": { color: "var(--color-m3-success)", bg: "var(--color-m3-success-container)", icon: BookOpen },
  "Nghị định": { color: "var(--color-m3-warning)", bg: "var(--color-m3-warning-container)", icon: ClipboardList },
  "Quyết định": { color: "var(--m3-primary, #1a73e8)", bg: "var(--m3-primary-container, #dae9fb)", icon: ClipboardList },
  Khác: { color: "var(--m3-primary, #1a73e8)", bg: "var(--m3-surface-container-high, #eef1f4)", icon: Archive },
};

export default function DocumentArchivePage() {
  const [docs, setDocs] = useState<ArchiveDoc[]>([]);
  const [source, setSource] = useState<"mysql" | "disk" | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ArchiveDoc | null>(null);
  const [form, setForm] = useState<DocumentForm>(emptyForm);
  const [saving, setSaving] = useState(false);

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

  const openCreate = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (doc: ArchiveDoc) => {
    setEditingDoc(doc);
    setForm({ ...emptyForm, code: doc.code, title: doc.title, issuer: doc.issuer, issuedDate: doc.issued_date, summary: doc.summary, docType: doc.category === "Luật" ? "luat" : doc.category === "Thông tư" ? "thong_tu" : doc.category === "Văn bản hợp nhất" ? "van_ban_hop_nhat" : "khac", sourceUrl: doc.source_url });
    setFormOpen(true);
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editingDoc ? `/api/admin/document-archive/${encodeURIComponent(editingDoc.id)}` : "/api/admin/document-archive";
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key !== "file" && value) data.append(key, String(value));
      });
      if (form.file) data.append("file", form.file);
      const response = await fetch(url, { method: editingDoc ? "PATCH" : "POST", body: data });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Không thể lưu văn bản");
      setFormOpen(false);
      await loadList();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lỗi lưu văn bản");
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = async (doc: ArchiveDoc) => {
    if (!window.confirm(`Xóa văn bản ${doc.code}?`)) return;
    const response = await fetch(`/api/admin/document-archive/${encodeURIComponent(doc.id)}`, { method: "DELETE" });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Không thể xóa văn bản");
    else await loadList();
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Kho văn bản
          </h1>
        <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
          Luật, thông tư NVQS mới nhất — lưu file + DB, phục vụ tra cứu và AI
        </p>
          {source && (
          <p className="text-xs mt-1 text-m3-on-surface-variant">
            Nguồn: {source === "mysql" ? "MySQL" : "File trong source"} ·{" "}
            {docs.length} văn bản
          </p>
          )}
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-m3-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          <Plus size={18} />
          Thêm văn bản
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-m3-error bg-m3-error-container px-4 py-3 text-sm text-m3-on-error-container">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!categoryFilter ? "bg-m3-primary text-white" : "bg-m3-surface-lowest border border-m3-outline-variant text-m3-on-surface-variant hover:border-m3-primary"}`}
        >
          Tất cả ({docs.length})
        </button>
        {categories.map((cat) => {
          const cfg = categoryConfig[cat] || {
            color: "var(--m3-on-surface-variant, #475569)",
            bg: "var(--m3-surface-container-high, #eef1f4)",
            icon: FileText,
          };
          const count = docs.filter((d) => d.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${categoryFilter === cat ? "text-white" : "bg-m3-surface-lowest border border-m3-outline-variant text-m3-on-surface-variant hover:border-m3-primary"}`}
              style={categoryFilter === cat ? { background: cfg.color } : {}}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề, số hiệu, nội dung tóm tắt..."
              className="w-full pl-10 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={18}
            />
            <select
              className="pl-10 pr-8 py-2 border border-m3-outline-variant rounded-xl text-sm appearance-none focus:outline-none focus:border-m3-primary bg-m3-surface-lowest cursor-pointer"
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

        <div className="divide-y divide-m3-outline-variant">
          {loading ? (
            <div className="px-6 py-12 text-center text-m3-on-surface-variant">
              <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-sm">Đang tải kho văn bản...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-m3-on-surface-variant">
              <Archive size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Không tìm thấy văn bản nào.</p>
            </div>
          ) : (
            filtered.map((doc) => {
              const cfg = categoryConfig[doc.category] || {
                color: "var(--m3-on-surface-variant, #475569)",
                bg: "var(--m3-surface-container-high, #eef1f4)",
                icon: FileText,
              };
              const Icon = cfg.icon;
              return (
                <div
                  key={doc.id}
                  className="px-6 py-4 hover:bg-m3-surface-high/50 transition-colors flex items-start gap-4"
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
                      <span className="text-xs font-mono text-m3-on-surface-variant">
                        {doc.code}
                      </span>
                      <span className="text-xs text-m3-on-surface-variant">
                        • {doc.year || "—"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-m3-on-surface leading-snug">
                      {doc.title}
                    </p>
                    <p className="text-xs text-m3-on-surface-variant mt-0.5">
                      Ban hành bởi: {doc.issuer}
                      {doc.issued_date ? ` · ${doc.issued_date}` : ""}
                    </p>
                    {doc.summary && (
                      <p className="text-xs text-m3-on-surface-variant mt-1 line-clamp-2">
                        {doc.summary}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(doc.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-xs bg-m3-surface-container text-m3-on-surface-variant"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => router.push(`/admin/document-archive/${encodeURIComponent(doc.id)}`)}
                      className="p-1.5 text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-surface-high rounded-lg transition-colors"
                      title="Xem"
                    >
                      <Eye size={16} />
                    </button>
                    <a
                      href={doc.public_url}
                      download
                      className="p-1.5 text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-primary-container rounded-lg transition-colors"
                      title="Tải file"
                    >
                      <Download size={16} />
                    </a>
                    <button onClick={() => openEdit(doc)} className="rounded-lg p-1.5 text-m3-on-surface-variant hover:bg-m3-surface-high hover:text-m3-primary" title="Sửa">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => void deleteDoc(doc)} className="rounded-lg p-1.5 text-m3-on-surface-variant hover:bg-m3-error-container hover:text-m3-error" title="Xóa">
                      <Trash2 size={16} />
                    </button>
                    {doc.source_url && (
                      <a
                        href={doc.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-m3-on-surface-variant hover:text-m3-on-success-container hover:bg-m3-success-container rounded-lg transition-colors"
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

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitForm} className="w-full max-w-2xl rounded-2xl bg-m3-surface-lowest p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-m3-on-surface">{editingDoc ? "Sửa văn bản" : "Thêm văn bản"}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-m3-on-surface-variant hover:bg-m3-surface-container"><X size={18} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["code", "title", "issuer", "sourceUrl", "issuedDate", "effectiveDate"] as const).map((field) => (
                <label key={field} className={field === "code" || field === "title" || field === "issuer" || field === "sourceUrl" ? "sm:col-span-2" : ""}>
                  <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">{field === "code" ? "Số hiệu" : field === "title" ? "Tiêu đề" : field === "issuer" ? "Cơ quan ban hành" : field === "issuedDate" ? "Ngày ban hành" : field === "effectiveDate" ? "Ngày hiệu lực" : "Link nguồn chính thức"}</span>
                  <input required={!["effectiveDate", "sourceUrl"].includes(field)} type={field.includes("Date") ? "date" : "text"} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm outline-none focus:border-m3-primary" />
                </label>
              ))}
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Loại văn bản</span>
                <select value={form.docType} onChange={(event) => setForm({ ...form, docType: event.target.value })} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm">
                  <option value="luat">Luật</option><option value="thong_tu">Thông tư</option><option value="van_ban_hop_nhat">Văn bản hợp nhất</option><option value="nghi_dinh">Nghị định</option><option value="quyet_dinh">Quyết định</option><option value="khac">Khác</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">File PDF {editingDoc && "mới (không bắt buộc)"}</span>
                <span className="flex items-center gap-3">
                  <input id="legal-document-file" required={!editingDoc} type="file" accept="application/pdf,.pdf" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} className="sr-only" />
                  <span className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-m3-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                    <Plus size={16} />
                    {editingDoc ? "Đổi PDF" : "Tải PDF"}
                  </span>
                  <span className="min-w-0 truncate text-sm text-m3-on-surface-variant">
                    {form.file?.name || (editingDoc ? editingDoc.file_name : "Chưa chọn file")}
                  </span>
                </span>
              </label>
              <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">Tóm tắt</span><textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={3} className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm outline-none focus:border-m3-primary" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-m3-outline-variant px-4 py-2 text-sm">Hủy</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-m3-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}Lưu văn bản</button></div>
          </form>
        </div>
      )}

    </div>
  );
}
