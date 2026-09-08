"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, Users } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import Modal, { ConfirmDialog } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  headName: string;
  memberCount: number;
  status: string;
  createdAt: string;
}

interface DeptForm {
  name: string;
  code: string;
  description: string;
  headName: string;
  memberCount: string;
  status: string;
}

const defaultForm: DeptForm = {
  name: "",
  code: "",
  description: "",
  headName: "",
  memberCount: "0",
  status: "active",
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Vô hiệu hóa" },
];

const FORM_STATUS_OPTIONS = [
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Vô hiệu hóa" },
];

export default function DepartmentsClient() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [form, setForm] = useState<DeptForm>(defaultForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "8",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/departments?${params}`);
      const data = await res.json();
      setDepartments(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, statusFilter]);

  useEffect(() => {
    fetchDepts();
  }, [fetchDepts]);

  const openCreate = () => {
    setEditingDept(null);
    setForm(defaultForm);
    setFormError("");
    setIsFormOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      headName: dept.headName,
      memberCount: dept.memberCount.toString(),
      status: dept.status,
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const openDelete = (dept: Department) => {
    setDeletingDept(dept);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    setFormLoading(true);
    try {
      const url = editingDept
        ? `/api/admin/departments/${editingDept.id}`
        : "/api/admin/departments";
      const method = editingDept ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          memberCount: parseInt(form.memberCount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Có lỗi xảy ra");
        return;
      }
      setIsFormOpen(false);
      fetchDepts();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDept) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/departments/${deletingDept.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setIsDeleteOpen(false);
        fetchDepts();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-m3-on-surface">
            Danh sách đơn vị
          </h1>
          <p className="mt-1.5 text-[14px] text-m3-on-surface-variant">
            {total} đơn vị trong hệ thống
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus size={16} />}
          onClick={openCreate}
        >
          Thêm đơn vị
        </Button>
      </div>

      {/* Filters */}
      <div className="admin-filter-tray">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--m3-on-surface-variant, #475569)" }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm tên, mã, chỉ huy..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl text-sm transition-all outline-none"
              style={{
                background: "var(--m3-surface-container-high, #eef1f4)",
                border: "1px solid var(--m3-outline-variant, #e3e8ee)",
                color: "var(--m3-on-surface, #1b1d20)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--m3-primary, #1a73e8)";
                e.target.style.background = "#fff";
                e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--m3-primary, #1a73e8) 10%, transparent)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--m3-outline-variant, #e3e8ee)";
                e.target.style.background = "var(--m3-surface-container-high, #eef1f4)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2.5 rounded-xl text-sm transition-all outline-none"
            style={{
              background: "var(--m3-surface-container-high, #eef1f4)",
              border: "1px solid var(--m3-outline-variant, #e3e8ee)",
              color: "var(--m3-on-surface, #1b1d20)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--m3-primary, #1a73e8)";
              e.target.style.background = "#fff";
              e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--m3-primary, #1a73e8) 10%, transparent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--m3-outline-variant, #e3e8ee)";
              e.target.style.background = "var(--m3-surface-container-high, #eef1f4)";
              e.target.style.boxShadow = "none";
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="macos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  Đơn vị
                </th>
                <th className="hidden md:table-cell">
                  Chỉ huy trưởng
                </th>
                <th className="hidden sm:table-cell">
                  Quân số
                </th>
                <th>
                  Trạng thái
                </th>
                <th className="text-right">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-m3-surface-highest rounded-lg" />
                        <div className="space-y-1.5">
                          <div className="h-3 bg-m3-surface-highest rounded w-28" />
                          <div className="h-2 bg-m3-surface-container rounded w-16" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="h-3 bg-m3-surface-highest rounded w-24" />
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="h-3 bg-m3-surface-highest rounded w-12" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 bg-m3-surface-highest rounded-full w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-7 bg-m3-surface-highest rounded-lg w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : departments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-m3-on-surface-variant"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="text-m3-on-surface-variant" />
                      <p>Không tìm thấy phòng ban nào</p>
                    </div>
                  </td>
                </tr>
              ) : (
                departments.map((dept, idx) => (
                  <tr
                    key={dept.id}
                    className="transition-colors hover:bg-m3-surface-high bg-m3-surface-lowest"
                    style={{
                      borderBottom:
                        idx < departments.length - 1
                          ? "1px solid var(--m3-outline-variant, #e3e8ee)"
                          : "none",
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: "var(--m3-surface-container-high, #eef1f4)",
                            border: "1px solid var(--m3-outline-variant, #e3e8ee)",
                          }}
                        >
                          <span
                            className="text-xs font-black"
                            style={{ color: "var(--m3-primary, #1a73e8)" }}
                          >
                            {dept.code.slice(0, 3)}
                          </span>
                        </div>
                        <div>
                          <p
                            className="font-semibold"
                            style={{ color: "var(--m3-on-surface, #1b1d20)" }}
                          >
                            {dept.name}
                          </p>
                          <p
                            className="text-xs font-medium"
                            style={{ color: "var(--m3-primary, #1a73e8)" }}
                          >
                            {dept.description || "Chưa có mô tả"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 hidden md:table-cell font-medium"
                      style={{ color: "var(--m3-on-surface-variant, #475569)" }}
                    >
                      {dept.headName || "—"}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div
                        className="flex items-center gap-1.5 font-bold"
                        style={{ color: "var(--m3-primary, #1a73e8)" }}
                      >
                        <Users size={14} style={{ color: "var(--m3-on-surface-variant, #475569)" }} />
                        {dept.memberCount}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        label={
                          dept.status === "active" ? "Hoạt động" : "Vô hiệu"
                        }
                        variant={
                          dept.status === "active" ? "success" : "danger"
                        }
                        dot
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(dept)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-m3-surface-container"
                          style={{ color: "var(--m3-primary, #1a73e8)" }}
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openDelete(dept)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-m3-error-container"
                          style={{ color: "var(--m3-error, #ba1a1a)" }}
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && total > 0 && (
          <div className="px-6 py-4" style={{ borderTop: "1px solid var(--m3-outline-variant, #e3e8ee)" }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              limit={8}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingDept ? "Chỉnh sửa phòng ban" : "Thêm phòng ban mới"}
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              disabled={formLoading}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={formLoading}
            >
              {editingDept ? "Lưu thay đổi" : "Tạo phòng ban"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-m3-error-container border border-m3-error text-m3-on-error-container text-sm px-4 py-2.5 rounded-xl">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tên phòng ban"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Khoa CNTT"
              className="col-span-2"
            />
            <Input
              label="Mã"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="CNTT"
            />
            <Input
              label="Số thành viên"
              type="number"
              value={form.memberCount}
              onChange={(e) =>
                setForm((f) => ({ ...f, memberCount: e.target.value }))
              }
              placeholder="0"
            />
            <Input
              label="Trưởng bộ phận"
              value={form.headName}
              onChange={(e) =>
                setForm((f) => ({ ...f, headName: e.target.value }))
              }
              placeholder="Nguyễn Văn A"
            />
            <Select
              label="Trạng thái"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              options={FORM_STATUS_OPTIONS}
            />
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-m3-on-surface-variant">
                Mô tả
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Mô tả ngắn về phòng ban..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-m3-outline-variant bg-m3-surface-lowest text-sm text-m3-on-surface placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-m3-primary focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Xóa phòng ban"
        message={`Bạn có chắc muốn xóa phòng ban "${deletingDept?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        loading={deleteLoading}
      />
    </div>
  );
}
