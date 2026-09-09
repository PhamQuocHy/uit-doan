/**
 * Làm sạch dữ liệu demo + seed nhẹ để kiểm thử.
 * Mỗi xã: 10 trúng tuyển · 5 dự bị · 10 hoãn · 25 không gọi (= 50).
 * Phạm vi: 5 tỉnh QK9 × 5 xã/tỉnh. 1 đợt camp1 + chỉ tiêu đủ.
 *
 * Usage: npx tsx scripts/seed-demo-light.ts
 */
import fs from "fs";
import path from "path";
import mysql, { Connection } from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

const CAMPAIGN_ID = "camp1";
const CAMPAIGN_NAME = "Đợt gọi nhập ngũ đợt 1 năm 2026";
const QK9 = "dv-qk9";
/** 5 tỉnh QK9 — Cần Thơ (92) seed đủ mọi xã (gồm Phú Lộc); tỉnh khác 5 xã */
const PROVINCE_CODES = ["92", "96", "91", "82", "86"];
const WARDS_PER_OTHER_PROVINCE = 5;
/** Ưu tiên luôn có mặt khi cắt danh sách xã tỉnh khác */
const PRIORITY_WARD_NAMES = ["Phú Lộc", "Ninh Kiều", "Cái Khế", "Hưng Phú", "Ô Môn"];

const MIX = {
  trungtuyen: 10, // trúng tuyển → dự kiến gọi, chờ duyệt
  du_bi: 5,
  tamhoan: 10,
  khong_goi: 25,
} as const;

const LAST = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
  "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý",
];
const MID_M = ["Văn", "Hữu", "Đức", "Minh", "Quốc", "Thanh", "Công", "Xuân"];
const MID_F = ["Thị", "Ngọc", "Thanh", "Kim", "Thu", "Mai"];
const FIRST_M = [
  "An", "Bình", "Cường", "Dũng", "Hùng", "Khoa", "Long", "Nam", "Phong", "Quang",
  "Sơn", "Tùng", "Việt", "Hải", "Kiên", "Thắng",
];
const FIRST_F = ["Anh", "Hà", "Hương", "Lan", "Linh", "Mai", "Nga", "Trang", "Uyên", "Yến"];
const EDU = ["12/12", "Cao đẳng", "Đại học", "9/12"];
const JOBS = ["Sinh viên", "Công nhân", "Nông dân", "Tự do", "Nhân viên"];

type Ward = { code: string; name: string };
type Province = { code: string; name: string; wards: Ward[] };

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function citizenName(i: number): string {
  return `${pick(LAST, i)} ${pick(MID_M, i + 1)} ${pick(FIRST_M, i + 2)}`;
}

function fatherOf(name: string, i: number): string {
  const surname = name.split(/\s+/)[0] || pick(LAST, i);
  return `${surname} ${pick(MID_M, i + 3)} ${pick(FIRST_M, i + 4)}`;
}

function motherOf(i: number): string {
  return `${pick(LAST, i + 5)} ${pick(MID_F, i + 6)} ${pick(FIRST_F, i + 7)}`;
}

function cccdFor(seq: number): string {
  return `092${String(2000000 + seq).padStart(9, "0")}`;
}

function dobFor(i: number): string {
  const year = 2003 + (i % 5); // 2003–2007
  const month = (i % 12) + 1;
  const day = (i % 27) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function tableExists(conn: Connection, name: string): Promise<boolean> {
  const db = process.env.DB_NAME || "quan_ly_nvqs";
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [db, name],
  );
  return Number((rows as { c: number }[])[0].c) > 0;
}

