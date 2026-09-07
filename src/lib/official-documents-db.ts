import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import type {
  MilitaryDocument,
  MilitaryDocumentAttachment,
} from "@/lib/data";
import { toDateOnlyString } from "@/lib/date-vn";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "cong-van");

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function toIso(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  return new Date(s.includes("T") ? s : s.replace(" ", "T")).toISOString();
}

function parseToUnits(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function publicUrlFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.indexOf("/uploads/");
  if (idx >= 0) return normalized.slice(idx);
  if (normalized.startsWith("uploads/")) return `/${normalized}`;
  return `/uploads/cong-van/${path.basename(normalized)}`;
}

type DocRow = RowDataPacket & {
  id: string;
  code: string;
  title: string;
  content: string | null;
  type: "incoming" | "outgoing";
  from_unit: string;
  to_units_json: unknown;
  doc_date: string | Date;
  status: string;
  urgent: number;
  created_by: string | null;
  created_at: string | Date;
};

type AttRow = RowDataPacket & {
  id: string;
  document_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number;
};

function mapAttachment(r: AttRow): MilitaryDocumentAttachment {
  return {
    id: r.id,
    fileName: r.file_name,
    url: publicUrlFromPath(r.file_path),
    mimeType: r.mime_type || "application/octet-stream",
    sizeBytes: Number(r.size_bytes) || 0,
  };
}

function mapDoc(
  row: DocRow,
  attachments: MilitaryDocumentAttachment[] = [],
): MilitaryDocument {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    content: row.content || "",
    type: row.type,
    fromUnit: row.from_unit,
    toUnits: parseToUnits(row.to_units_json),
    date: toDateOnlyString(row.doc_date) || "",
    status: (row.status as MilitaryDocument["status"]) || "sent",
    urgent: Boolean(row.urgent),
    createdBy: row.created_by || "",
    createdAt: toIso(row.created_at),
    attachments,
  };
}

async function loadAttachments(
  documentIds: string[],
): Promise<Map<string, MilitaryDocumentAttachment[]>> {
  const map = new Map<string, MilitaryDocumentAttachment[]>();
  if (!documentIds.length) return map;
  const placeholders = documentIds.map(() => "?").join(",");
  const rows = await queryRows<AttRow[]>(
    `SELECT id, document_id, file_name, file_path, mime_type, size_bytes
     FROM official_document_attachments
     WHERE document_id IN (${placeholders})
     ORDER BY created_at ASC`,
    documentIds,
  );
  for (const r of rows) {
    const list = map.get(r.document_id) || [];
    list.push(mapAttachment(r));
    map.set(r.document_id, list);
  }
  return map;
}

export async function findOfficialDocumentsFromDb(args: {
  unitCode: string;
  hierarchyLevel: string;
}): Promise<MilitaryDocument[] | null> {
  if (!(await pingDb())) return null;
  try {
    let rows: DocRow[];
    if (args.hierarchyLevel === "bo") {
      rows = await queryRows<DocRow[]>(
        `SELECT * FROM official_documents
         ORDER BY doc_date DESC, created_at DESC
         LIMIT 500`,
      );
    } else {
      rows = await queryRows<DocRow[]>(
        `SELECT * FROM official_documents
         WHERE from_unit = ?
            OR JSON_CONTAINS(to_units_json, JSON_QUOTE(?), '$')
         ORDER BY doc_date DESC, created_at DESC
         LIMIT 500`,
        [args.unitCode, args.unitCode],
      );
    }
    const attMap = await loadAttachments(rows.map((r) => r.id));
    return rows.map((r) => mapDoc(r, attMap.get(r.id) || []));
  } catch (e) {
    console.error("findOfficialDocumentsFromDb:", e);
    return null;
  }
}

export type SavedUploadFile = {
  id: string;
  fileName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
};

export async function saveOfficialDocFiles(
  documentId: string,
  files: File[],
): Promise<SavedUploadFile[]> {
  const dir = path.join(UPLOAD_DIR, documentId);
  await fs.mkdir(dir, { recursive: true });
  const saved: SavedUploadFile[] = [];

  for (const file of files) {
    const id = newId("att");
    const safeName = file.name.replace(/[^\w.\-()\sÀ-ỹ]+/gi, "_").slice(0, 180);
    const diskName = `${id}_${safeName}`;
    const abs = path.join(dir, diskName);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(abs, buf);
    const relativePath = path
      .join("uploads", "cong-van", documentId, diskName)
      .replace(/\\/g, "/");
    saved.push({
      id,
      fileName: file.name,
      relativePath,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buf.length,
    });
  }
  return saved;
}

export async function createOfficialDocumentInDb(data: {
  code: string;
  title: string;
  content: string;
  type: "incoming" | "outgoing";
  fromUnit: string;
  toUnits: string[];
  date: string;
  status: MilitaryDocument["status"];
  urgent: boolean;
  createdBy: string;
  files?: File[];
}): Promise<MilitaryDocument | null> {
  if (!(await pingDb())) return null;
  const id = newId("doc");
  try {
    await queryExecute(
      `INSERT INTO official_documents
        (id, code, title, content, type, from_unit, to_units_json, doc_date, status, urgent, created_by)
       VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?)`,
      [
        id,
        data.code,
        data.title,
        data.content,
        data.type,
        data.fromUnit,
        JSON.stringify(data.toUnits),
        data.date.slice(0, 10),
        data.status,
        data.urgent ? 1 : 0,
        data.createdBy,
      ],
    );

    const files = data.files || [];
    const saved = files.length ? await saveOfficialDocFiles(id, files) : [];
    for (const f of saved) {
      await queryExecute(
        `INSERT INTO official_document_attachments
          (id, document_id, file_name, file_path, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [f.id, id, f.fileName, f.relativePath, f.mimeType, f.sizeBytes],
      );
    }

    const attachments: MilitaryDocumentAttachment[] = saved.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      url: `/${f.relativePath}`,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
    }));

    return {
      id,
      code: data.code,
      title: data.title,
      content: data.content,
      type: data.type,
      fromUnit: data.fromUnit,
      toUnits: data.toUnits,
      date: data.date.slice(0, 10),
      status: data.status,
      urgent: data.urgent,
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
      attachments,
    };
  } catch (e) {
    console.error("createOfficialDocumentInDb:", e);
    return null;
  }
}

export async function nextOfficialDocCode(
  type: "incoming" | "outgoing",
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = type === "outgoing" ? "CV" : "BC";
  if (!(await pingDb())) {
    return `${prefix}-${year}/001`;
  }
  try {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM official_documents
       WHERE YEAR(doc_date) = ? AND type = ?`,
      [year, type],
    );
    const n = Number(rows[0]?.n ?? 0) + 1;
    return `${prefix}-${year}/${String(n).padStart(3, "0")}`;
  } catch {
    return `${prefix}-${year}/001`;
  }
}
