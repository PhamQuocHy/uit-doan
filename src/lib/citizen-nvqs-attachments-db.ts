import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import { getUnitByCode } from "@/lib/hierarchy";
import type { HierarchyLevel, HierarchyUnit } from "@/lib/data";
import {
  minhChungFolderSlug,
  purposesEquivalentTo,
  type CitizenNvqsAttachment,
  type MinhChungLoai,
  type MinhChungLocalityFolders,
  type NvqsAttachmentPurpose,
} from "@/lib/citizen-nvqs-attachments";

export type {
  CitizenNvqsAttachment,
  MinhChungLoai,
  MinhChungLocalityFolders,
  NvqsAttachmentPurpose,
} from "@/lib/citizen-nvqs-attachments";
export {
  MINH_CHUNG_LOAI_OPTIONS,
  minhChungFolderSlug,
  minhChungLabel,
  parseMinhChungLoai,
  purposesEquivalentTo,
} from "@/lib/citizen-nvqs-attachments";

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 8;
const ALLOWED_EXT = /\.(pdf|png|jpe?g|webp|gif|doc|docx|xls|xlsx)$/i;

function newId() {
  return `nvatt_${randomBytes(6).toString("hex")}`;
}

function slugifySegment(raw: string): string {
  const s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || "unknown";
}

function folderFromUnit(unit: { code: string; name: string }): string {
  return slugifySegment(`${unit.code}-${unit.name}`);
}

async function findHierarchyUnit(
  code: string | null | undefined,
): Promise<HierarchyUnit | null> {
  const c = (code || "").trim();
  if (!c) return null;
  if (await pingDb()) {
    try {
      const rows = await queryRows<
        (RowDataPacket & {
          code: string;
          name: string;
          level: string;
          parent_code: string | null;
        })[]
      >(
        `SELECT code, name, level, parent_code
         FROM hierarchy_units
         WHERE code = ? LIMIT 1`,
        [c],
      );
      if (rows[0]) {
        return {
          code: rows[0].code,
          name: rows[0].name,
          level: rows[0].level as HierarchyLevel,
          parentCode: rows[0].parent_code || undefined,
        };
      }
    } catch {
      // fall through
    }
  }
  return getUnitByCode(c) || null;
}

/**
 * Tự map thư mục theo đơn vị gửi minh chứng:
 * - Cấp xã gửi → tỉnh (cha) + xã đó
 * - Cấp tỉnh gửi → tỉnh đó + xã của hồ sơ công dân (nếu có)
 * - Cấp bộ / khác → theo địa phương đăng ký của hồ sơ
 */
export async function resolveMinhChungUploadFolders(opts: {
  uploaderLevel?: string | null;
  uploaderUnitCode?: string | null;
  citizenUnitCode?: string | null;
}): Promise<MinhChungLocalityFolders> {
  const uploader = await findHierarchyUnit(opts.uploaderUnitCode);
  const citizenUnit = await findHierarchyUnit(opts.citizenUnitCode);
  const level = (opts.uploaderLevel || uploader?.level || "").toLowerCase();

  let tinhUnit: HierarchyUnit | null = null;
  let xaUnit: HierarchyUnit | null = null;

  if (level === "xa" && uploader) {
    xaUnit = uploader;
    tinhUnit = uploader.parentCode
      ? await findHierarchyUnit(uploader.parentCode)
      : null;
  } else if (level === "tinh" && uploader) {
    tinhUnit = uploader;
    if (citizenUnit?.level === "xa") {
      const sameTinh =
        !citizenUnit.parentCode ||
        citizenUnit.parentCode === uploader.code ||
        citizenUnit.code.startsWith(`${uploader.code}-`);
      if (sameTinh) xaUnit = citizenUnit;
    }
  } else if (citizenUnit) {
    if (citizenUnit.level === "xa") {
      xaUnit = citizenUnit;
      tinhUnit = citizenUnit.parentCode
        ? await findHierarchyUnit(citizenUnit.parentCode)
        : null;
    } else if (citizenUnit.level === "tinh") {
      tinhUnit = citizenUnit;
    }
  }

  if (!tinhUnit || !xaUnit) {
    const code =
      (level === "xa" ? opts.uploaderUnitCode : null) ||
      opts.citizenUnitCode ||
      opts.uploaderUnitCode ||
      "";
    const trimmed = String(code).trim();
    if (trimmed) {
      const parentGuess = trimmed.includes("-")
        ? trimmed.split("-")[0]
        : trimmed;
      if (!tinhUnit) {
        tinhUnit =
          (await findHierarchyUnit(parentGuess)) ||
          ({
            code: parentGuess,
            name: parentGuess,
            level: "tinh",
          } satisfies HierarchyUnit);
      }
      if (!xaUnit && (level === "xa" || trimmed.includes("-"))) {
        xaUnit =
          (await findHierarchyUnit(trimmed)) ||
          ({
            code: trimmed,
            name: trimmed,
            level: "xa",
            parentCode: parentGuess,
          } satisfies HierarchyUnit);
      }
    }
  }

  return {
    tinh: tinhUnit ? folderFromUnit(tinhUnit) : "chua-xac-dinh",
    xa: xaUnit ? folderFromUnit(xaUnit) : "chua-xac-dinh",
    tinhCode: tinhUnit?.code || "chua-xac-dinh",
    xaCode: xaUnit?.code || "chua-xac-dinh",
    tinhName: tinhUnit?.name || "Chưa xác định",
    xaName: xaUnit?.name || "Chưa xác định",
  };
}