async function clearDemoData(conn: Connection) {
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  const tables = [
    "exam_participants",
    "analytics_citizen_features",
    "citizen_residence",
    "citizen_residences",
    "citizen_education",
    "citizen_identities",
    "citizen_family",
    "citizen_health_exams",
    "health_exams",
    "citizens",
    "receiving_sub_quotas",
    "receiving_quota_provinces",
    "receiving_quotas",
    "quota_tombstones",
    "quotas",
    "recruitment_campaigns",
  ];
  for (const t of tables) {
    if (await tableExists(conn, t)) {
      await conn.query(`TRUNCATE TABLE \`${t}\``);
      console.log(`  truncated ${t}`);
    }
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function loadProvinces(): Promise<Province[]> {
  const provincesPath = path.join(process.cwd(), "src", "data", "provinces.json");
  const raw = JSON.parse(fs.readFileSync(provincesPath, "utf8")) as Array<{
    code: number;
    name: string;
    wards?: Array<{ code: number; name: string }>;
  }>;

  const out: Province[] = [];
  for (const code of PROVINCE_CODES) {
    const p = raw.find((x) => String(x.code) === code);
    if (!p) continue;
    const allWards = (p.wards || []).map((w) => ({
      code: `${code}-${w.code}`,
      name: w.name,
    }));

    let wards: Ward[];
    if (code === "92") {
      // Cần Thơ: đủ xã/phường để kiểm thử (có Xã Phú Lộc)
      wards = allWards;
    } else {
      const priority = allWards.filter((w) =>
        PRIORITY_WARD_NAMES.some((n) => w.name.includes(n)),
      );
      const rest = allWards.filter((w) => !priority.includes(w));
      wards = [...priority, ...rest].slice(0, WARDS_PER_OTHER_PROVINCE);
    }

    out.push({ code, name: p.name, wards });
  }
  return out;
}

async function ensureHierarchy(conn: Connection, provinces: Province[]) {
  await conn.query(
    `INSERT INTO hierarchy_units (code, name, level, parent_code, is_active)
     VALUES ('bo', 'Bộ Quốc phòng', 'bo', NULL, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1`,
  );
  await conn.query(
    `INSERT INTO hierarchy_units (code, name, level, parent_code, is_active, unit_kind)
     VALUES (?, 'Quân khu 9', 'donvi', 'bo', 1, 'quankhu')
     ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1, unit_kind = 'quankhu'`,
    [QK9],
  );
  for (const p of provinces) {
    await conn.query(
      `INSERT INTO hierarchy_units (code, name, level, parent_code, is_active)
       VALUES (?, ?, 'tinh', 'bo', 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1`,
      [p.code, p.name],
    );
    for (const w of p.wards) {
      await conn.query(
        `INSERT INTO hierarchy_units (code, name, level, parent_code, is_active)
         VALUES (?, ?, 'xa', ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), parent_code = VALUES(parent_code), is_active = 1`,
        [w.code, w.name, p.code],
      );
    }
  }
}

type Slot =
  | { kind: "trungtuyen" }
  | { kind: "du_bi" }
  | { kind: "tamhoan" }
  | { kind: "khong_goi" };

function slotsForWard(): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < MIX.trungtuyen; i++) slots.push({ kind: "trungtuyen" });
  for (let i = 0; i < MIX.du_bi; i++) slots.push({ kind: "du_bi" });
  for (let i = 0; i < MIX.tamhoan; i++) slots.push({ kind: "tamhoan" });
  for (let i = 0; i < MIX.khong_goi; i++) slots.push({ kind: "khong_goi" });
  return slots;
}

function profileFor(slot: Slot, i: number) {
  if (slot.kind === "trungtuyen") {
    return {
      military_status: "trungtuyen",
      military_status_reason: null as string | null,
      call_intent: "du_kien_goi",
      approval_status: "pending",
      health_grade: (i % 3) + 1,
      locked: 0,
    };
  }
  if (slot.kind === "du_bi") {
    return {
      military_status: "trungtuyen",
      military_status_reason: "Dự bị gọi nhập ngũ",
      call_intent: "du_bi",
      approval_status: "none",
      health_grade: (i % 3) + 1,
      locked: 0,
    };
  }
  if (slot.kind === "tamhoan") {
    return {
      military_status: "tamhoan",
      military_status_reason: "Đang theo học đại học chính quy",
      call_intent: "unset",
      approval_status: "pending",
      health_grade: null as number | null,
      locked: 0,
    };
  }
  return {
    military_status: "trungtuyen",
    military_status_reason: "Không đủ tiêu chuẩn sức khỏe / đề xuất không gọi",
    call_intent: "de_xuat_khong_goi",
    approval_status: "pending",
    health_grade: 4 + (i % 2),
    locked: 0,
  };
}

