"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, Eye, EyeOff, MapPin } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal, { ConfirmDialog } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import {
  AdminListHeader,
  AdminStatusTabs,
  AdminListToolbar,
  AdminListShell,
  AdminHoverActions,
  AdminIconBtn,
  AdminPill,
  AdminPrimaryBtn,
  ADMIN_SELECT_CLS,
} from "@/components/admin/list-ui";
import type { HierarchyLevel, HierarchyUnit } from "@/lib/data";
import { FUNCTIONAL_ROLE_LABELS } from "@/lib/functional-roles";
import {
  isQuanKhuOrBtl,
  MILITARY_REGIONS,
  MILITARY_SUB_UNITS,
} from "@/lib/military-regions";

type SystemRole = {
  id: number;
  name: string;
  code: string;
  description: string;
};

type UserRow = {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleId?: number | null;
  roleName?: string;
  roleCode?: string;
  department: string;
  hierarchyLevel?: HierarchyLevel;
  unitCode?: string;
  unitName?: string;
  parentUnitCode?: string | null;
  parentUnitName?: string | null;
  functionalRole?: string;
  status: string;
  editPin?: string | null;
  createdAt: string;
};

type UserFormData = {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  editPin: string;
  /** Đơn vị gán cho tài khoản (tỉnh khi Bộ; xã khi Tỉnh; cố định khi Xã) */
  unitCode: string;
  roleId: string;
  /** Chỉ dùng khi session cấp Bộ: loại đơn vị gán */
  unitKind: "tinh" | "quan_khu" | "don_vi_nhan";
};

const defaultForm: UserFormData = {
  username: "",
  password: "",
  name: "",
  email: "",
  phone: "",
  status: "active",
  editPin: "",
  unitCode: "",
  roleId: "",
  unitKind: "tinh",
};

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "Tất cả vai trò" },
  { value: "admin", label: "Quản trị viên" },
  { value: "y_te", label: "Cán bộ y tế" },
  { value: "quan_khu", label: "Quân khu / BTL" },
  { value: "nhan_quan", label: "Đơn vị nhận quân" },
  { value: "user", label: "Cán bộ nghiệp vụ / khác" },
];

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Vô hiệu hóa" },
  { value: "locked", label: "Đã khóa" },
];

const FORM_STATUS_OPTIONS = [
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Vô hiệu hóa" },
  { value: "locked", label: "Đã khóa" },
];

const SELECT_CLS =
  "w-full rounded-[10px] border border-black/[0.1] bg-white px-3 py-2.5 text-[14px] text-m3-on-surface outline-none focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/10";

function statusLabel(status: string): string {
  if (status === "active") return "Hoạt động";
  if (status === "inactive") return "Vô hiệu hóa";
  if (status === "locked") return "Đã khóa";
  return status || "—";
}

function statusPillStyle(status: string): { bg: string; color: string } {
  if (status === "active") {
    return {
      bg: "color-mix(in srgb, var(--color-m3-success) 14%, transparent)",
      color: "var(--color-m3-success)",
    };
  }
  if (status === "locked") {
    return {
      bg: "color-mix(in srgb, var(--color-m3-warning) 14%, transparent)",
      color: "var(--m3-error, #ba1a1a)",
    };
  }
  if (status === "inactive") {
    return {
      bg: "color-mix(in srgb, var(--m3-error, #ba1a1a) 10%, transparent)",
      color: "var(--m3-error, #ba1a1a)",
    };
  }
  return {
    bg: "var(--m3-surface-container-high, #eef1f4)",
    color: "var(--m3-on-surface-variant, #475569)",
  };
}

function rolePillStyle(roleCode?: string, functionalRole?: string): {
  bg: string;
  color: string;
} {
  if (roleCode === "MEDICAL_OFFICER" || functionalRole === "y_te") {
    return {
      bg: "color-mix(in srgb, #00897b 14%, transparent)",
      color: "#00695c",
    };
  }
  if (functionalRole === "nhan_quan" || roleCode?.includes("RECEIVING")) {
    return {
      bg: "color-mix(in srgb, var(--color-m3-success) 14%, transparent)",
      color: "var(--color-m3-success)",
    };
  }
  if (roleCode?.includes("ADMIN") || roleCode === "SUPER_ADMIN") {
    return {
      bg: "color-mix(in srgb, var(--m3-primary) 14%, transparent)",
      color: "var(--m3-primary)",
    };
  }
  return {
    bg: "var(--m3-surface-container-high, #eef1f4)",
    color: "var(--m3-on-surface-variant, #475569)",
  };
}

