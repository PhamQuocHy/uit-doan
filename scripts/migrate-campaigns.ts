/**
 * Chạy migration 013: tạo bảng recruitment_campaigns + seed.
 * Usage: npx tsx scripts/migrate-campaigns.ts
 */
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

async function main() {
  const sqlPath = path.join(
    process.cwd(),
    "dacta",
    "migrations",
    "013_recruitment_campaigns.sql",
  );
  const raw = fs.readFileSync(sqlPath, "utf8");
  // Bỏ comment dòng -- ... rồi tách statement
  const sql = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    const [rows] = await conn.query(
      "SELECT id, name, year, status FROM recruitment_campaigns ORDER BY year DESC",
    );
    console.log("OK: recruitment_campaigns sẵn sàng.");
    console.log(rows);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("Migration thất bại:", e);
  process.exit(1);
});
