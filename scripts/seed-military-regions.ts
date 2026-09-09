/**
 * Đồng bộ quân khu / quân đoàn / sư đoàn / trung đoàn + TK demo vào MySQL.
 * Đặt mật khẩu toàn hệ thống = admin123 và ghi file tài khoản.
 *
 * Chạy: npx tsx scripts/seed-military-regions.ts
 */
import fs from "fs";
import path from "path";
import mysql, { RowDataPacket } from "mysql2/promise";
import { loadEnv } from "./load-env";
import { hashPassword } from "../src/lib/password";
import {
  ALL_MILITARY_UNITS,
  MILITARY_REGIONS,
  MILITARY_SUB_UNITS,
  isQuanKhuOrBtl,
  type MilitaryUnitDef,
} from "../src/lib/military-regions";

loadEnv();

const DEMO_PASSWORD = "admin123";

function usernameForUnit(u: MilitaryUnitDef): string {
  if (isQuanKhuOrBtl(u.code)) {
    const suffix = u.code.replace("dv-", "").replace(/-/g, "");
    return `admin_${suffix}`;
  }
  // dv-qk9-sd330-td1 → admin_qk9_sd330_td1
  return `admin_${u.code.replace(/^dv-/, "").replace(/-/g, "_")}`;
}

function displayRole(u: MilitaryUnitDef): string {
  if (u.kind === "quankhu" || u.kind === "btl") return "Quân khu / BTL";
  if (u.kind === "quandoan") return "Quân đoàn (nhận quân)";
  if (u.kind === "sudoan") return "Sư đoàn (nhận quân)";
  if (u.kind === "trungdoan") return "Trung đoàn (nhận quân)";
  return "Đơn vị nhận quân";
}

