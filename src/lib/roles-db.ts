import { RowDataPacket, ResultSetHeader } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";

export type RoleRecord = {
  id: number;
  name: string;
  code: string;
  description: string;
  usersCount: number;
  createdAt: string | null;
};

export type PermissionRecord = {
  id: number;
  key: string;
  module: string;
  description: string;
};

export type RoleMember = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  status: string;
  unitCode: string | null;
};

/** Modules hiển thị trên ma trận quyền (UI). */
export const PERMISSION_MODULES: {
  key: string;
  label: string;
  actions: Partial<Record<"view" | "create" | "edit" | "delete", string>>;
  options: { key: string; label: string }[];
}[] = [
  {
    key: "CITIZEN",
    label: "Hồ sơ công dân",
    actions: {
      view: "CITIZEN_VIEW",
      create: "CITIZEN_CREATE",
      edit: "CITIZEN_EDIT",
      delete: "CITIZEN_DELETE",
    },
    options: [{ key: "CITIZEN_EXPORT", label: "Xuất danh sách công dân" }],
  },
  {
    key: "HEALTH",
    label: "Khám sức khỏe",
    actions: {
      view: "HEALTH_VIEW",
      create: "HEALTH_CREATE",
      edit: "HEALTH_EDIT",
      delete: "HEALTH_DELETE",
    },
    options: [{ key: "HEALTH_APPROVE", label: "Duyệt phân loại sức khỏe" }],
  },
  {
    key: "EDUCATION",
    label: "Học vấn",
    actions: { view: "EDUCATION_VIEW", edit: "EDUCATION_EDIT" },
    options: [],
  },
  {
    key: "RESIDENCE",
    label: "Cư trú",
    actions: { view: "RESIDENCE_VIEW", edit: "RESIDENCE_EDIT" },
    options: [],
  },
  {
    key: "RECRUITMENT",
    label: "Tuyển quân / đợt gọi",
    actions: {
      view: "RECRUITMENT_VIEW",
      create: "RECRUITMENT_CREATE",
      edit: "RECRUITMENT_EDIT",
      delete: "RECRUITMENT_DELETE",
    },
    options: [],
  },
  {
    key: "APPROVAL",
    label: "Xét duyệt nhập ngũ",
    actions: { view: "APPROVAL_VIEW", edit: "APPROVAL_EDIT" },
    options: [],
  },
  {
    key: "DOCUMENT",
    label: "Công văn / hồ sơ",
    actions: {
      view: "DOCUMENT_VIEW",
      create: "DOCUMENT_CREATE",
      edit: "DOCUMENT_EDIT",
      delete: "DOCUMENT_DELETE",
    },
    options: [],
  },
  {
    key: "QUOTA",
    label: "Chỉ tiêu",
    actions: { view: "QUOTA_VIEW", edit: "QUOTA_EDIT" },
    options: [],
  },
  {
    key: "USER",
    label: "Người dùng",
    actions: {
      view: "USER_VIEW",
      create: "USER_CREATE",
      edit: "USER_EDIT",
      delete: "USER_DELETE",
    },
    options: [],
  },
  {
    key: "ROLE",
    label: "Vai trò & quyền hạn",
    actions: { view: "ROLE_VIEW", edit: "ROLE_EDIT" },
    options: [],
  },
  {
    key: "REPORT",
    label: "Báo cáo thống kê",
    actions: { view: "REPORT_VIEW" },
    options: [{ key: "REPORT_EXPORT", label: "Xuất báo cáo" }],
  },
  {
    key: "LOG",
    label: "Nhật ký hệ thống",
    actions: { view: "LOG_VIEW" },
    options: [],
  },
  {
    key: "SETTING",
    label: "Cấu hình hệ thống",
    actions: { view: "SETTING_VIEW", edit: "SETTING_EDIT" },
    options: [],
  },
];

function toIso(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) {
    return new Date(s.replace(" ", "T") + "Z").toISOString();
  }
  return new Date(s).toISOString();
}

function slugRoleCode(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return base || `ROLE_${Date.now()}`;
}

export async function findRolesFromDb(query?: {
  search?: string;
}): Promise<RoleRecord[] | null> {
  if (!(await pingDb())) return null;
  try {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    if (query?.search) {
      where.push(
        "(r.role_name LIKE ? OR r.display_name LIKE ? OR r.description LIKE ?)",
      );
      const s = `%${query.search}%`;
      params.push(s, s, s);
    }

    const rows = await queryRows<
      (RowDataPacket & {
        id: number;
        role_name: string;
        display_name: string | null;
        description: string | null;
        user_count: number;
        created_at: string | Date | null;
      })[]
    >(
      `SELECT
         r.id, r.role_name, r.display_name, r.description, r.created_at,
         (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
       FROM roles r
       WHERE ${where.join(" AND ")}
       ORDER BY r.id ASC`,
      params,
    );

    return rows.map((r) => {
      const code = String(r.role_name);
      const name =
        (r.display_name && String(r.display_name).trim()) ||
        (r.description && String(r.description).trim()) ||
        code;
      return {
        id: Number(r.id),
        code,
        name,
        description: r.description ? String(r.description) : "—",
        usersCount: Number(r.user_count || 0),
        createdAt: r.created_at ? toIso(r.created_at) : null,
      };
    });
  } catch (e) {
    console.error("findRolesFromDb:", e);
    return null;
  }
}