type GroupBlock = {
  key: string;
  title: string;
  users: UserRow[];
};

/** Nhóm gọn: Bộ thấy theo tỉnh; Tỉnh thấy theo xã; Xã một nhóm. */
function groupUsersByLocality(
  users: UserRow[],
  sessionLevel: string | null,
): GroupBlock[] {
  const map = new Map<string, GroupBlock>();

  for (const u of users) {
    const level = u.hierarchyLevel || "xa";
    let key: string;
    let title: string;

    if (sessionLevel === "tinh") {
      key = `xa:${u.unitCode || u.id}`;
      title = u.unitName || u.department || u.unitCode || "Xã / phường";
    } else if (sessionLevel === "xa") {
      key = "xa-self";
      title = u.unitName || "Đơn vị của bạn";
    } else {
      if (level === "tinh") {
        key = `tinh:${u.unitCode}`;
        title = u.unitName || u.unitCode || "Tỉnh / TP";
      } else if (level === "xa") {
        const parent = u.parentUnitCode || u.unitCode?.split("-")[0] || "khac";
        key = `tinh:${parent}`;
        title = u.parentUnitName || parent;
      } else if (level === "bo") {
        key = "bo";
        title = "Cấp Bộ";
      } else if (level === "donvi" && isQuanKhuOrBtl(u.unitCode || "")) {
        key = `qk:${u.unitCode}`;
        title = u.unitName || "Quân khu / BTL";
      } else if (level === "donvi") {
        key = `dv:${u.parentUnitCode || u.unitCode || "khac"}`;
        title = u.parentUnitName
          ? `Nhận quân — ${u.parentUnitName}`
          : u.unitName || "Đơn vị nhận quân";
      } else {
        key = `other:${u.unitCode}`;
        title = u.unitName || "Khác";
      }
    }

    if (!map.has(key)) map.set(key, { key, title, users: [] });
    map.get(key)!.users.push(u);
  }

  return [...map.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "vi"),
  );
}