/** Fallback đồng bộ theo 1 mã đơn vị (không có session) */
export function resolveMinhChungLocalityFolders(
  unitCode: string | null | undefined,
): { tinh: string; xa: string } {
  const code = (unitCode || "").trim();
  if (!code) {
    return { tinh: "chua-xac-dinh", xa: "chua-xac-dinh" };
  }
  const unit = getUnitByCode(code);
  if (!unit) {
    const parent = code.includes("-") ? code.split("-")[0] : code;
    return {
      tinh: slugifySegment(parent),
      xa: slugifySegment(code),
    };
  }
  if (unit.level === "xa") {
    const parent = unit.parentCode ? getUnitByCode(unit.parentCode) : undefined;
    return {
      tinh: slugifySegment(
        parent ? `${parent.code}-${parent.name}` : unit.parentCode || "tinh",
      ),
      xa: slugifySegment(`${unit.code}-${unit.name}`),
    };
  }
  if (unit.level === "tinh") {
    return {
      tinh: slugifySegment(`${unit.code}-${unit.name}`),
      xa: "chua-xac-dinh",
    };
  }
  return {
    tinh: slugifySegment(unit.parentCode || unit.code),
    xa: slugifySegment(`${unit.code}-${unit.name}`),
  };
}

export async function ensureCitizenNvqsAttachmentsTable(): Promise<boolean> {
  if (!(await pingDb())) return false;
  try {
    await queryExecute(`
      CREATE TABLE IF NOT EXISTS citizen_nvqs_attachments (
        id VARCHAR(64) NOT NULL,
        citizen_id VARCHAR(64) NOT NULL,
        purpose VARCHAR(64) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(512) NOT NULL,
        mime_type VARCHAR(128) NULL,
        size_bytes INT NOT NULL DEFAULT 0,
        uploaded_by VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_cnvqs_citizen (citizen_id),
        KEY idx_cnvqs_purpose (citizen_id, purpose)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Mở rộng ENUM cũ (nếu còn) → VARCHAR để chứa loại minh chứng mới
    try {
      await queryExecute(`
        ALTER TABLE citizen_nvqs_attachments
        MODIFY COLUMN purpose VARCHAR(64) NOT NULL
      `);
    } catch {
      // ignore if already VARCHAR / no permission
    }
    return true;
  } catch (e) {
    console.error("ensureCitizenNvqsAttachmentsTable:", e);
    return false;
  }
}

function mapRow(
  r: RowDataPacket & {
    id: string;
    citizen_id: string;
    purpose: NvqsAttachmentPurpose;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    size_bytes: number;
    uploaded_by: string | null;
    created_at: string | Date;
  },
): CitizenNvqsAttachment {
  const filePath = String(r.file_path || "");
  return {
    id: r.id,
    citizenId: r.citizen_id,
    purpose: r.purpose,
    fileName: r.file_name,
    filePath,
    mimeType: r.mime_type || "application/octet-stream",
    sizeBytes: Number(r.size_bytes) || 0,
    uploadedBy: r.uploaded_by,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    url: filePath.startsWith("/") ? filePath : `/${filePath}`,
  };
}

export async function listCitizenNvqsAttachments(
  citizenId: string,
  purpose?: NvqsAttachmentPurpose | NvqsAttachmentPurpose[],
): Promise<CitizenNvqsAttachment[]> {
  if (!(await ensureCitizenNvqsAttachmentsTable())) return [];
  const purposes = purpose
    ? Array.isArray(purpose)
      ? purpose
      : [purpose]
    : null;
  let where = "citizen_id = ?";
  const params: (string | number)[] = [citizenId];
  if (purposes?.length) {
    where += ` AND purpose IN (${purposes.map(() => "?").join(",")})`;
    params.push(...purposes);
  }
  const rows = await queryRows<
    (RowDataPacket & {
      id: string;
      citizen_id: string;
      purpose: NvqsAttachmentPurpose;
      file_name: string;
      file_path: string;
      mime_type: string | null;
      size_bytes: number;
      uploaded_by: string | null;
      created_at: string | Date;
    })[]
  >(
    `SELECT * FROM citizen_nvqs_attachments WHERE ${where} ORDER BY created_at DESC`,
    params,
  );
  return rows.map(mapRow);
}

export async function countCitizenNvqsAttachments(
  citizenId: string,
  purpose: NvqsAttachmentPurpose | NvqsAttachmentPurpose[] | MinhChungLoai,
): Promise<number> {
  if (!(await ensureCitizenNvqsAttachmentsTable())) return 0;
  const purposes: NvqsAttachmentPurpose[] = Array.isArray(purpose)
    ? purpose
    : purpose === "giay_tam_hoan" ||
        purpose === "giay_mien_goi" ||
        purpose === "giay_kham_suc_khoe"
      ? purposesEquivalentTo(purpose)
      : [purpose];
  const [row] = await queryRows<(RowDataPacket & { n: number })[]>(
    `SELECT COUNT(*) AS n FROM citizen_nvqs_attachments
     WHERE citizen_id = ? AND purpose IN (${purposes.map(() => "?").join(",")})`,
    [citizenId, ...purposes],
  );
  return Number(row?.n || 0);
}

export async function saveCitizenNvqsFiles(
  citizenId: string,
  purpose: MinhChungLoai,
  files: File[],
  opts: {
    uploadedBy?: string;
    uploaderLevel?: string | null;
    uploaderUnitCode?: string | null;
    citizenUnitCode?: string | null;
    /** @deprecated dùng uploaderUnitCode + citizenUnitCode */
    unitCode?: string | null;
  } = {},
): Promise<{
  attachments: CitizenNvqsAttachment[];
  locality: MinhChungLocalityFolders;
}> {
  if (!(await ensureCitizenNvqsAttachmentsTable())) {
    throw new Error("Không khởi tạo được bảng minh chứng");
  }
  const locality = await resolveMinhChungUploadFolders({
    uploaderLevel: opts.uploaderLevel,
    uploaderUnitCode: opts.uploaderUnitCode || opts.unitCode,
    citizenUnitCode: opts.citizenUnitCode || opts.unitCode,
  });
  if (files.length === 0) {
    return { attachments: [], locality };
  }
  if (files.length > MAX_FILES) {
    throw new Error(`Tối đa ${MAX_FILES} tệp mỗi lần tải lên`);
  }
  if (locality.tinh === "chua-xac-dinh" && locality.xa === "chua-xac-dinh") {
    throw new Error(
      "Không xác định được tỉnh/xã của tài khoản hoặc hồ sơ để lưu minh chứng",
    );
  }

  const loaiFolder = minhChungFolderSlug(purpose);
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const relativeDir = path
    .join(
      "uploads",
      "minh-chung",
      locality.tinh,
      locality.xa,
      loaiFolder,
      year,
      month,
    )
    .replace(/\\/g, "/");
  const absDir = path.join(process.cwd(), "public", relativeDir);
  await fs.mkdir(absDir, { recursive: true });

  const saved: CitizenNvqsAttachment[] = [];

  for (const file of files) {
    if (!ALLOWED_EXT.test(file.name)) {
      throw new Error(`Định dạng không hỗ trợ: ${file.name}`);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      throw new Error(`Tệp quá lớn (tối đa 12MB): ${file.name}`);
    }
    const id = newId();
    const safeName = file.name.replace(/[^\w.\-()\sÀ-ỹ]+/gi, "_").slice(0, 180);
    const diskName = `${id}_${safeName}`;
    await fs.writeFile(path.join(absDir, diskName), buf);
    const relativePath = `${relativeDir}/${diskName}`;

    await queryExecute(
      `INSERT INTO citizen_nvqs_attachments
        (id, citizen_id, purpose, file_name, file_path, mime_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        citizenId,
        purpose,
        file.name,
        relativePath,
        file.type || "application/octet-stream",
        buf.length,
        opts.uploadedBy || null,
      ],
    );
    saved.push({
      id,
      citizenId,
      purpose,
      fileName: file.name,
      filePath: relativePath,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buf.length,
      uploadedBy: opts.uploadedBy || null,
      createdAt: new Date().toISOString(),
      url: `/${relativePath}`,
    });
  }
  return { attachments: saved, locality };
}

export async function deleteCitizenNvqsAttachment(
  citizenId: string,
  attachmentId: string,
): Promise<boolean> {
  if (!(await ensureCitizenNvqsAttachmentsTable())) return false;
  const rows = await queryRows<
    (RowDataPacket & { id: string; file_path: string })[]
  >(
    `SELECT id, file_path FROM citizen_nvqs_attachments
     WHERE id = ? AND citizen_id = ? LIMIT 1`,
    [attachmentId, citizenId],
  );
  if (!rows[0]) return false;
  await queryExecute(
    `DELETE FROM citizen_nvqs_attachments WHERE id = ? AND citizen_id = ?`,
    [attachmentId, citizenId],
  );
  try {
    const abs = path.join(process.cwd(), "public", rows[0].file_path);
    await fs.unlink(abs);
  } catch {
    // ignore missing file
  }
  return true;
}
