/**
 * Nâng cấp một lần: mật khẩu plaintext còn sót trong users.password_hash
 * → scrypt hash. Chỉ chạy được khi giá trị lưu = mật khẩu gốc (plaintext).
 * Usage: npm run db:hash-passwords
 */
import mysql, { RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../src/lib/password";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: parseInt(process.env.DB_PORT || "3306", 10),
  });
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, username, password_hash FROM users WHERE password_hash IS NOT NULL AND password_hash NOT LIKE 'scrypt$%'",
  );

  if (!rows.length) {
    console.log("Không còn mật khẩu plaintext nào. Bỏ qua.");
  } else {
    for (const r of rows) {
      await conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
        hashPassword(r.password_hash),
        r.id,
      ]);
      console.log(`  Đã hash: ${r.username}`);
    }
  }

  const [check] = await conn.query<Array<RowDataPacket & { remaining: number }>>(
    "SELECT COUNT(*) AS remaining FROM users WHERE password_hash NOT LIKE 'scrypt$%'",
  );
  console.log(`\nCòn plaintext: ${check[0]?.remaining ?? 0}`);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
