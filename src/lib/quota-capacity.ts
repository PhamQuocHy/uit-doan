import { RowDataPacket } from "mysql2";
import { pingDb, queryRows } from "@/lib/db";
import { db, getUnitDescendants } from "@/lib/data";

const ELIGIBLE = ["chuakham", "dangkham", "trungtuyen"] as const;

export type UnitCapacity = {
  unitCode: string;
  totalCitizens: number;
  eligible: number;
  byStatus: Record<string, number>;
};

/** Số hồ sơ đủ điều kiện tuyển (chưa khám / đang khám / đậu) trong đơn vị */
export async function getUnitRecruitmentCapacity(
  unitCode: string,
): Promise<UnitCapacity> {
  const byStatus: Record<string, number> = {};
  let totalCitizens = 0;
  let eligible = 0;

  const dbOk = await pingDb();
  if (dbOk) {
    try {
      const rows = await queryRows<
        (RowDataPacket & { military_status: string; cnt: number })[]
      >(
        `SELECT military_status, COUNT(*) AS cnt
         FROM citizens
         WHERE unit_code = ? OR unit_code LIKE CONCAT(?, '-%')
         GROUP BY military_status`,
        [unitCode, unitCode],
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

  const unitCodes = getUnitDescendants(unitCode);
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
