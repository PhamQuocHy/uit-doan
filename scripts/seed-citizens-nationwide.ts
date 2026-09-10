/**
 * Xóa hồ sơ công dân + seed lại toàn quốc để kiểm thử.
 * Mỗi xã: 15 dự kiến gọi · 5 dự bị · 10 tạm hoãn · 20 đề xuất không gọi (= 50).
 * 1 đợt camp1 năm 2026. Giữ hierarchy / quân khu / users.
 *
 * Usage: npx tsx scripts/seed-citizens-nationwide.ts
 */
import fs from "fs";
import path from "path";
import mysql, { Connection } from "mysql2/promise";
import { loadEnv } from "./load-env";

loadEnv();

const CAMPAIGN_ID = "camp1";
const CAMPAIGN_NAME = "Đợt gọi nhập ngũ đợt 1 năm 2026";

const MIX = {
  trungtuyen: 15, // dự kiến gọi
  du_bi: 5,
  tamhoan: 10,
  khong_goi: 20, // đề xuất không gọi
} as const;

/** Quân khu / BTL → mã tỉnh (khớp src/lib/military-regions.ts) */
const REGION_PROVINCES: Array<{ code: string; name: string; provinces: string[] }> = [
  { code: "dv-qk1", name: "Quân khu 1", provinces: ["4", "20", "24", "19"] },
  { code: "dv-qk2", name: "Quân khu 2", provinces: ["8", "15", "25", "14", "11", "12"] },
  { code: "dv-qk3", name: "Quân khu 3", provinces: ["22", "31", "37", "33"] },
  { code: "dv-qk4", name: "Quân khu 4", provinces: ["38", "40", "42", "44", "46"] },
  { code: "dv-qk5", name: "Quân khu 5", provinces: ["48", "51", "52", "66", "56"] },
  { code: "dv-qk7", name: "Quân khu 7", provinces: ["79", "75", "80", "68"] },
  { code: "dv-qk9", name: "Quân khu 9", provinces: ["92", "96", "91", "82", "86"] },
  { code: "dv-btl-hn", name: "Bộ Tư lệnh Thủ đô Hà Nội", provinces: ["1"] },
];

const LAST = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
  "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Đào", "Tô", "Cao",
  "Mai", "Châu", "Trịnh", "Lâm", "Quách", "Thái", "Tống", "Hà", "La", "Chu",
  "Đoàn", "Hứa", "Lương", "Tăng", "Kiều",
];
const MID_M = [
  "Văn", "Hữu", "Đức", "Minh", "Quốc", "Thanh", "Công", "Xuân", "Hoàng", "Anh",
  "Tuấn", "Bảo", "Đình", "Quang", "Thành", "Hải", "Huy", "Phúc", "Gia", "Thế",
];
const FIRST_M = [
  "An", "Bình", "Cường", "Dũng", "Hùng", "Khoa", "Long", "Nam", "Phong", "Quang",
  "Sơn", "Tùng", "Việt", "Hải", "Kiên", "Thắng", "Đạt", "Phúc", "Lâm", "Khánh",
  "Bảo", "Huy", "Khang", "Phát", "Thịnh", "Trí", "Vinh", "Đông", "Giang", "Hiếu",
  "Khải", "Lộc", "Mạnh", "Nghĩa", "Tài", "Toàn", "Trung", "Duy", "Hào", "Kiệt",
  "Nhân", "Phương", "Thiện", "Đăng", "Bằng", "Chiến", "Danh", "Quân", "Hưng", "Tuấn",
];
const MID_F = ["Thị", "Ngọc", "Thanh", "Kim", "Thu", "Mai", "Bích", "Diệu", "Hồng", "Tuyết"];
const FIRST_F = [
  "Anh", "Hà", "Hương", "Lan", "Linh", "Mai", "Nga", "Trang", "Uyên", "Yến",
  "Chi", "Dung", "Hạnh", "Loan", "My", "Oanh", "Phương", "Quỳnh", "Thảo", "Vy",
];
const EDU = ["12/12", "Cao đẳng", "Đại học", "9/12"];
const JOBS = ["Sinh viên", "Công nhân", "Nông dân", "Tự do", "Nhân viên"];

