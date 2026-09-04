/**
 * Seed roles, hierarchy units, demo users (4 cấp: Bộ / Tỉnh / Xã / ĐV nhận quân).
 * Usage: npm run db:seed-users
 */
import fs from "fs";
import path from "path";
import mysql, { RowDataPacket } from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "quan_ly_nvqs";
  const port = parseInt(process.env.DB_PORT || "3306", 10);

  const sqlPath = path.join(
    process.cwd(),
    "dacta",
    "migrations",
    "004_seed_users_hierarchy.sql",
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    multipleStatements: true,
  });

  console.log(`Seeding users into ${database}...`);
  await conn.query(sql);

  const [rows] = await conn.query<
    RowDataPacket[] &
      Array<{ username: string; full_name: string; unit_code: string; level: string }>
  >(
    `SELECT u.username, u.full_name, u.unit_code, hu.level, hu.name AS unit_name
     FROM users u
     LEFT JOIN hierarchy_units hu ON hu.code = u.unit_code
     WHERE u.username IN ('admin_bo','admin_cantho','admin_phuloc','admin_qk9','admin_yte')
     ORDER BY FIELD(hu.level,'bo','tinh','xa','donvi')`,
  );

  console.log("\nTài khoản demo (mật khẩu: 123):\n");
  for (const r of rows as Array<{
    username: string;
    full_name: string;
    unit_code: string;
    level: string;
    unit_name: string;
  }>) {
    console.log(
      `  ${r.username.padEnd(14)} | ${(r.level || "?").padEnd(6)} | ${r.unit_name || r.unit_code}`,
    );
  }

  await conn.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
