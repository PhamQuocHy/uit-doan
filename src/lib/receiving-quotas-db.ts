import { randomBytes } from "crypto";
import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import { hierarchyUnits } from "@/lib/data";
import {
  getProvincesForMilitaryRegion,
  getMilitaryRegionForProvince,
  getAssignableReceivingUnits,
  isQuanKhuOrBtl,
} from "@/lib/military-regions";

export type ReceivingQuota = {
  id: string;
  campaignId: string;
  campaignName?: string;
  campaignYear?: number;
  receivingUnitCode: string;
  receivingUnitName: string;
  amount: number;
  filled: number;
  note: string | null;
  provinces: { code: string; name: string }[];
  createdAt: string;
  updatedAt: string;
};

function newId() {
  return `rq_${randomBytes(6).toString("hex")}`;
}

function unitName(code: string) {
  return hierarchyUnits.find((u) => u.code === code)?.name || code;
}

let tablesReady: boolean | null = null;

export async function ensureReceivingQuotaTables(): Promise<boolean> {
  if (tablesReady === true) return true;
  if (!(await pingDb())) {
    tablesReady = false;
    return false;
  }
  try {
    await queryExecute(`
      CREATE TABLE IF NOT EXISTS receiving_quotas (
        id VARCHAR(64) NOT NULL,
        campaign_id VARCHAR(64) NOT NULL,
        receiving_unit_code VARCHAR(64) NOT NULL,
        amount INT NOT NULL DEFAULT 0,
        note VARCHAR(500) NULL DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_receiving_quota_camp_unit (campaign_id, receiving_unit_code),
        KEY idx_receiving_quota_unit (receiving_unit_code),
        KEY idx_receiving_quota_campaign (campaign_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryExecute(`
      CREATE TABLE IF NOT EXISTS receiving_quota_provinces (
        id BIGINT NOT NULL AUTO_INCREMENT,
        receiving_quota_id VARCHAR(64) NOT NULL,
        province_code VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_rqp_quota_province (receiving_quota_id, province_code),
        KEY idx_rqp_province (province_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryExecute(`
      CREATE TABLE IF NOT EXISTS receiving_sub_quotas (
        id VARCHAR(64) NOT NULL,
        campaign_id VARCHAR(64) NOT NULL,
        from_unit VARCHAR(64) NOT NULL,
        to_unit VARCHAR(64) NOT NULL,
        amount INT NOT NULL DEFAULT 0,
        note VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_rsq_camp_from_to (campaign_id, from_unit, to_unit),
        KEY idx_rsq_to (to_unit)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    tablesReady = true;
    return true;
  } catch (e) {
    console.error("ensureReceivingQuotaTables:", e);
    tablesReady = false;
    return false;
  }
}

/** Mã tỉnh từ unit_code công dân / session (92 hoặc 92-31756 → 92) */
export function resolveProvinceCode(unitCode: string | null | undefined): string | null {
  if (!unitCode) return null;
  if (unitCode === "bo") return null;
  const unit = hierarchyUnits.find((u) => u.code === unitCode);
  if (unit?.level === "tinh") return unit.code;
  if (unit?.level === "xa" || unit?.level === "huyen") {
    return unit.parentCode || unitCode.split("-")[0] || null;
  }
  if (/^\d+/.test(unitCode)) {
    return unitCode.split("-")[0] || null;
  }
  return null;
}

async function filledFor(
  campaignId: string,
  receivingUnitCode: string,
): Promise<number> {
  const rows = await queryRows<(RowDataPacket & { n: number })[]>(
    `SELECT COUNT(*) AS n FROM citizens
     WHERE campaign_id = ?
       AND receiving_unit_code = ?
       AND military_status = 'nhapngu'
       AND archived_at IS NULL
       AND receiving_status IN ('da_phan_quan','submitted_to_bo','bo_approved','published','unit_confirmed')`,
    [campaignId, receivingUnitCode],
  );
  return Number(rows[0]?.n || 0);
}

async function loadProvinces(
  quotaIds: string[],
): Promise<Map<string, { code: string; name: string }[]>> {
  const map = new Map<string, { code: string; name: string }[]>();
  if (quotaIds.length === 0) return map;
  const ph = quotaIds.map(() => "?").join(",");
  const rows = await queryRows<
    (RowDataPacket & { receiving_quota_id: string; province_code: string })[]
  >(
    `SELECT receiving_quota_id, province_code
     FROM receiving_quota_provinces
     WHERE receiving_quota_id IN (${ph})`,
    quotaIds,
  );
  for (const r of rows) {
    const list = map.get(r.receiving_quota_id) || [];
    list.push({
      code: r.province_code,
      name: unitName(r.province_code),
    });
    map.set(r.receiving_quota_id, list);
  }
  for (const [k, list] of map) {
    list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    map.set(k, list);
  }
  return map;
}

type QuotaRow = RowDataPacket & {
  id: string;
  campaign_id: string;
  receiving_unit_code: string;
  amount: number;
  note: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  campaign_name?: string | null;
  campaign_year?: number | null;
};

async function mapQuotas(rows: QuotaRow[]): Promise<ReceivingQuota[]> {
  const out: ReceivingQuota[] = [];
  for (const r of rows) {
    const regionProvinces = getProvincesForMilitaryRegion(r.receiving_unit_code);
    out.push({
      id: r.id,
      campaignId: r.campaign_id,
      campaignName: r.campaign_name || undefined,
      campaignYear: r.campaign_year != null ? Number(r.campaign_year) : undefined,
      receivingUnitCode: r.receiving_unit_code,
      receivingUnitName: unitName(r.receiving_unit_code),
      amount: Number(r.amount) || 0,
      filled: await filledForRegion(r.campaign_id, r.receiving_unit_code),
      note: r.note,
      provinces: regionProvinces.map((code) => ({
        code,
        name: unitName(code),
      })),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    });
  }
  return out;
}

/** Số đã phân trong địa bàn quân khu (theo đợt) */
async function filledForRegion(campaignId: string, regionCode: string): Promise<number> {
  const provinces = getProvincesForMilitaryRegion(regionCode);
  if (!provinces.length) return filledFor(campaignId, regionCode);
  const parts = provinces.map(() => "(unit_code = ? OR unit_code LIKE CONCAT(?, '-%'))");
  const params: unknown[] = [campaignId];
  for (const p of provinces) params.push(p, p);
  const rows = await queryRows<(RowDataPacket & { n: number })[]>(
    `SELECT COUNT(*) AS n FROM citizens
     WHERE campaign_id = ?
       AND military_status = 'nhapngu'
       AND archived_at IS NULL
       AND receiving_status IN ('da_phan_quan','submitted_to_bo','bo_approved','published','unit_confirmed')
       AND (${parts.join(" OR ")})`,
    params,
  );
  return Number(rows[0]?.n || 0);
}

export async function findReceivingQuotas(filters: {
  campaignId?: string;
  receivingUnitCode?: string;
  provinceCode?: string;
}): Promise<ReceivingQuota[] | null> {
  if (!(await ensureReceivingQuotaTables())) return null;

  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filters.campaignId) {
    where.push("q.campaign_id = ?");
    params.push(filters.campaignId);
  }
  if (filters.receivingUnitCode) {
    where.push("q.receiving_unit_code = ?");
    params.push(filters.receivingUnitCode);
  }
  if (filters.provinceCode) {
    const region = getMilitaryRegionForProvince(filters.provinceCode);
    if (region) {
      where.push("q.receiving_unit_code = ?");
      params.push(region);
    } else {
      where.push("1=0");
    }
  }

  const rows = await queryRows<QuotaRow[]>(
    `SELECT q.*, c.name AS campaign_name, c.year AS campaign_year
     FROM receiving_quotas q
     LEFT JOIN recruitment_campaigns c ON c.id = q.campaign_id
     WHERE ${where.join(" AND ")}
     ORDER BY c.year DESC, q.updated_at DESC`,
    params,
  );
  return mapQuotas(rows);
}

export async function upsertReceivingQuota(input: {
  campaignId: string;
  receivingUnitCode: string;
  amount: number;
  note?: string | null;
}): Promise<ReceivingQuota | null> {
  if (!(await ensureReceivingQuotaTables())) return null;
  const existing = await queryRows<(RowDataPacket & { id: string })[]>(
    `SELECT id FROM receiving_quotas
     WHERE campaign_id = ? AND receiving_unit_code = ?
     LIMIT 1`,
    [input.campaignId, input.receivingUnitCode],
  );
  if (existing[0]?.id) {
    await queryExecute(
      `UPDATE receiving_quotas
       SET amount = ?, note = ?, updated_at = NOW()
       WHERE id = ?`,
      [input.amount, input.note || null, existing[0].id],
    );
    const list = await findReceivingQuotas({ campaignId: input.campaignId });
    return list?.find((q) => q.id === existing[0].id) || null;
  }
  const id = newId();
  await queryExecute(
    `INSERT INTO receiving_quotas (id, campaign_id, receiving_unit_code, amount, note)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      input.campaignId,
      input.receivingUnitCode,
      input.amount,
      input.note || null,
    ],
  );
  const list = await findReceivingQuotas({ campaignId: input.campaignId });
  return list?.find((q) => q.id === id) || null;
}

export async function setReceivingQuotaProvinces(
  quotaId: string,
  provinceCodes: string[],
): Promise<ReceivingQuota | null> {
  if (!(await ensureReceivingQuotaTables())) return null;
  const rows = await queryRows<(RowDataPacket & { id: string; receiving_unit_code: string; campaign_id: string })[]>(
    `SELECT id, receiving_unit_code, campaign_id FROM receiving_quotas WHERE id = ? LIMIT 1`,
    [quotaId],
  );
  if (!rows[0]) return null;

  const valid = new Set(
    hierarchyUnits.filter((u) => u.level === "tinh").map((u) => u.code),
  );
  const codes = [...new Set(provinceCodes.filter((c) => valid.has(c)))];

  await queryExecute(
    `DELETE FROM receiving_quota_provinces WHERE receiving_quota_id = ?`,
    [quotaId],
  );
  for (const code of codes) {
    await queryExecute(
      `INSERT INTO receiving_quota_provinces (receiving_quota_id, province_code)
       VALUES (?, ?)`,
      [quotaId, code],
    );
  }
  await queryExecute(
    `UPDATE receiving_quotas SET updated_at = NOW() WHERE id = ?`,
    [quotaId],
  );
  const list = await findReceivingQuotas({
    campaignId: rows[0].campaign_id,
    receivingUnitCode: rows[0].receiving_unit_code,
  });
  return list?.[0] || null;
}

export async function deleteReceivingQuota(id: string): Promise<boolean> {
  if (!(await ensureReceivingQuotaTables())) return false;
  const result = await queryExecute(`DELETE FROM receiving_quotas WHERE id = ?`, [
    id,
  ]);
  return result.affectedRows > 0;
}

export async function deleteReceivingQuotaByCampaignUnit(
  campaignId: string,
  receivingUnitCode: string,
): Promise<boolean> {
  if (!(await ensureReceivingQuotaTables())) return false;
  const result = await queryExecute(
    `DELETE FROM receiving_quotas
     WHERE campaign_id = ? AND receiving_unit_code = ?`,
    [campaignId, receivingUnitCode],
  );
  return result.affectedRows > 0;
}

/**
 * Đồng bộ chỉ tiêu nhận quân Bộ→QK với chỉ tiêu tuyển quân Bộ→QK (cùng đợt).
 * Nguồn sự thật = quotas (tuyển quân).
 */
export async function syncReceivingQuotasFromRecruitment(
  campaignId: string,
): Promise<{
  synced: { code: string; name: string; amount: number }[];
  removed: string[];
} | null> {
  if (!(await ensureReceivingQuotaTables())) return null;
  const { listBoRecruitmentByRegion } = await import("@/lib/quotas-db");
  const { isQuanKhuOrBtl } = await import("@/lib/military-regions");

  const recruitment = (await listBoRecruitmentByRegion(campaignId)).filter(
    (q) => isQuanKhuOrBtl(q.toUnit) && q.amount > 0,
  );
  const keep = new Set(recruitment.map((q) => q.toUnit));
  const synced: { code: string; name: string; amount: number }[] = [];

  for (const q of recruitment) {
    const row = await upsertReceivingQuota({
      campaignId,
      receivingUnitCode: q.toUnit,
      amount: q.amount,
      note: "Đồng bộ từ chỉ tiêu tuyển quân",
    });
    if (row) {
      synced.push({
        code: row.receivingUnitCode,
        name: row.receivingUnitName,
        amount: row.amount,
      });
    }
  }

  const existing = (await findReceivingQuotas({ campaignId })) || [];
  const removed: string[] = [];
  for (const r of existing) {
    if (!keep.has(r.receivingUnitCode)) {
      await deleteReceivingQuota(r.id);
      removed.push(r.receivingUnitCode);
    }
  }

  return { synced, removed };
}

/** Đồng bộ một quân khu sau khi Bộ giao/sửa chỉ tiêu tuyển quân */
export async function syncOneReceivingFromRecruitment(
  campaignId: string,
  regionCode: string,
): Promise<ReceivingQuota | null> {
  if (!(await ensureReceivingQuotaTables())) return null;
  const { sumBoRecruitmentQuotaToUnit } = await import("@/lib/quotas-db");
  const amount = await sumBoRecruitmentQuotaToUnit(regionCode, campaignId);
  if (amount == null) return null;
  if (amount <= 0) {
    await deleteReceivingQuotaByCampaignUnit(campaignId, regionCode);
    return null;
  }
  return upsertReceivingQuota({
    campaignId,
    receivingUnitCode: regionCode,
    amount,
    note: "Đồng bộ từ chỉ tiêu tuyển quân",
  });
}

export type SubQuota = {
  id: string;
  campaignId: string;
  fromUnit: string;
  fromUnitName: string;
  toUnit: string;
  toUnitName: string;
  amount: number;
  note: string | null;
};

export async function findSubQuotas(filters: {
  campaignId?: string;
  fromUnit?: string;
  toUnit?: string;
}): Promise<SubQuota[]> {
  if (!(await ensureReceivingQuotaTables())) return [];
  const where = ["1=1"];
  const params: unknown[] = [];
  if (filters.campaignId) {
    where.push("campaign_id = ?");
    params.push(filters.campaignId);
  }
  if (filters.fromUnit) {
    where.push("from_unit = ?");
    params.push(filters.fromUnit);
  }
  if (filters.toUnit) {
    where.push("to_unit = ?");
    params.push(filters.toUnit);
  }
  const rows = await queryRows<
    (RowDataPacket & {
      id: string;
      campaign_id: string;
      from_unit: string;
      to_unit: string;
      amount: number;
      note: string | null;
    })[]
  >(
    `SELECT * FROM receiving_sub_quotas WHERE ${where.join(" AND ")} ORDER BY to_unit`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    fromUnit: r.from_unit,
    fromUnitName: unitName(r.from_unit),
    toUnit: r.to_unit,
    toUnitName: unitName(r.to_unit),
    amount: Number(r.amount) || 0,
    note: r.note,
  }));
}

export async function findSubQuotasWithFilled(filters: {
  campaignId?: string;
  fromUnit?: string;
  toUnit?: string;
}): Promise<(SubQuota & { filled: number })[]> {
  const list = await findSubQuotas(filters);
  return Promise.all(
    list.map(async (row) => ({
      ...row,
      filled: filters.campaignId
        ? await filledFor(filters.campaignId, row.toUnit)
        : 0,
    })),
  );
}

/** Quân khu giao chỉ tiêu nhận quân xuống sư đoàn / trung đoàn / quân đoàn thuộc mình */
export async function upsertSubQuota(input: {
  campaignId: string;
  fromUnit: string;
  toUnit: string;
  amount: number;
  note?: string | null;
}): Promise<(SubQuota & { filled?: number }) | null> {
  if (!(await ensureReceivingQuotaTables())) return null;
  if (!isQuanKhuOrBtl(input.fromUnit)) return null;

  const allowed = getAssignableReceivingUnits(input.fromUnit);
  if (!allowed.some((u) => u.code === input.toUnit)) return null;

  const existing = await queryRows<(RowDataPacket & { id: string })[]>(
    `SELECT id FROM receiving_sub_quotas
     WHERE campaign_id = ? AND from_unit = ? AND to_unit = ? LIMIT 1`,
    [input.campaignId, input.fromUnit, input.toUnit],
  );
  if (existing[0]?.id) {
    await queryExecute(
      `UPDATE receiving_sub_quotas SET amount = ?, note = ?, updated_at = NOW() WHERE id = ?`,
      [input.amount, input.note || null, existing[0].id],
    );
  } else {
    const id = `rsq_${randomBytes(6).toString("hex")}`;
    await queryExecute(
      `INSERT INTO receiving_sub_quotas (id, campaign_id, from_unit, to_unit, amount, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.campaignId,
        input.fromUnit,
        input.toUnit,
        input.amount,
        input.note || null,
      ],
    );
  }
  const list = await findSubQuotas({
    campaignId: input.campaignId,
    fromUnit: input.fromUnit,
    toUnit: input.toUnit,
  });
  const row = list[0];
  if (!row) return null;
  return {
    ...row,
    filled: await filledFor(input.campaignId, input.toUnit),
  };
}

/** Đơn vị nhận mà tỉnh được phép phân quân trong đợt — không còn dùng; QK phân quân */
export async function allowedReceivingUnitsForProvince(
  campaignId: string,
  provinceCode: string,
): Promise<{ code: string; name: string; amount: number; filled: number }[]> {
  const region = getMilitaryRegionForProvince(provinceCode);
  if (!region) return [];
  const list = await findReceivingQuotas({ campaignId, receivingUnitCode: region });
  if (!list?.length) return [];
  return list.map((q) => ({
    code: q.receivingUnitCode,
    name: q.receivingUnitName,
    amount: q.amount,
    filled: q.filled,
  }));
}
