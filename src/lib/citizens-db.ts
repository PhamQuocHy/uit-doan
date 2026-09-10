import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import {
  ensureCitizenCampaignsTable,
  sqlCitizenInCampaign,
} from "@/lib/citizen-campaigns-db";
import type { Citizen } from "@/lib/data";
import { getUnitDescendants } from "@/lib/data";
import { toDateOnlyString } from "@/lib/date-vn";
import {
  calcAgeYears,
  NVQS_AGE_MAX,
  NVQS_AGE_MIN,
  sqlAgeYear,
  type CitizenAgeScope,
} from "@/lib/nvqs-age";
import { callDisplayFilterSql } from "@/lib/enlistment-approval";

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
  approval_comment?: string | null;
  pipeline_status?: string | null;
  province_comment?: string | null;
  province_reviewed_at?: string | Date | null;
  military_status_locked: number | null;
  call_intent: Citizen["callIntent"] | null;
  approval_status: Citizen["approvalStatus"] | null;
  campaign_id: string | null;
  receiving_status: Citizen["receivingStatus"] | null;
  receiving_unit_code: string | null;
  health_grade: number | null;
  education_level: string | null;
  job: string | null;
  school_name?: string | null;
  identification_features?: string | null;
  issue_date?: string | Date | null;
  expiry_date?: string | Date | null;
  old_id_number?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  avatar_url?: string | null;
  archived_at?: string | Date | null;
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

function toDateOnly(d: string | Date | null | undefined): string | undefined {
  return toDateOnlyString(d);
}

