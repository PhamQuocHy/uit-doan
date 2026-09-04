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

function rowToAuthUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    password: row.password_hash,
    name: row.full_name,
    role: mapRole(row.role_name),
    hierarchyLevel: (row.unit_level || "xa") as HierarchyLevel,
    unitCode: row.unit_code || "bo",
    functionalRole: (row.functional_role || "tuyen_quan") as FunctionalRole,
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
