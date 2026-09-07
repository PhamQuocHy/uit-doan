import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import { hashPassword, isHashed, verifyPassword } from "@/lib/password";
import type { HierarchyLevel } from "@/lib/data";
import type { FunctionalRole } from "@/lib/functional-roles";

export type AuthUser = {
  id: string;
  username: string;
  password: string;
  name: string;
  role: "admin" | "user";
  hierarchyLevel: HierarchyLevel;
  unitCode: string;
  functionalRole: FunctionalRole;
  status: "active" | "inactive" | "locked";
};

type DbUserRow = RowDataPacket & {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  status: "active" | "inactive" | "locked";
  unit_code: string | null;
  unit_level: HierarchyLevel | null;
  role_name: string | null;
  functional_role: FunctionalRole | null;
};

function mapRole(roleName: string | null): "admin" | "user" {
  if (!roleName) return "user";
  const n = roleName.toLowerCase();
  if (n.includes("admin") || n.includes("quản trị") || n.includes("quan tri")) {
    return "admin";
  }
  return "user";
}

function mapFunctionalRole(
  functionalRole: FunctionalRole | null,
  roleName: string | null,
): FunctionalRole {
  const n = String(roleName || "").toLowerCase();
  if (
    n.includes("medical") ||
    n.includes("y_te") ||
    n.includes("y te") ||
    n.includes("y tế") ||
    n.includes("yte")
  ) {
    return "y_te";
  }
  if (n.includes("receiving") || n.includes("nhận quân") || n.includes("nhan quan")) {
    return "nhan_quan";
  }
  return (functionalRole || "tuyen_quan") as FunctionalRole;
}

function rowToAuthUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    password: row.password_hash,
    name: row.full_name,
    role: mapRole(row.role_name),
    hierarchyLevel: (row.unit_level || "xa") as HierarchyLevel,
    unitCode: row.unit_code || "bo",
    functionalRole: mapFunctionalRole(row.functional_role, row.role_name),
    status: row.status === "locked" ? "locked" : row.status,
  };
}

/** Tìm user theo username từ MySQL. Trả null nếu không có DB / không tìm thấy. */
export async function findUserByUsernameFromDb(
  username: string,
): Promise<AuthUser | null> {
  const ok = await pingDb();
  if (!ok) return null;

  const rows = await queryRows<DbUserRow[]>(
    `SELECT
       u.id,
       u.username,
       u.password_hash,
       u.full_name,
       u.status,
       u.unit_code,
       u.functional_role,
       hu.level AS unit_level,
       r.role_name
     FROM users u
     LEFT JOIN hierarchy_units hu ON hu.code = u.unit_code
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.username = ?
     LIMIT 1`,
    [username],
  );

  if (!rows.length) return null;
  return rowToAuthUser(rows[0]);
}

export { isHashed, verifyPassword };

/** Nâng cấp bản ghi legacy (plaintext) lên scrypt hash sau khi đăng nhập khớp. */
export async function upgradePasswordHash(userId: string, plain: string): Promise<void> {
  try {
    await queryExecute("UPDATE users SET password_hash = ? WHERE id = ?", [
      hashPassword(plain),
      userId,
    ]);
  } catch {
    // không chặn đăng nhập nếu upgrade fail
  }
}

/**
 * Cập nhật hồ sơ / mật khẩu trên MySQL.
 * Tra cứu theo id hoặc username (id memory seed có thể khác id trong DB).
 */
export async function updateUserInDb(
  lookup: { id?: string; username?: string },
  data: {
    passwordHash?: string;
    name?: string;
    email?: string;
    phone?: string;
    status?: "active" | "inactive" | "locked";
    unitCode?: string | null;
    roleId?: number | null;
    functionalRole?: FunctionalRole;
  },
): Promise<boolean> {
  const ok = await pingDb();
  if (!ok) return false;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.passwordHash !== undefined) {
    sets.push("password_hash = ?");
    params.push(data.passwordHash);
  }
  if (data.name !== undefined) {
    sets.push("full_name = ?");
    params.push(data.name);
  }
  if (data.email !== undefined) {
    sets.push("email = ?");
    params.push(data.email);
  }
  if (data.phone !== undefined) {
    sets.push("phone = ?");
    params.push(data.phone);
  }
  if (data.status !== undefined) {
    sets.push("status = ?");
    params.push(data.status);
  }
  if (data.unitCode !== undefined) {
    sets.push("unit_code = ?");
    params.push(data.unitCode);
  }
  if (data.roleId !== undefined) {
    sets.push("role_id = ?");
    params.push(data.roleId);
  }
  if (data.functionalRole !== undefined) {
    sets.push("functional_role = ?");
    params.push(data.functionalRole);
  }

  if (sets.length === 0) return false;

  const where: string[] = [];
  if (lookup.id) {
    where.push("id = ?");
    params.push(lookup.id);
  }
  if (lookup.username) {
    where.push("username = ?");
    params.push(lookup.username);
  }
  if (where.length === 0) return false;

  try {
    const result = await queryExecute(
      `UPDATE users SET ${sets.join(", ")} WHERE ${where.join(" OR ")}`,
      params,
    );
    return result.affectedRows > 0;
  } catch (e) {
    console.error("updateUserInDb:", e);
    return false;
  }
}

