/**
 * Cập nhật DOB hồ sơ Cần Thơ để demo cảnh báo tuổi + chờ duyệt lưu trữ.
 * Usage: npx tsx scripts/demo-cantho-ages.ts
 */
import mysql from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

const YEAR = new Date().getFullYear();

type Bucket = "age25" | "age26" | "age27" | "expired28" | "expired29" | "expired30";

const TARGETS: { bucket: Bucket; birthYear: number; count: number }[] = [
  { bucket: "age25", birthYear: YEAR - 25, count: 8 },
  { bucket: "age26", birthYear: YEAR - 26, count: 6 },
  { bucket: "age27", birthYear: YEAR - 27, count: 6 },
  { bucket: "expired28", birthYear: YEAR - 28, count: 5 },
  { bucket: "expired29", birthYear: YEAR - 29, count: 4 },
  { bucket: "expired30", birthYear: YEAR - 30, count: 3 },
];

function dobFor(birthYear: number, index: number): string {
  const month = String(((index * 3) % 12) + 1).padStart(2, "0");
  const day = String(((index * 5) % 27) + 1).padStart(2, "0");
  return `${birthYear}-${month}-${day}`;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: parseInt(process.env.DB_PORT || "3306", 10),
  });

  // Đảm bảo cột archived_at
  const [cols] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'citizens'
       AND COLUMN_NAME = 'archived_at'
     LIMIT 1`,
  );
  if (!cols.length) {
    await conn.query(
      `ALTER TABLE citizens
       ADD COLUMN archived_at DATETIME NULL DEFAULT NULL
       COMMENT 'Thời điểm duyệt chuyển hồ sơ lưu trữ'`,
    );
    console.log("Added column citizens.archived_at");
  }

  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, full_name, date_of_birth, unit_code, archived_at
     FROM citizens
     WHERE unit_code = '92' OR unit_code LIKE '92-%'
     ORDER BY id ASC`,
  );

  if (!rows.length) {
    console.error("Không tìm thấy hồ sơ Cần Thơ (unit_code 92 / 92-*).");
    await conn.end();
    process.exit(1);
  }

  console.log(`Tìm thấy ${rows.length} hồ sơ Cần Thơ. Năm hiện tại: ${YEAR}`);

  // Reset archived_at để demo chờ duyệt
  await conn.query(
    `UPDATE citizens
     SET archived_at = NULL
     WHERE unit_code = '92' OR unit_code LIKE '92-%'`,
  );

  let cursor = 0;
  const summary: Record<string, number> = {};

  for (const t of TARGETS) {
    let updated = 0;
    for (let i = 0; i < t.count && cursor < rows.length; i++, cursor++) {
      const row = rows[cursor];
      const dob = dobFor(t.birthYear, i);
      await conn.query(
        `UPDATE citizens
         SET date_of_birth = ?, archived_at = NULL, updated_at = NOW()
         WHERE id = ?`,
        [dob, row.id],
      );
      updated++;
    }
    summary[t.bucket] = updated;
  }

  // Phần còn lại: để tuổi 20–24 (nằm trong NVQS, nền bình thường)
  let rest = 0;
  while (cursor < rows.length) {
    const row = rows[cursor];
    const age = 20 + (rest % 5); // 20..24
    const dob = dobFor(YEAR - age, rest);
    await conn.query(
      `UPDATE citizens
       SET date_of_birth = ?, archived_at = NULL, updated_at = NOW()
       WHERE id = ?`,
      [dob, row.id],
    );
    rest++;
    cursor++;
  }
  summary.age20to24 = rest;

  const [check] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT
       SUM(CASE WHEN (YEAR(CURDATE()) - YEAR(date_of_birth)) = 26 AND archived_at IS NULL THEN 1 ELSE 0 END) AS a26,
       SUM(CASE WHEN (YEAR(CURDATE()) - YEAR(date_of_birth)) = 27 AND archived_at IS NULL THEN 1 ELSE 0 END) AS a27,
       SUM(CASE WHEN (YEAR(CURDATE()) - YEAR(date_of_birth)) > 27 AND archived_at IS NULL THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived,
       COUNT(*) AS total
     FROM citizens
     WHERE unit_code = '92' OR unit_code LIKE '92-%'`,
  );

  console.log("Đã cập nhật theo nhóm:", summary);
  console.log("Kiểm tra Cần Thơ:", check[0]);
  console.log(
    "Gợi ý UI: Hồ sơ công dân → dòng vàng (26) / đỏ (27); Hồ sơ lưu trữ → notification đỏ chờ duyệt.",
  );

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
