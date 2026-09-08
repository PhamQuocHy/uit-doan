/**
 * Backfill health_exams + citizen_residence cho toàn bộ citizens.
 * Usage: npx tsx scripts/backfill-citizen-exams-residence.ts
 */
import mysql from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

async function main() {
  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "quan_ly_nvqs";
  const port = parseInt(process.env.DB_PORT || "3306", 10);

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    multipleStatements: true,
  });

  console.log(`Connected ${database}@${host}:${port}`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS citizen_residence (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(50) NOT NULL,
      residence_type ENUM('Que quan', 'Thuong tru', 'Tam tru', 'Chuyen di') NOT NULL,
      address VARCHAR(500) NOT NULL,
      start_year INT DEFAULT NULL,
      end_year INT DEFAULT NULL,
      status ENUM('current', 'past', 'pending') NOT NULL DEFAULT 'past',
      decision_no VARCHAR(100) DEFAULT NULL,
      note TEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_residence_citizen (citizen_id),
      CONSTRAINT fk_citizen_residence_citizen
        FOREIGN KEY (citizen_id) REFERENCES citizens (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [needHealth] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT c.id, c.date_of_birth, c.health_grade
     FROM citizens c
     LEFT JOIN health_exams h ON h.citizen_id = c.id
     WHERE h.id IS NULL`,
  );
  console.log(`Citizens thiếu health_exams: ${needHealth.length}`);

  const healthBatch: unknown[][] = [];
  for (const row of needHealth) {
    const seed = hash(String(row.id));
    const gradeNum = row.health_grade != null ? Number(row.health_grade) : (seed % 5) + 1;
    const grade = `Loại ${Math.min(6, Math.max(1, gradeNum))}`;
    const examYear = 2024;
    const height = 160 + (seed % 26);
    const weight = 50 + (seed % 30);
    const sys = 100 + (seed % 30);
    const dia = 60 + (seed % 20);
    const vision = ((seed % 20) / 10 + 8).toFixed(1);
    const qualified = gradeNum <= 3 ? 1 : 0;

    healthBatch.push([
      `HE-${row.id}-S1`,
      row.id,
      examYear,
      "Sơ tuyển cấp xã",
      height,
      weight,
      `${sys}/${dia}`,
      vision,
      vision,
      "Bình thường",
      60 + (seed % 30),
      null,
      grade,
      "BS. Tuyển quân",
      qualified,
    ]);
    if (qualified) {
      healthBatch.push([
        `HE-${row.id}-D1`,
        row.id,
        examYear,
        "Khám tuyển cấp huyện",
        height,
        weight + 1,
        `${sys}/${dia}`,
        vision,
        vision,
        "Bình thường",
        62 + (seed % 28),
        null,
        grade,
        "BS. TTYT huyện",
        qualified,
      ]);
    }
  }

  for (let i = 0; i < healthBatch.length; i += 300) {
    const slice = healthBatch.slice(i, i + 300);
    await conn.query(
      `INSERT IGNORE INTO health_exams (
        id, citizen_id, exam_year, exam_phase, height, weight, blood_pressure,
        vision_left, vision_right, hearing, heart_rate, conclusions_detail,
        medical_grade, doctor_id, is_qualified
      ) VALUES ?`,
      [slice],
    );
    process.stdout.write(`\r  health ${Math.min(i + 300, healthBatch.length)}/${healthBatch.length}`);
  }
  console.log("");

  const [needRes] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT c.id, c.date_of_birth, c.origin_place, c.permanent_address, c.current_address
     FROM citizens c
     LEFT JOIN citizen_residence r ON r.citizen_id = c.id
     WHERE r.id IS NULL`,
  );
  console.log(`Citizens thiếu residence: ${needRes.length}`);

  const residenceBatch: unknown[][] = [];
  for (const row of needRes) {
    const birthYear = row.date_of_birth
      ? new Date(row.date_of_birth).getFullYear()
      : 2005;
    if (row.origin_place) {
      residenceBatch.push([
        row.id,
        "Que quan",
        String(row.origin_place),
        birthYear,
        null,
        "past",
        null,
        null,
      ]);
    }
    const current = row.current_address || row.permanent_address;
    if (current) {
      residenceBatch.push([
        row.id,
        "Thuong tru",
        String(current),
        birthYear + 14,
        null,
        "current",
        null,
        null,
      ]);
    }
  }

  for (let i = 0; i < residenceBatch.length; i += 300) {
    const slice = residenceBatch.slice(i, i + 300);
    await conn.query(
      `INSERT INTO citizen_residence
        (citizen_id, residence_type, address, start_year, end_year, status, decision_no, note)
       VALUES ?`,
      [slice],
    );
    process.stdout.write(`\r  residence ${Math.min(i + 300, residenceBatch.length)}/${residenceBatch.length}`);
  }
  console.log("");

  const [[h]] = await conn.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM health_exams");
  const [[r]] = await conn.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM citizen_residence");
  await conn.end();

  console.log(`Done. health_exams=${h.cnt}, citizen_residence=${r.cnt}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
