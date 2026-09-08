import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";

export type AuditActionType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "EXPORT"
  | "VIEW_SENSITIVE";

export type AuditLogRecord = {
  id: number;
  userId: string | null;
  username: string | null;
  fullName: string | null;
  actionType: AuditActionType;
  targetTable: string | null;
  targetId: string | null;
  dataSnapshot: string | null;
  ipAddress: string | null;
  logTime: string;
};

type AuditRow = RowDataPacket & {
  id: number;
  user_id: string | null;
  username: string | null;
  full_name: string | null;
  action_type: AuditActionType;
  target_table: string | null;
  target_id: string | null;
  data_snapshot: string | null;
  ip_address: string | null;
  log_time: string | Date;
};

function toIso(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) return new Date(s.replace(" ", "T") + "Z").toISOString();
  return new Date(s).toISOString();
}

export async function writeAuditLog(entry: {
  userId?: string | null;
  actionType: AuditActionType;
  targetTable?: string | null;
  targetId?: string | null;
  dataSnapshot?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  if (!(await pingDb())) return;
  try {
    const snapshot =
      entry.dataSnapshot === undefined || entry.dataSnapshot === null
        ? null
        : typeof entry.dataSnapshot === "string"
          ? entry.dataSnapshot
          : JSON.stringify(entry.dataSnapshot);

    await queryExecute(
      `INSERT INTO system_audit_logs
        (user_id, action_type, target_table, target_id, data_snapshot, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.userId || null,
        entry.actionType,
        entry.targetTable || null,
        entry.targetId || null,
        snapshot,
        entry.ipAddress || null,
      ],
    );
  } catch (e) {
    console.error("writeAuditLog:", e);
  }
}

export async function findAuditLogs(query: {
  search?: string;
  actionType?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: AuditLogRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} | null> {
  if (!(await pingDb())) return null;

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const offset = (page - 1) * limit;

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (query.actionType) {
    where.push("l.action_type = ?");
    params.push(query.actionType.toUpperCase());
  }

  if (query.search) {
    const s = `%${query.search}%`;
    where.push(
      `(u.username LIKE ? OR u.full_name LIKE ? OR l.target_table LIKE ? OR l.target_id LIKE ? OR l.data_snapshot LIKE ?)`,
    );
    params.push(s, s, s, s, s);
  }

  const whereSql = where.join(" AND ");

  try {
    const [countRow] = await queryRows<(RowDataPacket & { cnt: number })[]>(
      `SELECT COUNT(*) AS cnt
       FROM system_audit_logs l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE ${whereSql}`,
      params,
    );
    let total = Number(countRow?.cnt || 0);

    if (total === 0 && !query.search && !query.actionType) {
      await backfillAuditLogsFromUsers();
      const [count2] = await queryRows<(RowDataPacket & { cnt: number })[]>(
        `SELECT COUNT(*) AS cnt FROM system_audit_logs`,
      );
      total = Number(count2?.cnt || 0);
    }

    if (total === 0) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const rows = await queryRows<AuditRow[]>(
      `SELECT
         l.id, l.user_id, l.action_type, l.target_table, l.target_id,
         l.data_snapshot, l.ip_address, l.log_time,
         u.username, u.full_name
       FROM system_audit_logs l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE ${whereSql}
       ORDER BY l.log_time DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      data: rows.map((r) => ({
        id: Number(r.id),
        userId: r.user_id ? String(r.user_id) : null,
        username: r.username ? String(r.username) : null,
        fullName: r.full_name ? String(r.full_name) : null,
        actionType: r.action_type,
        targetTable: r.target_table ? String(r.target_table) : null,
        targetId: r.target_id ? String(r.target_id) : null,
        dataSnapshot: r.data_snapshot ? String(r.data_snapshot) : null,
        ipAddress: r.ip_address ? String(r.ip_address) : null,
        logTime: toIso(r.log_time),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  } catch (e) {
    console.error("findAuditLogs:", e);
    return null;
  }
}

/** Khi bảng log trống: tạo bản ghi LOGIN từ last_login của users. */
async function backfillAuditLogsFromUsers(): Promise<void> {
  try {
    await queryExecute(
      `INSERT INTO system_audit_logs
        (user_id, action_type, target_table, target_id, data_snapshot, log_time)
       SELECT
         u.id,
         'LOGIN',
         'users',
         u.id,
         JSON_OBJECT('source', 'backfill', 'username', u.username),
         COALESCE(u.last_login, u.updated_at, u.created_at)
       FROM users u
       WHERE NOT EXISTS (
         SELECT 1 FROM system_audit_logs l WHERE l.user_id = u.id AND l.action_type = 'LOGIN'
       )`,
    );
  } catch (e) {
    console.error("backfillAuditLogsFromUsers:", e);
  }
}

export type { RoleRecord } from "@/lib/roles-db";
export { findRolesFromDb } from "@/lib/roles-db";
