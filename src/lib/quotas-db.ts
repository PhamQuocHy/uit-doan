import { randomBytes } from "crypto";
import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import type { HierarchyLevel, Quota } from "@/lib/data";
import { hierarchyUnits } from "@/lib/data";

type QuotaRow = RowDataPacket & {
  id: string;
  campaign_id: string | null;
  year: number;
  from_level: string | null;
  from_unit: string;
  to_level: string | null;
  to_unit: string;
  to_unit_name: string | null;
  amount: number;
  filled: number;
  note: string | null;
  created_at: string | Date;
};

let tablesReady: boolean | null = null;

function newId() {
  return `q_${randomBytes(6).toString("hex")}`;
}

function unitName(code: string) {
  if (code === "bo") return "Bộ Quốc phòng";
  return hierarchyUnits.find((u) => u.code === code)?.name || code;
}

function mapRow(r: QuotaRow): Quota {
  return {
    id: r.id,
    campaignId: r.campaign_id || undefined,
    year: Number(r.year),
    fromLevel: (r.from_level || "bo") as HierarchyLevel,
    fromUnit: r.from_unit,
    toLevel: (r.to_level || "tinh") as HierarchyLevel,
    toUnit: r.to_unit,
    toUnitName: r.to_unit_name || unitName(r.to_unit),
    amount: Number(r.amount) || 0,
    filled: Number(r.filled) || 0,
    note: r.note || "",
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  };
}

async function ensureUnit(code: string, name: string, level: string, parentCode: string | null) {
  await queryExecute(
    `INSERT INTO hierarchy_units (code, name, level, parent_code, is_active)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1`,
    [code, name, level, parentCode],
  );
}

export async function ensureQuotasTable(): Promise<boolean> {
  if (tablesReady === true) return true;
  if (!(await pingDb())) {
    tablesReady = false;
    return false;
  }
  try {
    await queryExecute(`
      CREATE TABLE IF NOT EXISTS quotas (
        id VARCHAR(64) NOT NULL,
        campaign_id VARCHAR(64) NULL,
        year INT NOT NULL,
        from_level VARCHAR(16) NULL,
        from_unit VARCHAR(64) NOT NULL,
        to_level VARCHAR(16) NULL,
        to_unit VARCHAR(64) NOT NULL,
        to_unit_name VARCHAR(255) NULL,
        amount INT NOT NULL DEFAULT 0,
        filled INT NOT NULL DEFAULT 0,
        note TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_quota_year (year),
        KEY idx_quota_from (from_unit),
        KEY idx_quota_to (to_unit),
        KEY idx_quota_campaign (campaign_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const cols = await queryRows<(RowDataPacket & { COLUMN_NAME: string })[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotas'`,
    );
    const have = new Set(cols.map((c) => c.COLUMN_NAME));
    const alters: [string, string][] = [
      ["campaign_id", "ADD COLUMN campaign_id VARCHAR(64) NULL AFTER id"],
      ["from_level", "ADD COLUMN from_level VARCHAR(16) NULL AFTER year"],
      ["to_level", "ADD COLUMN to_level VARCHAR(16) NULL AFTER from_unit"],
      ["to_unit_name", "ADD COLUMN to_unit_name VARCHAR(255) NULL AFTER to_unit"],
    ];
    for (const [name, ddl] of alters) {
      if (!have.has(name)) {
        try {
          await queryExecute(`ALTER TABLE quotas ${ddl}`);
        } catch (e) {
          console.warn("ensureQuotasTable alter", name, e);
        }
      }
    }

    await ensureUnit("bo", "Bộ Quốc phòng", "bo", null);
    for (const code of [
      "dv-btl-hn",
      "dv-qk1",
      "dv-qk2",
      "dv-qk3",
      "dv-qk4",
      "dv-qk5",
      "dv-qk7",
      "dv-qk9",
    ]) {
      await ensureUnit(code, unitName(code), "donvi", "bo");
    }

    await queryExecute(`
      CREATE TABLE IF NOT EXISTS quota_tombstones (
        id VARCHAR(64) NOT NULL,
        deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Xóa seed cũ Bộ → tỉnh (mã số tỉnh)
    await queryExecute(
      `DELETE FROM quotas
       WHERE from_unit = 'bo'
         AND (IFNULL(to_level,'') = 'tinh' OR to_unit REGEXP '^[0-9]+$')`,
    );

    const seeds: {
      id: string;
      campaignId: string;
      year: number;
      toUnit: string;
      amount: number;
      note: string;
    }[] = [
      {
        id: "q1",
        campaignId: "camp1",
        year: 2026,
        toUnit: "dv-btl-hn",
        amount: 500,
        note: "Chỉ tiêu theo nghị quyết số 01/2026",
      },
      {
        id: "q2",
        campaignId: "camp1",
        year: 2026,
        toUnit: "dv-qk7",
        amount: 800,
        note: "Chỉ tiêu theo nghị quyết số 01/2026",
      },
      {
        id: "q3",
        campaignId: "camp1",
        year: 2026,
        toUnit: "dv-qk5",
        amount: 200,
        note: "Chỉ tiêu theo nghị quyết số 01/2026",
      },
      {
        id: "q4",
        campaignId: "camp1",
        year: 2026,
        toUnit: "dv-qk9",
        amount: 500,
        note: "Chỉ tiêu theo nghị quyết số 01/2026",
      },
    ];

    const tombstones = await queryRows<(RowDataPacket & { id: string })[]>(
      `SELECT id FROM quota_tombstones`,
    );
    const deleted = new Set(tombstones.map((t) => t.id));

    for (const s of seeds) {
      if (deleted.has(s.id)) continue;
      await queryExecute(
        `INSERT INTO quotas
           (id, campaign_id, year, from_level, from_unit, to_level, to_unit, to_unit_name, amount, filled, note)
         VALUES (?, ?, ?, 'bo', 'bo', 'donvi', ?, ?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [
          s.id,
          s.campaignId,
          s.year,
          s.toUnit,
          unitName(s.toUnit),
          s.amount,
          s.note,
        ],
      );
    }

    tablesReady = true;
    return true;
  } catch (e) {
    console.error("ensureQuotasTable:", e);
    tablesReady = false;
    return false;
  }
}