async function seedCampaign(conn: Connection, targetQuota: number) {
  await conn.query(
    `INSERT INTO recruitment_campaigns
      (id, name, year, start_date, end_date, status, target_quota, created_at, updated_at)
     VALUES (?, ?, 2026, '2026-02-01', '2026-03-15', 'ongoing', ?, NOW(), NOW())`,
    [CAMPAIGN_ID, CAMPAIGN_NAME, targetQuota],
  );
}

async function seedQuotas(
  conn: Connection,
  provinces: Province[],
  trungtuyenPerWard: number,
) {
  const wardsTotal = provinces.reduce((s, p) => s + p.wards.length, 0);
  const boToQk = wardsTotal * trungtuyenPerWard;

  await conn.query(
    `INSERT INTO quotas
      (id, campaign_id, year, from_level, from_unit, to_level, to_unit, to_unit_name, amount, filled, note, created_at)
     VALUES (?, ?, 2026, 'bo', 'bo', 'donvi', ?, 'Quân khu 9', ?, 0, 'Seed demo — khớp trúng tuyển', NOW())`,
    [`q_demo_qk9`, CAMPAIGN_ID, QK9, boToQk],
  );

  await conn.query(
    `INSERT INTO receiving_quotas (id, campaign_id, receiving_unit_code, amount, note)
     VALUES (?, ?, ?, ?, 'Đồng bộ từ chỉ tiêu tuyển quân')
     ON DUPLICATE KEY UPDATE amount = VALUES(amount), note = VALUES(note)`,
    [`rq_demo_qk9`, CAMPAIGN_ID, QK9, boToQk],
  );

  let qi = 0;
  for (const p of provinces) {
    const tinhAmount = p.wards.length * trungtuyenPerWard;
    qi += 1;
    await conn.query(
      `INSERT INTO quotas
        (id, campaign_id, year, from_level, from_unit, to_level, to_unit, to_unit_name, amount, filled, note, created_at)
       VALUES (?, ?, 2026, 'donvi', ?, 'tinh', ?, ?, ?, 0, 'Seed demo QK9 → tỉnh', NOW())`,
      [`q_demo_p${qi}`, CAMPAIGN_ID, QK9, p.code, p.name, tinhAmount],
    );

    let wi = 0;
    for (const w of p.wards) {
      wi += 1;
      await conn.query(
        `INSERT INTO quotas
          (id, campaign_id, year, from_level, from_unit, to_level, to_unit, to_unit_name, amount, filled, note, created_at)
         VALUES (?, ?, 2026, 'tinh', ?, 'xa', ?, ?, ?, 0, 'Seed demo tỉnh → xã', NOW())`,
        [
          `q_demo_p${qi}_w${wi}`,
          CAMPAIGN_ID,
          p.code,
          w.code,
          w.name,
          trungtuyenPerWard,
        ],
      );
    }
  }

  return boToQk;
}

