"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Send,
  Paperclip,
  Trash2,
  FileText,
  Minimize2,
} from "lucide-react";
import {
  AdminListHeader,
  AdminStatusTabs,
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
  AdminPrimaryBtn,
} from "@/components/admin/list-ui";

interface DocAttachment {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

interface Doc {
  id: string;
  code: string;
  title: string;
  content: string;
  type: string;
  fromUnit: string;
  toUnits: string[];
  date: string;
  status: string;
  urgent: boolean;
  attachments?: DocAttachment[];
}

interface ChildUnit {
  code: string;
  name: string;
}

interface Session {
  unitCode: string;
  hierarchyLevel: string;
  name: string;
}

const TYPE_TABS = [
  { value: "", label: "Tất cả" },
  { value: "incoming", label: "Đến" },
  { value: "outgoing", label: "Đi" },
] as const;

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "Chờ xử lý",
    color: "var(--color-m3-warning)",
    bg: "var(--color-m3-warning-container)",
  },
  processed: {
    label: "Đã xử lý",
    color: "var(--color-m3-success)",
    bg: "var(--color-m3-success-container)",
  },
  sent: {
    label: "Đã gửi",
    color: "var(--m3-primary, #1a73e8)",
    bg: "var(--m3-primary-container, #dae9fb)",
  },
};

const unitNamesFallback: Record<string, string> = {
  bo: "Bộ Quốc phòng",
};

const levelLabel: Record<string, string> = {
  bo: "Bộ QP",
  tinh: "Tỉnh",
  huyen: "Huyện",
  xa: "Xã",
};

