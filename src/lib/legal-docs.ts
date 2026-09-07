import fs from "fs";
import path from "path";
import type { RowDataPacket } from "mysql2";
import { pingDb, queryExecute, queryRows } from "@/lib/db";
import { toDateOnlyString } from "@/lib/date-vn";

export type LegalDocType =
  | "luat"
  | "thong_tu"
  | "van_ban_hop_nhat"
  | "nghi_dinh"
  | "quyet_dinh"
  | "khac";

export type LegalDocumentMeta = {
  id: string;
  code: string;
  title: string;
  issuer: string;
  issued_date: string;
  effective_date: string;
  doc_type: LegalDocType | string;
  priority: number;
  summary: string;
  source_url: string;
  file_name: string;
  source_file_name?: string;
  hierarchy_level?: string;
  tags: string[];
};

export type LegalDocument = LegalDocumentMeta & {
  file_path: string;
  public_url: string;
  category: string;
  year: number;
  content?: string;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  luat: "Luật",
  thong_tu: "Thông tư",
  van_ban_hop_nhat: "Văn bản hợp nhất",
  nghi_dinh: "Nghị định",
  quyet_dinh: "Quyết định",
  khac: "Khác",
};

export function docTypeLabel(docType: string): string {
  return DOC_TYPE_LABELS[docType] || docType;
}

function legalDocsDir(): string {
  return path.join(process.cwd(), "data", "legal-docs");
}

export function loadCatalogFromDisk(): LegalDocumentMeta[] {
  const catalogPath = path.join(legalDocsDir(), "catalog.json");
  const raw = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as LegalDocumentMeta[];
  return raw.sort((a, b) => a.priority - b.priority);
}

