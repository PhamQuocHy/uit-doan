import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";

export type NvqsAttachmentPurpose = "khong_goi" | "tam_hoan";

export type CitizenNvqsAttachment = {
  id: string;
  citizenId: string;
  purpose: NvqsAttachmentPurpose;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string | null;
  createdAt: string;
  url: string;
};

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "citizen-nvqs");
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 8;
const ALLOWED_EXT = /\.(pdf|png|jpe?g|webp|gif|doc|docx|xls|xlsx)$/i;

function newId() {
  return `nvatt_${randomBytes(6).toString("hex")}`;
}

export async function ensureCitizenNvqsAttachmentsTable(): Promise<boolean> {
  if (!(await pingDb())) return false;
  try {
    await queryExecute(`
      CREATE TABLE IF NOT EXISTS citizen_nvqs_attachments (
        id VARCHAR(64) NOT NULL,
        citizen_id VARCHAR(64) NOT NULL,
        purpose ENUM('khong_goi','tam_hoan') NOT NULL,
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
  purpose?: NvqsAttachmentPurpose,
): Promise<CitizenNvqsAttachment[]> {
  if (!(await ensureCitizenNvqsAttachmentsTable())) return [];
  const where = purpose
    ? "citizen_id = ? AND purpose = ?"
    : "citizen_id = ?";
  const params = purpose ? [citizenId, purpose] : [citizenId];
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
  purpose: NvqsAttachmentPurpose,
): Promise<number> {
  if (!(await ensureCitizenNvqsAttachmentsTable())) return 0;
  const [row] = await queryRows<(RowDataPacket & { n: number })[]>(
    `SELECT COUNT(*) AS n FROM citizen_nvqs_attachments
     WHERE citizen_id = ? AND purpose = ?`,
    [citizenId, purpose],
  );
  return Number(row?.n || 0);
}

export async function saveCitizenNvqsFiles(
  citizenId: string,
  purpose: NvqsAttachmentPurpose,
  files: File[],
  uploadedBy?: string,
): Promise<CitizenNvqsAttachment[]> {
  if (!(await ensureCitizenNvqsAttachmentsTable())) {
    throw new Error("Không khởi tạo được bảng minh chứng");
  }
  if (files.length === 0) return [];
  if (files.length > MAX_FILES) {
    throw new Error(`Tối đa ${MAX_FILES} tệp mỗi lần tải lên`);
  }

  const dir = path.join(UPLOAD_ROOT, citizenId);
  await fs.mkdir(dir, { recursive: true });
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
    await fs.writeFile(path.join(dir, diskName), buf);
    const relativePath = path
      .join("uploads", "citizen-nvqs", citizenId, diskName)
      .replace(/\\/g, "/");

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
        uploadedBy || null,
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
      uploadedBy: uploadedBy || null,
      createdAt: new Date().toISOString(),
      url: `/${relativePath}`,
    });
  }
  return saved;
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
  return (true as unknown as ResultSetHeader) && true;
}
