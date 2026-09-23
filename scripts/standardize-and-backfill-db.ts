/**
 * Script chuẩn hóa dữ liệu NVQS và bổ sung dữ liệu còn thiếu trong DB:
 * 1. Chuẩn hóa military_status từ 'trungtuyen' -> 'truottuyen' cho toàn bộ hồ sơ 'de_xuat_khong_goi' (sức khỏe Loại 4, 5).
 * 2. Backfill health_exams năm 2026 đồng bộ theo health_grade của công dân.
 * 3. Backfill citizen_residence (Quê quán, Thường trú).
 * 4. Backfill citizen_family (birth_year, occupation, address cho Cha và Mẹ).
 * 5. Bổ sung graduation_year còn thiếu trong citizen_education.
 *
 * Usage: npx tsx scripts/standardize-and-backfill-db.ts
 */

import mysql from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const FATHER_OCCUPATIONS = [
  "Nông dân",
  "Công nhân",
  "Kinh doanh tự do",
  "Thợ cơ khí",
  "Lao động tự do",
  "Cán bộ hưu trí",
  "Tài xế",
  "Thợ xây dựng",
];

const MOTHER_OCCUPATIONS = [
  "Nội trợ",
  "Buôn bán nhỏ",
  "Công nhân",
  "Nông dân",
  "Giáo viên",
  "Lao động tự do",
  "Nhân viên văn phòng",
  "May mặc",
];

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

  console.log(`Connected to MySQL: ${database}@${host}:${port}`);

  // =========================================================================
  // 1. CHUẨN HÓA TRẠNG THÁI CITIZENS
  // =========================================================================
  console.log("\n--- BƯỚC 1: Chuẩn hóa trạng thái NVQS trong bảng citizens ---");
  const [fixStatusResult] = await conn.query<mysql.ResultSetHeader>(`
    UPDATE citizens 
    SET military_status = 'truottuyen' 
    WHERE (call_intent = 'de_xuat_khong_goi' OR call_intent = 'khong_goi')
      AND military_status = 'trungtuyen'
  `);
  console.log(`  -> Đã cập nhật ${fixStatusResult.affectedRows} công dân đề xuất không gọi/không gọi sang 'truottuyen' (Rớt).`);

  // Xử lý bản ghi lẻ test nếu có
  const [fixEdgeResult] = await conn.query<mysql.ResultSetHeader>(`
    UPDATE citizens 
    SET military_status = 'chuakham' 
    WHERE military_status = 'trungtuyen' AND call_intent = 'unset' AND health_grade IS NULL
  `);
  if (fixEdgeResult.affectedRows > 0) {
    console.log(`  -> Đã chuẩn hóa ${fixEdgeResult.affectedRows} hồ sơ unset sang 'chuakham'.`);
  }

  // =========================================================================
  // 2. BACKFILL SỨC KHỎE (health_exams) NĂM 2026
  // =========================================================================
  console.log("\n--- BƯỚC 2: Bổ sung hồ sơ khám sức khỏe năm 2026 ---");
  const [needHealth] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT c.id, c.date_of_birth, c.health_grade
    FROM citizens c
    LEFT JOIN health_exams h ON h.citizen_id = c.id AND h.exam_year = 2026
    WHERE c.health_grade IS NOT NULL AND h.id IS NULL
  `);
  console.log(`  Số công dân có health_grade cần bổ sung phiếu khám 2026: ${needHealth.length}`);

  const EXAM_YEAR = 2026;
  const healthRows: unknown[][] = [];

  for (const row of needHealth) {
    const seed = hash(String(row.id));
    const gradeNum = Number(row.health_grade) || 1;
    const grade = `Loại ${gradeNum}`;
    const qualified = gradeNum <= 3 ? 1 : 0;

    // Chiều cao và cân nặng theo loại sức khỏe
    const height = gradeNum === 1 ? 168 + (seed % 10) : gradeNum === 2 ? 163 + (seed % 8) : gradeNum === 3 ? 160 + (seed % 6) : 154 + (seed % 5);
    const weight = gradeNum <= 2 ? 56 + (seed % 15) : gradeNum === 3 ? 50 + (seed % 8) : 44 + (seed % 5);
    const sys = gradeNum <= 3 ? 110 + (seed % 18) : 145 + (seed % 15);
    const dia = gradeNum <= 3 ? 70 + (seed % 15) : 95 + (seed % 10);
    const vision = gradeNum === 1 ? "10.0" : gradeNum === 2 ? "9.0" : gradeNum === 3 ? "8.0" : "5.0";

    const s1Note = qualified
      ? "Đủ tiêu chuẩn sơ tuyển sức khỏe NVQS"
      : `Không đủ tiêu chuẩn sức khỏe gọi nhập ngũ (Loại ${gradeNum}) — Đề xuất không gọi`;

    // Vòng 1: Sơ tuyển cấp xã
    healthRows.push([
      `HE-${row.id}-2026-S1`,
      row.id,
      EXAM_YEAR,
      "Sơ tuyển cấp xã",
      height,
      weight,
      `${sys}/${dia}`,
      vision,
      vision,
      "Bình thường",
      70 + (seed % 15),
      s1Note,
      grade,
      "BS. Tuyển quân xã",
      qualified,
    ]);

    // Vòng 2: Khám tuyển cấp huyện (chỉ dành cho người đạt Vòng 1)
    if (qualified) {
      healthRows.push([
        `HE-${row.id}-2026-D1`,
        row.id,
        EXAM_YEAR,
        "Khám tuyển cấp huyện",
        height,
        weight + (seed % 2),
        `${sys}/${dia}`,
        vision,
        vision,
        "Bình thường",
        72 + (seed % 12),
        "Đủ tiêu chuẩn sức khỏe phục vụ tại ngũ",
        grade,
        "BS. TTYT huyện",
        qualified,
      ]);
    }
  }

  console.log(`  Tổng số phiếu khám cần chèn: ${healthRows.length}`);
  const HEALTH_BATCH_SIZE = 3000;
  for (let i = 0; i < healthRows.length; i += HEALTH_BATCH_SIZE) {
    const slice = healthRows.slice(i, i + HEALTH_BATCH_SIZE);
    await conn.query(
      `INSERT IGNORE INTO health_exams (
        id, citizen_id, exam_year, exam_phase, height, weight, blood_pressure,
        vision_left, vision_right, hearing, heart_rate, conclusions_detail,
        medical_grade, doctor_id, is_qualified
      ) VALUES ?`,
      [slice],
    );
    process.stdout.write(`\r  -> Đã lưu health_exams: ${Math.min(i + HEALTH_BATCH_SIZE, healthRows.length)}/${healthRows.length}`);
  }
  console.log("\n  -> Hoàn thành bổ sung health_exams.");

  // =========================================================================
  // 3. BACKFILL CƯ TRÚ (citizen_residence)
  // =========================================================================
  console.log("\n--- BƯỚC 3: Bổ sung lịch sử cư trú (citizen_residence) ---");
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

  const [needRes] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT c.id, c.date_of_birth, c.origin_place, c.permanent_address, c.current_address
    FROM citizens c
    LEFT JOIN citizen_residence r ON r.citizen_id = c.id
    WHERE r.id IS NULL
  `);
  console.log(`  Số công dân cần bổ sung cư trú: ${needRes.length}`);

  const residenceRows: unknown[][] = [];
  for (const row of needRes) {
    const birthYear = row.date_of_birth
      ? new Date(row.date_of_birth).getFullYear()
      : 2004;

    const origin = row.origin_place || row.permanent_address;
    if (origin) {
      residenceRows.push([
        row.id,
        "Que quan",
        String(origin),
        birthYear,
        null,
        "past",
        null,
        "Nguyên quán khai sinh",
      ]);
    }

    const current = row.permanent_address || row.current_address;
    if (current) {
      residenceRows.push([
        row.id,
        "Thuong tru",
        String(current),
        birthYear + 14,
        null,
        "current",
        null,
        "Nơi đăng ký hộ khẩu thường trú hiện tại",
      ]);
    }
  }

  console.log(`  Tổng số bản ghi cư trú cần chèn: ${residenceRows.length}`);
  const RES_BATCH_SIZE = 3000;
  for (let i = 0; i < residenceRows.length; i += RES_BATCH_SIZE) {
    const slice = residenceRows.slice(i, i + RES_BATCH_SIZE);
    await conn.query(
      `INSERT INTO citizen_residence
        (citizen_id, residence_type, address, start_year, end_year, status, decision_no, note)
       VALUES ?`,
      [slice],
    );
    process.stdout.write(`\r  -> Đã lưu citizen_residence: ${Math.min(i + RES_BATCH_SIZE, residenceRows.length)}/${residenceRows.length}`);
  }
  console.log("\n  -> Hoàn thành bổ sung citizen_residence.");

  // =========================================================================
  // 4. BACKFILL THÂN NHÂN (citizen_family: birth_year, occupation, address)
  // =========================================================================
  console.log("\n--- BƯỚC 4: Bổ sung thông tin thân nhân (Cha, Mẹ) ---");
  const [famEmpty] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT COUNT(*) as cnt
    FROM citizen_family
    WHERE birth_year IS NULL OR occupation IS NULL OR address IS NULL
  `);
  console.log(`  Số bản ghi thân nhân cần cập nhật thông tin: ${famEmpty[0].cnt}`);

  if (famEmpty[0].cnt > 0) {
    // Cập nhật Cha
    await conn.query(`
      UPDATE citizen_family f
      JOIN citizens c ON c.id = f.citizen_id
      SET
        f.birth_year = COALESCE(f.birth_year, YEAR(c.date_of_birth) - 28),
        f.address = COALESCE(f.address, c.permanent_address),
        f.political_status = COALESCE(f.political_status, 'Công dân tốt'),
        f.occupation = COALESCE(
          f.occupation,
          CASE MOD(CONV(SUBSTRING(MD5(CONCAT(f.id, c.id)), 1, 4), 16, 10), 8)
            WHEN 0 THEN 'Nông dân'
            WHEN 1 THEN 'Công nhân'
            WHEN 2 THEN 'Kinh doanh tự do'
            WHEN 3 THEN 'Thợ cơ khí'
            WHEN 4 THEN 'Lao động tự do'
            WHEN 5 THEN 'Cán bộ hưu trí'
            WHEN 6 THEN 'Tài xế'
            ELSE 'Thợ xây dựng'
          END
        )
      WHERE f.relationship = 'Cha' AND (f.birth_year IS NULL OR f.occupation IS NULL OR f.address IS NULL)
    `);

    // Cập nhật Mẹ
    await conn.query(`
      UPDATE citizen_family f
      JOIN citizens c ON c.id = f.citizen_id
      SET
        f.birth_year = COALESCE(f.birth_year, YEAR(c.date_of_birth) - 25),
        f.address = COALESCE(f.address, c.permanent_address),
        f.political_status = COALESCE(f.political_status, 'Công dân tốt'),
        f.occupation = COALESCE(
          f.occupation,
          CASE MOD(CONV(SUBSTRING(MD5(CONCAT(f.id, c.id)), 1, 4), 16, 10), 8)
            WHEN 0 THEN 'Nội trợ'
            WHEN 1 THEN 'Buôn bán nhỏ'
            WHEN 2 THEN 'Công nhân'
            WHEN 3 THEN 'Nông dân'
            WHEN 4 THEN 'Giáo viên'
            WHEN 5 THEN 'Lao động tự do'
            WHEN 6 THEN 'Nhân viên văn phòng'
            ELSE 'May mặc'
          END
        )
      WHERE f.relationship = 'Me' AND (f.birth_year IS NULL OR f.occupation IS NULL OR f.address IS NULL)
    `);
    console.log("  -> Hoàn thành bổ sung thông tin Cha, Mẹ.");
  }

  // =========================================================================
  // 5. BỔ SUNG GRADUATION_YEAR CÒN THIẾU TRONG citizen_education
  // =========================================================================
  console.log("\n--- BƯỚC 5: Bổ sung năm tốt nghiệp trong citizen_education ---");
  const [eduResult] = await conn.query<mysql.ResultSetHeader>(`
    UPDATE citizen_education ce
    JOIN citizens c ON c.id = ce.citizen_id
    SET ce.graduation_year = COALESCE(ce.graduation_year, YEAR(c.date_of_birth) + 18)
    WHERE ce.graduation_year IS NULL
  `);
  console.log(`  -> Đã bổ sung năm tốt nghiệp cho ${eduResult.affectedRows} bản ghi.`);

  // =========================================================================
  // KIỂM TRA LẠI KẾT QUẢ
  // =========================================================================
  console.log("\n=== KẾT QUẢ KIỂM TRA SAU CHUẨN HÓA ===");
  const [[cntInconsistent]] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT COUNT(*) as c 
    FROM citizens 
    WHERE military_status = 'trungtuyen' 
      AND (call_intent = 'de_xuat_khong_goi' OR call_intent = 'khong_goi' OR health_grade > 3)
  `);
  console.log(`  Xung đột 'trungtuyen' với đề xuất không gọi / SK > 3: ${cntInconsistent.c} (mong đợi: 0)`);

  const [[heCount]] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT COUNT(*) as c FROM health_exams WHERE exam_year = 2026
  `);
  console.log(`  Tổng số phiếu khám năm 2026 trong health_exams: ${heCount.c}`);

  const [[resCount]] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT COUNT(*) as c FROM citizen_residence
  `);
  console.log(`  Tổng số bản ghi cư trú trong citizen_residence: ${resCount.c}`);

  // Kiểm tra riêng hồ sơ Đỗ Đức Nghĩa (100000162481)
  const [targetCitizen] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT c.id, c.full_name, c.cccd, c.military_status, c.call_intent, c.health_grade, c.military_status_reason
    FROM citizens c WHERE c.cccd = '100000162481'
  `);
  console.log(`  Hồ sơ Đỗ Đức Nghĩa:`, JSON.stringify(targetCitizen[0], null, 2));

  const [targetExams] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT exam_year, exam_phase, medical_grade, is_qualified, conclusions_detail
    FROM health_exams WHERE citizen_id = ?
  `, [targetCitizen[0]?.id]);
  console.log(`  Phiếu khám của Đỗ Đức Nghĩa:`, JSON.stringify(targetExams, null, 2));

  const [targetRes] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT residence_type, address, status FROM citizen_residence WHERE citizen_id = ?
  `, [targetCitizen[0]?.id]);
  console.log(`  Cư trú của Đỗ Đức Nghĩa:`, JSON.stringify(targetRes, null, 2));

  const [targetFam] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT rel_name, relationship, birth_year, occupation, address FROM citizen_family WHERE citizen_id = ?
  `, [targetCitizen[0]?.id]);
  console.log(`  Thân nhân của Đỗ Đức Nghĩa:`, JSON.stringify(targetFam, null, 2));

  await conn.end();
  console.log("\n>>> Toàn bộ quá trình chuẩn hóa đã hoàn tất thành công! <<<");
}

main().catch((err) => {
  console.error("Lỗi thực thi:", err);
  process.exit(1);
});
