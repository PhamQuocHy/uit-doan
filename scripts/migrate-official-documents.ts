/**
 * Migration 014: official_documents + attachments
 * Usage: npx tsx scripts/migrate-official-documents.ts
 */
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

async function main() {
  const sqlPath = path.join(
    process.cwd(),
    "dacta",
    "migrations",
    "014_official_documents.sql",
  );
  const raw = fs.readFileSync(sqlPath, "utf8");
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
    console.log("OK: official_documents + attachments sẵn sàng.");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("Migration thất bại:", e);
  process.exit(1);
});