export default function UsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
  const [sessionUnitCode, setSessionUnitCode] = useState<string | null>(null);
  const [sessionUnitName, setSessionUnitName] = useState<string>("");

  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([]);
  const [unitOptions, setUnitOptions] = useState<HierarchyUnit[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserFormData>(defaultForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const unitFieldLabel =
    sessionLevel === "bo"
      ? form.unitKind === "quan_khu"
        ? "Quân khu / BTL"
        : form.unitKind === "don_vi_nhan"
          ? "Đơn vị nhận quân"
          : "Tỉnh / Thành phố"
      : sessionLevel === "tinh"
        ? "Xã / Phường"
        : "Đơn vị";

  const boUnitOptions = useMemo((): HierarchyUnit[] => {
    if (sessionLevel !== "bo") return unitOptions;
    if (form.unitKind === "quan_khu") {
      return MILITARY_REGIONS.map((r) => ({
        code: r.code,
        name: r.name,
        level: "donvi" as HierarchyLevel,
        parentCode: r.parentCode,
      }));
    }
    if (form.unitKind === "don_vi_nhan") {
      return MILITARY_SUB_UNITS.map((r) => ({
        code: r.code,
        name: r.name,
        level: "donvi" as HierarchyLevel,
        parentCode: r.parentCode,
      }));
    }
    return unitOptions;
  }, [sessionLevel, form.unitKind, unitOptions]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: String(pageSize),
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
  }, [currentPage, pageSize, search, roleFilter, statusFilter]);

  const loadUnitOptions = useCallback(
    async (level: string | null, unitCode: string | null) => {
      if (!level || !unitCode) {
        setUnitOptions([]);
        return;
      }
      try {
        if (level === "bo") {
          const res = await fetch(
            "/api/admin/hierarchy/children?parentCode=bo",
          );
          const data = res.ok ? await res.json() : { items: [] };
          setUnitOptions(
            ((data.items || []) as HierarchyUnit[]).filter(
              (i) => i.level === "tinh",
            ),
          );
        } else if (level === "tinh") {
          const res = await fetch(
            `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(unitCode)}`,
          );
          const data = res.ok ? await res.json() : { items: [] };
          setUnitOptions(
            ((data.items || []) as HierarchyUnit[]).filter(
              (i) => i.level === "xa",
            ),
          );
        } else {
          setUnitOptions([]);
        }
      } catch {
        setUnitOptions([]);
      }
    },
    [],
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const level = data?.user?.hierarchyLevel ?? null;
        const unitCode = data?.user?.unitCode ?? null;
        const unitName = data?.user?.unitName ?? unitCode ?? "";
        setSessionLevel(level);
        setSessionUnitCode(unitCode);
        setSessionUnitName(unitName);
        void loadUnitOptions(level, unitCode);
      })
      .catch(() => {
        setSessionLevel(null);
        setSessionUnitCode(null);
      });

    fetch("/api/admin/roles")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data) => {
        setSystemRoles(
          (data.data || []).map(
            (r: {
              id: number;
              name: string;
              code: string;
              description: string;
            }) => ({
              id: r.id,
              name: r.name,
              code: r.code,
              description: r.description,
            }),
          ),
        );
      })
      .catch(() => setSystemRoles([]));
  }, [loadUnitOptions]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const groups = useMemo(
    () => groupUsersByLocality(users, sessionLevel),
    [users, sessionLevel],
  );

  const openCreate = () => {
    setEditingUser(null);
    setForm({
      ...defaultForm,
      unitCode: sessionLevel === "xa" ? sessionUnitCode || "" : "",
      unitKind: "tinh",
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const openEdit = (user: UserRow) => {
    const code = user.unitCode || "";
    let unitKind: UserFormData["unitKind"] = "tinh";
    if (isQuanKhuOrBtl(code)) unitKind = "quan_khu";
    else if (user.hierarchyLevel === "donvi") unitKind = "don_vi_nhan";

    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      editPin: user.editPin || "",
      unitCode:
        sessionLevel === "xa"
          ? sessionUnitCode || user.unitCode || ""
          : user.unitCode || "",
      roleId: user.roleId != null ? String(user.roleId) : "",
      unitKind,
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const openDelete = (user: UserRow) => {
    setDeletingUser(user);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async () => {
    setFormError("");
    const unitCode =
      sessionLevel === "xa" ? sessionUnitCode || "" : form.unitCode.trim();

    if (!form.name.trim()) {
      setFormError("Vui lòng nhập họ và tên");
      return;
    }
    if (!editingUser && !form.username.trim()) {
      setFormError("Vui lòng nhập tên đăng nhập");
      return;
    }
    if (!editingUser && form.password.trim().length < 6) {
      setFormError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (editingUser && form.password.trim() && form.password.trim().length < 6) {
      setFormError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (!unitCode) {
      setFormError(
        sessionLevel === "bo"
          ? form.unitKind === "quan_khu"
            ? "Vui lòng chọn quân khu / BTL"
            : form.unitKind === "don_vi_nhan"
              ? "Vui lòng chọn đơn vị nhận quân"
              : "Vui lòng chọn tỉnh / thành phố"
          : sessionLevel === "tinh"
            ? "Vui lòng chọn xã / phường"
            : "Thiếu đơn vị quản lý",
      );
      return;
    }
    if (!form.roleId) {
      setFormError("Vui lòng chọn vai trò");
      return;
    }

    setFormLoading(true);
    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";
      const body = editingUser
        ? {
            username: editingUser.username,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            status: form.status,
            unitCode,
            roleId: Number(form.roleId),
            ...(form.unitKind !== "tinh" && { functionalRole: "nhan_quan" }),
            ...(form.password.trim() && { password: form.password.trim() }),
            ...(form.editPin.trim() &&
              form.unitKind === "tinh" && { editPin: form.editPin.trim() }),
          }
        : {
            username: form.username.trim(),
            password: form.password.trim(),
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            status: form.status,
            unitCode,
            roleId: Number(form.roleId),
            ...(form.unitKind !== "tinh" && { functionalRole: "nhan_quan" }),
            ...(form.editPin.trim() &&
              form.unitKind === "tinh" && { editPin: form.editPin.trim() }),
          };

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

  const showPinField =
    (sessionLevel === "bo" && form.unitKind === "tinh") ||
    sessionLevel === "tinh";

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Thành viên"
        countLabel={`${total.toLocaleString("vi-VN")} tài khoản`}
        filters={
          <select
            className={`${ADMIN_SELECT_CLS} max-w-[220px]`}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Lọc vai trò"
          >
            {ROLE_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        }
        actions={
          <AdminPrimaryBtn onClick={openCreate}>
            <Plus size={16} />
            Thêm thành viên
          </AdminPrimaryBtn>
        }
      />

      <AdminListShell
        page={currentPage}
        totalPages={totalPages}
        loading={loading}
        tabs={
          <AdminStatusTabs
            tabs={[...STATUS_TABS]}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          />
        }
        toolbar={
          <AdminListToolbar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="Tìm tên, tài khoản, đơn vị..."
            page={currentPage}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setCurrentPage(1);
            }}
          />
        }
      >
        {loading ? (
          <p className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
            Đang tải...
          </p>
        ) : users.length === 0 ? (
          <p className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant">
            Không có thành viên phù hợp.
          </p>
        ) : (
          <div className="space-y-4 p-3 sm:p-4">
            {groups.map((group) => (
              <section
                key={group.key}
                className="overflow-hidden rounded-[16px] border border-black/[0.06] bg-white"
              >
                <div className="flex items-start gap-2 border-b border-black/[0.05] bg-[#f1f5f9] px-4 py-3">
                  <MapPin
                    size={16}
                    className="mt-0.5 shrink-0 text-m3-primary"
                  />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-m3-on-surface">
                      {group.title}
                    </h3>
                    <p className="text-[12px] text-m3-on-surface-variant">
                      {group.users.length} thành viên
                    </p>
                  </div>
                </div>
                <ul className="divide-y divide-black/[0.04]">
                  {group.users.map((user) => {
                    const roleLabelText =
                      user.roleName ||
                      (user.functionalRole
                        ? FUNCTIONAL_ROLE_LABELS[
                            user.functionalRole as keyof typeof FUNCTIONAL_ROLE_LABELS
                          ]
                        : null) ||
                      (user.role === "admin" ? "Quản trị viên" : "Người dùng");
                    const roleStyle = rolePillStyle(
                      user.roleCode,
                      user.functionalRole,
                    );
                    const stStyle = statusPillStyle(user.status);

                    return (
                      <li
                        key={user.id}
                        className="group relative flex flex-col gap-2 px-4 py-3.5 pr-14 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold text-m3-on-surface">
                            {user.name}
                          </p>
                          <p className="text-[13px] text-m3-on-surface-variant">
                            @{user.username}
                            {user.unitName ? ` · ${user.unitName}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <AdminPill
                              label={roleLabelText}
                              bg={roleStyle.bg}
                              color={roleStyle.color}
                            />
                            <AdminPill
                              label={statusLabel(user.status)}
                              bg={stStyle.bg}
                              color={stStyle.color}
                            />
                            {user.editPin != null && user.editPin !== "" && (
                              <span className="inline-flex items-center gap-1 text-[12px] text-m3-on-surface-variant">
                                PIN{" "}
                                {revealedPins[user.id]
                                  ? user.editPin
                                  : "••••••"}
                                <button
                                  type="button"
                                  className="text-m3-primary"
                                  onClick={() =>
                                    setRevealedPins((m) => ({
                                      ...m,
                                      [user.id]: !m[user.id],
                                    }))
                                  }
                                >
                                  {revealedPins[user.id] ? (
                                    <EyeOff size={14} />
                                  ) : (
                                    <Eye size={14} />
                                  )}
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                        <AdminHoverActions>
                          <AdminIconBtn
                            title="Sửa"
                            onClick={() => openEdit(user)}
                          >
                            <Edit2 size={15} />
                          </AdminIconBtn>
                          <AdminIconBtn
                            title="Xóa"
                            onClick={() => openDelete(user)}
                          >
                            <Trash2 size={15} />
                          </AdminIconBtn>
                        </AdminHoverActions>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </AdminListShell>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingUser ? "Chỉnh sửa người dùng" : "Thêm thành viên"}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Họ và tên"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Tên đăng nhập"
              value={form.username}
              disabled={Boolean(editingUser)}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              required={!editingUser}
            />
            <Input
              label={
                editingUser
                  ? "Mật khẩu mới (để trống nếu không đổi)"
                  : "Mật khẩu"
              }
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required={!editingUser}
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Số điện thoại"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-m3-on-surface">
                Trạng thái <span className="text-m3-error">*</span>
              </label>
              <select
                className={SELECT_CLS}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {FORM_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 rounded-[14px] border border-m3-primary/15 bg-m3-primary/[0.04] p-4">
            <p className="text-[13px] font-bold text-m3-primary">
              Đơn vị quản lý
            </p>

            {sessionLevel === "xa" ? (
              <div>
                <p className="mb-1 text-[13px] font-medium text-m3-on-surface">
                  Xã / Phường
                </p>
                <p className="rounded-[10px] border border-black/[0.08] bg-white px-3 py-2.5 text-[14px] font-semibold">
                  {sessionUnitName || sessionUnitCode}
                </p>
              </div>
            ) : (
              <>
                {sessionLevel === "bo" && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-m3-on-surface">
                      Loại đơn vị <span className="text-m3-error">*</span>
                    </label>
                    <select
                      className={SELECT_CLS}
                      value={form.unitKind}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          unitKind: e.target.value as UserFormData["unitKind"],
                          unitCode: "",
                          editPin: "",
                        }))
                      }
                    >
                      <option value="tinh">Tỉnh / Thành phố</option>
                      <option value="quan_khu">Quân khu / BTL</option>
                      <option value="don_vi_nhan">
                        Đơn vị nhận quân (sư đoàn / trung đoàn)
                      </option>
                    </select>
                    {form.unitKind === "quan_khu" && (
                      <p className="mt-2 text-[12px] leading-snug text-m3-on-surface-variant">
                        Không chọn tỉnh/thành — địa bàn tỉnh thuộc quân khu
                        được lấy từ bản đồ phân cấp sẵn.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-m3-on-surface">
                    {unitFieldLabel} <span className="text-m3-error">*</span>
                  </label>
                  <select
                    className={SELECT_CLS}
                    value={form.unitCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unitCode: e.target.value }))
                    }
                  >
                    <option value="">
                      — Chọn {unitFieldLabel.toLowerCase()} —
                    </option>
                    {(sessionLevel === "bo" ? boUnitOptions : unitOptions).map(
                      (u) => (
                        <option key={u.code} value={u.code}>
                          {u.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </>
            )}

            {showPinField && (
              <Input
                label="Mã PIN đơn vị"
                value={form.editPin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, editPin: e.target.value }))
                }
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-m3-on-surface">
              Vai trò <span className="text-m3-error">*</span>
            </label>
            <select
              className={SELECT_CLS}
              value={form.roleId}
              onChange={(e) =>
                setForm((f) => ({ ...f, roleId: e.target.value }))
              }
            >
              <option value="">— Chọn vai trò —</option>
              {systemRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {formError && (
            <p className="text-[13px] font-medium text-m3-error">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              disabled={formLoading}
            >
              Hủy
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={formLoading}>
              {formLoading
                ? "Đang lưu…"
                : editingUser
                  ? "Lưu thay đổi"
                  : "Thêm thành viên"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Xóa thành viên"
        message={
          deletingUser
            ? `Vô hiệu hóa / xóa tài khoản “${deletingUser.name}” (@${deletingUser.username})?`
            : ""
        }
        confirmLabel="Xóa"
        loading={deleteLoading}
      />
    </div>
  );
}
