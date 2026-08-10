/**
 * Seed hồ sơ công dân đủ 34 tỉnh/TP, mỗi tỉnh ≥ 30 hồ sơ.
 * Usage: npx tsx scripts/seed-citizens-34.ts [--force]
 */
import path from "path";
import fs from "fs";
import mysql, { Connection } from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

const PER_PROVINCE = 30;

const STATUSES = [
  "chuakham",
  "dangkham",
  "trungtuyen",
  "truottuyen",
  "tamhoan",
  "miengoi",
  "nhapngu",
] as const;

const REASON_BY_STATUS: Partial<Record<(typeof STATUSES)[number], string[]>> = {
  tamhoan: [
    "Đang theo học đại học chính quy",
    "Hoàn cảnh gia đình khó khăn",
    "Chưa đủ tuổi theo quy định",
  ],
  truottuyen: [
    "Không đủ tiêu chuẩn sức khỏe",
    "Không đạt vòng khám tuyển",
  ],
  miengoi: ["Miễn theo diện sức khỏe Loại 5", "Thuộc diện miễn theo quy định"],
};

const EDU_LEVELS = ["9/12", "12/12", "Cao đẳng", "Đại học", "Thạc sĩ"];
const JOBS = [
  "Sinh viên",
  "Công nhân",
  "Nhân viên văn phòng",
  "Nông dân",
  "Thợ điện",
  "Tự do",
  "Kỹ thuật viên",
];