export async function findRoleById(id: number): Promise<RoleRecord | null> {
  const all = await findRolesFromDb();
  return all?.find((r) => r.id === id) || null;
}

export async function findPermissionsFromDb(): Promise<PermissionRecord[] | null> {
  if (!(await pingDb())) return null;
  try {
    const rows = await queryRows<
      (RowDataPacket & {
        id: number;
        permission_key: string;
        module: string | null;
        description: string | null;
      })[]
    >(
      `SELECT id, permission_key, module, description FROM permissions ORDER BY module, id`,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      key: String(r.permission_key),
      module: String(r.module || "OTHER"),
      description: r.description ? String(r.description) : "",
    }));
  } catch (e) {
    console.error("findPermissionsFromDb:", e);
    return null;
  }
}

export async function findRolePermissionIds(roleId: number): Promise<number[] | null> {
  if (!(await pingDb())) return null;
  try {
    const rows = await queryRows<(RowDataPacket & { permission_id: number })[]>(
      `SELECT permission_id FROM role_permissions WHERE role_id = ?`,
      [roleId],
    );
    return rows.map((r) => Number(r.permission_id));
  } catch (e) {
    console.error("findRolePermissionIds:", e);
    return null;
  }
}

export async function setRolePermissions(
  roleId: number,
  permissionIds: number[],
): Promise<boolean> {
  if (!(await pingDb())) return false;
  try {
    await queryExecute(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
    const unique = [...new Set(permissionIds.filter((n) => Number.isFinite(n) && n > 0))];
    for (const pid of unique) {
      await queryExecute(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [roleId, pid],
      );
    }
    return true;
  } catch (e) {
    console.error("setRolePermissions:", e);
    return false;
  }
}

export async function createRoleInDb(data: {
  name: string;
  description?: string;
}): Promise<RoleRecord | null> {
  if (!(await pingDb())) return null;
  const display = data.name.trim();
  if (!display) return null;
  let code = slugRoleCode(display);
  try {
    // đảm bảo unique
    const existing = await queryRows<(RowDataPacket & { cnt: number })[]>(
      `SELECT COUNT(*) AS cnt FROM roles WHERE role_name = ?`,
      [code],
    );
    if (Number(existing[0]?.cnt || 0) > 0) {
      code = `${code}_${Date.now().toString(36).toUpperCase()}`;
    }

    const description = data.description?.trim() || display;
    const result = await queryExecute(
      `INSERT INTO roles (role_name, display_name, description) VALUES (?, ?, ?)`,
      [code, display, description],
    );
    const id = Number((result as ResultSetHeader).insertId);
    return {
      id,
      code,
      name: display,
      description,
      usersCount: 0,
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("createRoleInDb:", e);
    return null;
  }
}

const MEDICAL_ROLE_CODE = "MEDICAL_OFFICER";
const MEDICAL_ROLE_NAME = "Cán bộ y tế";
const MEDICAL_ROLE_DESC =
  "Cán bộ y tế — nhập khám sức khỏe, theo dõi đợt khám tuyển";

const MEDICAL_PERMISSION_KEYS = [
  "CITIZEN_VIEW",
  "HEALTH_VIEW",
  "HEALTH_CREATE",
  "HEALTH_EDIT",
  "HEALTH_APPROVE",
  "EDUCATION_VIEW",
  "RESIDENCE_VIEW",
  "RECRUITMENT_VIEW",
  "REPORT_VIEW",
] as const;

/**
 * Đảm bảo vai trò "Cán bộ y tế" tồn tại riêng (không gộp trong Cán bộ nghiệp vụ),
 * gán quyền khám sức khỏe, và chuyển user functional_role=y_te sang vai trò này.
 */
export async function ensureMedicalOfficerRole(): Promise<number | null> {
  if (!(await pingDb())) return null;
  try {
    // Cột display_name (idempotent)
    const cols = await queryRows<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'display_name'`,
    );
    if (!Number((cols[0] as { cnt?: number })?.cnt || 0)) {
      await queryExecute(
        `ALTER TABLE roles ADD COLUMN display_name VARCHAR(150) NULL COMMENT 'Tên hiển thị' AFTER role_name`,
      );
    }

    // Đổi tên cũ "Nhân viên y tế" → chuẩn hóa
    await queryExecute(
      `UPDATE roles
       SET role_name = ?,
           display_name = ?,
           description = ?
       WHERE role_name IN ('Nhân viên y tế', 'Nhan vien y te', 'HEALTH_STAFF')
          OR display_name IN ('Nhân viên y tế', 'Nhan vien y te')`,
      [MEDICAL_ROLE_CODE, MEDICAL_ROLE_NAME, MEDICAL_ROLE_DESC],
    );

    let rows = await queryRows<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM roles
       WHERE role_name = ?
          OR display_name = ?
          OR role_name LIKE '%y_te%'
          OR role_name LIKE '%Y_TE%'
          OR display_name LIKE '%Cán bộ y tế%'
          OR display_name LIKE '%Can bo y te%'
       ORDER BY id ASC
       LIMIT 1`,
      [MEDICAL_ROLE_CODE, MEDICAL_ROLE_NAME],
    );

    let roleId = rows[0] ? Number(rows[0].id) : 0;

    if (!roleId) {
      const result = await queryExecute(
        `INSERT INTO roles (role_name, display_name, description) VALUES (?, ?, ?)`,
        [MEDICAL_ROLE_CODE, MEDICAL_ROLE_NAME, MEDICAL_ROLE_DESC],
      );
      roleId = Number((result as ResultSetHeader).insertId);
    } else {
      await queryExecute(
        `UPDATE roles
         SET role_name = ?, display_name = ?, description = COALESCE(NULLIF(description, ''), ?)
         WHERE id = ?`,
        [MEDICAL_ROLE_CODE, MEDICAL_ROLE_NAME, MEDICAL_ROLE_DESC, roleId],
      );
    }

    if (!roleId) return null;

    // Quyền mặc định cho cán bộ y tế
    const permRows = await queryRows<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM permissions WHERE permission_key IN (${MEDICAL_PERMISSION_KEYS.map(() => "?").join(",")})`,
      [...MEDICAL_PERMISSION_KEYS],
    );
    for (const p of permRows) {
      await queryExecute(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [roleId, Number(p.id)],
      );
    }

    // Tách user y tế ra khỏi Cán bộ nghiệp vụ / vai trò khác
    await queryExecute(
      `UPDATE users SET role_id = ? WHERE functional_role = 'y_te' AND (role_id IS NULL OR role_id <> ?)`,
      [roleId, roleId],
    );

    return roleId;
  } catch (e) {
    console.error("ensureMedicalOfficerRole:", e);
    return null;
  }
}

export async function updateRoleInDb(
  id: number,
  data: { name?: string; description?: string },
): Promise<RoleRecord | null> {
  if (!(await pingDb())) return null;
  try {
    const current = await findRoleById(id);
    if (!current) return null;

    if (data.name !== undefined && data.name.trim()) {
      await queryExecute(`UPDATE roles SET display_name = ? WHERE id = ?`, [
        data.name.trim(),
        id,
      ]);
    }
    if (data.description !== undefined) {
      await queryExecute(`UPDATE roles SET description = ? WHERE id = ?`, [
        data.description.trim(),
        id,
      ]);
    }

    return findRoleById(id);
  } catch (e) {
    console.error("updateRoleInDb:", e);
    return null;
  }
}

export async function deleteRoleInDb(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await pingDb())) return { ok: false, error: "DB offline" };
  try {
    const role = await findRoleById(id);
    if (!role) return { ok: false, error: "Không tìm thấy vai trò" };
    if (id === 1 || role.code === "SUPER_ADMIN" || role.code === MEDICAL_ROLE_CODE) {
      return {
        ok: false,
        error:
          role.code === MEDICAL_ROLE_CODE
            ? "Không thể xóa vai trò Cán bộ y tế (vai trò hệ thống)"
            : "Không thể xóa vai trò SUPER_ADMIN",
      };
    }
    const [cnt] = await queryRows<(RowDataPacket & { cnt: number })[]>(
      `SELECT COUNT(*) AS cnt FROM users WHERE role_id = ?`,
      [id],
    );
    if (Number(cnt?.cnt || 0) > 0) {
      return {
        ok: false,
        error: "Vai trò đang được gán cho người dùng — hãy chuyển họ sang vai trò khác trước.",
      };
    }
    await queryExecute(`DELETE FROM roles WHERE id = ?`, [id]);
    return { ok: true };
  } catch (e) {
    console.error("deleteRoleInDb:", e);
    return { ok: false, error: "Không xóa được vai trò" };
  }
}

export async function findRoleMembers(roleId: number): Promise<RoleMember[] | null> {
  if (!(await pingDb())) return null;
  try {
    const rows = await queryRows<
      (RowDataPacket & {
        id: string;
        username: string;
        full_name: string;
        email: string | null;
        status: string;
        unit_code: string | null;
      })[]
    >(
      `SELECT id, username, full_name, email, status, unit_code
       FROM users WHERE role_id = ?
       ORDER BY full_name ASC`,
      [roleId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      username: String(r.username),
      fullName: String(r.full_name),
      email: r.email ? String(r.email) : null,
      status: String(r.status),
      unitCode: r.unit_code ? String(r.unit_code) : null,
    }));
  } catch (e) {
    console.error("findRoleMembers:", e);
    return null;
  }
}