type Ward = { code: string; name: string };
type Province = { code: string; name: string; wards: Ward[] };

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

/** Tên Việt Nam thường gặp: Họ + Đệm + Tên (cho phép trùng, CCCD vẫn unique). */
function citizenName(seq: number): string {
  return `${pick(LAST, seq)} ${pick(MID_M, seq + 1)} ${pick(FIRST_M, seq + 2)}`;
}

function fatherOf(name: string, i: number): string {
  const surname = name.split(/\s+/)[0] || pick(LAST, i);
  return `${surname} ${pick(MID_M, i + 3)} ${pick(FIRST_M, i + 4)}`;
}

function motherOf(i: number): string {
  return `${pick(LAST, i + 5)} ${pick(MID_F, i + 6)} ${pick(FIRST_F, i + 7)}`;
}

function cccdFor(seq: number): string {
  return String(100000000000 + seq).padStart(12, "0").slice(0, 12);
}

function dobFor(i: number): string {
  const year = 2003 + (i % 5);
  const month = (i % 12) + 1;
  const day = (i % 27) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function provinceToRegion(): Map<string, { code: string; name: string }> {
  const map = new Map<string, { code: string; name: string }>();
  for (const r of REGION_PROVINCES) {
    for (const p of r.provinces) map.set(p, { code: r.code, name: r.name });
  }
  return map;
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

async function clearCitizenData(conn: Connection) {
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  const tables = [
    "exam_participants",
    "exam_rounds",
    "analytics_citizen_features",
    "citizen_residence",
    "citizen_residences",
    "citizen_education",
    "citizen_identities",
    "citizen_family",
    "citizen_health_exams",
    "citizen_nvqs_attachments",
    "citizen_campaigns",
    "citizen_campaign_history",
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

function loadProvinces(): Province[] {
  const provincesPath = path.join(process.cwd(), "src", "data", "provinces.json");
  const raw = JSON.parse(fs.readFileSync(provincesPath, "utf8")) as Array<{
    code: number;
    name: string;
    wards?: Array<{ code: number; name: string }>;
  }>;

  return raw.map((p) => {
    const code = String(p.code);
    return {
      code,
      name: p.name,
      wards: (p.wards || []).map((w) => ({
        code: `${code}-${w.code}`,
        name: w.name,
      })),
    };
  });
}

async function ensureHierarchy(conn: Connection, provinces: Province[]) {
  await conn.query(
    `INSERT INTO hierarchy_units (code, name, level, parent_code, is_active)
     VALUES ('bo', 'Bộ Quốc phòng', 'bo', NULL, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1`,
  );

  for (const r of REGION_PROVINCES) {
    await conn.query(
      `INSERT INTO hierarchy_units (code, name, level, parent_code, is_active, unit_kind)
       VALUES (?, ?, 'donvi', 'bo', 1, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1, unit_kind = VALUES(unit_kind)`,
      [r.code, r.name, r.code === "dv-btl-hn" ? "btl" : "quankhu"],
    );
  }

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

async function seedQuotas(conn: Connection, provinces: Province[]) {
  const regionMap = provinceToRegion();
  const byRegion = new Map<string, { name: string; provinces: Province[] }>();

  for (const p of provinces) {
    const reg = regionMap.get(p.code);
    if (!reg) {
      console.warn(`  ! Tỉnh ${p.code} ${p.name} chưa gắn quân khu — bỏ chỉ tiêu`);
      continue;
    }
    const cur = byRegion.get(reg.code) || { name: reg.name, provinces: [] };
    cur.provinces.push(p);
    byRegion.set(reg.code, cur);
  }

  let qi = 0;
  for (const [regionCode, group] of byRegion) {
    const regionWards = group.provinces.reduce((s, p) => s + p.wards.length, 0);
    const regionAmount = regionWards * MIX.trungtuyen;
    qi += 1;

    await conn.query(
      `INSERT INTO quotas
        (id, campaign_id, year, from_level, from_unit, to_level, to_unit, to_unit_name, amount, filled, note, created_at)
       VALUES (?, ?, 2026, 'bo', 'bo', 'donvi', ?, ?, ?, 0, 'Seed toàn quốc — khớp dự kiến gọi', NOW())`,
      [`q_nat_r${qi}`, CAMPAIGN_ID, regionCode, group.name, regionAmount],
    );

    await conn.query(
      `INSERT INTO receiving_quotas (id, campaign_id, receiving_unit_code, amount, note)
       VALUES (?, ?, ?, ?, 'Đồng bộ từ chỉ tiêu tuyển quân')
       ON DUPLICATE KEY UPDATE amount = VALUES(amount), note = VALUES(note)`,
      [`rq_nat_r${qi}`, CAMPAIGN_ID, regionCode, regionAmount],
    );

    let pi = 0;
    for (const p of group.provinces) {
      pi += 1;
      const tinhAmount = p.wards.length * MIX.trungtuyen;
      await conn.query(
        `INSERT INTO quotas
          (id, campaign_id, year, from_level, from_unit, to_level, to_unit, to_unit_name, amount, filled, note, created_at)
         VALUES (?, ?, 2026, 'donvi', ?, 'tinh', ?, ?, ?, 0, 'Seed QK/BTL → tỉnh', NOW())`,
        [`q_nat_r${qi}_p${pi}`, CAMPAIGN_ID, regionCode, p.code, p.name, tinhAmount],
      );

      let wi = 0;
      for (const w of p.wards) {
        wi += 1;
        await conn.query(
          `INSERT INTO quotas
            (id, campaign_id, year, from_level, from_unit, to_level, to_unit, to_unit_name, amount, filled, note, created_at)
           VALUES (?, ?, 2026, 'tinh', ?, 'xa', ?, ?, ?, 0, 'Seed tỉnh → xã', NOW())`,
          [
            `q_nat_r${qi}_p${pi}_w${wi}`,
            CAMPAIGN_ID,
            p.code,
            w.code,
            w.name,
            MIX.trungtuyen,
          ],
        );
      }
    }
  }
}

async function flushBatch(
  conn: Connection,
  citizenRows: unknown[][],
  eduRows: unknown[][],
  idRows: unknown[][],
  famRows: unknown[][],
  hasEdu: boolean,
  hasId: boolean,
  hasFam: boolean,
) {
  if (!citizenRows.length) return;
  await conn.query(
    `INSERT INTO citizens (
      id, full_name, cccd, date_of_birth, gender, nationality, ethnicity, religion,
      origin_place, permanent_address, current_address, phone, unit_code,
      military_status, military_status_reason, military_status_locked,
      call_intent, approval_status, campaign_id, health_grade, is_blacklisted
    ) VALUES ?`,
    [citizenRows],
  );
  if (hasEdu) {
    await conn.query(
      `INSERT INTO citizen_education (citizen_id, school_name, level, major, graduation_year, gpa) VALUES ?`,
      [eduRows],
    );
  }
  if (hasId) {
    await conn.query(
      `INSERT INTO citizen_identities
        (citizen_id, identification_features, issue_date, expiry_date, old_id_number)
       VALUES ?`,
      [idRows],
    );
  }
  if (hasFam) {
    await conn.query(
      `INSERT INTO citizen_family (citizen_id, rel_name, relationship) VALUES ?`,
      [famRows],
    );
  }
}

export async function main() {
  console.log("Seed hồ sơ: tên Việt Nam thường (Họ Đệm Tên), CCCD unique");

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "quan_ly_nvqs",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    multipleStatements: true,
  });

  try {
    console.log("1) Clear hồ sơ công dân + đợt/chỉ tiêu (giữ quân khu / users)…");
    await clearCitizenData(conn);

    console.log("2) Hierarchy đủ 34 tỉnh / xã…");
    const provinces = loadProvinces();
    if (!provinces.length) throw new Error("Không load được provinces.json");
    await ensureHierarchy(conn, provinces);

    const wardCount = provinces.reduce((s, p) => s + p.wards.length, 0);
    const targetQuota = wardCount * MIX.trungtuyen;
    const expectedCitizens = wardCount * 50;

    console.log(
      `   ${provinces.length} tỉnh · ${wardCount} xã · dự kiến ${expectedCitizens.toLocaleString("vi-VN")} hồ sơ`,
    );

    console.log("3) Campaign camp1 / 2026…");
    await seedCampaign(conn, targetQuota);

    const hasEdu = await tableExists(conn, "citizen_education");
    const hasId = await tableExists(conn, "citizen_identities");
    const hasFam = await tableExists(conn, "citizen_family");

    console.log("4) Seed citizens…");
    let seq = 1;
    const batchSize = 200;
    let citizenRows: unknown[][] = [];
    let eduRows: unknown[][] = [];
    let idRows: unknown[][] = [];
    let famRows: unknown[][] = [];
    let inserted = 0;

    const slots = slotsForWard();

    for (const p of provinces) {
      for (const w of p.wards) {
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const wardNum = w.code.includes("-") ? w.code.split("-").slice(1).join("-") : w.code;
          const id = `cd-${p.code}-${wardNum}-${String(i + 1).padStart(2, "0")}`;
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

          if (citizenRows.length >= batchSize) {
            await flushBatch(conn, citizenRows, eduRows, idRows, famRows, hasEdu, hasId, hasFam);
            inserted += citizenRows.length;
            citizenRows = [];
            eduRows = [];
            idRows = [];
            famRows = [];
            if (inserted % 10000 === 0) {
              console.log(`   … ${inserted.toLocaleString("vi-VN")} / ${expectedCitizens.toLocaleString("vi-VN")}`);
            }
          }
        }
      }
    }

    if (citizenRows.length) {
      await flushBatch(conn, citizenRows, eduRows, idRows, famRows, hasEdu, hasId, hasFam);
      inserted += citizenRows.length;
    }

    console.log("5) Quotas + receiving theo quân khu…");
    await seedQuotas(conn, provinces);

    const [cnt] = await conn.query(`SELECT COUNT(*) AS n FROM citizens`);
    const [distinctNames] = await conn.query(
      `SELECT COUNT(DISTINCT full_name) AS n FROM citizens`,
    );
    const [byIntent] = await conn.query(
      `SELECT call_intent, military_status, COUNT(*) n
       FROM citizens GROUP BY call_intent, military_status ORDER BY n DESC`,
    );
    const [sampleWard] = await conn.query(
      `SELECT unit_code,
              SUM(call_intent = 'du_kien_goi') AS goi,
              SUM(call_intent = 'du_bi') AS dubi,
              SUM(military_status = 'tamhoan') AS hoan,
              SUM(call_intent = 'de_xuat_khong_goi') AS khong
       FROM citizens
       GROUP BY unit_code
       LIMIT 5`,
    );
    const [campaigns] = await conn.query(
      `SELECT id, name, year, target_quota FROM recruitment_campaigns`,
    );

    console.log("\nDone.");
    console.log(`  citizens: ${(cnt as { n: number }[])[0].n}`);
    console.log(`  distinct names: ${(distinctNames as { n: number }[])[0].n}`);
    console.log(`  wards: ${wardCount} (mỗi xã 50 = 15+5+10+20)`);
    console.log(`  campaigns:`, campaigns);
    console.log(`  breakdown:`, byIntent);
    console.log(`  sample wards:`, sampleWard);
  } finally {
    await conn.end();
  }
}

const isDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("seed-citizens-nationwide.ts") ||
    process.argv[1].endsWith("seed-citizens-nationwide.js"));

if (isDirect) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