export type AdminUserListItem = {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "user";
  roleId: number | null;
  roleName: string;
  roleCode: string;
  department: string;
  hierarchyLevel: HierarchyLevel;
  unitCode: string;
  unitName: string;
  parentUnitCode: string | null;
  parentUnitName: string | null;
  functionalRole: FunctionalRole;
  status: "active" | "inactive" | "locked";
  createdAt: string;
};

function placeholders(n: number) {
  return Array.from({ length: n }, () => "?").join(",");
}

export async function findUsersFromDb(query?: {
  search?: string;
  role?: string;
  status?: string;
  unitCodes?: string[];
  /** Lọc theo cấp đơn vị: tinh | xa | bo | donvi */
  levelFilter?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} | null> {
  if (!(await pingDb())) return null;
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  const offset = (page - 1) * limit;

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (query?.search?.trim()) {
    const s = `%${query.search.trim()}%`;
    where.push(
      "(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR hu.name LIKE ?)",
    );
    params.push(s, s, s, s, s);
  }
  if (query?.status) {
    where.push("u.status = ?");
    params.push(query.status);
  }
  if (query?.levelFilter) {
    where.push("hu.level = ?");
    params.push(query.levelFilter);
  }
  if (query?.role === "admin") {
    where.push(
      "(r.role_name LIKE '%ADMIN%' OR r.role_name LIKE '%admin%' OR r.display_name LIKE '%Quản trị%')",
    );
  } else if (query?.role === "user") {
    where.push(
      "(r.role_name IS NULL OR (r.role_name NOT LIKE '%ADMIN%' AND r.role_name NOT LIKE '%admin%' AND IFNULL(r.display_name,'') NOT LIKE '%Quản trị%'))",
    );
  } else if (query?.role === "y_te") {
    where.push(
      "(u.functional_role = 'y_te' OR r.role_name = 'MEDICAL_OFFICER' OR IFNULL(r.display_name,'') LIKE '%y tế%')",
    );
  } else if (query?.role === "nhan_quan") {
    where.push(
      "(u.functional_role = 'nhan_quan' OR r.role_name LIKE '%RECEIVING%' OR IFNULL(r.display_name,'') LIKE '%nhận quân%')",
    );
  }

  if (query?.unitCodes && query.unitCodes.length > 0) {
    if (query.unitCodes.length <= 500) {
      where.push(`u.unit_code IN (${placeholders(query.unitCodes.length)})`);
      params.push(...query.unitCodes);
    } else {
      const root = query.unitCodes[0]?.split("-")[0] || query.unitCodes[0];
      where.push("(u.unit_code = ? OR u.unit_code LIKE CONCAT(?, '-%'))");
      params.push(root, root);
    }
  }

  const whereSql = where.join(" AND ");

  try {
    const [countRow] = await queryRows<(RowDataPacket & { cnt: number })[]>(
      `SELECT COUNT(*) AS cnt
       FROM users u
       LEFT JOIN hierarchy_units hu ON hu.code = u.unit_code
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRow?.cnt || 0);

    const rows = await queryRows<
      (RowDataPacket & {
        id: string;
        username: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        status: "active" | "inactive" | "locked";
        unit_code: string | null;
        unit_name: string | null;
        unit_level: HierarchyLevel | null;
        parent_code: string | null;
        parent_name: string | null;
        role_id: number | null;
        role_name: string | null;
        display_name: string | null;
        functional_role: FunctionalRole | null;
        created_at: string | Date | null;
      })[]
    >(
      `SELECT
         u.id, u.username, u.full_name, u.email, u.phone, u.status,
         u.unit_code, u.functional_role, u.role_id, u.created_at,
         hu.name AS unit_name, hu.level AS unit_level, hu.parent_code,
         parent.name AS parent_name,
         r.role_name, r.display_name
       FROM users u
       LEFT JOIN hierarchy_units hu ON hu.code = u.unit_code
       LEFT JOIN hierarchy_units parent ON parent.code = hu.parent_code
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${whereSql}
       ORDER BY
         CASE hu.level
           WHEN 'bo' THEN 0
           WHEN 'tinh' THEN 1
           WHEN 'xa' THEN 2
           WHEN 'donvi' THEN 3
           ELSE 4
         END,
         COALESCE(parent.name, hu.name, u.unit_code),
         hu.name,
         u.full_name
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const data: AdminUserListItem[] = rows.map((r) => {
      const roleCode = r.role_name ? String(r.role_name) : "";
      const roleName =
        (r.display_name && String(r.display_name).trim()) ||
        roleCode ||
        "Người dùng";
      const unitCode = r.unit_code || "bo";
      const unitName = r.unit_name ? String(r.unit_name) : unitCode;
      return {
        id: String(r.id),
        username: String(r.username),
        name: String(r.full_name),
        email: r.email ? String(r.email) : "",
        phone: r.phone ? String(r.phone) : "",
        role: mapRole(r.role_name),
        roleId: r.role_id != null ? Number(r.role_id) : null,
        roleName,
        roleCode,
        department: unitName,
        hierarchyLevel: (r.unit_level || "xa") as HierarchyLevel,
        unitCode,
        unitName,
        parentUnitCode: r.parent_code ? String(r.parent_code) : null,
        parentUnitName: r.parent_name ? String(r.parent_name) : null,
        functionalRole: mapFunctionalRole(r.functional_role, r.role_name),
        status: r.status === "locked" ? "locked" : r.status,
        createdAt: r.created_at
          ? new Date(r.created_at).toISOString()
          : new Date().toISOString(),
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  } catch (e) {
    console.error("findUsersFromDb:", e);
    return null;
  }
}

export async function createUserInDb(data: {
  id?: string;
  username: string;
  passwordHash: string;
  name: string;
  email?: string;
  phone?: string;
  roleId: number;
  unitCode: string;
  functionalRole: FunctionalRole;
  status?: "active" | "inactive" | "locked";
}): Promise<AdminUserListItem | { error: string; code: "DUPLICATE" | "DB_ERROR" } | null> {
  if (!(await pingDb())) return null;
  const id = data.id || `u-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await queryExecute(
      `INSERT INTO users
        (id, username, password_hash, full_name, email, phone, role_id, unit_code, functional_role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.username.trim(),
        data.passwordHash,
        data.name.trim(),
        data.email?.trim() || null,
        data.phone?.trim() || null,
        data.roleId,
        data.unitCode,
        data.functionalRole,
        data.status || "active",
      ],
    );
    const listed = await findUsersFromDb({ search: data.username, limit: 20 });
    const created = listed?.data.find((u) => u.username === data.username.trim());
    if (created) return created;
    return {
      id,
      username: data.username.trim(),
      name: data.name.trim(),
      email: data.email?.trim() || "",
      phone: data.phone?.trim() || "",
      role: "user",
      roleId: data.roleId,
      roleName: "",
      roleCode: "",
      department: data.unitCode,
      hierarchyLevel: "xa",
      unitCode: data.unitCode,
      unitName: data.unitCode,
      parentUnitCode: null,
      parentUnitName: null,
      functionalRole: data.functionalRole,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("createUserInDb:", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/Duplicate entry|ER_DUP_ENTRY/i.test(msg)) {
      return { error: "Tên đăng nhập đã tồn tại", code: "DUPLICATE" };
    }
    return { error: "Không tạo được tài khoản trên cơ sở dữ liệu", code: "DB_ERROR" };
  }
}

export function inferFunctionalRoleFromRoleCode(
  roleCode: string,
  roleName?: string,
): FunctionalRole {
  return mapFunctionalRole(null, `${roleCode} ${roleName || ""}`);
}

export async function touchLastLogin(userId: string): Promise<void> {
  try {
    await queryExecute(
      "UPDATE users SET last_login = NOW(), failed_attempts = 0 WHERE id = ?",
      [userId],
    );
  } catch {
    // ignore — không chặn đăng nhập nếu update fail
  }
}
