"use client";

import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import {
  AdminListHeader,
  AdminListShell,
  AdminListToolbar,
  AdminStatusTabs,
  AdminTable,
  AdminTHead,
  AdminPill,
  ADMIN_TH_CLS,
  ADMIN_TD_CLS,
  adminRowClass,
} from "@/components/admin/list-ui";

type AuditLog = {
  id: number;
  username: string | null;
  fullName: string | null;
  actionType: string;
  targetTable: string | null;
  targetId: string | null;
  dataSnapshot: string | null;
  logTime: string;
};

const ACTION_TABS = [
  { value: "", label: "Tất cả" },
  { value: "CREATE", label: "Thêm mới" },
  { value: "UPDATE", label: "Cập nhật" },
  { value: "DELETE", label: "Xóa" },
  { value: "LOGIN", label: "Đăng nhập" },
  { value: "EXPORT", label: "Xuất dữ liệu" },
] as const;

function relativeTimeVi(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Vừa xong";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Hôm qua";
  if (day < 7) return `${day} ngày trước`;
  return new Date(iso).toLocaleString("vi-VN");
}

function actionUi(type: string): { bg: string; color: string; label: string } {
  switch (type) {
    case "CREATE":
      return {
        bg: "var(--color-m3-success-container)",
        color: "var(--color-m3-success)",
        label: "THÊM MỚI",
      };
    case "UPDATE":
      return {
        bg: "var(--m3-primary-container, #dae9fb)",
        color: "var(--m3-primary, #1a73e8)",
        label: "CẬP NHẬT",
      };
    case "DELETE":
      return {
        bg: "var(--m3-error-container, #ffdad6)",
        color: "var(--m3-error, #ba1a1a)",
        label: "XÓA",
      };
    case "EXPORT":
      return {
        bg: "var(--m3-secondary-container, #e8e8e8)",
        color: "var(--m3-on-secondary-container, #1b1d20)",
        label: "XUẤT",
      };
    case "VIEW_SENSITIVE":
      return {
        bg: "var(--m3-secondary-container, #e8e8e8)",
        color: "var(--m3-on-secondary-container, #1b1d20)",
        label: "XEM",
      };
    case "LOGIN":
    default:
      return {
        bg: "var(--m3-surface-container-high, #eef1f4)",
        color: "var(--m3-on-surface-variant, #475569)",
        label: "HỆ THỐNG",
      };
  }
}

function describeAction(log: AuditLog): string {
  if (log.actionType === "LOGIN") return "Đăng nhập hệ thống";
  if (log.actionType === "UPDATE" && log.targetTable === "users") {
    try {
      const snap = log.dataSnapshot ? JSON.parse(log.dataSnapshot) : null;
      if (Array.isArray(snap?.fields) && snap.fields.includes("password")) {
        return "Cập nhật mật khẩu tài khoản";
      }
    } catch {
      /* ignore */
    }
    return "Cập nhật tài khoản người dùng";
  }
  if (log.actionType === "CREATE") return `Thêm mới (${log.targetTable || "bản ghi"})`;
  if (log.actionType === "DELETE") return `Xóa (${log.targetTable || "bản ghi"})`;
  if (log.actionType === "EXPORT") return "Xuất dữ liệu";
  if (log.actionType === "VIEW_SENSITIVE") return "Xem dữ liệu nhạy cảm";
  return `Thao tác ${log.actionType} trên ${log.targetTable || "hệ thống"}`;
}

function describeTarget(log: AuditLog): string {
  if (log.actionType === "LOGIN") {
    return log.username || log.targetId || "—";
  }
  if (log.targetTable === "users") {
    try {
      const snap = log.dataSnapshot ? JSON.parse(log.dataSnapshot) : null;
      if (snap?.targetUsername) return String(snap.targetUsername);
      if (snap?.username) return String(snap.username);
    } catch {
      /* ignore */
    }
  }
  if (log.targetId) {
    return log.targetTable ? `${log.targetTable}: ${log.targetId}` : log.targetId;
  }
  return log.targetTable || "—";
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) params.set("search", search);
      if (actionType) params.set("actionType", actionType);
      const res = await fetch(`/api/admin/logs?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không tải được nhật ký");
        setLogs([]);
        return;
      }
      setLogs(Array.isArray(data.data) ? data.data : []);
      setTotal(Number(data.total || 0));
    } catch {
      setError("Không kết nối được máy chủ");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, actionType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Nhật ký Hệ thống (Logs)"
        countLabel={total > 0 ? `${total.toLocaleString("vi-VN")} bản ghi` : undefined}
      />

      <AdminListShell
        page={page}
        totalPages={totalPages}
        loading={loading}
        tabs={
          <AdminStatusTabs
            tabs={[...ACTION_TABS]}
            value={actionType}
            onChange={(v) => {
              setActionType(v);
              setPage(1);
            }}
          />
        }
        toolbar={
          <AdminListToolbar
            search={searchInput}
            onSearchChange={(v) => setSearchInput(v)}
            searchPlaceholder="Tìm kiếm log theo hành động, user..."
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
            <th className={ADMIN_TH_CLS}>Thời gian</th>
            <th className={ADMIN_TH_CLS}>Người thực hiện</th>
            <th className={ADMIN_TH_CLS}>Loại hình</th>
            <th className={ADMIN_TH_CLS}>Nội dung thao tác</th>
            <th className={ADMIN_TH_CLS}>Đối tượng tác động</th>
          </AdminTHead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  Đang tải nhật ký...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[14px] text-m3-error">
                  {error}
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  <div className="flex flex-col items-center gap-2">
                    <History size={28} className="text-m3-on-surface-variant/50" />
                    Chưa có nhật ký nào được ghi nhận.
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => {
                const ui = actionUi(log.actionType);
                return (
                  <tr key={log.id} className={adminRowClass(idx)}>
                    <td className={`${ADMIN_TD_CLS} whitespace-nowrap text-[12px] text-m3-on-surface-variant`}>
                      {relativeTimeVi(log.logTime)}
                    </td>
                    <td className={`${ADMIN_TD_CLS} font-semibold`}>
                      {log.username || log.fullName || "—"}
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill label={ui.label} bg={ui.bg} color={ui.color} />
                    </td>
                    <td className={`${ADMIN_TD_CLS} text-m3-on-surface-variant`}>
                      {describeAction(log)}
                    </td>
                    <td className={`${ADMIN_TD_CLS} italic text-m3-on-surface-variant`}>
                      {describeTarget(log)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </AdminTable>
      </AdminListShell>
    </div>
  );
}