function mapCitizen(row: CitizenRow): Citizen {
  return {
    id: row.id,
    fullName: row.full_name,
    cccd: row.cccd,
    dateOfBirth: toDateOnly(row.date_of_birth) || "",
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
    schoolName: row.school_name || undefined,
    healthStatus:
      row.health_grade != null ? `Loại ${row.health_grade}` : undefined,
    identificationFeatures: row.identification_features || undefined,
    issueDate: toDateOnly(row.issue_date),
    expiryDate: toDateOnly(row.expiry_date),
    oldIdNumber: row.old_id_number || undefined,
    fatherName: row.father_name || undefined,
    motherName: row.mother_name || undefined,
    avatar: row.avatar_url || undefined,
    militaryStatus: row.military_status,
    militaryStatusReason: row.military_status_reason || undefined,
    approvalComment: row.approval_comment || null,
    pipelineStatus: (row.pipeline_status || "none") as Citizen["pipelineStatus"],
    provinceComment: row.province_comment || null,
    provinceReviewedAt: row.province_reviewed_at
      ? toIso(row.province_reviewed_at)
      : null,
    militaryStatusLocked: Boolean(row.military_status_locked),
    callIntent: (row.call_intent || "unset") as Citizen["callIntent"],
    approvalStatus: (row.approval_status || "none") as Citizen["approvalStatus"],
    campaignId: row.campaign_id || undefined,
    receivingStatus: (row.receiving_status || null) as Citizen["receivingStatus"],
    receivingUnitCode: row.receiving_unit_code || null,
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function placeholders(n: number) {
  return Array.from({ length: n }, () => "?").join(",");
}

let archivedColumnReady: boolean | null = null;
let avatarColumnReady: boolean | null = null;
let callIntentReady: boolean | null = null;
let approvalCommentReady: boolean | null = null;
let pipelineColumnsReady: boolean | null = null;
let pipelineBackfillDone: boolean | null = null;
let listIndexesReady: boolean | null = null;

/** Index phục vụ list theo unit_code / education (chạy 1 lần / process). */
async function ensureCitizenListIndexes(): Promise<void> {
  if (listIndexesReady === true) return;
  if (!(await pingDb())) {
    listIndexesReady = false;
    return;
  }
  try {
    const db = process.env.DB_NAME || "quan_ly_nvqs";
    const hasIndex = async (table: string, name: string) => {
      const rows = await queryRows<(RowDataPacket & { c: number })[]>(
        `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [db, table, name],
      );
      return Number(rows[0]?.c || 0) > 0;
    };
    if (!(await hasIndex("citizen_education", "idx_edu_citizen"))) {
      await queryExecute(
        `CREATE INDEX idx_edu_citizen ON citizen_education (citizen_id)`,
      );
    }
    if (!(await hasIndex("citizens", "idx_citizens_unit_arch_upd"))) {
      await queryExecute(
        `CREATE INDEX idx_citizens_unit_arch_upd ON citizens (unit_code, archived_at, updated_at)`,
      );
    }
    listIndexesReady = true;
  } catch (e) {
    console.warn("ensureCitizenListIndexes:", e);
    listIndexesReady = false;
  }
}

/** Đảm bảo avatar_url đủ chỗ lưu ảnh chip (base64). */
export async function ensureCitizenAvatarColumn(): Promise<void> {
  if (avatarColumnReady === true) return;
  if (!(await pingDb())) return;
  try {
    const cols = await queryRows<RowDataPacket[]>(
      `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'citizen_identities'
         AND COLUMN_NAME = 'avatar_url'
       LIMIT 1`,
    );
    const col = cols[0] as { DATA_TYPE?: string; len?: number } | undefined;
    if (!col) {
      await queryExecute(
        `ALTER TABLE citizen_identities ADD COLUMN avatar_url MEDIUMTEXT NULL`,
      );
      avatarColumnReady = true;
      return;
    }
    if (String(col.DATA_TYPE).toLowerCase() === "text") {
      await queryExecute(
        `ALTER TABLE citizen_identities MODIFY COLUMN avatar_url MEDIUMTEXT NULL`,
      );
    }
    avatarColumnReady = true;
  } catch (e) {
    console.warn("ensureCitizenAvatarColumn:", e);
  }
}

export async function ensureCitizenCallIntentDuBi(): Promise<void> {
  if (callIntentReady === true) return;
  if (!(await pingDb())) return;
  try {
    const cols = await queryRows<(RowDataPacket & { COLUMN_TYPE?: string })[]>(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'citizens'
         AND COLUMN_NAME = 'call_intent'
       LIMIT 1`,
    );
    const colType = String(cols[0]?.COLUMN_TYPE || "");
    if (colType && !colType.includes("de_xuat_khong_goi")) {
      await queryExecute(
        `ALTER TABLE citizens
         MODIFY COLUMN call_intent
         ENUM('unset','du_kien_goi','khong_goi','du_bi','de_xuat_khong_goi') NOT NULL DEFAULT 'unset'
         COMMENT 'Dự kiến tuyển gọi / đề xuất không gọi / dự bị'`,
      );
    } else if (colType && !colType.includes("du_bi")) {
      await queryExecute(
        `ALTER TABLE citizens
         MODIFY COLUMN call_intent
         ENUM('unset','du_kien_goi','khong_goi','du_bi','de_xuat_khong_goi') NOT NULL DEFAULT 'unset'
         COMMENT 'Dự kiến tuyển gọi / đề xuất không gọi / dự bị'`,
      );
    }
    callIntentReady = true;
  } catch (e) {
    console.warn("ensureCitizenCallIntentDuBi:", e);
  }
}

export async function ensureCitizenApprovalCommentColumn(): Promise<void> {
  if (approvalCommentReady === true) return;
  if (!(await pingDb())) return;
  try {
    const cols = await queryRows<(RowDataPacket & { COLUMN_NAME: string })[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'citizens'
         AND COLUMN_NAME = 'approval_comment'`,
    );
    if (cols.length === 0) {
      await queryExecute(
        `ALTER TABLE citizens
         ADD COLUMN approval_comment TEXT NULL
         COMMENT 'Nhận xét QK khi không chấp nhận đề xuất / tạm hoãn'
         AFTER military_status_reason`,
      );
    }
    approvalCommentReady = true;
  } catch (e) {
    console.warn("ensureCitizenApprovalCommentColumn:", e);
  }
}

/** Cột pipeline xã→tỉnh→QK (+ backfill pending cũ → qk_pending, chạy 1 lần). */
export async function ensureCitizenPipelineColumns(): Promise<void> {
  if (pipelineColumnsReady === true && pipelineBackfillDone === true) return;
  if (!(await pingDb())) return;
  try {
    if (pipelineColumnsReady !== true) {
      const cols = await queryRows<(RowDataPacket & { COLUMN_NAME: string })[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'citizens'
           AND COLUMN_NAME IN ('pipeline_status','province_comment','province_reviewed_at')`,
      );
      const have = new Set(cols.map((c) => c.COLUMN_NAME));
      if (!have.has("pipeline_status")) {
        await queryExecute(
          `ALTER TABLE citizens
           ADD COLUMN pipeline_status
             ENUM('none','local_ready','province_pending','province_ok','province_returned','qk_pending')
             NOT NULL DEFAULT 'none'
             COMMENT 'Luồng chuyển hồ sơ xã→tỉnh→QK'
             AFTER approval_status`,
        );
      }
      if (!have.has("province_comment")) {
        await queryExecute(
          `ALTER TABLE citizens
           ADD COLUMN province_comment TEXT NULL
           COMMENT 'Lý do tỉnh trả về bổ sung'
           AFTER approval_comment`,
        );
      }
      if (!have.has("province_reviewed_at")) {
        await queryExecute(
          `ALTER TABLE citizens
           ADD COLUMN province_reviewed_at DATETIME NULL
           COMMENT 'Thời điểm tỉnh đồng tình / trả về'
           AFTER province_comment`,
        );
      }
      pipelineColumnsReady = true;
    }

    if (pipelineBackfillDone === true) return;

    // Backfill legacy — chỉ chạy 1 lần / process (tránh UPDATE full table mỗi GET)
    await queryExecute(
      `UPDATE citizens
       SET approval_status = 'none'
       WHERE approval_status = 'pending'
         AND IFNULL(pipeline_status, 'none') IN (
           'local_ready','province_pending','province_ok','province_returned'
         )`,
    );
    await queryExecute(
      `UPDATE citizens
       SET pipeline_status = 'qk_pending'
       WHERE IFNULL(pipeline_status, 'none') = 'none'
         AND (
           approval_status IN ('pending','approved','rejected')
           OR (
             IFNULL(approval_status,'none') = 'none'
             AND IFNULL(military_status_locked,0) = 1
             AND IFNULL(approval_comment,'') <> ''
           )
         )`,
    );
    await queryExecute(
      `UPDATE citizens
       SET pipeline_status = 'local_ready',
           approval_status = 'none'
       WHERE pipeline_status = 'qk_pending'
         AND approval_status = 'pending'
         AND province_reviewed_at IS NULL
         AND (
           military_status = 'tamhoan'
           OR call_intent = 'de_xuat_khong_goi'
           OR call_intent = 'du_kien_goi'
         )`,
    );
    pipelineBackfillDone = true;
  } catch (e) {
    console.warn("ensureCitizenPipelineColumns:", e);
  }
}

/**
 * Legacy: không còn ép pending thẳng QK (đã có pipeline xã→tỉnh).
 * Giữ hàm để không vỡ import cũ.
 */
export async function ensureProposalPendingMigration(): Promise<void> {
  if (!(await pingDb())) return;
  try {
    await ensureCitizenCallIntentDuBi();
    await ensureCitizenPipelineColumns();
  } catch (e) {
    console.warn("ensureProposalPendingMigration:", e);
  }
}

let receivingColumnsReady: boolean | null = null;

/** Đảm bảo cột phân đơn vị nhận quân (idempotent). */
export async function ensureCitizenReceivingColumns(): Promise<boolean> {
  if (receivingColumnsReady === true) return true;
  if (!(await pingDb())) {
    receivingColumnsReady = false;
    return false;
  }
  try {
    const cols = await queryRows<(RowDataPacket & { COLUMN_NAME: string })[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'citizens'
         AND COLUMN_NAME IN ('receiving_status', 'receiving_unit_code')`,
    );
    const have = new Set(cols.map((c) => c.COLUMN_NAME));
    if (!have.has("receiving_status")) {
      await queryExecute(
        `ALTER TABLE citizens
         ADD COLUMN receiving_status
           ENUM('chua_phan_quan','da_phan_quan','submitted_to_bo','bo_approved','published')
           NULL DEFAULT NULL
           COMMENT 'Trạng thái phân đơn vị nhận quân'
         AFTER campaign_id`,
      );
    }
    if (!have.has("receiving_unit_code")) {
      await queryExecute(
        `ALTER TABLE citizens
         ADD COLUMN receiving_unit_code VARCHAR(64) NULL DEFAULT NULL
           COMMENT 'Mã đơn vị nhận quân (quân khu)'
         AFTER receiving_status`,
      );
    }
    // Đồng bộ hồ sơ đã nhập ngũ cũ
    await queryExecute(
      `UPDATE citizens
       SET receiving_status = 'chua_phan_quan'
       WHERE military_status = 'nhapngu'
         AND (receiving_status IS NULL OR receiving_status = '')
         AND (receiving_unit_code IS NULL OR receiving_unit_code = '')`,
    );
    await queryExecute(
      `UPDATE citizens
       SET receiving_status = 'da_phan_quan'
       WHERE military_status = 'nhapngu'
         AND receiving_unit_code IS NOT NULL
         AND receiving_unit_code <> ''
         AND (receiving_status IS NULL OR receiving_status = 'chua_phan_quan')`,
    );
    // Seed quân khu nếu thiếu
    await queryExecute(
      `INSERT IGNORE INTO hierarchy_units (code, name, level, parent_code, is_active) VALUES
        ('dv-qk1', 'Quân khu 1', 'donvi', 'bo', 1),
        ('dv-qk2', 'Quân khu 2', 'donvi', 'bo', 1),
        ('dv-qk3', 'Quân khu 3', 'donvi', 'bo', 1),
        ('dv-qk4', 'Quân khu 4', 'donvi', 'bo', 1),
        ('dv-qk5', 'Quân khu 5', 'donvi', 'bo', 1),
        ('dv-qk7', 'Quân khu 7', 'donvi', 'bo', 1),
        ('dv-qk9', 'Quân khu 9', 'donvi', 'bo', 1)`,
    );
    receivingColumnsReady = true;
    return true;
  } catch (e) {
    console.error("ensureCitizenReceivingColumns:", e);
    receivingColumnsReady = false;
    return false;
  }
}

/** Đảm bảo cột archived_at tồn tại (idempotent). */
export async function ensureCitizenArchivedAtColumn(): Promise<boolean> {
  if (archivedColumnReady === true) return true;
  if (!(await pingDb())) {
    archivedColumnReady = false;
    return false;
  }
  try {
    const cols = await queryRows<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'citizens'
         AND COLUMN_NAME = 'archived_at'
       LIMIT 1`,
    );
    if (cols.length === 0) {
      await queryExecute(
        `ALTER TABLE citizens
         ADD COLUMN archived_at DATETIME NULL DEFAULT NULL
         COMMENT 'Thời điểm duyệt chuyển hồ sơ lưu trữ'`,
      );
    }
    try {
      await queryExecute(
        `CREATE INDEX idx_citizens_archived_at ON citizens (archived_at)`,
      );
    } catch {
      /* index đã tồn tại */
    }
    archivedColumnReady = true;
    return true;
  } catch (e) {
    console.error("ensureCitizenArchivedAtColumn:", e);
    archivedColumnReady = false;
    return false;
  }
}

function applyAgeScope(where: string[], ageScope: CitizenAgeScope) {
  const ageExpr = sqlAgeYear("c.date_of_birth");
  if (ageScope === "active") {
    where.push(`c.archived_at IS NULL`);
    where.push(`${ageExpr} BETWEEN ${NVQS_AGE_MIN} AND ${NVQS_AGE_MAX}`);
  } else if (ageScope === "pending") {
    where.push(`c.archived_at IS NULL`);
    where.push(`${ageExpr} > ${NVQS_AGE_MAX}`);
  } else if (ageScope === "archive") {
    where.push(`c.archived_at IS NOT NULL`);
  }
}

export function filterCitizensByAgeScopeMemory(
  items: Citizen[],
  ageScope: CitizenAgeScope,
): Citizen[] {
  if (ageScope === "all") return items;
  return items.filter((c) => {
    const age = calcAgeYears(c.dateOfBirth);
    const archived = Boolean(c.archivedAt);
    if (ageScope === "archive") return archived;
    if (ageScope === "pending") return !archived && age > NVQS_AGE_MAX;
    return !archived && age >= NVQS_AGE_MIN && age <= NVQS_AGE_MAX;
  });
}

export async function archiveCitizensInDb(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  if (!(await pingDb())) return 0;
  await ensureCitizenArchivedAtColumn();
  try {
    const result = await queryExecute(
      `UPDATE citizens
       SET archived_at = NOW(), updated_at = NOW()
       WHERE id IN (${placeholders(ids.length)})
         AND archived_at IS NULL
         AND ${sqlAgeYear("date_of_birth")} > ${NVQS_AGE_MAX}`,
      ids,
    );
    return Number(result.affectedRows || 0);
  } catch (e) {
    console.error("archiveCitizensInDb:", e);
    return 0;
  }
}

export async function archiveAllPendingInDb(unitCodes?: string[]): Promise<number> {
  if (!(await pingDb())) return 0;
  await ensureCitizenArchivedAtColumn();
  const where = [
    "archived_at IS NULL",
    `${sqlAgeYear("date_of_birth")} > ${NVQS_AGE_MAX}`,
  ];
  const params: unknown[] = [];
  if (unitCodes && unitCodes.length > 0) {
    if (unitCodes.length <= 500) {
      where.push(`unit_code IN (${placeholders(unitCodes.length)})`);
      params.push(...unitCodes);
    } else {
      const root = unitCodes[0]?.split("-")[0] || unitCodes[0];
      where.push("(unit_code = ? OR unit_code LIKE CONCAT(?, '-%'))");
      params.push(root, root);
    }
  }
  try {
    const result = await queryExecute(
      `UPDATE citizens SET archived_at = NOW(), updated_at = NOW() WHERE ${where.join(" AND ")}`,
      params,
    );
    return Number(result.affectedRows || 0);
  } catch (e) {
    console.error("archiveAllPendingInDb:", e);
    return 0;
  }
}

export async function findCitizensFromDb(query: {
  search?: string;
  militaryStatus?: string;
  callIntent?: string;
  campaignId?: string;
  educationLevel?: string;
  healthGrade?: string;
  unitCodes?: string[];
  page?: number;
  limit?: number;
  /** active = 18–27 chưa lưu trữ; pending = hết tuổi chờ duyệt; archive = đã duyệt */
  ageScope?: CitizenAgeScope;
}): Promise<{
  data: Citizen[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} | null> {
  const ok = await pingDb();
  if (!ok) return null;
  await ensureCitizenArchivedAtColumn();
  await ensureCitizenAvatarColumn();
  await ensureCitizenCallIntentDuBi();
  await ensureCitizenApprovalCommentColumn();
  await ensureCitizenPipelineColumns();
  await ensureCitizenReceivingColumns();
  await ensureCitizenCampaignsTable();
  await ensureCitizenListIndexes();

  const page = query.page || 1;
  const limit = query.limit || 10;
  const offset = (page - 1) * limit;

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  applyAgeScope(where, query.ageScope || "active");

  if (query.unitCodes && query.unitCodes.length > 0) {
    const root0 = query.unitCodes[0];
    // Phạm vi Bộ (code "bo"): không lọc unit_code — tránh LIKE "bo-%" sai với mã tỉnh "92-…"
    if (root0 === "bo") {
      // nationwide — bỏ filter địa phương
    } else {
      // tránh query quá dài: nếu lọc theo tỉnh (code không có '-'), dùng LIKE
      const onlyTinh =
        query.unitCodes.length > 1 &&
        query.unitCodes.every(
          (c) => c === root0 || c.startsWith(`${root0}-`),
        );

      if (onlyTinh && root0 && !root0.includes("-")) {
        where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
        params.push(root0, root0);
      } else if (query.unitCodes.length <= 500) {
        where.push(`c.unit_code IN (${placeholders(query.unitCodes.length)})`);
        params.push(...query.unitCodes);
      } else {
        const root = root0?.split("-")[0] || root0;
        where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
        params.push(root, root);
      }
    }
  }

  if (query.militaryStatus) {
    where.push("c.military_status = ?");
    params.push(query.militaryStatus);
  }

  const callSql = query.callIntent
    ? callDisplayFilterSql(query.callIntent)
    : null;
  if (callSql) {
    where.push(callSql);
  }

  if (query.campaignId) {
    // Thuộc đợt theo lịch sử HOẶC đợt đang làm — gắn 2027 không làm mất khỏi 2026
    where.push(sqlCitizenInCampaign("?", "c"));
    params.push(query.campaignId, query.campaignId);
  }

  const eduJoin = `
       LEFT JOIN citizen_education edu ON edu.id = (
         SELECT e2.id FROM citizen_education e2
         WHERE e2.citizen_id = c.id
         ORDER BY e2.id DESC
         LIMIT 1
       )`;

  if (query.educationLevel) {
    const levels = educationLevelMatchValues(query.educationLevel);
    if (levels.length === 1) {
      where.push("edu.level = ?");
      params.push(levels[0]);
    } else if (levels.length > 1) {
      where.push(`edu.level IN (${placeholders(levels.length)})`);
      params.push(...levels);
    }
  }

  if (query.healthGrade === "none") {
    where.push("c.health_grade IS NULL");
  } else if (query.healthGrade) {
    const grade = Number(query.healthGrade);
    if (Number.isFinite(grade)) {
      where.push("c.health_grade = ?");
      params.push(grade);
    }
  }

  if (query.search) {
    const s = `%${query.search}%`;
    where.push(
      "(c.full_name LIKE ? OR c.cccd LIKE ? OR c.phone LIKE ? OR c.permanent_address LIKE ? OR c.current_address LIKE ?)",
    );
    params.push(s, s, s, s, s);
  }

  const whereSql = where.join(" AND ");
  const needsEduJoin = Boolean(query.educationLevel);

  try {
    const [countRow] = await queryRows<(RowDataPacket & { cnt: number })[]>(
      `SELECT COUNT(*) AS cnt FROM citizens c${needsEduJoin ? eduJoin : ""} WHERE ${whereSql}`,
      params,
    );

    const total = Number(countRow?.cnt || 0);

    // Bước 1: lấy id trang hiện tại (không JOIN nặng / không kéo MEDIUMTEXT avatar)
    const idRows = await queryRows<(RowDataPacket & { id: string })[]>(
      `SELECT c.id
       FROM citizens c${needsEduJoin ? eduJoin : ""}
       WHERE ${whereSql}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) {
      return { data: [], total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    }

    // Bước 2: hydrate đủ field cho các id trang hiện tại (gồm avatar — chỉ ~20 dòng)
    const rows = await queryRows<CitizenRow[]>(
      `SELECT
         c.id, c.full_name, c.cccd, c.date_of_birth, c.gender,
         c.nationality, c.ethnicity, c.religion, c.origin_place,
         c.permanent_address, c.current_address, c.phone, c.unit_code,
         c.military_status, c.military_status_reason, c.approval_comment, c.military_status_locked,
         c.call_intent, c.approval_status, c.pipeline_status, c.province_comment, c.province_reviewed_at,
         c.health_grade, c.campaign_id, c.receiving_status, c.receiving_unit_code,
         c.created_at, c.updated_at, c.archived_at,
         edu.level AS education_level,
         edu.major AS job,
         edu.school_name AS school_name,
         NULL AS identification_features,
         ci.issue_date,
         ci.expiry_date,
         ci.old_id_number,
         ci.avatar_url,
         NULL AS father_name,
         NULL AS mother_name
       FROM citizens c
       LEFT JOIN citizen_education edu ON edu.id = (
         SELECT e2.id FROM citizen_education e2
         WHERE e2.citizen_id = c.id
         ORDER BY e2.id DESC
         LIMIT 1
       )
       LEFT JOIN citizen_identities ci ON ci.citizen_id = c.id
       WHERE c.id IN (${placeholders(ids.length)})
       ORDER BY FIELD(c.id, ${placeholders(ids.length)})`,
      [...ids, ...ids],
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

export type CitizenStatusSummary = {
  du_kien_goi: number;
  du_bi: number;
  hoan: number;
  khong_goi: number;
};

/** Đếm 4 nhóm trạng thái theo phạm vi (không theo tab callIntent / militaryStatus). */
export async function countCitizenStatusSummaryFromDb(query: {
  search?: string;
  campaignId?: string;
  educationLevel?: string;
  healthGrade?: string;
  unitCodes?: string[];
  ageScope?: CitizenAgeScope;
}): Promise<CitizenStatusSummary | null> {
  const ok = await pingDb();
  if (!ok) return null;
  await ensureCitizenArchivedAtColumn();
  await ensureCitizenCallIntentDuBi();
  await ensureCitizenPipelineColumns();
  await ensureCitizenCampaignsTable();
  await ensureCitizenListIndexes();

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  applyAgeScope(where, query.ageScope || "active");

  if (query.unitCodes && query.unitCodes.length > 0) {
    const root0 = query.unitCodes[0];
    if (root0 === "bo") {
      // nationwide
    } else {
      const onlyTinh =
        query.unitCodes.length > 1 &&
        query.unitCodes.every(
          (c) => c === root0 || c.startsWith(`${root0}-`),
        );

      if (onlyTinh && root0 && !root0.includes("-")) {
        where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
        params.push(root0, root0);
      } else if (query.unitCodes.length <= 500) {
        where.push(`c.unit_code IN (${placeholders(query.unitCodes.length)})`);
        params.push(...query.unitCodes);
      } else {
        const root = root0?.split("-")[0] || root0;
        where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
        params.push(root, root);
      }
    }
  }

  if (query.campaignId) {
    where.push(sqlCitizenInCampaign("?", "c"));
    params.push(query.campaignId, query.campaignId);
  }

  const eduJoin = `
       LEFT JOIN citizen_education edu ON edu.id = (
         SELECT e2.id FROM citizen_education e2
         WHERE e2.citizen_id = c.id
         ORDER BY e2.id DESC
         LIMIT 1
       )`;

  if (query.educationLevel) {
    const levels = educationLevelMatchValues(query.educationLevel);
    if (levels.length === 1) {
      where.push("edu.level = ?");
      params.push(levels[0]);
    } else if (levels.length > 1) {
      where.push(`edu.level IN (${placeholders(levels.length)})`);
      params.push(...levels);
    }
  }

  if (query.healthGrade === "none") {
    where.push("c.health_grade IS NULL");
  } else if (query.healthGrade) {
    const grade = Number(query.healthGrade);
    if (Number.isFinite(grade)) {
      where.push("c.health_grade = ?");
      params.push(grade);
    }
  }

  if (query.search) {
    const s = `%${query.search}%`;
    where.push(
      "(c.full_name LIKE ? OR c.cccd LIKE ? OR c.phone LIKE ? OR c.permanent_address LIKE ? OR c.current_address LIKE ?)",
    );
    params.push(s, s, s, s, s);
  }

  const whereSql = where.join(" AND ");
  const needsEduJoin = Boolean(query.educationLevel);
  const duKienSql = callDisplayFilterSql("du_kien_goi");
  const duBiSql = callDisplayFilterSql("du_bi");
  const khongGoiSql = callDisplayFilterSql("khong_goi");
  if (!duKienSql || !duBiSql || !khongGoiSql) return null;

  try {
    const [row] = await queryRows<
      (RowDataPacket & {
        du_kien_goi: number;
        du_bi: number;
        hoan: number;
        khong_goi: number;
      })[]
    >(
      `SELECT
         SUM(CASE WHEN ${duKienSql} THEN 1 ELSE 0 END) AS du_kien_goi,
         SUM(CASE WHEN ${duBiSql} THEN 1 ELSE 0 END) AS du_bi,
         SUM(CASE WHEN c.military_status = 'tamhoan' THEN 1 ELSE 0 END) AS hoan,
         SUM(CASE WHEN ${khongGoiSql} THEN 1 ELSE 0 END) AS khong_goi
       FROM citizens c${needsEduJoin ? eduJoin : ""}
       WHERE ${whereSql}`,
      params,
    );

    return {
      du_kien_goi: Number(row?.du_kien_goi || 0),
      du_bi: Number(row?.du_bi || 0),
      hoan: Number(row?.hoan || 0),
      khong_goi: Number(row?.khong_goi || 0),
    };
  } catch (e) {
    console.error("countCitizenStatusSummaryFromDb:", e);
    return null;
  }
}

/** Chuẩn hóa nhóm trình độ học vấn để lọc khớp dữ liệu cũ (12/12, Thạc sĩ…). */
function educationLevelMatchValues(filter: string): string[] {
  if (filter === "THPT" || filter === "pho_thong") {
    return ["THPT", "12/12", "9/12", "THCS", "PTTH"];
  }
  if (filter === "Sau đại học" || filter === "sau_dai_hoc") {
    return ["Sau đại học", "Thạc sĩ", "Tiến sĩ", "ThS", "TS"];
  }
  return [filter];
}

const CITIZEN_SELECT_SQL = `SELECT
         c.id, c.full_name, c.cccd, c.date_of_birth, c.gender,
         c.nationality, c.ethnicity, c.religion, c.origin_place,
         c.permanent_address, c.current_address, c.phone, c.unit_code,
         c.military_status, c.military_status_reason, c.approval_comment, c.military_status_locked,
         c.call_intent, c.approval_status, c.pipeline_status, c.province_comment, c.province_reviewed_at,
         c.health_grade, c.campaign_id, c.receiving_status, c.receiving_unit_code,
         c.created_at, c.updated_at, c.archived_at,
         edu.level AS education_level,
         edu.major AS job,
         edu.school_name AS school_name,
         ci.identification_features,
         ci.issue_date,
         ci.expiry_date,
         ci.old_id_number,
         ci.avatar_url,
         fam.father_name,
         fam.mother_name
       FROM citizens c
       LEFT JOIN (
         SELECT e1.citizen_id, e1.level, e1.major, e1.school_name
         FROM citizen_education e1
         INNER JOIN (
           SELECT citizen_id, MAX(id) AS max_id
           FROM citizen_education
           GROUP BY citizen_id
         ) latest ON latest.max_id = e1.id
       ) edu ON edu.citizen_id = c.id
       LEFT JOIN citizen_identities ci ON ci.citizen_id = c.id
       LEFT JOIN (
         SELECT
           citizen_id,
           MAX(CASE WHEN relationship = 'Cha' THEN rel_name END) AS father_name,
           MAX(CASE WHEN relationship = 'Me' THEN rel_name END) AS mother_name
         FROM citizen_family
         WHERE relationship IN ('Cha', 'Me')
         GROUP BY citizen_id
       ) fam ON fam.citizen_id = c.id`;

export async function findCitizenByIdFromDb(id: string): Promise<Citizen | null> {
  const ok = await pingDb();
  if (!ok) return null;
  await ensureCitizenArchivedAtColumn();
  await ensureCitizenAvatarColumn();
  await ensureCitizenCallIntentDuBi();
  await ensureCitizenApprovalCommentColumn();
  await ensureCitizenPipelineColumns();
  await ensureCitizenReceivingColumns();
  try {
    const rows = await queryRows<CitizenRow[]>(
      `${CITIZEN_SELECT_SQL}
       WHERE c.id = ?
       LIMIT 1`,
      [id],
    );
    return rows[0] ? mapCitizen(rows[0]) : null;
  } catch (e) {
    console.error("findCitizenByIdFromDb:", e);
    return null;
  }
}

export async function findCitizenByCccdFromDb(
  cccd: string,
): Promise<Citizen | null> {
  const ok = await pingDb();
  if (!ok) return null;
  await ensureCitizenArchivedAtColumn();
  await ensureCitizenAvatarColumn();
  await ensureCitizenReceivingColumns();
  const digits = String(cccd || "").replace(/\D/g, "");
  if (!digits) return null;
  try {
    const rows = await queryRows<CitizenRow[]>(
      `${CITIZEN_SELECT_SQL}
       WHERE c.cccd = ?
       LIMIT 1`,
      [digits],
    );
    return rows[0] ? mapCitizen(rows[0]) : null;
  } catch (e) {
    console.error("findCitizenByCccdFromDb:", e);
    return null;
  }
}

/** Hồ sơ có ảnh CCCD/3x4 — dùng nhận dạng khuôn mặt 1:N */
export async function findCitizensWithAvatarFromDb(query: {
  unitCodes?: string[];
  limit?: number;
  ageScope?: CitizenAgeScope;
}): Promise<Citizen[] | null> {
  const ok = await pingDb();
  if (!ok) return null;
  await ensureCitizenArchivedAtColumn();
  await ensureCitizenAvatarColumn();

  const where: string[] = [
    "ci.avatar_url IS NOT NULL",
    "TRIM(ci.avatar_url) <> ''",
  ];
  const params: unknown[] = [];
  applyAgeScope(where, query.ageScope || "active");

  if (query.unitCodes && query.unitCodes.length > 0) {
    const root0 = query.unitCodes[0];
    if (root0 !== "bo") {
      const onlyTinh =
        query.unitCodes.length > 1 &&
        query.unitCodes.every(
          (c) => c === root0 || c.startsWith(`${root0}-`),
        );
      if (onlyTinh && root0 && !root0.includes("-")) {
        where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
        params.push(root0, root0);
      } else if (query.unitCodes.length <= 500) {
        where.push(`c.unit_code IN (${placeholders(query.unitCodes.length)})`);
        params.push(...query.unitCodes);
      } else {
        const root = root0?.split("-")[0] || root0;
        where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
        params.push(root, root);
      }
    }
  }

  const limit = Math.min(Math.max(query.limit || 40, 1), 80);
  try {
    const rows = await queryRows<CitizenRow[]>(
      `${CITIZEN_SELECT_SQL}
       WHERE ${where.join(" AND ")}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ?`,
      [...params, limit],
    );
    return rows.map(mapCitizen);
  } catch (e) {
    console.error("findCitizensWithAvatarFromDb:", e);
    return null;
  }
}

async function upsertCitizenIdentity(
  citizenId: string,
  data: Partial<Citizen>,
): Promise<void> {
  const hasAny =
    data.identificationFeatures !== undefined ||
    data.issueDate !== undefined ||
    data.expiryDate !== undefined ||
    data.oldIdNumber !== undefined ||
    data.avatar !== undefined;
  if (!hasAny) return;

  await queryExecute(
    `INSERT INTO citizen_identities
      (citizen_id, identification_features, issue_date, expiry_date, old_id_number, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       identification_features = COALESCE(VALUES(identification_features), identification_features),
       issue_date = COALESCE(VALUES(issue_date), issue_date),
       expiry_date = COALESCE(VALUES(expiry_date), expiry_date),
       old_id_number = COALESCE(VALUES(old_id_number), old_id_number),
       avatar_url = COALESCE(VALUES(avatar_url), avatar_url)`,
    [
      citizenId,
      data.identificationFeatures ?? null,
      data.issueDate ?? null,
      data.expiryDate ?? null,
      data.oldIdNumber ?? null,
      data.avatar ?? null,
    ],
  );
}

async function upsertCitizenParents(
  citizenId: string,
  data: Partial<Citizen>,
): Promise<void> {
  if (data.fatherName !== undefined && data.fatherName.trim()) {
    await queryExecute(
      `INSERT INTO citizen_family (citizen_id, rel_name, relationship)
       SELECT ?, ?, 'Cha'
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM citizen_family WHERE citizen_id = ? AND relationship = 'Cha'
       )`,
      [citizenId, data.fatherName.trim(), citizenId],
    );
    await queryExecute(
      `UPDATE citizen_family SET rel_name = ? WHERE citizen_id = ? AND relationship = 'Cha'`,
      [data.fatherName.trim(), citizenId],
    );
  }
  if (data.motherName !== undefined && data.motherName.trim()) {
    await queryExecute(
      `INSERT INTO citizen_family (citizen_id, rel_name, relationship)
       SELECT ?, ?, 'Me'
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM citizen_family WHERE citizen_id = ? AND relationship = 'Me'
       )`,
      [citizenId, data.motherName.trim(), citizenId],
    );
    await queryExecute(
      `UPDATE citizen_family SET rel_name = ? WHERE citizen_id = ? AND relationship = 'Me'`,
      [data.motherName.trim(), citizenId],
    );
  }
}

export async function updateCitizenInDb(
  id: string,
  data: Partial<Citizen>,
): Promise<Citizen | null> {
  const ok = await pingDb();
  if (!ok) return null;
  await ensureCitizenCallIntentDuBi();
  await ensureCitizenApprovalCommentColumn();
  await ensureCitizenPipelineColumns();
  await ensureCitizenReceivingColumns();

  const fields: string[] = [];
  const params: unknown[] = [];

  const map: Record<string, unknown> = {
    full_name: data.fullName,
    cccd: data.cccd,
    date_of_birth: data.dateOfBirth,
    gender: data.gender,
    nationality: data.nationality,
    ethnicity: data.ethnicity,
    religion: data.religion,
    origin_place: data.originPlace,
    phone: data.phone,
    permanent_address: data.address,
    current_address: data.address,
    military_status: data.militaryStatus,
    military_status_reason: data.militaryStatusReason,
    approval_comment:
      data.approvalComment !== undefined ? data.approvalComment : undefined,
    call_intent: data.callIntent,
    approval_status: data.approvalStatus,
    pipeline_status: data.pipelineStatus,
    province_comment:
      data.provinceComment !== undefined ? data.provinceComment : undefined,
    campaign_id:
      data.campaignId !== undefined ? data.campaignId || null : undefined,
    receiving_status:
      data.receivingStatus !== undefined ? data.receivingStatus : undefined,
    receiving_unit_code:
      data.receivingUnitCode !== undefined
        ? data.receivingUnitCode || null
        : undefined,
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

  try {
    if (fields.length) {
      await queryExecute(
        `UPDATE citizens SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
        [...params, id],
      );
    }
    await upsertCitizenIdentity(id, data);
    await upsertCitizenParents(id, data);

    if (
      data.educationLevel !== undefined ||
      data.job !== undefined ||
      data.schoolName !== undefined
    ) {
      const existingEdu = await queryRows<RowDataPacket[]>(
        `SELECT id FROM citizen_education WHERE citizen_id = ? ORDER BY id DESC LIMIT 1`,
        [id],
      );
      const school =
        data.schoolName !== undefined
          ? data.schoolName.trim() || null
          : undefined;
      if (existingEdu[0]?.id) {
        const eduFields: string[] = [];
        const eduParams: unknown[] = [];
        if (data.educationLevel !== undefined) {
          eduFields.push("level = ?");
          eduParams.push(data.educationLevel || null);
        }
        if (data.job !== undefined) {
          eduFields.push("major = ?");
          eduParams.push(data.job || null);
        }
        if (school !== undefined) {
          eduFields.push("school_name = ?");
          eduParams.push(school);
        }
        if (eduFields.length) {
          await queryExecute(
            `UPDATE citizen_education SET ${eduFields.join(", ")} WHERE id = ?`,
            [...eduParams, existingEdu[0].id],
          );
        }
      } else if (data.educationLevel || data.job || school) {
        await queryExecute(
          `INSERT INTO citizen_education (citizen_id, school_name, level, major)
           VALUES (?, ?, ?, ?)`,
          [
            id,
            school ?? null,
            data.educationLevel || null,
            data.job || null,
          ],
        );
      }
    }

    return findCitizenByIdFromDb(id);
  } catch (e) {
    console.error("updateCitizenInDb:", e);
    return null;
  }
}

export type CreateCitizenResult =
  | { ok: true; data: Citizen }
  | { ok: false; error: string; code: "DUPLICATE_CCCD" | "DB_ERROR" };

export async function createCitizenInDb(
  data: Partial<Citizen> & {
    fullName: string;
    cccd: string;
    dateOfBirth: string;
  },
): Promise<CreateCitizenResult | null> {
  const ok = await pingDb();
  if (!ok) return null;
  await ensureCitizenAvatarColumn();

  const id = data.id || `C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  try {
    await queryExecute(
      `INSERT INTO citizens (
        id, full_name, cccd, date_of_birth, gender, nationality, ethnicity, religion,
        origin_place, permanent_address, current_address, phone, unit_code,
        military_status, military_status_reason, military_status_locked,
        call_intent, approval_status, campaign_id, health_grade, is_blacklisted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        data.fullName,
        data.cccd,
        data.dateOfBirth,
        data.gender || "male",
        data.nationality || "Việt Nam",
        data.ethnicity || "Kinh",
        data.religion || "Không",
        data.originPlace || null,
        data.address || "",
        data.address || "",
        data.phone || "",
        data.unitCode || null,
        data.militaryStatus || "chuakham",
        data.militaryStatusReason || null,
        data.militaryStatusLocked ? 1 : 0,
        data.callIntent || "unset",
        data.approvalStatus || "none",
        data.campaignId || null,
        data.healthStatus?.match(/\d+/)?.[0]
          ? Number(data.healthStatus.match(/\d+/)![0])
          : null,
      ],
    );

    if (data.educationLevel || data.job || data.schoolName?.trim()) {
      await queryExecute(
        `INSERT INTO citizen_education (citizen_id, school_name, level, major)
         VALUES (?, ?, ?, ?)`,
        [
          id,
          data.schoolName?.trim() || null,
          data.educationLevel || null,
          data.job || null,
        ],
      );
    }

    await upsertCitizenIdentity(id, data);
    await upsertCitizenParents(id, data);

    const created = await findCitizenByIdFromDb(id);
    if (!created) {
      return { ok: false, error: "Đã ghi DB nhưng không đọc lại được hồ sơ", code: "DB_ERROR" };
    }
    return { ok: true, data: created };
  } catch (e) {
    console.error("createCitizenInDb:", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/Duplicate entry|ER_DUP_ENTRY|uk_cccd/i.test(msg)) {
      return {
        ok: false,
        error: `Số CCCD ${data.cccd} đã có trong hệ thống. Không thể thêm trùng.`,
        code: "DUPLICATE_CCCD",
      };
    }
    return {
      ok: false,
      error: "Không lưu được hồ sơ vào cơ sở dữ liệu. Thử lại hoặc kiểm tra kết nối DB.",
      code: "DB_ERROR",
    };
  }
}

export function scopeUnitCodes(unitCode: string): string[] {
  return getUnitDescendants(unitCode);
}