export async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    multipleStatements: true,
  });

  try {
    console.log("1) Clear demo tables…");
    await clearDemoData(conn);

    console.log("2) Hierarchy (QK9 demo provinces)…");
    const provinces = await loadProvinces();
    if (!provinces.length) throw new Error("Không load được tỉnh demo");
    await ensureHierarchy(conn, provinces);

    const wardCount = provinces.reduce((s, p) => s + p.wards.length, 0);
    const targetQuota = wardCount * MIX.trungtuyen;

    console.log("3) Campaign…");
    await seedCampaign(conn, targetQuota);

    console.log(
      `4) Citizens: Cần Thơ đủ xã + 4 tỉnh × ${WARDS_PER_OTHER_PROVINCE} xã × 50…`,
    );

    let seq = 1;
    const citizenRows: unknown[][] = [];
    const eduRows: unknown[][] = [];
    const idRows: unknown[][] = [];
    const famRows: unknown[][] = [];

    for (const p of provinces) {
      for (const w of p.wards) {
        const slots = slotsForWard();
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const id = `demo-${p.code}-${w.code.split("-")[1]}-${String(i + 1).padStart(2, "0")}`;
          const name = citizenName(seq);
          const cccd = cccdFor(seq);
          const dob = dobFor(seq);
          const address = `${w.name}, ${p.name}`;
          const prof = profileFor(slot, i);
          const phone = `09${String(10000000 + (seq % 89999999)).padStart(8, "0")}`;

          citizenRows.push([
            id,
            name,
            cccd,
            dob,
            "male",
            "Việt Nam",
            "Kinh",
            "Không",
            p.name,
            address,
            address,
            phone,
            w.code,
            prof.military_status,
            prof.military_status_reason,
            prof.locked,
            prof.call_intent,
            prof.approval_status,
            CAMPAIGN_ID,
            prof.health_grade,
            0,
          ]);

          eduRows.push([
            id,
            `Trường THPT ${w.name}`,
            pick(EDU, seq),
            pick(JOBS, seq),
            Number(dob.slice(0, 4)) + 18,
            2.5 + (seq % 15) / 10,
          ]);

          idRows.push([
            id,
            pick(
              [
                "Nốt ruồi cách 1cm dưới đuôi mắt phải",
                "Sẹo nhỏ trên trán bên trái",
                "Không có đặc điểm đặc biệt",
              ],
              seq,
            ),
            "2022-06-15",
            "2032-06-15",
            cccd.slice(-9),
          ]);

          famRows.push([id, fatherOf(name, seq), "Cha"]);
          famRows.push([id, motherOf(seq), "Me"]);

          seq += 1;
        }
      }
    }

    const batch = 100;
    for (let b = 0; b < citizenRows.length; b += batch) {
      const cSlice = citizenRows.slice(b, b + batch);
      const eSlice = eduRows.slice(b, b + batch);
      const iSlice = idRows.slice(b, b + batch);
      const fSlice = famRows.slice(b * 2, b * 2 + cSlice.length * 2);

      await conn.query(
        `INSERT INTO citizens (
          id, full_name, cccd, date_of_birth, gender, nationality, ethnicity, religion,
          origin_place, permanent_address, current_address, phone, unit_code,
          military_status, military_status_reason, military_status_locked,
          call_intent, approval_status, campaign_id, health_grade, is_blacklisted
        ) VALUES ?`,
        [cSlice],
      );
      if (await tableExists(conn, "citizen_education")) {
        await conn.query(
          `INSERT INTO citizen_education (citizen_id, school_name, level, major, graduation_year, gpa) VALUES ?`,
          [eSlice],
        );
      }
      if (await tableExists(conn, "citizen_identities")) {
        await conn.query(
          `INSERT INTO citizen_identities
            (citizen_id, identification_features, issue_date, expiry_date, old_id_number)
           VALUES ?`,
          [iSlice],
        );
      }
      if (await tableExists(conn, "citizen_family")) {
        await conn.query(
          `INSERT INTO citizen_family (citizen_id, rel_name, relationship) VALUES ?`,
          [fSlice],
        );
      }
    }

    console.log("5) Quotas + receiving…");
    const boAmount = await seedQuotas(conn, provinces, MIX.trungtuyen);

    const [cnt] = await conn.query(`SELECT COUNT(*) AS n FROM citizens`);
    const [byIntent] = await conn.query(
      `SELECT call_intent, military_status, approval_status, COUNT(*) n
       FROM citizens GROUP BY call_intent, military_status, approval_status ORDER BY n DESC`,
    );

    console.log("\nDone.");
    console.log(`  citizens: ${(cnt as { n: number }[])[0].n}`);
    console.log(`  wards: ${wardCount} (mỗi xã 50 hồ sơ)`);
    console.log(`  campaign: ${CAMPAIGN_ID} — target ${targetQuota}`);
    console.log(`  Bộ → QK9 tuyển/nhận: ${boAmount}`);
    console.log("  breakdown:", byIntent);
    console.log("\nTài khoản demo giữ nguyên (admin123). Đăng nhập Bộ / QK9 / Cần Thơ để kiểm thử.");
  } finally {
    await conn.end();
  }
}

const isDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("seed-demo-light.ts") ||
    process.argv[1].endsWith("seed-demo-light.js"));

if (isDirect) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
