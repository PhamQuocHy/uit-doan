/**
 * Đặt lại mật khẩu TOÀN BỘ tài khoản: sinh mật khẩu ngẫu nhiên mạnh cho mỗi
 * user, lưu scrypt hash vào users.password_hash, in mật khẩu mới MỘT LẦN duy nhất.
 * Usage: npm run db:reset-passwords
 */
import mysql, { RowDataPacket } from "mysql2/promise";
import { randomInt } from "crypto";
import { hashPassword } from "../src/lib/password";
import { loadEnv } from "./load-env";

loadEnv();

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGIT = "23456789";
const SYMBOL = "!@#$%*+-=?";
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

/** 14 ký tự, chắc chắn có chữ hoa / thường / số / ký tự đặc biệt. */
function generatePassword(): string {
  const chars = [UPPER, LOWER, DIGIT, SYMBOL].map((pool) => pool[randomInt(pool.length)]);
  while (chars.length < 14) chars.push(ALL[randomInt(ALL.length)]);
  // xáo trộn để 4 ký tự bắt buộc không nằm ở đầu
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: parseInt(process.env.DB_PORT || "3306", 10),
  });

  const [users] = await conn.query<RowDataPacket[]>(
    "SELECT id, username, full_name FROM users ORDER BY username",
  );
  if (!users.length) {
    console.log("Bảng users trống — không có gì để đặt lại.");
    await conn.end();
    return;
  }

  const fresh: Array<{ username: string; fullName: string; password: string }> = [];
  for (const u of users) {
    const password = generatePassword();
    await conn.execute("UPDATE users SET password_hash = ?, failed_attempts = 0 WHERE id = ?", [
      hashPassword(password),
      u.id,
    ]);
    fresh.push({ username: u.username, fullName: String(u.full_name ?? ""), password });
  }

  const [check] = await conn.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total, SUM(password_hash LIKE 'scrypt$%') AS hashed FROM users",
  );
  await conn.end();

  const width = Math.max(...fresh.map((f) => f.username.length));
  console.log(`\nĐã đặt lại mật khẩu cho ${fresh.length} tài khoản:\n`);
  for (const f of fresh) {
    console.log(`  ${f.username.padEnd(width)}  ${f.password}   ${f.fullName}`);
  }
  console.log(
    `\nKiểm tra: ${(check[0]?.hashed ?? 0)}/${check[0]?.total ?? 0} bản ghi mang scrypt hash.`,
  );
  console.log("Lưu các mật khẩu trên lại NGAY — chúng không hiển thị lại lần nữa.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
