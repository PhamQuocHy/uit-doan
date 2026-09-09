import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { pingDb, queryExecute, queryRows } from "@/lib/db";
import type { Citizen } from "@/lib/data";

export type CitizenCampaignSource =
  | "manual"
  | "ai_sample"
  | "backfill"
  | "carry_over";

export type CitizenCampaignRow = {
  id: number;
  citizenId: string;
  campaignId: string;
  campaignName?: string | null;
  campaignYear?: number | null;
  callIntent: string | null;
  approvalStatus: string | null;
  militaryStatus: string | null;
  militaryStatusReason: string | null;
  pipelineStatus: string | null;
  source: CitizenCampaignSource;
  note: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};

type CcDbRow = RowDataPacket & {
  id: number;
  citizen_id: string;
  campaign_id: string;
  campaign_name?: string | null;
  campaign_year?: number | null;
  call_intent: string | null;
  approval_status: string | null;
  military_status: string | null;
  military_status_reason: string | null;
  pipeline_status: string | null;
  source: CitizenCampaignSource;
  note: string | null;
  is_current: number;
  created_at: string | Date;
  updated_at: string | Date;
};

let tableReady: boolean | null = null;

function toIso(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  return new Date(String(d).replace(" ", "T")).toISOString();
}

function mapRow(r: CcDbRow): CitizenCampaignRow {
  return {
    id: Number(r.id),
    citizenId: r.citizen_id,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name || null,
    campaignYear:
      r.campaign_year != null ? Number(r.campaign_year) : null,
    callIntent: r.call_intent,
    approvalStatus: r.approval_status,
    militaryStatus: r.military_status,
    militaryStatusReason: r.military_status_reason,
    pipelineStatus: r.pipeline_status,
    source: r.source || "manual",
    note: r.note,
    isCurrent: Boolean(r.is_current),
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

/** Tạo bảng + backfill idempotent (dev không cần chạy migration tay). */
export async function ensureCitizenCampaignsTable(): Promise<boolean> {
  if (tableReady === true) return true;
  if (!(await pingDb())) {
    tableReady = false;
    return false;
  }
  try {
    await queryExecute(`
      CREATE TABLE IF NOT EXISTS citizen_campaigns (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        citizen_id VARCHAR(64) NOT NULL,
        campaign_id VARCHAR(64) NOT NULL,
        call_intent VARCHAR(32) NULL,
        approval_status VARCHAR(32) NULL DEFAULT 'none',
        military_status VARCHAR(32) NULL,
        military_status_reason VARCHAR(500) NULL,
        pipeline_status VARCHAR(32) NULL DEFAULT 'none',
        source ENUM('manual','ai_sample','backfill','carry_over') NOT NULL DEFAULT 'manual',
        note VARCHAR(500) NULL,
        is_current TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_citizen_campaign (citizen_id, campaign_id),
        KEY idx_cc_campaign (campaign_id),
        KEY idx_cc_citizen (citizen_id),
        KEY idx_cc_current (citizen_id, is_current)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryExecute(`
      INSERT INTO citizen_campaigns (
        citizen_id, campaign_id, call_intent, approval_status, military_status,
        military_status_reason, pipeline_status, source, note, is_current
      )
      SELECT
        c.id,
        c.campaign_id,
        c.call_intent,
        c.approval_status,
        c.military_status,
        LEFT(IFNULL(c.military_status_reason, ''), 500),
        IFNULL(c.pipeline_status, 'none'),
        'backfill',
        'Đồng bộ từ campaign_id lúc nâng cấp lịch sử đợt',
        1
      FROM citizens c
      WHERE c.campaign_id IS NOT NULL
        AND TRIM(c.campaign_id) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM citizen_campaigns cc
          WHERE cc.citizen_id = c.id AND cc.campaign_id = c.campaign_id
        )
    `);

    tableReady = true;
    return true;
  } catch (e) {
    console.error("ensureCitizenCampaignsTable:", e);
    tableReady = false;
    return false;
  }
}

export async function listCitizenCampaignHistory(
  citizenId: string,
): Promise<CitizenCampaignRow[]> {
  if (!(await ensureCitizenCampaignsTable())) return [];
  try {
    const rows = await queryRows<CcDbRow[]>(
      `SELECT
         cc.*,
         rc.name AS campaign_name,
         rc.year AS campaign_year
       FROM citizen_campaigns cc
       LEFT JOIN recruitment_campaigns rc ON rc.id = cc.campaign_id
       WHERE cc.citizen_id = ?
       ORDER BY IFNULL(rc.year, 0) DESC, cc.updated_at DESC, cc.id DESC`,
      [citizenId],
    );
    return rows.map(mapRow);
  } catch (e) {
    console.error("listCitizenCampaignHistory:", e);
    return [];
  }
}

/**
 * Snapshot trạng thái hiện tại vào lịch sử đợt cũ (không xóa),
 * rồi gắn / cập nhật đợt mới và đánh dấu is_current.
 */
export async function upsertCitizenCampaignHistory(args: {
  citizenId: string;
  /** Đợt mới đang gắn */
  campaignId: string;
  /** Snapshot đợt cũ trước khi đổi (nếu khác đợt mới) */
  previous?: {
    campaignId: string;
    callIntent?: string | null;
    approvalStatus?: string | null;
    militaryStatus?: string | null;
    militaryStatusReason?: string | null;
    pipelineStatus?: string | null;
  } | null;
  /** Trạng thái ghi vào dòng đợt mới */
  next: {
    callIntent?: string | null;
    approvalStatus?: string | null;
    militaryStatus?: string | null;
    militaryStatusReason?: string | null;
    pipelineStatus?: string | null;
    note?: string | null;
  };
  source?: CitizenCampaignSource;
}): Promise<boolean> {
  if (!(await ensureCitizenCampaignsTable())) return false;
  const source = args.source || "manual";

  try {
    // 1) Giữ / cập nhật snapshot đợt cũ — KHÔNG xóa
    if (
      args.previous?.campaignId &&
      args.previous.campaignId !== args.campaignId
    ) {
      await queryExecute(
        `INSERT INTO citizen_campaigns (
           citizen_id, campaign_id, call_intent, approval_status, military_status,
           military_status_reason, pipeline_status, source, note, is_current
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'carry_over', ?, 0)
         ON DUPLICATE KEY UPDATE
           call_intent = VALUES(call_intent),
           approval_status = VALUES(approval_status),
           military_status = VALUES(military_status),
           military_status_reason = VALUES(military_status_reason),
           pipeline_status = VALUES(pipeline_status),
           is_current = 0,
           updated_at = NOW()`,
        [
          args.citizenId,
          args.previous.campaignId,
          args.previous.callIntent || "unset",
          args.previous.approvalStatus || "none",
          args.previous.militaryStatus || null,
          (args.previous.militaryStatusReason || "").slice(0, 500) || null,
          args.previous.pipelineStatus || "none",
          "Giữ lịch sử đợt trước khi gắn đợt mới",
        ],
      );
    }

    // 2) Bỏ cờ current trên các đợt khác
    await queryExecute(
      `UPDATE citizen_campaigns SET is_current = 0, updated_at = NOW()
       WHERE citizen_id = ? AND campaign_id <> ?`,
      [args.citizenId, args.campaignId],
    );

    // 3) Upsert đợt mới
    await queryExecute(
      `INSERT INTO citizen_campaigns (
         citizen_id, campaign_id, call_intent, approval_status, military_status,
         military_status_reason, pipeline_status, source, note, is_current
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         call_intent = VALUES(call_intent),
         approval_status = VALUES(approval_status),
         military_status = VALUES(military_status),
         military_status_reason = VALUES(military_status_reason),
         pipeline_status = VALUES(pipeline_status),
         source = VALUES(source),
         note = COALESCE(VALUES(note), note),
         is_current = 1,
         updated_at = NOW()`,
      [
        args.citizenId,
        args.campaignId,
        args.next.callIntent || "unset",
        args.next.approvalStatus || "none",
        args.next.militaryStatus || null,
        (args.next.militaryStatusReason || "").slice(0, 500) || null,
        args.next.pipelineStatus || "none",
        source,
        (args.next.note || "").slice(0, 500) || null,
      ],
    );

    return true;
  } catch (e) {
    console.error("upsertCitizenCampaignHistory:", e);
    return false;
  }
}

/** Điều kiện SQL: hồ sơ từng / đang thuộc đợt (lịch sử ∪ campaign_id hiện tại). */
export function sqlCitizenInCampaign(
  campaignParamPlaceholder = "?",
  citizenAlias = "c",
): string {
  return `(
    ${citizenAlias}.campaign_id = ${campaignParamPlaceholder}
    OR EXISTS (
      SELECT 1 FROM citizen_campaigns cc
      WHERE cc.citizen_id = ${citizenAlias}.id
        AND cc.campaign_id = ${campaignParamPlaceholder}
    )
  )`;
}

export function snapshotFromCitizen(citizen: Citizen): {
  campaignId: string;
  callIntent: string | null;
  approvalStatus: string | null;
  militaryStatus: string | null;
  militaryStatusReason: string | null;
  pipelineStatus: string | null;
} | null {
  const campaignId = (citizen.campaignId || "").trim();
  if (!campaignId) return null;
  return {
    campaignId,
    callIntent: citizen.callIntent || "unset",
    approvalStatus: citizen.approvalStatus || "none",
    militaryStatus: citizen.militaryStatus || null,
    militaryStatusReason: citizen.militaryStatusReason || null,
    pipelineStatus: citizen.pipelineStatus || "none",
  };
}

/** Đã duyệt gọi / nhập ngũ — không đưa sang đợt mới bằng AI. */
export function isFinalApprovedCall(citizen: {
  militaryStatus?: string | null;
  approvalStatus?: string | null;
}): boolean {
  return (
    citizen.militaryStatus === "nhapngu" ||
    citizen.approvalStatus === "approved"
  );
}

export async function countCitizensInCampaignHistory(
  campaignId: string,
): Promise<number> {
  if (!(await ensureCitizenCampaignsTable())) return 0;
  try {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT citizen_id) AS n FROM citizen_campaigns WHERE campaign_id = ?`,
      [campaignId],
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}
