"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
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
import {
  AdminListHeader,
  AdminListToolbar,
  AdminListShell,
  AdminTable,
  AdminTHead,
  ADMIN_TH_CLS,
  ADMIN_TD_CLS,
  adminRowClass,
  AdminHoverActions,
  AdminIconBtn,
  AdminPill,
  AdminStatusTabs,
  ADMIN_SELECT_CLS,
  AdminPrimaryBtn,
} from "@/components/admin/list-ui";

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
  Luật: {
    color: "var(--m3-error, #ba1a1a)",
    bg: "var(--m3-error-container, #ffdad6)",
    icon: FileCheck,
  },
  "Thông tư": {
    color: "var(--m3-tertiary, #5a5f6e)",
    bg: "#ede9fe",
    icon: FileText,
  },
  "Văn bản hợp nhất": {
    color: "var(--color-m3-success)",
    bg: "var(--color-m3-success-container)",
    icon: BookOpen,
  },
  "Nghị định": {
    color: "var(--color-m3-warning)",
    bg: "var(--color-m3-warning-container)",
    icon: ClipboardList,
  },
  "Quyết định": {
    color: "var(--m3-primary, #1a73e8)",
    bg: "var(--m3-primary-container, #dae9fb)",
    icon: ClipboardList,
  },
  Khác: {
    color: "var(--m3-primary, #1a73e8)",
    bg: "var(--m3-surface-container-high, #eef1f4)",
    icon: Archive,
  },
};

