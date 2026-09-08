import { RowDataPacket } from "mysql2";
import { pingDb, queryRows } from "@/lib/db";
import { db, getUnitDescendants } from "@/lib/data";
import {
  getProvincesForMilitaryRegion,
  isQuanKhuOrBtl,
} from "@/lib/military-regions";

const ELIGIBLE = ["chuakham", "dangkham", "trungtuyen"] as const;

export type UnitCapacity = {
  unitCode: string;
  totalCitizens: number;
  eligible: number;
  byStatus: Record<string, number>;
};

/** Phạm vi unit_code: tỉnh/xã, hoặc toàn địa bàn quân khu */
function localityScopeSql(unitCode: string): { sql: string; params: string[] } {
  if (isQuanKhuOrBtl(unitCode)) {
    const provinces = getProvincesForMilitaryRegion(unitCode);
    if (provinces.length === 0) return { sql: "1=0", params: [] };
    const parts = provinces.map(
      () => "(unit_code = ? OR unit_code LIKE CONCAT(?, '-%'))",
    );
    const params: string[] = [];
    for (const p of provinces) params.push(p, p);
    return { sql: `(${parts.join(" OR ")})`, params };
  }
  return {
    sql: "(unit_code = ? OR unit_code LIKE CONCAT(?, '-%'))",
    params: [unitCode, unitCode],
  };
}

function localityUnitCodes(unitCode: string): string[] {
  if (isQuanKhuOrBtl(unitCode)) {
    const codes = new Set<string>();
    for (const p of getProvincesForMilitaryRegion(unitCode)) {
      for (const c of getUnitDescendants(p)) codes.add(c);
    }
    return [...codes];
  }
  return getUnitDescendants(unitCode);
}

/** Số hồ sơ đủ điều kiện tuyển (chưa khám / đang khám / đậu) trong đơn vị */
export async function getUnitRecruitmentCapacity(
  unitCode: string,
): Promise<UnitCapacity> {
  const byStatus: Record<string, number> = {};
  let totalCitizens = 0;
  let eligible = 0;
  const scope = localityScopeSql(unitCode);

  const dbOk = await pingDb();
  if (dbOk) {
    try {
      const rows = await queryRows<
        (RowDataPacket & { military_status: string; cnt: number })[]
      >(
        `SELECT military_status, COUNT(*) AS cnt
         FROM citizens
         WHERE ${scope.sql}
         GROUP BY military_status`,
        scope.params,
      );

      for (const r of rows) {
        const n = Number(r.cnt);
        byStatus[r.military_status] = n;
        totalCitizens += n;
        if ((ELIGIBLE as readonly string[]).includes(r.military_status)) {
          eligible += n;
        }
      }

      return { unitCode, totalCitizens, eligible, byStatus };
    } catch (e) {
      console.error("getUnitRecruitmentCapacity mysql:", e);
    }
  }

  const unitCodes = localityUnitCodes(unitCode);
  const list = db.citizens.findAll({ limit: 100000, unitCodes }).data;
  totalCitizens = list.length;
  for (const c of list) {
    byStatus[c.militaryStatus] = (byStatus[c.militaryStatus] || 0) + 1;
    if ((ELIGIBLE as readonly string[]).includes(c.militaryStatus)) {
      eligible += 1;
    }
  }

  return { unitCode, totalCitizens, eligible, byStatus };
}

/**
 * Tiến độ chỉ tiêu tuyển quân:
 * - Tỉnh/xã: hồ sơ đã duyệt gọi / nhập ngũ trong đơn vị
 * - Quân khu: tổng hồ sơ đã duyệt gọi từ các tỉnh/xã thuộc địa bàn
 */
export async function getUnitEnlistedCount(
  unitCode: string,
  campaignId?: string | null,
): Promise<number> {
  const scope = localityScopeSql(unitCode);
  const dbOk = await pingDb();
  if (dbOk) {
    try {
      const where = [
        scope.sql,
        `(approval_status = 'approved' OR military_status = 'nhapngu')`,
        "archived_at IS NULL",
      ];
      const params: unknown[] = [...scope.params];
      if (campaignId) {
        // Đếm cả hồ sơ đợt này và hồ sơ đã duyệt chưa gắn đợt (seed cũ)
        where.push("(campaign_id = ? OR campaign_id IS NULL)");
        params.push(campaignId);
      }
      const [row] = await queryRows<(RowDataPacket & { cnt: number })[]>(
        `SELECT COUNT(*) AS cnt FROM citizens WHERE ${where.join(" AND ")}`,
        params,
      );
      return Number(row?.cnt || 0);
    } catch (e) {
      console.error("getUnitEnlistedCount mysql:", e);
    }
  }

  const unitCodes = localityUnitCodes(unitCode);
  return db.citizens
    .findAll({ limit: 100000, unitCodes })
    .data.filter((c) => {
      if (campaignId && c.campaignId && c.campaignId !== campaignId) return false;
      return (
        c.approvalStatus === "approved" || c.militaryStatus === "nhapngu"
      );
    }).length;
}