async function main() {
  const passHash = hashPassword(DEMO_PASSWORD);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    multipleStatements: true,
  });

  try {
    await conn.query(
      `ALTER TABLE hierarchy_units ADD COLUMN unit_kind VARCHAR(32) NULL DEFAULT NULL AFTER level`,
    );
  } catch {
    /* exists */
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS military_region_provinces (
      region_code VARCHAR(64) NOT NULL,
      province_code VARCHAR(64) NOT NULL,
      PRIMARY KEY (region_code, province_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS receiving_sub_quotas (
      id VARCHAR(64) NOT NULL,
      campaign_id VARCHAR(64) NOT NULL,
      from_unit VARCHAR(64) NOT NULL,
      to_unit VARCHAR(64) NOT NULL,
      amount INT NOT NULL DEFAULT 0,
      note VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_rsq (campaign_id, from_unit, to_unit)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const u of ALL_MILITARY_UNITS) {
    await conn.query(
      `INSERT INTO hierarchy_units (code, name, level, parent_code, is_active, unit_kind)
       VALUES (?, ?, 'donvi', ?, 1, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         parent_code = VALUES(parent_code),
         unit_kind = VALUES(unit_kind),
         is_active = 1`,
      [u.code, u.name, u.parentCode, u.kind],
    );
  }

  await conn.query(
    `UPDATE hierarchy_units SET parent_code = 'dv-qk9', unit_kind = 'sudoan',
       name = 'Sư đoàn Bộ binh 330 (demo cũ)'
     WHERE code = 'donvi-f330'`,
  );

  await conn.query(`DELETE FROM military_region_provinces`);
  for (const r of MILITARY_REGIONS) {
    for (const p of r.provinceCodes || []) {
      await conn.query(
        `INSERT IGNORE INTO military_region_provinces (region_code, province_code) VALUES (?, ?)`,
        [r.code, p],
      );
    }
  }

  const [roles] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM roles WHERE role_name = 'RECEIVING_UNIT' LIMIT 1`,
  );
  let roleId = Number(roles[0]?.id || 0);
  if (!roleId) {
    const [any] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM roles ORDER BY id LIMIT 1`,
    );
    roleId = Number(any[0]?.id || 2);
  }

  const accountRows: Array<{
    username: string;
    name: string;
    unit: string;
    role: string;
    kind: string;
  }> = [];

  for (const u of ALL_MILITARY_UNITS) {
    const username = usernameForUnit(u);
    const id = `u-${u.code}`;
    const name =
      u.kind === "quankhu" || u.kind === "btl"
        ? `Ban chỉ huy — ${u.name}`
        : `Chỉ huy — ${u.name}`;
    const email = `${username}@ymsa.vn`;

    await conn.query(
      `INSERT INTO users (id, username, password_hash, full_name, email, phone, role_id, unit_code, status, functional_role)
       VALUES (?, ?, ?, ?, ?, '0900000000', ?, ?, 'active', 'nhan_quan')
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         unit_code = VALUES(unit_code),
         functional_role = 'nhan_quan',
         role_id = VALUES(role_id),
         password_hash = VALUES(password_hash),
         status = 'active'`,
      [id, username, passHash, name, email, roleId, u.code],
    );

    accountRows.push({
      username,
      name,
      unit: u.code,
      role: displayRole(u),
      kind: u.kind,
    });
  }

  // Đồng bộ legacy username
  await conn.query(
    `UPDATE users SET functional_role = 'nhan_quan', unit_code = 'dv-qk9', password_hash = ?
     WHERE username = 'admin_qk9'`,
    [passHash],
  );
  await conn.query(
    `UPDATE users SET functional_role = 'nhan_quan', unit_code = 'dv-qk9-sd330', password_hash = ?
     WHERE username IN ('admin_f330', 'admin_sd330')`,
    [passHash],
  );

  // Đặt MK admin123 cho TOÀN BỘ users
  await conn.query(`UPDATE users SET password_hash = ?, failed_attempts = 0`, [
    passHash,
  ]);

  const [allUsers] = await conn.query<RowDataPacket[]>(
    `SELECT u.username, u.full_name, u.unit_code, u.functional_role, hu.name AS unit_name, hu.level AS unit_level
     FROM users u
     LEFT JOIN hierarchy_units hu ON hu.code = u.unit_code
     WHERE u.status = 'active'
     ORDER BY
       FIELD(IFNULL(hu.level,'z'), 'bo','donvi','tinh','xa'),
       u.username`,
  );

  const outPath = path.join(process.cwd(), "docs", "TAI-KHOAN-DEMO.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const lines: string[] = [
    "# Tài khoản demo hệ thống NVQS",
    "",
    `Cập nhật: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `**Mật khẩu thống nhất tạm thời:** \`${DEMO_PASSWORD}\` (đổi sau khi bàn giao).`,
    "",
    "## Cách đăng nhập",
    "",
    "| Portal | Ghi chú |",
    "|---|---|",
    "| Cấp bộ | Không chọn đơn vị |",
    "| Quân khu | Chọn Quân khu / BTL |",
    "| Địa phương | Chọn tỉnh / xã |",
    "| Đơn vị nhận quân | Chọn sư đoàn / quân đoàn / trung đoàn |",
    "| Cán bộ y tế | Chọn tỉnh / xã |",
    "",
    "## Toàn bộ tài khoản active",
    "",
    "| Username | Mật khẩu | Họ tên | Đơn vị | Cấp | Vai trò chức năng |",
    "|---|---|---|---|---|---|",
  ];

  for (const u of allUsers) {
    lines.push(
      `| \`${u.username}\` | \`${DEMO_PASSWORD}\` | ${u.full_name || ""} | ${u.unit_name || u.unit_code || ""} (\`${u.unit_code || ""}\`) | ${u.unit_level || ""} | ${u.functional_role || ""} |`,
    );
  }

  lines.push(
    "",
    "## Đơn vị quân sự đã seed (nhận quân)",
    "",
    `Tổng: **${ALL_MILITARY_UNITS.length}** đơn vị (${MILITARY_REGIONS.length} quân khu/BTL + ${MILITARY_SUB_UNITS.length} quân đoàn/sư đoàn/trung đoàn).`,
    "",
    "### Quân khu / BTL",
    "",
  );
  for (const r of MILITARY_REGIONS) {
    lines.push(
      `- \`${usernameForUnit(r)}\` — ${r.name} (\`${r.code}\`) · tỉnh: ${(r.provinceCodes || []).join(", ")}`,
    );
  }
  lines.push("", "### Quân đoàn / Sư đoàn / Trung đoàn", "");
  for (const u of MILITARY_SUB_UNITS) {
    lines.push(
      `- \`${usernameForUnit(u)}\` — ${u.name} (\`${u.code}\`) · parent \`${u.parentCode}\` · ${u.kind}`,
    );
  }
  lines.push(
    "",
    "## Ghi chú nguồn dữ liệu",
    "",
    "- Sư đoàn bộ binh theo danh sách công khai Wikipedia (QĐND VN), gồm QK1–5,7,9, BTL Thủ đô (SD 301), Quân đoàn 12 & 34.",
    "- Mỗi sư đoàn gắn 03 trung đoàn bộ binh theo biên chế chuẩn (TD 1/2/3) vì số hiệu trung đoàn nội bộ không công bố đầy đủ.",
    "- Thêm Trung đoàn 152 độc lập (Quân khu 9) theo nguồn công khai.",
    "",
  );

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log(`Seeded ${ALL_MILITARY_UNITS.length} military units.`);
  console.log(`Military accounts: ${accountRows.length}`);
  console.log(`All active users password → ${DEMO_PASSWORD}`);
  console.log(`Accounts file: ${outPath}`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
