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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className="text-xl font-bold tracking-wide"
            style={{ color: "#3b491e" }}
          >
            Danh sách đơn vị
          </h2>
          <p className="text-sm font-medium mt-1" style={{ color: "#748c2c" }}>
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
      <div
        className="rounded-3xl p-4"
        style={{
          background: "#ffffff",
          border: "1px solid #edf4dc",
          boxShadow: "0 8px 30px rgba(0,0,0,0.02)",
        }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "#93a83e" }}
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
                background: "#f8fae8",
                border: "1px solid #dce7ba",
                color: "#3b491e",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#748c2c";
                e.target.style.background = "#fff";
                e.target.style.boxShadow = "0 0 0 3px rgba(116,140,44,0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#dce7ba";
                e.target.style.background = "#f8fae8";
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
              background: "#f8fae8",
              border: "1px solid #dce7ba",
              color: "#3b491e",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#748c2c";
              e.target.style.background = "#fff";
              e.target.style.boxShadow = "0 0 0 3px rgba(116,140,44,0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#dce7ba";
              e.target.style.background = "#f8fae8";
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
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: "#ffffff",
          border: "1px solid #edf4dc",
          boxShadow: "0 8px 30px rgba(0,0,0,0.02)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #edf4dc",
                  background: "#f8fae8",
                }}
              >
                <th
                  className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest"
                  style={{ color: "#586c23" }}
                >
                  Đơn vị
                </th>
                <th
                  className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest hidden md:table-cell"
                  style={{ color: "#586c23" }}
                >
                  Chỉ huy trưởng
                </th>
                <th
                  className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest hidden sm:table-cell"
                  style={{ color: "#586c23" }}
                >
                  Quân số
                </th>
                <th
                  className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest"
                  style={{ color: "#586c23" }}
                >
                  Trạng thái
                </th>
                <th
                  className="text-right px-6 py-4 text-xs font-bold uppercase tracking-widest"
                  style={{ color: "#586c23" }}
                >
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
                        <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                        <div className="space-y-1.5">
                          <div className="h-3 bg-slate-200 rounded w-28" />
                          <div className="h-2 bg-slate-100 rounded w-16" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="h-3 bg-slate-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="h-3 bg-slate-200 rounded w-12" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 bg-slate-200 rounded-full w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-7 bg-slate-200 rounded-lg w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : departments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="text-slate-300" />
                      <p>Không tìm thấy phòng ban nào</p>
                    </div>
                  </td>
                </tr>
              ) : (
                departments.map((dept, idx) => (
                  <tr
                    key={dept.id}
                    className="transition-colors hover:bg-gray-50 bg-white"
                    style={{
                      borderBottom:
                        idx < departments.length - 1
                          ? "1px solid #edf4dc"
                          : "none",
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: "#f8fae8",
                            border: "1px solid #dce7ba",
                          }}
                        >
                          <span
                            className="text-xs font-black"
                            style={{ color: "#748c2c" }}
                          >
                            {dept.code.slice(0, 3)}
                          </span>
                        </div>
                        <div>
                          <p
                            className="font-semibold"
                            style={{ color: "#3b491e" }}
                          >
                            {dept.name}
                          </p>
                          <p
                            className="text-xs font-medium"
                            style={{ color: "#748c2c" }}
                          >
                            {dept.description || "Chưa có mô tả"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 hidden md:table-cell font-medium"
                      style={{ color: "#586c23" }}
                    >
                      {dept.headName || "—"}
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div
                        className="flex items-center gap-1.5 font-bold"
                        style={{ color: "#748c2c" }}
                      >
                        <Users size={14} style={{ color: "#93a83e" }} />
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
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                          style={{ color: "#748c2c" }}
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openDelete(dept)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                          style={{ color: "#dc2626" }}
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
          <div className="px-6 py-4" style={{ borderTop: "1px solid #edf4dc" }}>
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
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-2.5 rounded-xl">
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
              <label className="text-sm font-medium text-slate-700">
                Mô tả
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Mô tả ngắn về phòng ban..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
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
