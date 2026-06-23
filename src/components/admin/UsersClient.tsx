"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, Filter } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import Modal, { ConfirmDialog } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: string;
  createdAt: string;
}

interface UserFormData {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: string;
}

const defaultForm: UserFormData = {
  username: "",
  password: "",
  name: "",
  email: "",
  phone: "",
  role: "user",
  department: "",
  status: "active",
};

const ROLE_OPTIONS = [
  { value: "", label: "Tất cả vai trò" },
  { value: "admin", label: "Quản trị viên" },
  { value: "user", label: "Người dùng" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Vô hiệu hóa" },
];

const FORM_ROLE_OPTIONS = [
  { value: "user", label: "Người dùng" },
  { value: "admin", label: "Quản trị viên" },
];

const FORM_STATUS_OPTIONS = [
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Vô hiệu hóa" },
];

export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(defaultForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "8",
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(defaultForm);
    setFormError("");
    setIsFormOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      department: user.department,
      status: user.status,
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const openDelete = (user: User) => {
    setDeletingUser(user);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    setFormLoading(true);
    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";
      const body = editingUser
        ? {
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            department: form.department,
            status: form.status,
            ...(form.password && { password: form.password }),
          }
        : form;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Có lỗi xảy ra");
        return;
      }
      setIsFormOpen(false);
      fetchUsers();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setIsDeleteOpen(false);
        fetchUsers();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setCurrentPage(1);
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
            Danh sách quân nhân
          </h2>
          <p className="text-sm font-medium mt-1" style={{ color: "#748c2c" }}>
            {total} tài khoản trong hệ thống
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus size={16} />}
          onClick={openCreate}
        >
          Thêm người dùng
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
              placeholder="Tìm kiếm họ tên, username..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
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
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
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
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
                  Quân nhân
                </th>
                <th
                  className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest hidden lg:table-cell"
                  style={{ color: "#586c23" }}
                >
                  Email
                </th>
                <th
                  className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest hidden md:table-cell"
                  style={{ color: "#586c23" }}
                >
                  Đơn vị
                </th>
                <th
                  className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest"
                  style={{ color: "#586c23" }}
                >
                  Vai trò
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
                        <div className="w-8 h-8 bg-slate-200 rounded-full" />
                        <div className="space-y-1.5">
                          <div className="h-3 bg-slate-200 rounded w-28" />
                          <div className="h-2 bg-slate-100 rounded w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="h-3 bg-slate-200 rounded w-36" />
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="h-3 bg-slate-200 rounded w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 bg-slate-200 rounded-full w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 bg-slate-200 rounded-full w-20" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-7 bg-slate-200 rounded-lg w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="text-slate-300" />
                      <p>Không tìm thấy người dùng nào</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user, idx) => (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-gray-50 bg-white"
                    style={{
                      borderBottom:
                        idx < users.length - 1 ? "1px solid #edf4dc" : "none",
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
                            className="text-sm font-bold"
                            style={{ color: "#748c2c" }}
                          >
                            {user.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p
                            className="font-semibold"
                            style={{ color: "#3b491e" }}
                          >
                            {user.name}
                          </p>
                          <p
                            className="text-xs font-medium"
                            style={{ color: "#748c2c" }}
                          >
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 hidden lg:table-cell font-medium"
                      style={{ color: "#586c23" }}
                    >
                      {user.email}
                    </td>
                    <td
                      className="px-6 py-4 hidden md:table-cell font-medium"
                      style={{ color: "#586c23" }}
                    >
                      {user.department || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        label={user.role === "admin" ? "Chỉ huy" : "Quân nhân"}
                        variant={user.role === "admin" ? "info" : "default"}
                        dot
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        label={
                          user.status === "active" ? "Tại ngũ" : "Xuất ngũ"
                        }
                        variant={
                          user.status === "active" ? "success" : "danger"
                        }
                        dot
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                          style={{ color: "#748c2c" }}
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openDelete(user)}
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
        {/* Pagination */}
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
        title={editingUser ? "Chỉnh sửa người dùng" : "Thêm người dùng mới"}
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
              {editingUser ? "Lưu thay đổi" : "Tạo người dùng"}
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
            <div className="col-span-2">
              <Input
                label="Họ và tên"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Nguyễn Văn A"
              />
            </div>
            <Input
              label="Tên đăng nhập"
              required
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              placeholder="username"
              disabled={!!editingUser}
            />
            <Input
              label={
                editingUser
                  ? "Mật khẩu mới (để trống nếu không đổi)"
                  : "Mật khẩu"
              }
              type="password"
              required={!editingUser}
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder="••••••••"
            />
            <div className="col-span-2">
              <Input
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="user@ymsa.edu.vn"
              />
            </div>
            <Input
              label="Số điện thoại"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="09xxxxxxxx"
            />
            <Input
              label="Phòng ban"
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({ ...f, department: e.target.value }))
              }
              placeholder="Khoa CNTT"
            />
            <Select
              label="Vai trò"
              required
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              options={FORM_ROLE_OPTIONS}
            />
            <Select
              label="Trạng thái"
              required
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              options={FORM_STATUS_OPTIONS}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Xóa người dùng"
        message={`Bạn có chắc muốn xóa người dùng "${deletingUser?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        loading={deleteLoading}
      />
    </div>
  );
}