export async function findQuotasForUnit(
  unitCode: string,
  hierarchyLevel: string,
): Promise<Quota[] | null> {
  if (!(await ensureQuotasTable())) return null;
  const rows =
    hierarchyLevel === "bo"
      ? await queryRows<QuotaRow[]>(
          `SELECT * FROM quotas ORDER BY created_at DESC, id`,
        )
      : await queryRows<QuotaRow[]>(
          `SELECT * FROM quotas
           WHERE from_unit = ? OR to_unit = ?
           ORDER BY created_at DESC, id`,
          [unitCode, unitCode],
        );
  return rows.map(mapRow);
}

export async function findQuotaById(id: string): Promise<Quota | null> {
  if (!(await ensureQuotasTable())) return null;
  const rows = await queryRows<QuotaRow[]>(
    `SELECT * FROM quotas WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findQuotaByCampaignTarget(
  fromUnit: string,
  toUnit: string,
  campaignId: string,
): Promise<Quota | null> {
  if (!(await ensureQuotasTable())) return null;
  const rows = await queryRows<QuotaRow[]>(
    `SELECT * FROM quotas
     WHERE from_unit = ?
       AND to_unit = ?
       AND campaign_id = ?
     LIMIT 1`,
    [fromUnit, toUnit, campaignId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function createQuota(data: Omit<Quota, "id" | "createdAt">): Promise<Quota | null> {
  if (!(await ensureQuotasTable())) return null;
  await ensureUnit(
    data.toUnit,
    data.toUnitName || unitName(data.toUnit),
    data.toLevel,
    data.fromUnit === "bo" ? "bo" : null,
  );
  const id = newId();
  await queryExecute(
    `INSERT INTO quotas
       (id, campaign_id, year, from_level, from_unit, to_level, to_unit, to_unit_name, amount, filled, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      data.campaignId || null,
      data.year,
      data.fromLevel,
      data.fromUnit,
      data.toLevel,
      data.toUnit,
      data.toUnitName,
      data.amount,
      data.note || null,
    ],
  );
  return (await findQuotaById(id)) || null;
}

export async function updateQuota(
  id: string,
  data: { amount: number; note?: string },
): Promise<Quota | null> {
  if (!(await ensureQuotasTable())) return null;
  const result = await queryExecute(
    `UPDATE quotas SET amount = ?, note = ? WHERE id = ?`,
    [data.amount, data.note ?? null, id],
  );
  if (!result.affectedRows) return null;
  return findQuotaById(id);
}

export async function deleteQuota(id: string): Promise<boolean> {
  if (!(await ensureQuotasTable())) return false;
  const result = await queryExecute(`DELETE FROM quotas WHERE id = ?`, [id]);
  if (result.affectedRows > 0) {
    await queryExecute(
      `INSERT INTO quota_tombstones (id) VALUES (?)
       ON DUPLICATE KEY UPDATE deleted_at = CURRENT_TIMESTAMP`,
      [id],
    );
    return true;
  }
  // Không còn trong bảng nhưng vẫn ghi tombstone để seed không hồi sinh
  const existed = await queryRows<(RowDataPacket & { id: string })[]>(
    `SELECT id FROM quota_tombstones WHERE id = ? LIMIT 1`,
    [id],
  );
  if (existed[0]) return true;
  await queryExecute(
    `INSERT INTO quota_tombstones (id) VALUES (?)
     ON DUPLICATE KEY UPDATE deleted_at = CURRENT_TIMESTAMP`,
    [id],
  );
  return true;
}

/** Tổng chỉ tiêu tuyển quân Bộ → một quân khu/BTL (theo đợt) */
export async function sumBoRecruitmentQuotaToUnit(
  toUnit: string,
  campaignId?: string | null,
): Promise<number | null> {
  if (!(await ensureQuotasTable())) return null;
  const where = ["from_unit = 'bo'", "to_unit = ?"];
  const params: unknown[] = [toUnit];
  if (campaignId) {
    where.push("(campaign_id = ? OR campaign_id IS NULL)");
    params.push(campaignId);
  }
  const [row] = await queryRows<(RowDataPacket & { n: number })[]>(
    `SELECT COALESCE(SUM(amount), 0) AS n FROM quotas WHERE ${where.join(" AND ")}`,
    params,
  );
  return Number(row?.n || 0);
}

/** Danh sách chỉ tiêu Bộ → QK/BTL theo đợt (gom theo to_unit) */
export async function listBoRecruitmentByRegion(
  campaignId: string,
): Promise<{ toUnit: string; toUnitName: string; amount: number }[]> {
  if (!(await ensureQuotasTable())) return [];
  const rows = await queryRows<
    (RowDataPacket & { to_unit: string; to_unit_name: string | null; amount: number })[]
  >(
    `SELECT to_unit, MAX(to_unit_name) AS to_unit_name, SUM(amount) AS amount
     FROM quotas
     WHERE from_unit = 'bo'
       AND (campaign_id = ? OR campaign_id IS NULL)
     GROUP BY to_unit
     ORDER BY to_unit`,
    [campaignId],
  );
  return rows.map((r) => ({
    toUnit: r.to_unit,
    toUnitName: r.to_unit_name || unitName(r.to_unit),
    amount: Number(r.amount) || 0,
  }));
}
