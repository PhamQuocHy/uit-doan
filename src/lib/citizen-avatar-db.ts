import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { pingDb, queryExecute, queryRows } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { resolveMinhChungUploadFolders } from "@/lib/citizen-nvqs-attachments-db";
import { ensureCitizenAvatarColumn } from "@/lib/citizens-db";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT = /\.(png|jpe?g|webp|gif)$/i;

function newId() {
  return `avatar_${randomBytes(6).toString("hex")}`;
}

function publicRoot() {
  return path.join(process.cwd(), "public");
}

async function readCurrentAvatarUrl(citizenId: string): Promise<string | null> {
  const rows = await queryRows<(RowDataPacket & { avatar_url: string | null })[]>(
    `SELECT avatar_url FROM citizen_identities WHERE citizen_id = ? LIMIT 1`,
    [citizenId],
  );
  return rows[0]?.avatar_url || null;
}

async function unlinkIfManagedAvatar(filePath: string | null | undefined) {
  const raw = (filePath || "").trim().replace(/^\/+/, "");
  if (!raw.startsWith("uploads/avatars/")) return;
  try {
    await fs.unlink(path.join(publicRoot(), raw));
  } catch {
    // ignore missing file
  }
}

async function writeAvatarUrl(citizenId: string, avatarUrl: string | null) {
  await ensureCitizenAvatarColumn();
  await queryExecute(
    `INSERT INTO citizen_identities (citizen_id, avatar_url)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE avatar_url = VALUES(avatar_url)`,
    [citizenId, avatarUrl],
  );
}

/**
 * Lưu ảnh 3×4 theo cấu trúc giống minh chứng:
 * uploads/avatars/{tinh}/{xa}/anh-the/{YYYY}/{MM}/avatar_xxx_ten.jpg
 */
export async function saveCitizenAvatarFile(
  citizenId: string,
  file: File,
  opts: {
    uploaderLevel?: string | null;
    uploaderUnitCode?: string | null;
    citizenUnitCode?: string | null;
  } = {},
): Promise<{ avatar: string; filePath: string; locality: { tinh: string; xa: string } }> {
  if (!(await pingDb())) {
    throw new Error("Database không khả dụng");
  }
  if (!ALLOWED_EXT.test(file.name)) {
    throw new Error("Chỉ hỗ trợ ảnh PNG, JPG, WEBP, GIF");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    throw new Error("Ảnh quá lớn (tối đa 5MB)");
  }

  const locality = await resolveMinhChungUploadFolders({
    uploaderLevel: opts.uploaderLevel,
    uploaderUnitCode: opts.uploaderUnitCode,
    citizenUnitCode: opts.citizenUnitCode,
  });
  if (locality.tinh === "chua-xac-dinh" && locality.xa === "chua-xac-dinh") {
    throw new Error(
      "Không xác định được tỉnh/xã của tài khoản hoặc hồ sơ để lưu ảnh",
    );
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const relativeDir = path
    .join(
      "uploads",
      "avatars",
      locality.tinh,
      locality.xa,
      "anh-the",
      year,
      month,
    )
    .replace(/\\/g, "/");
  const absDir = path.join(publicRoot(), relativeDir);
  await fs.mkdir(absDir, { recursive: true });

  const id = newId();
  const safeName = file.name.replace(/[^\w.\-()\sÀ-ỹ]+/gi, "_").slice(0, 120);
  const diskName = `${id}_${safeName}`;
  await fs.writeFile(path.join(absDir, diskName), buf);
  const relativePath = `${relativeDir}/${diskName}`;
  const publicUrl = `/${relativePath}`;

  const prev = await readCurrentAvatarUrl(citizenId);
  await writeAvatarUrl(citizenId, publicUrl);
  await unlinkIfManagedAvatar(prev);

  return {
    avatar: publicUrl,
    filePath: relativePath,
    locality: { tinh: locality.tinh, xa: locality.xa },
  };
}

export async function clearCitizenAvatarFile(citizenId: string): Promise<void> {
  if (!(await pingDb())) {
    throw new Error("Database không khả dụng");
  }
  const prev = await readCurrentAvatarUrl(citizenId);
  await writeAvatarUrl(citizenId, null);
  await unlinkIfManagedAvatar(prev);
}
