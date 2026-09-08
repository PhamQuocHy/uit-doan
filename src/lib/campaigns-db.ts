import { randomBytes } from "crypto";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import type { RecruitmentCampaign } from "@/lib/data";
import { toDateOnlyString } from "@/lib/date-vn";

type CampaignRow = RowDataPacket & {
  id: string;
  name: string;
  year: number;
  start_date: string | Date;
  end_date: string | Date;
  status: "planning" | "ongoing" | "completed";
  target_quota: number;
  registered_count?: number | string | null;
  passed_count?: number | string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function newCampaignId(): string {
  return `camp_${randomBytes(6).toString("hex")}`;
}

function toIso(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d/.test(s)) {
    return new Date(s.includes("T") ? s : s.replace(" ", "T")).toISOString();
  }
  return new Date(s).toISOString();
}

function mapCampaign(row: CampaignRow): RecruitmentCampaign {
  return {
    id: row.id,
    name: row.name,
    year: Number(row.year),
    startDate: toDateOnlyString(row.start_date) || "",
    endDate: toDateOnlyString(row.end_date) || "",
    status: row.status,
    targetQuota: Number(row.target_quota) || 0,
    registeredCount: Number(row.registered_count) || 0,
    passedCount: Number(row.passed_count) || 0,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const STATS_SELECT = `
  c.id, c.name, c.year, c.start_date, c.end_date, c.status, c.target_quota,
  c.created_at, c.updated_at,
  (SELECT COUNT(*) FROM citizens ci WHERE ci.campaign_id = c.id) AS registered_count,
  (SELECT COUNT(*) FROM citizens ci
     WHERE ci.campaign_id = c.id
       AND ci.health_grade IS NOT NULL
       AND ci.health_grade BETWEEN 1 AND 3) AS passed_count
`;

export async function findCampaignsFromDb(query?: {
  status?: string;
  year?: number;
  page?: number;
  limit?: number;
}): Promise<{
  data: RecruitmentCampaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} | null> {
  if (!(await pingDb())) return null;

  try {
    const where: string[] = [];
    const params: unknown[] = [];
    if (query?.status) {
      where.push("c.status = ?");
      params.push(query.status);
    }
    if (query?.year) {
      where.push("c.year = ?");
      params.push(query.year);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRows = await queryRows<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM recruitment_campaigns c ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, Math.min(200, query?.limit || 10));
    const offset = (page - 1) * limit;

    const rows = await queryRows<CampaignRow[]>(
      `SELECT ${STATS_SELECT}
       FROM recruitment_campaigns c
       ${whereSql}
       ORDER BY c.year DESC, c.start_date DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      data: rows.map(mapCampaign),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  } catch (e) {
    console.error("findCampaignsFromDb:", e);
    return null;
  }
}

export async function findCampaignByIdFromDb(
  id: string,
): Promise<RecruitmentCampaign | null> {
  if (!(await pingDb())) return null;
  try {
    const rows = await queryRows<CampaignRow[]>(
      `SELECT ${STATS_SELECT}
       FROM recruitment_campaigns c
       WHERE c.id = ?
       LIMIT 1`,
      [id],
    );
    return rows[0] ? mapCampaign(rows[0]) : null;
  } catch (e) {
    console.error("findCampaignByIdFromDb:", e);
    return null;
  }
}

export async function createCampaignInDb(data: {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  status?: RecruitmentCampaign["status"];
  targetQuota: number;
}): Promise<RecruitmentCampaign | null> {
  if (!(await pingDb())) return null;
  try {
    const id = newCampaignId();
    const status = data.status || "planning";
    await queryExecute(
      `INSERT INTO recruitment_campaigns
        (id, name, year, start_date, end_date, status, target_quota)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.year,
        data.startDate.slice(0, 10),
        data.endDate.slice(0, 10),
        status,
        data.targetQuota,
      ],
    );
    return (
      (await findCampaignByIdFromDb(id)) || {
        id,
        name: data.name,
        year: data.year,
        startDate: data.startDate.slice(0, 10),
        endDate: data.endDate.slice(0, 10),
        status,
        targetQuota: data.targetQuota,
        registeredCount: 0,
        passedCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  } catch (e) {
    console.error("createCampaignInDb:", e);
    return null;
  }
}

export async function updateCampaignInDb(
  id: string,
  data: Partial<{
    name: string;
    year: number;
    startDate: string;
    endDate: string;
    status: RecruitmentCampaign["status"];
    targetQuota: number;
  }>,
): Promise<RecruitmentCampaign | null> {
  if (!(await pingDb())) return null;
  try {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (data.name !== undefined) {
      fields.push("name = ?");
      params.push(data.name);
    }
    if (data.year !== undefined) {
      fields.push("year = ?");
      params.push(data.year);
    }
    if (data.startDate !== undefined) {
      fields.push("start_date = ?");
      params.push(data.startDate.slice(0, 10));
    }
    if (data.endDate !== undefined) {
      fields.push("end_date = ?");
      params.push(data.endDate.slice(0, 10));
    }
    if (data.status !== undefined) {
      fields.push("status = ?");
      params.push(data.status);
    }
    if (data.targetQuota !== undefined) {
      fields.push("target_quota = ?");
      params.push(data.targetQuota);
    }
    if (!fields.length) return findCampaignByIdFromDb(id);

    params.push(id);
    const result = await queryExecute(
      `UPDATE recruitment_campaigns SET ${fields.join(", ")} WHERE id = ?`,
      params,
    );
    if ((result as ResultSetHeader).affectedRows === 0) {
      const existing = await findCampaignByIdFromDb(id);
      return existing;
    }
    return findCampaignByIdFromDb(id);
  } catch (e) {
    console.error("updateCampaignInDb:", e);
    return null;
  }
}