export function readLegalDocContent(fileName: string): string {
  if (!fileName.toLowerCase().endsWith(".md")) return "";
  let filePath = path.join(legalDocsDir(), fileName);
  if (!fs.existsSync(filePath) && fileName.endsWith(".pdf")) {
    filePath = path.join(legalDocsDir(), fileName.replace(/\.pdf$/i, ".md"));
  }
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function enrich(meta: LegalDocumentMeta, content?: string): LegalDocument {
  const year = Number((meta.issued_date || "").slice(0, 4)) || 0;
  const pdfFileName = meta.file_name.replace(/\.md$/i, ".pdf");
  return {
    ...meta,
    file_path: `data/legal-docs/${pdfFileName}`,
    public_url: `/documents/nvqs/${pdfFileName}`,
    category: docTypeLabel(meta.doc_type),
    year,
    ...(content !== undefined ? { content } : {}),
  };
}

export function listLegalDocumentsFromDisk(includeContent = false): LegalDocument[] {
  return loadCatalogFromDisk().map((m) =>
    enrich(
      m,
      includeContent
        ? readLegalDocContent(m.source_file_name || m.file_name)
        : undefined,
    ),
  );
}

export function getLegalDocumentFromDisk(id: string): LegalDocument | null {
  const meta = loadCatalogFromDisk().find((d) => d.id === id || d.code === id);
  if (!meta) return null;
  return enrich(meta, readLegalDocContent(meta.source_file_name || meta.file_name));
}

/** Văn bản ngắn gọn để đưa vào prompt AI */
export function buildLegalKnowledgeForAi(maxChars = 14000): string {
  const docs = listLegalDocumentsFromDisk(true);
  const header = [
    "### Kho văn bản pháp lý NVQS (ưu tiên bản mới nhất 2025)",
    "Khi hỏi về luật, độ tuổi, tạm hoãn, miễn gọi, tuyển chọn, sức khỏe — trả lời theo các văn bản dưới đây và nêu số hiệu.",
  ];

  const chunks: string[] = [...header];
  let used = header.join("\n").length;

  for (const doc of docs) {
    const body = (doc.content || doc.summary || "").trim();
    const block = [
      `\n#### ${doc.code} — ${doc.title}`,
      `Ban hành: ${doc.issuer} | Ngày: ${doc.issued_date} | Hiệu lực: ${doc.effective_date}`,
      body.slice(0, 3500),
    ].join("\n");

    if (used + block.length > maxChars) break;
    chunks.push(block);
    used += block.length;
  }

  return chunks.join("\n");
}

export function questionNeedsLegalContext(question: string): boolean {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

  const keywords = [
    "luat",
    "thong tu",
    "nghi dinh",
    "van ban",
    "nvqs",
    "nghia vu",
    "nhap ngu",
    "goi nhap",
    "tam hoan",
    "mien goi",
    "do tuoi",
    "tuoi",
    "suc khoe",
    "kham tuyen",
    "tuyen chon",
    "tuyen quan",
    "dieu 30",
    "dieu 41",
    "hop nhat",
    "phap ly",
    "quy dinh",
  ];

  return keywords.some((k) => q.includes(k));
}

export async function upsertLegalDocumentsToDb(): Promise<number> {
  const docs = listLegalDocumentsFromDisk(true);
  let n = 0;
  for (const doc of docs) {
    await queryExecute(
      `INSERT INTO legal_documents
        (id, code, title, issuer, issued_date, effective_date, doc_type, priority,
         summary, source_url, file_name, file_path, content_text, tags_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         issuer = VALUES(issuer),
         issued_date = VALUES(issued_date),
         effective_date = VALUES(effective_date),
         doc_type = VALUES(doc_type),
         priority = VALUES(priority),
         summary = VALUES(summary),
         source_url = VALUES(source_url),
         file_name = VALUES(file_name),
         file_path = VALUES(file_path),
         content_text = VALUES(content_text),
         tags_json = VALUES(tags_json),
         is_active = 1`,
      [
        doc.id,
        doc.code,
        doc.title,
        doc.issuer,
        doc.issued_date || null,
        doc.effective_date || null,
        doc.doc_type,
        doc.priority,
        doc.summary,
        doc.source_url,
        doc.file_name,
        doc.file_path,
        doc.content || "",
        JSON.stringify(doc.tags || []),
      ],
    );
    n += 1;
  }
  return n;
}

export async function listLegalDocuments(hierarchyLevel: string): Promise<{
  data: LegalDocument[];
  source: "mysql" | "disk";
}> {
  const dbOk = await pingDb();
  if (dbOk) {
    try {
      const rows = await queryRows<
        (RowDataPacket & {
          id: string;
          code: string;
          title: string;
          issuer: string;
          issued_date: string | Date | null;
          effective_date: string | Date | null;
          doc_type: string;
          priority: number;
          summary: string | null;
          source_url: string | null;
          file_name: string;
          file_path: string;
          tags_json: string | object | null;
          hierarchy_level: string;
        })[]
      >(
        `SELECT id, code, title, issuer, issued_date, effective_date, doc_type, priority,
                summary, source_url, file_name, file_path, tags_json
         FROM legal_documents
         WHERE is_active = 1 AND hierarchy_level = ?
         ORDER BY priority ASC, issued_date DESC`,
        [hierarchyLevel],
      );

      if (rows.length > 0) {
        const data = rows.map((r) => {
          let tags: string[] = [];
          try {
            tags =
              typeof r.tags_json === "string"
                ? JSON.parse(r.tags_json)
                : Array.isArray(r.tags_json)
                  ? (r.tags_json as string[])
                  : [];
          } catch {
            tags = [];
          }
          const issued = toDateOnlyString(r.issued_date) || "";
          return enrich({
            id: r.id,
            code: r.code,
            title: r.title,
            issuer: r.issuer,
            issued_date: issued,
            effective_date: toDateOnlyString(r.effective_date) || "",
            doc_type: r.doc_type,
            priority: r.priority,
            summary: r.summary || "",
            source_url: r.source_url || "",
            file_name: r.file_name,
            hierarchy_level: r.hierarchy_level,
            tags,
          });
        });
        return { data, source: "mysql" };
      }
    } catch (e) {
      console.error("listLegalDocuments mysql:", e);
    }
  }

  return { data: listLegalDocumentsFromDisk(false), source: "disk" };
}

export async function getLegalDocument(id: string, hierarchyLevel: string): Promise<LegalDocument | null> {
  const dbOk = await pingDb();
  if (dbOk) {
    try {
      const rows = await queryRows<
        (RowDataPacket & {
          id: string;
          code: string;
          title: string;
          issuer: string;
          issued_date: string | Date | null;
          effective_date: string | Date | null;
          doc_type: string;
          priority: number;
          summary: string | null;
          source_url: string | null;
          file_name: string;
          content_text: string | null;
          tags_json: string | object | null;
          hierarchy_level: string;
        })[]
      >(
        `SELECT id, code, title, issuer, issued_date, effective_date, doc_type, priority,
                summary, source_url, file_name, content_text, tags_json
         FROM legal_documents
         WHERE is_active = 1 AND hierarchy_level = ? AND (id = ? OR code = ?)
         LIMIT 1`,
        [hierarchyLevel, id, id],
      );
      const r = rows[0];
      if (r) {
        let tags: string[] = [];
        try {
          tags =
            typeof r.tags_json === "string"
              ? JSON.parse(r.tags_json)
              : Array.isArray(r.tags_json)
                ? (r.tags_json as string[])
                : [];
        } catch {
          tags = [];
        }
        const issued = toDateOnlyString(r.issued_date) || "";
        const content =
          r.content_text || readLegalDocContent(r.file_name);
        return enrich(
          {
            id: r.id,
            code: r.code,
            title: r.title,
            issuer: r.issuer,
            issued_date: issued,
            effective_date: toDateOnlyString(r.effective_date) || "",
            doc_type: r.doc_type,
            priority: r.priority,
            summary: r.summary || "",
            source_url: r.source_url || "",
            file_name: r.file_name,
            hierarchy_level: r.hierarchy_level,
            tags,
          },
          content,
        );
      }
    } catch (e) {
      console.error("getLegalDocument mysql:", e);
    }
  }

  return null;
}
