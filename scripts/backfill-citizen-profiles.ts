/**
 * Backfill hồ sơ công dân: identity + family cho mọi bản ghi đang thiếu.
 * Usage: npx tsx scripts/backfill-citizen-profiles.ts
 */
import mysql from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

const LAST = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
  "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý",
];
const MID_M = ["Văn", "Hữu", "Đức", "Minh", "Quốc", "Thanh", "Công", "Xuân"];
const MID_F = ["Thị", "Ngọc", "Thanh", "Kim", "Thu", "Mai"];
const FIRST_M = ["An", "Bình", "Cường", "Dũng", "Hùng", "Khoa", "Long", "Nam", "Phong", "Quang", "Sơn", "Tùng", "Việt"];
const FIRST_F = ["Anh", "Hà", "Hương", "Lan", "Linh", "Mai", "Nga", "Trang", "Uyên", "Yến"];
const FEATURES = [
  "Nốt ruồi cách 1cm dưới đuôi mắt phải",
  "Sẹo nhỏ trên trán bên trái",
  "Nốt ruồi trên cánh mũi trái",
  "Sẹo dài 1cm ở cằm",
  "Nốt ruồi dưới môi dưới",
  "Không có đặc điểm đặc biệt",
  "Sẹo nhỏ phía trên lông mày phải",
  "Nốt ruồi sau tai trái",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function fatherName(citizenName: string, seed: number): string {
  const parts = citizenName.trim().split(/\s+/);
  const surname = parts[0] || pick(LAST, seed);
  return `${surname} ${pick(MID_M, seed + 1)} ${pick(FIRST_M, seed + 2)}`;
}

function motherName(seed: number): string {
  return `${pick(LAST, seed + 3)} ${pick(MID_F, seed + 4)} ${pick(FIRST_F, seed + 5)}`;
}

function issueExpiry(dob: string | Date, seed: number): { issue: string; expiry: string } {
  const birth = new Date(dob);
  const birthYear = birth.getFullYear();
  // CCCD gắn chip phổ biến cấp từ 2021–2024
  const issueYear = Math.min(2024, Math.max(2021, birthYear + 14 + (seed % 5)));
  const issueMonth = (seed % 12) + 1;
  const issueDay = (seed % 27) + 1;
  const issue = `${issueYear}-${String(issueMonth).padStart(2, "0")}-${String(issueDay).padStart(2, "0")}`;
  const ageAtIssue = issueYear - birthYear;
  const validity = ageAtIssue < 25 ? 10 : ageAtIssue < 40 ? 15 : 25;
  const expiry = `${issueYear + validity}-${String(issueMonth).padStart(2, "0")}-${String(issueDay).padStart(2, "0")}`;
  return { issue, expiry };
}

function oldId(cccd: string, seed: number): string {
  if (cccd && cccd.length >= 9) return cccd.slice(-9);
  return String(100000000 + (seed % 899999999));
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

  const [citizens] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT c.id, c.full_name, c.cccd, c.date_of_birth, c.origin_place
     FROM citizens c
     LEFT JOIN citizen_identities ci ON ci.citizen_id = c.id
     WHERE ci.citizen_id IS NULL
        OR ci.identification_features IS NULL
        OR ci.issue_date IS NULL
        OR ci.expiry_date IS NULL
        OR ci.old_id_number IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM citizen_family f
          WHERE f.citizen_id = c.id AND f.relationship = 'Cha'
        )
        OR NOT EXISTS (
          SELECT 1 FROM citizen_family f
          WHERE f.citizen_id = c.id AND f.relationship = 'Me'
        )`,
  );

  console.log(`Citizens cần bổ sung hồ sơ: ${citizens.length}`);

  let identityUpserts = 0;
  let familyInserts = 0;

  for (const row of citizens) {
    const seed = hash(String(row.id) + String(row.cccd));
    const { issue, expiry } = issueExpiry(row.date_of_birth, seed);
    const features = pick(FEATURES, seed);
    const old = oldId(String(row.cccd || ""), seed);

    await conn.query(
      `INSERT INTO citizen_identities
        (citizen_id, identification_features, issue_date, expiry_date, old_id_number)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         identification_features = COALESCE(identification_features, VALUES(identification_features)),
         issue_date = COALESCE(issue_date, VALUES(issue_date)),
         expiry_date = COALESCE(expiry_date, VALUES(expiry_date)),
         old_id_number = COALESCE(old_id_number, VALUES(old_id_number))`,
      [row.id, features, issue, expiry, old],
    );
    identityUpserts += 1;

    const [hasFather] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id FROM citizen_family WHERE citizen_id = ? AND relationship = 'Cha' LIMIT 1`,
      [row.id],
    );
    if (!hasFather.length) {
      await conn.query(
        `INSERT INTO citizen_family (citizen_id, rel_name, relationship)
         VALUES (?, ?, 'Cha')`,
        [row.id, fatherName(String(row.full_name || ""), seed)],
      );
      familyInserts += 1;
    }

    const [hasMother] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id FROM citizen_family WHERE citizen_id = ? AND relationship = 'Me' LIMIT 1`,
      [row.id],
    );
    if (!hasMother.length) {
      await conn.query(
        `INSERT INTO citizen_family (citizen_id, rel_name, relationship)
         VALUES (?, ?, 'Me')`,
        [row.id, motherName(seed)],
      );
      familyInserts += 1;
    }
  }

  // Fill blank origin_place / nationality / ethnicity / religion if empty
  const [blankPersonal] = await conn.query<mysql.ResultSetHeader>(
    `UPDATE citizens
     SET
       nationality = COALESCE(NULLIF(nationality, ''), 'Việt Nam'),
       ethnicity = COALESCE(NULLIF(ethnicity, ''), 'Kinh'),
       religion = COALESCE(NULLIF(religion, ''), 'Không'),
       origin_place = COALESCE(NULLIF(origin_place, ''), permanent_address)
     WHERE nationality IS NULL OR nationality = ''
        OR ethnicity IS NULL OR ethnicity = ''
        OR religion IS NULL OR religion = ''
        OR origin_place IS NULL OR origin_place = ''`,
  );

  const [idCount] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM citizen_identities`,
  );
  const [famCount] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM citizen_family WHERE relationship IN ('Cha','Me')`,
  );
  const [citizenCount] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM citizens`,
  );

  await conn.end();

  console.log(`Done.
  identity upserts: ${identityUpserts}
  family inserts:   ${familyInserts}
  personal filled:  ${blankPersonal.affectedRows}
  totals: citizens=${citizenCount[0].cnt}, identities=${idCount[0].cnt}, parents=${famCount[0].cnt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