export default function DocumentArchivePage() {
  const [docs, setDocs] = useState<ArchiveDoc[]>([]);
  const [source, setSource] = useState<"mysql" | "disk" | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
    setForm({
      ...emptyForm,
      code: doc.code,
      title: doc.title,
      issuer: doc.issuer,
      issuedDate: doc.issued_date,
      summary: doc.summary,
      docType:
        doc.category === "Luật"
          ? "luat"
          : doc.category === "Thông tư"
            ? "thong_tu"
            : doc.category === "Văn bản hợp nhất"
              ? "van_ban_hop_nhat"
              : "khac",
      sourceUrl: doc.source_url,
    });
    setFormOpen(true);
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editingDoc
        ? `/api/admin/document-archive/${encodeURIComponent(editingDoc.id)}`
        : "/api/admin/document-archive";
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key !== "file" && value) data.append(key, String(value));
      });
      if (form.file) data.append("file", form.file);
      const response = await fetch(url, {
        method: editingDoc ? "PATCH" : "POST",
        body: data,
      });
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
    const response = await fetch(
      `/api/admin/document-archive/${encodeURIComponent(doc.id)}`,
      { method: "DELETE" },
    );
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, yearFilter, pageSize]);

  const categoryTabs = useMemo(
    () => [
      { value: "", label: `Tất cả (${docs.length})` },
      ...categories.map((cat) => ({
        value: cat,
        label: `${cat} (${docs.filter((d) => d.category === cat).length})`,
      })),
    ],
    [categories, docs],
  );

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Kho văn bản"
        countLabel={docs.length ? `${docs.length} văn bản` : undefined}
        actions={
          <AdminPrimaryBtn onClick={openCreate} tone="blue">
            <Plus size={16} />
            Thêm văn bản
          </AdminPrimaryBtn>
        }
      />

      <p className="text-[14px] text-m3-on-surface-variant">
        Luật, thông tư NVQS mới nhất — lưu file + DB, phục vụ tra cứu và AI
        {source ? (
          <span className="ml-1">
            · Nguồn: {source === "mysql" ? "MySQL" : "File trong source"}
          </span>
        ) : null}
      </p>

      {error && (
        <div className="rounded-xl border border-m3-error bg-m3-error-container px-4 py-3 text-sm text-m3-on-error-container">
          {error}
        </div>
      )}

      <AdminListShell
        page={page}
        totalPages={totalPages}
        loading={loading}
        tabs={
          <AdminStatusTabs
            tabs={categoryTabs}
            value={categoryFilter}
            onChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          />
        }
        toolbar={
          <AdminListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tìm theo tiêu đề, số hiệu, nội dung tóm tắt..."
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            extra={
              <select
                className={ADMIN_SELECT_CLS}
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                aria-label="Lọc theo năm"
              >
                <option value="">Tất cả năm</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            }
          />
        }
      >
        <AdminTable minWidth="min-w-[1000px]">
          <AdminTHead>
            <th className={ADMIN_TH_CLS}>Loại</th>
            <th className={ADMIN_TH_CLS}>Số hiệu</th>
            <th className={ADMIN_TH_CLS}>Tiêu đề</th>
            <th className={ADMIN_TH_CLS}>Cơ quan ban hành</th>
            <th className={ADMIN_TH_CLS}>Năm</th>
            <th className={ADMIN_TH_CLS}>Tóm tắt</th>
            <th className={ADMIN_TH_CLS}>Thao tác</th>
          </AdminTHead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2
                    size={28}
                    className="mx-auto mb-2 animate-spin opacity-50"
                  />
                  <p className="text-[14px] text-m3-on-surface-variant">
                    Đang tải kho văn bản...
                  </p>
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-m3-on-surface-variant"
                >
                  <Archive size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[14px]">Không tìm thấy văn bản nào.</p>
                </td>
              </tr>
            ) : (
              paginated.map((doc, idx) => {
                const cfg = categoryConfig[doc.category] || {
                  color: "var(--m3-on-surface-variant, #475569)",
                  bg: "var(--m3-surface-container-high, #eef1f4)",
                  icon: FileText,
                };
                return (
                  <tr key={doc.id} className={adminRowClass(idx)}>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill
                        label={doc.category}
                        bg={cfg.bg}
                        color={cfg.color}
                      />
                    </td>
                    <td className={`${ADMIN_TD_CLS} font-mono text-[12px] font-semibold`}>
                      {doc.code}
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <p className="max-w-[280px] text-[14px] font-semibold leading-snug text-m3-on-surface">
                        {doc.title}
                      </p>
                      {doc.issued_date ? (
                        <p className="mt-0.5 text-[12px] text-m3-on-surface-variant">
                          Ban hành: {doc.issued_date}
                        </p>
                      ) : null}
                      {(doc.tags || []).length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-m3-surface-container px-1.5 py-0.5 text-[11px] text-m3-on-surface-variant"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className={`${ADMIN_TD_CLS} text-m3-on-surface-variant`}>
                      {doc.issuer}
                    </td>
                    <td className={ADMIN_TD_CLS}>{doc.year || "—"}</td>
                    <td className={ADMIN_TD_CLS}>
                      <span
                        className="line-clamp-2 max-w-[220px] text-[12px] text-m3-on-surface-variant"
                        title={doc.summary || undefined}
                      >
                        {doc.summary || "—"}
                      </span>
                    </td>
                    <td className={`relative ${ADMIN_TD_CLS}`}>
                      <span className="text-[13px] text-m3-on-surface-variant">
                        {doc.file_name || "—"}
                      </span>
                      <AdminHoverActions>
                        <AdminIconBtn
                          title="Xem"
                          onClick={() =>
                            router.push(
                              `/admin/document-archive/${encodeURIComponent(doc.id)}`,
                            )
                          }
                          tone="gray"
                        >
                          <Eye size={15} />
                        </AdminIconBtn>
                        <AdminIconBtn
                          title="Tải file"
                          onClick={() => {
                            window.open(doc.public_url, "_blank");
                          }}
                          tone="blue"
                        >
                          <Download size={15} />
                        </AdminIconBtn>
                        <AdminIconBtn
                          title="Sửa"
                          onClick={() => openEdit(doc)}
                          tone="blue"
                        >
                          <Pencil size={15} />
                        </AdminIconBtn>
                        <AdminIconBtn
                          title="Xóa"
                          onClick={() => void deleteDoc(doc)}
                          tone="red"
                        >
                          <Trash2 size={15} />
                        </AdminIconBtn>
                        {doc.source_url ? (
                          <AdminIconBtn
                            title="Nguồn chính thức"
                            onClick={() =>
                              window.open(doc.source_url, "_blank")
                            }
                            tone="green"
                          >
                            <ExternalLink size={15} />
                          </AdminIconBtn>
                        ) : null}
                      </AdminHoverActions>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </AdminTable>
      </AdminListShell>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitForm}
            className="w-full max-w-2xl rounded-2xl bg-m3-surface-lowest p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-m3-on-surface">
                {editingDoc ? "Sửa văn bản" : "Thêm văn bản"}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-2 text-m3-on-surface-variant hover:bg-m3-surface-container"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  "code",
                  "title",
                  "issuer",
                  "sourceUrl",
                  "issuedDate",
                  "effectiveDate",
                ] as const
              ).map((field) => (
                <label
                  key={field}
                  className={
                    field === "code" ||
                    field === "title" ||
                    field === "issuer" ||
                    field === "sourceUrl"
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                    {field === "code"
                      ? "Số hiệu"
                      : field === "title"
                        ? "Tiêu đề"
                        : field === "issuer"
                          ? "Cơ quan ban hành"
                          : field === "issuedDate"
                            ? "Ngày ban hành"
                            : field === "effectiveDate"
                              ? "Ngày hiệu lực"
                              : "Link nguồn chính thức"}
                  </span>
                  <input
                    required={!["effectiveDate", "sourceUrl"].includes(field)}
                    type={field.includes("Date") ? "date" : "text"}
                    value={form[field]}
                    onChange={(event) =>
                      setForm({ ...form, [field]: event.target.value })
                    }
                    className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm outline-none focus:border-m3-primary"
                  />
                </label>
              ))}
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                  Loại văn bản
                </span>
                <select
                  value={form.docType}
                  onChange={(event) =>
                    setForm({ ...form, docType: event.target.value })
                  }
                  className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm"
                >
                  <option value="luat">Luật</option>
                  <option value="thong_tu">Thông tư</option>
                  <option value="van_ban_hop_nhat">Văn bản hợp nhất</option>
                  <option value="nghi_dinh">Nghị định</option>
                  <option value="quyet_dinh">Quyết định</option>
                  <option value="khac">Khác</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                  File PDF {editingDoc && "mới (không bắt buộc)"}
                </span>
                <span className="flex items-center gap-3">
                  <input
                    id="legal-document-file"
                    required={!editingDoc}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) =>
                      setForm({
                        ...form,
                        file: event.target.files?.[0] || null,
                      })
                    }
                    className="sr-only"
                  />
                  <span className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-m3-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                    <Plus size={16} />
                    {editingDoc ? "Đổi PDF" : "Tải PDF"}
                  </span>
                  <span className="min-w-0 truncate text-sm text-m3-on-surface-variant">
                    {form.file?.name ||
                      (editingDoc ? editingDoc.file_name : "Chưa chọn file")}
                  </span>
                </span>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-m3-on-surface-variant">
                  Tóm tắt
                </span>
                <textarea
                  value={form.summary}
                  onChange={(event) =>
                    setForm({ ...form, summary: event.target.value })
                  }
                  rows={3}
                  className="w-full rounded-xl border border-m3-outline-variant px-3 py-2 text-sm outline-none focus:border-m3-primary"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-m3-outline-variant px-4 py-2 text-sm"
              >
                Hủy
              </button>
              <button
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-m3-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Lưu văn bản
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
