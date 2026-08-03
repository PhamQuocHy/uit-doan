/**
 * Conditional analytics seed — only inserts when citizens table is empty (or --force).
 * Usage: npx tsx scripts/seed-analytics.ts [--force]
 */
import path from "path";
import fs from "fs";
import mysql, { Connection } from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

const TARGET_CITIZENS = 1200;

const STATUSES = [
  "chuakham",
  "dangkham",
  "trungtuyen",
  "tamhoan",
  "miengoi",
  "nhapngu",
] as const;

const DEFER_REASONS = [
  "hoc_tap",
  "suc_khoe",
  "gia_dinh",
  "chua_du_tuoi",
  "khac",
] as const;

const EDU_LEVELS = ["THPT", "Trung cấp", "Cao đẳng", "Đại học", "Sau đại học"];
const MAJORS = [
  "CNTT",
  "Cơ khí",
  "Điện",
  "Kế toán",
  "Y",
  "Luật",
  "Nông nghiệp",
  "Xây dựng",
  null,
];

const FIRST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng"];
const MIDDLE = ["Văn", "Thị", "Minh", "Quốc", "Đức", "Hữu", "Công"];
const LAST = ["An", "Bình", "Cường", "Dũng", "Hùng", "Long", "Nam", "Phong", "Quang", "Tùng", "Hải", "Sơn"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cccd(i: number) {
  return String(100000000000 + i).padStart(12, "0");
}

type WardRow = { code: string; name: string; parent: string };

async function ensureHierarchy(conn: Connection): Promise<WardRow[]> {
  await conn.query(
    `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active) VALUES
      ('bo', 'Bộ Quốc phòng', 'bo', NULL, 1)`
  );

  const provincesPath = path.join(process.cwd(), "src", "data", "provinces.json");
  const provinces = JSON.parse(fs.readFileSync(provincesPath, "utf8")) as Array<{
    code: number;
    name: string;
    wards: Array<{ code: number; name: string }>;
  }>;

  // Demo: TP Cần Thơ (API v2 — 34 tỉnh/TP, không còn cấp huyện)
  const target = provinces.find((p) => p.code === 92) || provinces[0];
  const wards: WardRow[] = [];
  const pCode = String(target.code);

  await conn.query(
    `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active) VALUES (?, ?, 'tinh', 'bo', 1)`,
    [pCode, target.name]
  );

  for (const w of (target.wards || []).slice(0, 24)) {
    const wCode = `${pCode}-${w.code}`;
    await conn.query(
      `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active) VALUES (?, ?, 'xa', ?, 1)`,
      [wCode, w.name, pCode]
    );
    wards.push({ code: wCode, name: w.name, parent: pCode });
  }

  await conn.query(
    `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active) VALUES
      ('dv-lq1', 'Lữ đoàn nhận quân demo', 'donvi', 'bo', 1)`
  );

  // Nhánh demo: Cần Thơ → Phường Hưng Phú
  for (const [code, name, level, parent] of [
    ["92", "Thành phố Cần Thơ", "tinh", "bo"],
    ["92-31201", "Phường Hưng Phú", "xa", "92"],
  ] as const) {
    await conn.query(
      `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active) VALUES (?, ?, ?, ?, 1)`,
      [code, name, level, parent]
    );
    if (level === "xa" && !wards.find((w) => w.code === code)) {
      wards.push({ code, name, parent });
    }
  }

  if (wards.length === 0) throw new Error("No wards available for seeding");
  return wards;
}

async function refreshFeatures(conn: Connection) {
  await conn.query(`
INSERT INTO analytics_citizen_features (
  citizen_id, age, unit_code, unit_level, education_level, job_proxy,
  health_grade, is_qualified_last, height, weight, bmi,
  military_status, deferment_reason, exam_count, years_since_last_exam,
  is_blacklisted, refreshed_at
)
SELECT
  c.id,
  TIMESTAMPDIFF(YEAR, c.date_of_birth, CURDATE()) AS age,
  c.unit_code,
  hu.level AS unit_level,
  edu.level AS education_level,
  edu.major AS job_proxy,
  c.health_grade,
  he.is_qualified AS is_qualified_last,
  he.height,
  he.weight,
  CASE
    WHEN he.height IS NOT NULL AND he.height > 0 AND he.weight IS NOT NULL
    THEN ROUND(he.weight / POWER(he.height / 100, 2), 2)
    ELSE NULL
  END AS bmi,
  c.military_status,
  c.deferment_reason,
  COALESCE(ec.exam_count, 0) AS exam_count,
  CASE
    WHEN he.exam_year IS NOT NULL THEN YEAR(CURDATE()) - he.exam_year
    ELSE NULL
  END AS years_since_last_exam,
  c.is_blacklisted,
  NOW()
FROM citizens c
LEFT JOIN hierarchy_units hu ON hu.code = c.unit_code
LEFT JOIN (
  SELECT e1.citizen_id, e1.level, e1.major
  FROM citizen_education e1
  INNER JOIN (
    SELECT citizen_id, MAX(id) AS max_id FROM citizen_education GROUP BY citizen_id
  ) latest ON latest.max_id = e1.id
) edu ON edu.citizen_id = c.id
LEFT JOIN (
  SELECT h1.citizen_id, h1.is_qualified, h1.height, h1.weight, h1.exam_year
  FROM health_exams h1
  INNER JOIN (
    SELECT citizen_id, MAX(exam_year) AS max_year FROM health_exams GROUP BY citizen_id
  ) hy ON hy.citizen_id = h1.citizen_id AND hy.max_year = h1.exam_year
) he ON he.citizen_id = c.id
LEFT JOIN (
  SELECT citizen_id, COUNT(*) AS exam_count FROM health_exams GROUP BY citizen_id
) ec ON ec.citizen_id = c.id
ON DUPLICATE KEY UPDATE
  age = VALUES(age),
  unit_code = VALUES(unit_code),
  unit_level = VALUES(unit_level),
  education_level = VALUES(education_level),
  job_proxy = VALUES(job_proxy),
  health_grade = VALUES(health_grade),
  is_qualified_last = VALUES(is_qualified_last),
  height = VALUES(height),
  weight = VALUES(weight),
  bmi = VALUES(bmi),
  military_status = VALUES(military_status),
  deferment_reason = VALUES(deferment_reason),
  exam_count = VALUES(exam_count),
  years_since_last_exam = VALUES(years_since_last_exam),
  is_blacklisted = VALUES(is_blacklisted),
  refreshed_at = NOW()
`);
}

export async function main() {
  const FORCE = process.argv.includes("--force");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    multipleStatements: true,
  });

  const migration = fs.readFileSync(
    path.join(process.cwd(), "dacta", "migrations", "001_analytics_ready.sql"),
    "utf8"
  );
  await conn.query(migration);

  const [countRows] = await conn.query("SELECT COUNT(*) AS cnt FROM citizens");
  const cnt = Number((countRows as { cnt: number }[])[0].cnt);

  if (cnt > 0 && !FORCE) {
    console.log(`citizens already has ${cnt} rows — skip seed (use --force to reseed).`);
    console.log("Refreshing feature mart only...");
    await refreshFeatures(conn);
    await conn.end();
    return;
  }

  if (FORCE && cnt > 0) {
    console.log("FORCE: clearing analytics-related citizen data...");
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    await conn.query("TRUNCATE TABLE analytics_citizen_features");
    await conn.query("TRUNCATE TABLE exam_participants");
    await conn.query("TRUNCATE TABLE exam_rounds");
    await conn.query("TRUNCATE TABLE quotas");
    await conn.query("TRUNCATE TABLE health_exams");
    await conn.query("TRUNCATE TABLE citizen_education");
    await conn.query("TRUNCATE TABLE citizens");
    await conn.query("SET FOREIGN_KEY_CHECKS=1");
  }

  console.log("Seeding hierarchy...");
  const wards = await ensureHierarchy(conn);

  console.log(`Seeding ${TARGET_CITIZENS} citizens (batched)...`);
  const years = [2023, 2024, 2025, 2026];
  const citizenIds: string[] = [];
  const batchSize = 100;

  for (let start = 1; start <= TARGET_CITIZENS; start += batchSize) {
    const end = Math.min(start + batchSize - 1, TARGET_CITIZENS);
    const citizenValues: unknown[][] = [];
    const eduValues: unknown[][] = [];
    const healthValues: unknown[][] = [];

    for (let i = start; i <= end; i++) {
      const id = `C${String(i).padStart(6, "0")}`;
      citizenIds.push(id);
      const ward = pick(wards);
      const birthYear = randInt(2000, 2008);
      const status = pick(STATUSES);
      const defer =
        status === "tamhoan" || status === "miengoi" ? pick(DEFER_REASONS) : null;
      const grade = randInt(1, 6);
      const name = `${pick(FIRST)} ${pick(MIDDLE)} ${pick(LAST)}`;
      const dob = `${birthYear}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;

      citizenValues.push([
        id,
        name,
        cccd(i),
        dob,
        "male",
        "Việt Nam",
        "Kinh",
        "Không",
        ward.name,
        ward.name,
        ward.name,
        `09${String(randInt(10000000, 99999999))}`,
        ward.code,
        status,
        defer,
        grade,
        Math.random() < 0.03 ? 1 : 0,
      ]);

      eduValues.push([
        id,
        `Trường ${pick(LAST)}`,
        pick(EDU_LEVELS),
        pick(MAJORS),
        birthYear + 18 + randInt(0, 4),
        Math.round((Math.random() * 2 + 2) * 100) / 100,
      ]);

      const examN = randInt(0, 2);
      for (let e = 0; e < examN; e++) {
        const year = pick(years);
        const height = randInt(160, 185);
        const weight = randInt(50, 85);
        const qualified = grade <= 3 ? 1 : 0;
        healthValues.push([
          `HE-${id}-${year}-${e}`,
          id,
          year,
          e === 0 ? "Sơ tuyển xã" : "Khám huyện",
          height,
          weight,
          `${randInt(100, 130)}/${randInt(60, 85)}`,
          String((Math.random() * 2 + 8).toFixed(1)),
          String((Math.random() * 2 + 8).toFixed(1)),
          "Bình thường",
          randInt(60, 95),
          qualified ? null : "Theo dõi sức khỏe",
          `Loại ${grade}`,
          qualified,
        ]);
      }
    }

    await conn.query(
      `INSERT INTO citizens (
        id, full_name, cccd, date_of_birth, gender, nationality, ethnicity, religion,
        origin_place, permanent_address, current_address, phone, unit_code,
        military_status, deferment_reason, health_grade, is_blacklisted
      ) VALUES ?`,
      [citizenValues]
    );
    await conn.query(
      `INSERT INTO citizen_education (citizen_id, school_name, level, major, graduation_year, gpa) VALUES ?`,
      [eduValues]
    );
    if (healthValues.length) {
      await conn.query(
        `INSERT INTO health_exams (
          id, citizen_id, exam_year, exam_phase, height, weight, blood_pressure,
          vision_left, vision_right, hearing, heart_rate, conclusions_detail,
          medical_grade, is_qualified
        ) VALUES ?`,
        [healthValues]
      );
    }
    process.stdout.write(`\r  citizens ${end}/${TARGET_CITIZENS}`);
  }
  console.log("");

  console.log("Seeding exam rounds & participants...");
  const epValues: unknown[][] = [];
  for (const year of years) {
    const roundId = `R-${year}-SO`;
    await conn.query(
      `INSERT INTO exam_rounds (id, name, year, phase, unit_code, status)
       VALUES (?, ?, ?, 'Sơ tuyển', 'bo', 'closed')`,
      [roundId, `Đợt sơ tuyển ${year}`, year]
    );
    const sample = citizenIds.filter((_, idx) => idx % 3 === year % 3).slice(0, 300);
    for (const cid of sample) {
      epValues.push([
        roundId,
        cid,
        pick(["pending", "passed", "failed", "deferred", "exempted", "enlisted"] as const),
      ]);
    }
  }
  for (let i = 0; i < epValues.length; i += 200) {
    await conn.query(
      `INSERT IGNORE INTO exam_participants (round_id, citizen_id, result) VALUES ?`,
      [epValues.slice(i, i + 200)]
    );
  }

  console.log("Seeding quotas...");
  const [unitRows] = await conn.query(
    `SELECT code, level FROM hierarchy_units WHERE level IN ('tinh','xa')`
  );
  const units = unitRows as { code: string; level: string }[];
  const quotaValues: unknown[][] = [];
  let q = 0;
  for (const year of years) {
    for (const u of units.slice(0, 20)) {
      q += 1;
      const amount =
        u.level === "tinh" ? randInt(80, 200) : randInt(5, 25);
      const filled = Math.min(amount, randInt(0, amount));
      quotaValues.push([`Q-${year}-${q}`, year, "bo", u.code, amount, filled, `Chỉ tiêu ${year}`]);
    }
  }
  if (quotaValues.length) {
    await conn.query(
      `INSERT INTO quotas (id, year, from_unit, to_unit, amount, filled, note) VALUES ?`,
      [quotaValues]
    );
  }

  console.log("Refreshing feature mart...");
  await refreshFeatures(conn);

  const [final] = await conn.query("SELECT COUNT(*) AS cnt FROM citizens");
  console.log("Done. citizens =", (final as { cnt: number }[])[0].cnt);
  await conn.end();
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("seed-analytics.ts") ||
    process.argv[1].endsWith("seed-analytics.js"));

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