const TABLE_COLS = 7;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [childUnits, setChildUnits] = useState<ChildUnit[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [viewDoc, setViewDoc] = useState<Doc | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [unitQuery, setUnitQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    content: "",
    urgent: false,
    type: "outgoing" as "outgoing" | "incoming",
    selectedUnits: [] as string[],
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const unitNameMap = useMemo(() => {
    const map: Record<string, string> = { ...unitNamesFallback };
    for (const u of childUnits) map[u.code] = u.name;
    if (session?.unitCode) {
      map[session.unitCode] =
        map[session.unitCode] ||
        session.name ||
        session.unitCode;
    }
    return map;
  }, [childUnits, session]);

  const resolveUnit = (code: string) => unitNameMap[code] || code;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [meRes, docsRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/admin/documents"),
    ]);
    if (meRes.ok) {
      const d = await meRes.json();
      setSession(d.user);
    }
    if (docsRes.ok) {
      const d = await docsRes.json();
      setDocs(d.data || []);

      const quotasRes = await fetch("/api/admin/quotas");
      if (quotasRes.ok) {
        const q = await quotasRes.json();
        setChildUnits(q.childUnits || []);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  const resetCompose = () => {
    setForm({
      title: "",
      content: "",
      urgent: false,
      type: "outgoing",
      selectedUnits: [],
    });
    setPendingFiles([]);
    setUnitQuery("");
    setSubmitError(null);
    setComposeMinimized(false);
  };

  const openCompose = () => {
    resetCompose();
    setShowModal(true);
  };

  const closeCompose = () => {
    setShowModal(false);
    resetCompose();
  };

  const toggleUnit = (code: string) => {
    setForm((f) => ({
      ...f,
      selectedUnits: f.selectedUnits.includes(code)
        ? f.selectedUnits.filter((u) => u !== code)
        : [...f.selectedUnits, code],
    }));
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const f of Array.from(list)) {
        if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
        if (next.length >= 8) break;
        next.push(f);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.title || form.selectedUnits.length === 0) {
      setSubmitError("Nhập tiêu đề và chọn ít nhất một đơn vị nhận.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = new FormData();
      body.set("title", form.title);
      body.set("content", form.content);
      body.set("urgent", form.urgent ? "1" : "0");
      body.set("type", form.type);
      body.set("toUnits", JSON.stringify(form.selectedUnits));
      for (const f of pendingFiles) body.append("files", f);

      const res = await fetch("/api/admin/documents", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(
          typeof data.error === "string" ? data.error : "Gửi công văn thất bại",
        );
        return;
      }
      closeCompose();
      await fetchData();
    } catch {
      setSubmitError("Lỗi kết nối khi gửi công văn");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(
    () =>
      docs.filter((d) => {
        const matchSearch =
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.code.toLowerCase().includes(search.toLowerCase());
        const matchType = !typeFilter || d.type === typeFilter;
        return matchSearch && matchType;
      }),
    [docs, search, typeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const filteredUnits = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) return childUnits;
    return childUnits.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q),
    );
  }, [childUnits, unitQuery]);

  const fromLabel = session
    ? resolveUnit(session.unitCode)
    : "—";

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Công văn đến / đi"
        countLabel={`${filtered.length.toLocaleString("vi-VN")} công văn`}
        actions={
          <AdminPrimaryBtn onClick={openCompose}>
            <Plus size={16} />
            Soạn công văn
          </AdminPrimaryBtn>
        }
      />

      {session && (
        <p className="text-[14px] text-m3-on-surface-variant">
          Đơn vị:{" "}
          <span className="font-medium text-m3-on-surface">
            {resolveUnit(session.unitCode)} (
            {levelLabel[session.hierarchyLevel] || session.hierarchyLevel})
          </span>
        </p>
      )}

      <AdminListShell
        page={page}
        totalPages={totalPages}
        loading={loading}
        tabs={
          <AdminStatusTabs
            tabs={[...TYPE_TABS]}
            value={typeFilter}
            onChange={setTypeFilter}
          />
        }
        toolbar={
          <AdminListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tìm theo tiêu đề, số hiệu..."
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        }
      >
        <AdminTable minWidth="min-w-[960px]">
          <AdminTHead>
            <th className={ADMIN_TH_CLS}>Loại</th>
            <th className={ADMIN_TH_CLS}>Số hiệu</th>
            <th className={ADMIN_TH_CLS}>Tiêu đề</th>
            <th className={ADMIN_TH_CLS}>Từ đơn vị</th>
            <th className={ADMIN_TH_CLS}>Đơn vị nhận</th>
            <th className={ADMIN_TH_CLS}>Ngày</th>
            <th className={ADMIN_TH_CLS}>Trạng thái</th>
          </AdminTHead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={TABLE_COLS}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  Đang tải...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={TABLE_COLS}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  Không có công văn nào.
                </td>
              </tr>
            ) : (
              paginated.map((doc, idx) => {
                const s = statusConfig[doc.status] || {
                  label: doc.status,
                  color: "var(--m3-on-surface-variant, #475569)",
                  bg: "var(--m3-surface-container-high, #eef1f4)",
                };
                const attCount = doc.attachments?.length || 0;
                return (
                  <tr key={doc.id} className={adminRowClass(idx)}>
                    <td className={ADMIN_TD_CLS}>
                      <div className="flex items-center gap-1.5">
                        {doc.type === "incoming" ? (
                          <AdminPill
                            label="Đến"
                            bg="var(--m3-primary-container, #dae9fb)"
                            color="var(--m3-primary, #1a73e8)"
                          />
                        ) : (
                          <AdminPill
                            label="Đi"
                            bg="var(--m3-surface-container-high, #eef1f4)"
                            color="var(--m3-primary, #1a73e8)"
                          />
                        )}
                        {doc.urgent && (
                          <span className="rounded bg-m3-error-container px-1.5 py-0.5 text-[11px] font-bold text-m3-on-error-container">
                            !
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`${ADMIN_TD_CLS} font-mono text-[12px] text-m3-on-surface-variant`}
                    >
                      {doc.code}
                    </td>
                    <td className={`${ADMIN_TD_CLS} max-w-[280px]`}>
                      <button
                        type="button"
                        onClick={() => setViewDoc(doc)}
                        className="block w-full truncate text-left font-semibold text-m3-on-surface hover:underline"
                      >
                        {doc.title}
                      </button>
                      {attCount > 0 && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-m3-on-surface-variant">
                          <Paperclip size={11} /> {attCount} tệp
                        </span>
                      )}
                    </td>
                    <td
                      className={`${ADMIN_TD_CLS} text-[12px] text-m3-on-surface-variant`}
                    >
                      {resolveUnit(doc.fromUnit)}
                    </td>
                    <td
                      className={`${ADMIN_TD_CLS} max-w-[160px] text-[12px] text-m3-on-surface-variant`}
                    >
                      <span className="block truncate">
                        {doc.toUnits.map(resolveUnit).join(", ")}
                      </span>
                    </td>
                    <td
                      className={`${ADMIN_TD_CLS} text-m3-on-surface-variant`}
                    >
                      {doc.date
                        ? doc.date.slice(0, 10).split("-").reverse().join("/")
                        : "—"}
                    </td>
                    <td className={`relative ${ADMIN_TD_CLS}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {doc.status === "pending" ? (
                          <Clock
                            size={12}
                            className="text-m3-on-surface-variant"
                          />
                        ) : (
                          <CheckCircle2
                            size={12}
                            className="text-m3-on-surface-variant"
                          />
                        )}
                        <AdminPill label={s.label} bg={s.bg} color={s.color} />
                      </span>
                      <AdminHoverActions>
                        <AdminIconBtn
                          title="Xem"
                          tone="gray"
                          onClick={() => setViewDoc(doc)}
                        >
                          <Eye size={15} />
                        </AdminIconBtn>
                        {attCount > 0 && doc.attachments?.[0] && (
                          <AdminIconBtn
                            title="Tải tệp đầu"
                            tone="blue"
                            onClick={() =>
                              window.open(doc.attachments![0]!.url, "_blank")
                            }
                          >
                            <Download size={15} />
                          </AdminIconBtn>
                        )}
                      </AdminHoverActions>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </AdminTable>
      </AdminListShell>

      {/* Compose kiểu Gmail — góc phải dưới */}
      {showModal && (
        <>
          {!composeMinimized && (
            <div
              className="fixed inset-0 z-40 bg-black/25"
              onClick={closeCompose}
              aria-hidden
            />
          )}
          <div
            className={`fixed z-50 overflow-hidden rounded-t-2xl border border-black/[0.08] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.28)] ${
              composeMinimized
                ? "bottom-0 right-6 h-12 w-[320px]"
                : "bottom-0 right-4 flex h-[min(640px,92vh)] w-[min(640px,100vw-1rem)] flex-col sm:right-6"
            }`}
          >
            <div className="flex h-12 shrink-0 items-center justify-between bg-[#404040] px-4 text-white">
              <span className="text-[14px] font-medium">
                {form.type === "outgoing" ? "Công văn đi mới" : "Báo cáo lên mới"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Thu nhỏ"
                  onClick={() => setComposeMinimized((v) => !v)}
                  className="rounded p-1.5 hover:bg-white/15"
                >
                  <Minimize2 size={16} />
                </button>
                <button
                  type="button"
                  title="Đóng"
                  onClick={closeCompose}
                  className="rounded p-1.5 hover:bg-white/15"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!composeMinimized && (
              <>
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="border-b border-black/[0.08] px-4 py-2">
                    <div className="flex items-center gap-3 text-[13px]">
                      <span className="w-10 shrink-0 text-m3-on-surface-variant">
                        Loại
                      </span>
                      <select
                        className="flex-1 border-0 bg-transparent py-1 text-[14px] outline-none"
                        value={form.type}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            type: e.target.value as "outgoing" | "incoming",
                          })
                        }
                      >
                        <option value="outgoing">
                          Công văn đi — gửi cấp dưới
                        </option>
                        <option value="incoming">
                          Báo cáo lên — gửi cấp trên
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-b border-black/[0.08] px-4 py-2 text-[13px]">
                    <span className="w-10 shrink-0 text-m3-on-surface-variant">
                      Từ
                    </span>
                    <span className="truncate text-[14px] text-m3-on-surface">
                      {fromLabel}
                    </span>
                  </div>

                  <div className="border-b border-black/[0.08] px-4 py-2">
                    <div className="flex gap-3 text-[13px]">
                      <span className="mt-1.5 w-10 shrink-0 text-m3-on-surface-variant">
                        Đến
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                          {form.selectedUnits.map((code) => (
                            <span
                              key={code}
                              className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#e8f0fe] px-2.5 py-0.5 text-[12px] font-medium text-[#174ea6]"
                            >
                              <span className="truncate">
                                {resolveUnit(code)}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleUnit(code)}
                                className="rounded-full p-0.5 hover:bg-black/10"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={unitQuery}
                          onChange={(e) => setUnitQuery(e.target.value)}
                          placeholder={
                            childUnits.length
                              ? "Gõ để tìm đơn vị nhận..."
                              : "Không có đơn vị cấp dưới"
                          }
                          className="w-full border-0 bg-transparent py-1 text-[14px] outline-none placeholder:text-m3-on-surface-variant/70"
                          disabled={!childUnits.length}
                        />
                        {unitQuery.trim() && filteredUnits.length > 0 && (
                          <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-black/[0.08] bg-white shadow-md">
                            {filteredUnits.slice(0, 12).map((u) => (
                              <button
                                key={u.code}
                                type="button"
                                onClick={() => {
                                  if (!form.selectedUnits.includes(u.code)) {
                                    toggleUnit(u.code);
                                  }
                                  setUnitQuery("");
                                }}
                                className="flex w-full px-3 py-2 text-left text-[13px] hover:bg-[#f2f2f2]"
                              >
                                {u.name}
                              </button>
                            ))}
                          </div>
                        )}
                        {!unitQuery.trim() &&
                          childUnits.length > 0 &&
                          form.selectedUnits.length === 0 && (
                            <div className="mt-1 max-h-28 overflow-y-auto">
                              {childUnits.slice(0, 8).map((u) => (
                                <button
                                  key={u.code}
                                  type="button"
                                  onClick={() => toggleUnit(u.code)}
                                  className="mr-1 mb-1 inline-flex rounded-full border border-black/[0.1] px-2.5 py-0.5 text-[12px] text-m3-on-surface-variant hover:bg-[#f2f2f2]"
                                >
                                  + {u.name}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-b border-black/[0.08] px-4 py-2 text-[13px]">
                    <span className="w-10 shrink-0 text-m3-on-surface-variant">
                      Chủ đề
                    </span>
                    <input
                      type="text"
                      className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[14px] outline-none"
                      placeholder="Tiêu đề công văn"
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                    />
                  </div>

                  <textarea
                    className="min-h-[160px] flex-1 resize-none border-0 px-4 py-3 text-[14px] leading-relaxed outline-none"
                    placeholder="Nội dung công văn..."
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                  />

                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 border-t border-black/[0.06] px-4 py-2">
                      {pendingFiles.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-lg border border-black/[0.08] bg-[#f8f9fa] px-2.5 py-1.5 text-[12px]"
                        >
                          <FileText size={14} className="shrink-0 text-[#5f6368]" />
                          <span className="truncate font-medium">{f.name}</span>
                          <span className="shrink-0 text-m3-on-surface-variant">
                            {formatBytes(f.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingFiles((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                            className="rounded p-0.5 hover:bg-black/10"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {submitError && (
                    <p className="px-4 pb-1 text-[13px] text-red-600">
                      {submitError}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2 border-t border-black/[0.08] px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-[#0b57d0] px-5 text-[14px] font-medium text-white hover:bg-[#0842a0] disabled:opacity-50"
                  >
                    <Send size={15} />
                    {submitting ? "Đang gửi..." : "Gửi"}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.txt"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    title="Đính kèm tệp"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full p-2 text-[#5f6368] hover:bg-[#f2f2f2]"
                  >
                    <Paperclip size={18} />
                  </button>

                  <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-[13px] text-red-700">
                    <input
                      type="checkbox"
                      checked={form.urgent}
                      onChange={(e) =>
                        setForm({ ...form, urgent: e.target.checked })
                      }
                      className="accent-red-600"
                    />
                    KHẨN
                  </label>

                  <button
                    type="button"
                    title="Hủy thư"
                    onClick={closeCompose}
                    className="ml-auto rounded-full p-2 text-[#5f6368] hover:bg-[#f2f2f2]"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Xem công văn */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] text-m3-on-surface-variant">
                    {viewDoc.code}
                  </span>
                  {viewDoc.urgent && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                      KHẨN
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-[18px] font-semibold text-m3-on-surface">
                  {viewDoc.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewDoc(null)}
                className="rounded-lg p-1.5 hover:bg-m3-surface-container"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-1 text-[13px] text-m3-on-surface-variant">
                <p>
                  <span className="inline-block w-16">Từ</span>
                  <span className="font-medium text-m3-on-surface">
                    {resolveUnit(viewDoc.fromUnit)}
                  </span>
                </p>
                <p>
                  <span className="inline-block w-16">Đến</span>
                  <span className="font-medium text-m3-on-surface">
                    {viewDoc.toUnits.map(resolveUnit).join(", ")}
                  </span>
                </p>
                <p>
                  <span className="inline-block w-16">Ngày</span>
                  <span className="font-medium text-m3-on-surface">
                    {viewDoc.date
                      ? viewDoc.date.slice(0, 10).split("-").reverse().join("/")
                      : "—"}
                  </span>
                </p>
              </div>

              {viewDoc.urgent && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
                  <AlertCircle size={16} /> Công văn KHẨN
                </div>
              )}

              <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-m3-on-surface">
                {viewDoc.content || (
                  <span className="italic text-m3-on-surface-variant">
                    Không có nội dung văn bản.
                  </span>
                )}
              </div>

              {(viewDoc.attachments?.length || 0) > 0 && (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-m3-on-surface-variant">
                    Tệp đính kèm ({viewDoc.attachments!.length})
                  </p>
                  <div className="space-y-2">
                    {viewDoc.attachments!.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-black/[0.08] px-3 py-2.5 hover:bg-[#f8f9fa]"
                      >
                        <FileText size={18} className="text-[#5f6368]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-m3-on-surface">
                            {a.fileName}
                          </p>
                          <p className="text-[11px] text-m3-on-surface-variant">
                            {formatBytes(a.sizeBytes)}
                          </p>
                        </div>
                        <Download size={16} className="text-[#0b57d0]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
