"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  History,
  Trash2,
  Save,
  Users,
  Shield,
  X,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type RoleRow = {
  id: number;
  name: string;
  code: string;
  description: string;
  usersCount: number;
};

type PermissionRow = {
  id: number;
  key: string;
  module: string;
  description: string;
};

type ModuleDef = {
  key: string;
  label: string;
  actions: Partial<Record<"view" | "create" | "edit" | "delete", string>>;
  options: { key: string; label: string }[];
};

type RoleMember = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  status: string;
  unitCode: string | null;
};

const DOT_COLORS = [
  "#1a73e8",
  "#d93025",
  "#188038",
  "#5f6368",
  "#a142f4",
  "#e37400",
  "#00897b",
  "#c2185b",
];

type TabId = "permissions" | "members";

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>("permissions");
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [selectedPermIds, setSelectedPermIds] = useState<Set<number>>(new Set());
  const [baselinePermIds, setBaselinePermIds] = useState<Set<number>>(new Set());
  const [members, setMembers] = useState<RoleMember[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const keyToId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of permissions) map.set(p.key, p.id);
    return map;
  }, [permissions]);

  const selectedRole = roles.find((r) => r.id === selectedId) || null;
  const dirty = useMemo(() => {
    if (selectedPermIds.size !== baselinePermIds.size) return true;
    for (const id of selectedPermIds) {
      if (!baselinePermIds.has(id)) return true;
    }
    return false;
  }, [selectedPermIds, baselinePermIds]);

  const fetchRoles = useCallback(async (preferId?: number) => {
    setLoadingRoles(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/roles", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không tải được vai trò");
        setRoles([]);
        return;
      }
      const list: RoleRow[] = Array.isArray(data.data) ? data.data : [];
      setRoles(list);
      setSelectedId((prev) => {
        if (preferId && list.some((r) => r.id === preferId)) return preferId;
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setError("Không kết nối được máy chủ");
      setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const fetchPermissionsCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/permissions", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setPermissions(Array.isArray(data.data) ? data.data : []);
        setModules(Array.isArray(data.modules) ? data.modules : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchRoleDetail = useCallback(async (roleId: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Không tải chi tiết vai trò");
        return;
      }
      const ids = new Set<number>(
        Array.isArray(data.permissionIds) ? data.permissionIds.map(Number) : [],
      );
      setSelectedPermIds(ids);
      setBaselinePermIds(new Set(ids));
      setMembers(Array.isArray(data.members) ? data.members : []);
      setRoles((prev) =>
        prev.map((r) =>
          r.id === roleId
            ? {
                ...r,
                name: data.name || r.name,
                description: data.description || r.description,
                usersCount:
                  typeof data.usersCount === "number"
                    ? data.usersCount
                    : r.usersCount,
              }
            : r,
        ),
      );
    } catch {
      setToast("Không tải chi tiết vai trò");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchPermissionsCatalog();
  }, [fetchRoles, fetchPermissionsCatalog]);

  useEffect(() => {
    if (selectedId == null) return;
    setTab("permissions");
    fetchRoleDetail(selectedId);
  }, [selectedId, fetchRoleDetail]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const togglePermKey = (key: string | undefined, checked: boolean) => {
    if (!key) return;
    const id = keyToId.get(key);
    if (id == null) return;
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const hasKey = (key: string | undefined) => {
    if (!key) return false;
    const id = keyToId.get(key);
    return id != null && selectedPermIds.has(id);
  };

  const savePermissions = async () => {
    if (selectedId == null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds: [...selectedPermIds] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Lưu quyền thất bại");
        return;
      }
      const ids = new Set<number>(
        Array.isArray(data.permissionIds) ? data.permissionIds.map(Number) : [],
      );
      setSelectedPermIds(ids);
      setBaselinePermIds(new Set(ids));
      setToast("Đã lưu quyền hạn");
    } catch {
      setToast("Không kết nối được máy chủ");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!createName.trim()) {
      setCreateError("Vui lòng nhập tên vai trò");
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Không tạo được vai trò");
        return;
      }
      setCreateOpen(false);
      setCreateName("");
      setCreateDesc("");
      await fetchRoles(data.id);
      setToast("Đã thêm vai trò mới");
    } catch {
      setCreateError("Không kết nối được máy chủ");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId == null || !selectedRole) return;
    if (selectedRole.code === "SUPER_ADMIN" || selectedId === 1) {
      setToast("Không thể xóa vai trò SUPER_ADMIN");
      return;
    }
    if (
      !window.confirm(
        `Xóa vai trò “${selectedRole.name}”? Thao tác không thể hoàn tác.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/roles/${selectedId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Không xóa được");
        return;
      }
      setToast("Đã xóa vai trò");
      await fetchRoles();
    } catch {
      setToast("Không kết nối được máy chủ");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-m3-on-surface">
          Vai trò & quyền
        </h1>
        <Link
          href="/admin/logs?search=roles"
          className="inline-flex items-center gap-2 text-[14px] font-medium text-m3-on-surface-variant transition hover:text-m3-primary"
        >
          <History size={16} />
          Lịch sử chỉnh sửa
        </Link>
      </div>

      {toast && (
        <div className="rounded-[12px] border border-m3-primary/20 bg-m3-primary-container px-4 py-2 text-[14px] font-medium text-m3-primary">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-[12px] border border-m3-error/20 bg-m3-error-container px-4 py-2 text-[14px] text-m3-error">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left: roles */}
        <aside className="flex max-h-[70vh] flex-col overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:max-h-none">
          <div className="flex items-center justify-between border-b border-m3-outline-variant px-4 py-3">
            <p className="text-[15px] font-bold text-m3-on-surface">Vai trò</p>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="rounded-lg p-1.5 text-m3-primary transition hover:bg-m3-primary-container"
              title="Thêm vai trò"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingRoles ? (
              <p className="px-3 py-6 text-center text-[14px] text-m3-on-surface-variant">
                Đang tải...
              </p>
            ) : roles.length === 0 ? (
              <p className="px-3 py-6 text-center text-[14px] text-m3-on-surface-variant">
                Chưa có vai trò
              </p>
            ) : (
              <ul className="space-y-1">
                {roles.map((role, idx) => {
                  const active = role.id === selectedId;
                  const color = DOT_COLORS[idx % DOT_COLORS.length];
                  return (
                    <li key={role.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(role.id)}
                        className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition ${
                          active
                            ? "bg-m3-primary-container text-m3-primary"
                            : "text-m3-on-surface hover:bg-m3-surface-high"
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">
                            {role.name}
                          </span>
                          <span
                            className={`block truncate text-[12px] ${
                              active
                                ? "text-m3-primary/70"
                                : "text-m3-on-surface-variant"
                            }`}
                          >
                            {role.usersCount} thành viên
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Right: detail */}
        <section className="flex min-h-[520px] flex-col overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {!selectedRole ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-m3-on-surface-variant">
              <Shield size={36} className="opacity-40" />
              <p>Chọn một vai trò để xem quyền hạn</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-m3-outline-variant px-5 pt-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-bold text-m3-on-surface">
                    Vai trò — {selectedRole.name}
                  </h2>
                  {selectedRole.description &&
                    selectedRole.description !== selectedRole.name && (
                      <p className="mt-1 text-[13px] text-m3-on-surface-variant">
                        {selectedRole.description}
                      </p>
                    )}
                  <div className="mt-3 flex gap-5">
                    <button
                      type="button"
                      onClick={() => setTab("permissions")}
                      className={`border-b-2 pb-2.5 text-[14px] font-semibold transition ${
                        tab === "permissions"
                          ? "border-m3-primary text-m3-primary"
                          : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface"
                      }`}
                    >
                      Quyền hạn
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("members")}
                      className={`border-b-2 pb-2.5 text-[14px] font-semibold transition ${
                        tab === "members"
                          ? "border-m3-primary text-m3-primary"
                          : "border-transparent text-m3-on-surface-variant hover:text-m3-on-surface"
                      }`}
                    >
                      Thành viên ({selectedRole.usersCount})
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 pb-3 sm:pb-0">
                  {tab === "permissions" && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Save size={14} />}
                      disabled={!dirty || saving || loadingDetail}
                      onClick={savePermissions}
                    >
                      {saving ? "Đang lưu..." : "Lưu quyền"}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={selectedId === 1}
                    className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-m3-error transition hover:bg-m3-error-container disabled:opacity-40"
                    title="Xóa vai trò"
                  >
                    <Trash2 size={14} />
                    Xóa
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {loadingDetail ? (
                  <p className="p-8 text-center text-[14px] text-m3-on-surface-variant">
                    Đang tải chi tiết...
                  </p>
                ) : tab === "members" ? (
                  <div className="p-4">
                    {members.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-m3-on-surface-variant">
                        <Users size={28} className="opacity-40" />
                        <p>Chưa có thành viên nào thuộc vai trò này</p>
                      </div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="text-[12px] font-bold uppercase tracking-wide text-m3-on-surface-variant">
                          <tr className="border-b border-m3-outline-variant">
                            <th className="px-3 py-2">Họ tên</th>
                            <th className="px-3 py-2">Username</th>
                            <th className="hidden px-3 py-2 sm:table-cell">Email</th>
                            <th className="px-3 py-2">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-m3-outline-variant">
                          {members.map((m) => (
                            <tr key={m.id}>
                              <td className="px-3 py-3 font-medium text-m3-on-surface">
                                {m.fullName}
                              </td>
                              <td className="px-3 py-3 text-m3-on-surface-variant">
                                @{m.username}
                              </td>
                              <td className="hidden px-3 py-3 text-m3-on-surface-variant sm:table-cell">
                                {m.email || "—"}
                              </td>
                              <td className="px-3 py-3 text-m3-on-surface-variant">
                                {m.status === "active"
                                  ? "Hoạt động"
                                  : m.status === "locked"
                                    ? "Đã khóa"
                                    : "Vô hiệu hóa"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-m3-surface-lowest text-[12px] font-bold uppercase tracking-wide text-m3-on-surface-variant">
                        <tr className="border-b border-m3-outline-variant">
                          <th className="px-5 py-3">Chức năng</th>
                          <th className="w-16 px-2 py-3 text-center">Xem</th>
                          <th className="w-16 px-2 py-3 text-center">Thêm</th>
                          <th className="w-16 px-2 py-3 text-center">Sửa</th>
                          <th className="w-16 px-2 py-3 text-center">Xóa</th>
                          <th className="px-5 py-3">Tùy chọn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-m3-outline-variant">
                        {modules.map((mod) => (
                          <tr key={mod.key} className="align-top hover:bg-m3-surface-high/40">
                            <td className="px-5 py-3.5 font-semibold text-m3-on-surface">
                              {mod.label}
                            </td>
                            {(
                              ["view", "create", "edit", "delete"] as const
                            ).map((action) => {
                              const key = mod.actions[action];
                              const available = Boolean(key && keyToId.has(key));
                              return (
                                <td key={action} className="px-2 py-3.5 text-center">
                                  {available ? (
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 cursor-pointer accent-[var(--m3-primary,#1a73e8)]"
                                      checked={hasKey(key)}
                                      onChange={(e) =>
                                        togglePermKey(key, e.target.checked)
                                      }
                                    />
                                  ) : (
                                    <span className="text-m3-outline-variant">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-5 py-3.5">
                              {mod.options.length === 0 ? (
                                <span className="text-m3-on-surface-variant">—</span>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {mod.options.map((opt) => {
                                    const available = keyToId.has(opt.key);
                                    if (!available) return null;
                                    return (
                                      <label
                                        key={opt.key}
                                        className="flex cursor-pointer items-start gap-2 text-[13px] text-m3-on-surface"
                                      >
                                        <input
                                          type="checkbox"
                                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--m3-primary,#1a73e8)]"
                                          checked={hasKey(opt.key)}
                                          onChange={(e) =>
                                            togglePermKey(opt.key, e.target.checked)
                                          }
                                        />
                                        <span>{opt.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm vai trò mới"
      >
        <div className="space-y-4">
          <Input
            label="Tên vai trò"
            required
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="VD: Cán bộ cấp xã"
          />
          <Input
            label="Mô tả"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            placeholder="Mô tả ngắn quyền hạn của vai trò"
          />
          {createError && (
            <p className="text-[13px] text-m3-error">{createError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              icon={<X size={14} />}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={createLoading}
              icon={<Plus size={14} />}
            >
              {createLoading ? "Đang tạo..." : "Thêm vai trò"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
