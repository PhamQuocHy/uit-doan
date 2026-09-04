import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import type { Citizen } from "@/lib/data";
import { getUnitDescendants } from "@/lib/data";

type CitizenRow = RowDataPacket & {
  id: string;
  full_name: string;
  cccd: string;
  date_of_birth: string | Date;
  gender: "male" | "female";
  nationality: string | null;
  ethnicity: string | null;
  religion: string | null;
  origin_place: string | null;
  permanent_address: string | null;
  current_address: string | null;
  phone: string | null;
  unit_code: string | null;
  military_status: Citizen["militaryStatus"];
  military_status_reason: string | null;
  military_status_locked: number | null;
  call_intent: Citizen["callIntent"] | null;
  approval_status: Citizen["approvalStatus"] | null;
  campaign_id: string | null;
  health_grade: number | null;
  education_level: string | null;
  job: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIso(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  return new Date(s).toISOString();
}

function mapCitizen(row: CitizenRow): Citizen {
  return {
    id: row.id,
    fullName: row.full_name,
    cccd: row.cccd,
    dateOfBirth: toIso(row.date_of_birth).slice(0, 10),
    gender: row.gender === "female" ? "female" : "male",
    nationality: row.nationality || undefined,
    ethnicity: row.ethnicity || undefined,
    religion: row.religion || undefined,
    originPlace: row.origin_place || undefined,
    address: row.permanent_address || row.current_address || "",
    unitCode: row.unit_code || undefined,
    phone: row.phone || "",
    educationLevel: row.education_level || "12/12",
    job: row.job || "",
    healthStatus:
      row.health_grade != null ? `Loại ${row.health_grade}` : undefined,
    militaryStatus: row.military_status,
    militaryStatusReason: row.military_status_reason || undefined,
    militaryStatusLocked: Boolean(row.military_status_locked),
    callIntent: (row.call_intent || "unset") as Citizen["callIntent"],
    approvalStatus: (row.approval_status || "none") as Citizen["approvalStatus"],
    campaignId: row.campaign_id || undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function placeholders(n: number) {
  return Array.from({ length: n }, () => "?").join(",");
}

export async function findCitizensFromDb(query: {
  search?: string;
  militaryStatus?: string;
  callIntent?: string;
  campaignId?: string;
  unitCodes?: string[];
  page?: number;
  limit?: number;
}): Promise<{
  data: Citizen[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} | null> {
  const ok = await pingDb();
  if (!ok) return null;

  const page = query.page || 1;
  const limit = query.limit || 10;
  const offset = (page - 1) * limit;

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (query.unitCodes && query.unitCodes.length > 0) {
    // tránh query quá dài: nếu lọc theo tỉnh (code không có '-'), dùng LIKE
    const onlyTinh =
      query.unitCodes.length > 1 &&
      query.unitCodes.every((c) => c === query.unitCodes![0] || c.startsWith(`${query.unitCodes![0]}-`));

    if (onlyTinh && query.unitCodes[0] && !query.unitCodes[0].includes("-")) {
      const root = query.unitCodes[0];
      where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
      params.push(root, root);
    } else if (query.unitCodes.length <= 500) {
      where.push(`c.unit_code IN (${placeholders(query.unitCodes.length)})`);
      params.push(...query.unitCodes);
    } else {
      const root = query.unitCodes[0]?.split("-")[0] || query.unitCodes[0];
      where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
      params.push(root, root);
    }
  }

  if (query.militaryStatus) {
    where.push("c.military_status = ?");
    params.push(query.militaryStatus);
  }

  if (query.callIntent) {
    where.push("c.call_intent = ?");
    params.push(query.callIntent);
  }
  if (query.campaignId) {
    where.push("c.campaign_id = ?");
    params.push(query.campaignId);
  }

  if (query.search) {
    const s = `%${query.search}%`;
    where.push(
      "(c.full_name LIKE ? OR c.cccd LIKE ? OR c.phone LIKE ? OR c.permanent_address LIKE ? OR c.current_address LIKE ?)",
    );
    params.push(s, s, s, s, s);
  }

  const whereSql = where.join(" AND ");

  try {
    const [countRow] = await queryRows<(RowDataPacket & { cnt: number })[]>(
      `SELECT COUNT(*) AS cnt FROM citizens c WHERE ${whereSql}`,
      params,
    );

    const total = Number(countRow?.cnt || 0);
    const rows = await queryRows<CitizenRow[]>(
      `SELECT
         c.id, c.full_name, c.cccd, c.date_of_birth, c.gender,
         c.nationality, c.ethnicity, c.religion, c.origin_place,
         c.permanent_address, c.current_address, c.phone, c.unit_code,
         c.military_status, c.military_status_reason, c.military_status_locked,
         c.call_intent, c.approval_status,
         c.health_grade, c.campaign_id, c.created_at, c.updated_at,
         edu.level AS education_level,
         edu.major AS job
       FROM citizens c
       LEFT JOIN (
         SELECT e1.citizen_id, e1.level, e1.major
         FROM citizen_education e1
         INNER JOIN (
           SELECT citizen_id, MAX(id) AS max_id
           FROM citizen_education
           GROUP BY citizen_id
         ) latest ON latest.max_id = e1.id
       ) edu ON edu.citizen_id = c.id
       WHERE ${whereSql}
       ORDER BY c.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      data: rows.map(mapCitizen),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  } catch (e) {
    console.error("findCitizensFromDb:", e);
    return null;
  }
}

export async function findCitizenByIdFromDb(id: string): Promise<Citizen | null> {
  const ok = await pingDb();
  if (!ok) return null;
  try {
    const rows = await queryRows<CitizenRow[]>(
      `SELECT
         c.id, c.full_name, c.cccd, c.date_of_birth, c.gender,
         c.nationality, c.ethnicity, c.religion, c.origin_place,
         c.permanent_address, c.current_address, c.phone, c.unit_code,
         c.military_status, c.military_status_reason, c.military_status_locked,
         c.call_intent, c.approval_status,
         c.health_grade, c.campaign_id, c.created_at, c.updated_at,
         edu.level AS education_level,
         edu.major AS job
       FROM citizens c
       LEFT JOIN (
         SELECT e1.citizen_id, e1.level, e1.major
         FROM citizen_education e1
         INNER JOIN (
           SELECT citizen_id, MAX(id) AS max_id
           FROM citizen_education
           GROUP BY citizen_id
         ) latest ON latest.max_id = e1.id
       ) edu ON edu.citizen_id = c.id
       WHERE c.id = ?
       LIMIT 1`,
      [id],
    );
    return rows[0] ? mapCitizen(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function updateCitizenInDb(
  id: string,
  data: Partial<Citizen>,
): Promise<Citizen | null> {
  const ok = await pingDb();
  if (!ok) return null;

  const fields: string[] = [];
  const params: unknown[] = [];

  const map: Record<string, unknown> = {
    full_name: data.fullName,
    cccd: data.cccd,
    date_of_birth: data.dateOfBirth,
    gender: data.gender,
    phone: data.phone,
    permanent_address: data.address,
    current_address: data.address,
    military_status: data.militaryStatus,
    military_status_reason: data.militaryStatusReason,
    call_intent: data.callIntent,
    approval_status: data.approvalStatus,
    campaign_id: data.campaignId || null,
    military_status_locked:
      data.militaryStatusLocked === undefined
        ? undefined
        : data.militaryStatusLocked
          ? 1
          : 0,
    unit_code: data.unitCode,
    health_grade: data.healthStatus?.match(/\d+/)?.[0]
      ? Number(data.healthStatus.match(/\d+/)![0])
      : undefined,
  };

  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      params.push(val);
    }
  }

  if (!fields.length) return findCitizenByIdFromDb(id);

  try {
    await queryExecute(
      `UPDATE citizens SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
      [...params, id],
    );
    return findCitizenByIdFromDb(id);
  } catch (e) {
    console.error("updateCitizenInDb:", e);
    return null;
  }
}

export function scopeUnitCodes(unitCode: string): string[] {
  return getUnitDescendants(unitCode);
}