const FIRST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương"];
const MIDDLE = ["Văn", "Minh", "Quốc", "Đức", "Hữu", "Công", "Thanh", "Hoài"];
const LAST = ["An", "Bình", "Cường", "Dũng", "Hùng", "Long", "Nam", "Phong", "Quang", "Tùng", "Hải", "Sơn", "Kiên", "Thắng", "Việt"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Province = {
  code: number;
  name: string;
  wards: Array<{ code: number; name: string }>;
};

async function ensureColumns(conn: Connection) {
  const db = process.env.DB_NAME || "quan_ly_nvqs";

  const has = async (col: string) => {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'citizens' AND COLUMN_NAME = ?`,
      [db, col],
    );
    return Number((rows as { c: number }[])[0].c) > 0;
  };

  if (!(await has("unit_code"))) {
    await conn.query(
      `ALTER TABLE citizens ADD COLUMN unit_code VARCHAR(50) NULL AFTER phone, ADD INDEX idx_citizen_unit (unit_code)`,
    );
  }
  if (!(await has("military_status_reason"))) {
    await conn.query(
      `ALTER TABLE citizens ADD COLUMN military_status_reason TEXT NULL AFTER military_status`,
    );
  }
  if (!(await has("military_status_locked"))) {
    await conn.query(
      `ALTER TABLE citizens ADD COLUMN military_status_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER military_status_reason`,
    );
  }

  // mở rộng ENUM nếu thiếu truottuyen
  const [enumRows] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'citizens' AND COLUMN_NAME = 'military_status'`,
    [db],
  );
  const colType = String((enumRows as { COLUMN_TYPE: string }[])[0]?.COLUMN_TYPE || "");
  if (colType && !colType.includes("truottuyen")) {
    await conn.query(
      `ALTER TABLE citizens MODIFY COLUMN military_status
       ENUM('chuakham','dangkham','trungtuyen','truottuyen','tamhoan','miengoi','nhapngu')
       NOT NULL DEFAULT 'chuakham'`,
    );
  }
}

async function ensureHierarchy(conn: Connection): Promise<
  Array<{ tinhCode: string; tinhName: string; wards: Array<{ code: string; name: string }> }>
> {
  await conn.query(
    `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active)
     VALUES ('bo', 'Bộ Quốc phòng', 'bo', NULL, 1)`,
  );

  const provincesPath = path.join(process.cwd(), "src", "data", "provinces.json");
  const provinces = JSON.parse(fs.readFileSync(provincesPath, "utf8")) as Province[];

  const result: Array<{
    tinhCode: string;
    tinhName: string;
    wards: Array<{ code: string; name: string }>;
  }> = [];

  for (const p of provinces) {
    const tinhCode = String(p.code);
    await conn.query(
      `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active)
       VALUES (?, ?, 'tinh', 'bo', 1)`,
      [tinhCode, p.name],
    );

    const wardList = (p.wards || []).slice(0, 12);
    const wards: Array<{ code: string; name: string }> = [];

    for (const w of wardList) {
      const wCode = `${tinhCode}-${w.code}`;
      await conn.query(
        `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active)
         VALUES (?, ?, 'xa', ?, 1)`,
        [wCode, w.name, tinhCode],
      );
      wards.push({ code: wCode, name: w.name });
    }

    // fallback nếu tỉnh không có ward trong JSON
    if (wards.length === 0) {
      const wCode = `${tinhCode}-00000`;
      await conn.query(
        `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active)
         VALUES (?, ?, 'xa', ?, 1)`,
        [wCode, `Đơn vị mặc định ${p.name}`, tinhCode],
      );
      wards.push({ code: wCode, name: `Đơn vị mặc định ${p.name}` });
    }

    result.push({ tinhCode, tinhName: p.name, wards });
  }

  console.log(`Hierarchy: ${result.length} tỉnh/TP`);
  return result;
}

export async function main() {
  const force = process.argv.includes("--force");
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

  try {
    await ensureColumns(conn);
    const provinces = await ensureHierarchy(conn);

    const [countRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM citizens`);
    const existing = Number((countRows as { cnt: number }[])[0].cnt);

    if (existing > 0 && !force) {
      // Bổ sung thiếu theo từng tỉnh thay vì bỏ qua hết
      console.log(`citizens hiện có ${existing} — sẽ bổ sung để mỗi tỉnh ≥ ${PER_PROVINCE} (dùng --force để xóa seed cũ)`);
    }

    if (force) {
      console.log("FORCE: xóa dữ liệu công dân cũ...");
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      try {
        await conn.query("TRUNCATE TABLE analytics_citizen_features");
      } catch {
        /* optional table */
      }
      try {
        await conn.query("TRUNCATE TABLE exam_participants");
      } catch {
        /* optional */
      }
      try {
        await conn.query("TRUNCATE TABLE health_exams");
      } catch {
        /* optional */
      }
      try {
        await conn.query("TRUNCATE TABLE citizen_education");
      } catch {
        /* optional */
      }
      try {
        await conn.query("TRUNCATE TABLE citizen_identities");
      } catch {
        /* optional */
      }
      try {
        await conn.query("TRUNCATE TABLE citizen_family");
      } catch {
        /* optional */
      }
      await conn.query("TRUNCATE TABLE citizens");
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    let seq = existing + 1;
    let insertedTotal = 0;

    for (const p of provinces) {
      const [cntRows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM citizens
         WHERE unit_code = ? OR unit_code LIKE CONCAT(?, '-%')`,
        [p.tinhCode, p.tinhCode],
      );
      const have = Number((cntRows as { cnt: number }[])[0].cnt);
      const need = Math.max(0, PER_PROVINCE - have);
      if (need === 0) {
        console.log(`  ✓ ${p.tinhName}: đủ ${have}`);
        continue;
      }

      const citizenValues: unknown[][] = [];
      const eduValues: unknown[][] = [];

      for (let i = 0; i < need; i++) {
        const ward = pick(p.wards);
        const status = pick(STATUSES);
        const reasons = REASON_BY_STATUS[status];
        const reason = reasons ? pick(reasons) : null;
        const grade = randInt(1, 5);
        const birthYear = randInt(2002, 2008);
        const id = `c34-${p.tinhCode}-${String(seq).padStart(6, "0")}`;
        const name = `${pick(FIRST)} ${pick(MIDDLE)} ${pick(LAST)}`;
        const dob = `${birthYear}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;
        const cccd = String(200000000000 + seq).padStart(12, "0");
        const address = `${ward.name}, ${p.tinhName}`;
        const edu = pick(EDU_LEVELS);
        const job = pick(JOBS);
        const locked =
          status === "tamhoan" || status === "truottuyen" || status === "nhapngu" ? 1 : 0;

        citizenValues.push([
          id,
          name,
          cccd,
          dob,
          "male",
          "Việt Nam",
          "Kinh",
          "Không",
          p.tinhName,
          address,
          address,
          `09${String(randInt(10000000, 99999999))}`,
          ward.code,
          status,
          reason,
          locked,
          grade,
          0,
        ]);

        eduValues.push([
          id,
          `Trường ${pick(LAST)} ${p.tinhName}`,
          edu,
          job,
          birthYear + 18,
          Math.round((Math.random() * 2 + 2) * 100) / 100,
        ]);

        seq += 1;
      }

      // batch insert
      const batch = 100;
      for (let b = 0; b < citizenValues.length; b += batch) {
        const slice = citizenValues.slice(b, b + batch);
        const eduSlice = eduValues.slice(b, b + batch);
        await conn.query(
          `INSERT INTO citizens (
            id, full_name, cccd, date_of_birth, gender, nationality, ethnicity, religion,
            origin_place, permanent_address, current_address, phone, unit_code,
            military_status, military_status_reason, military_status_locked,
            health_grade, is_blacklisted
          ) VALUES ?`,
          [slice],
        );
        await conn.query(
          `INSERT INTO citizen_education (citizen_id, school_name, level, major, graduation_year, gpa) VALUES ?`,
          [eduSlice],
        );
      }

      insertedTotal += need;
      console.log(`  + ${p.tinhName}: thêm ${need} (trước đó ${have})`);
    }

    const [final] = await conn.query(`SELECT COUNT(*) AS cnt FROM citizens`);
    const [byTinh] = await conn.query(
      `SELECT
         COALESCE(SUBSTRING_INDEX(unit_code, '-', 1), unit_code) AS tinh,
         COUNT(*) AS cnt
       FROM citizens
       WHERE unit_code IS NOT NULL
       GROUP BY tinh
       ORDER BY cnt ASC
       LIMIT 5`,
    );

    console.log(`\nDone. inserted=${insertedTotal}, total citizens=${(final as { cnt: number }[])[0].cnt}`);
    console.log("5 tỉnh ít hồ sơ nhất:", byTinh);
  } finally {
    await conn.end();
  }
}

const isDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("seed-citizens-34.ts") ||
    process.argv[1].endsWith("seed-citizens-34.js"));

if (isDirect) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
