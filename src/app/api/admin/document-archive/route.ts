import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listLegalDocuments } from "@/lib/legal-docs";
import { queryExecute } from "@/lib/db";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, source } = await listLegalDocuments(session.hierarchyLevel);
  return NextResponse.json({ data, source, total: data.length });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const code = String(form.get("code") || "").trim();
  const title = String(form.get("title") || "").trim();
  const issuer = String(form.get("issuer") || "").trim();
  const docType = String(form.get("docType") || "khac").trim();
  const summary = String(form.get("summary") || "").trim();
  const sourceUrl = String(form.get("sourceUrl") || "").trim();
  const issuedDate = String(form.get("issuedDate") || "").trim();
  const effectiveDate = String(form.get("effectiveDate") || "").trim();

  if (!code || !title || !issuer || !(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng nhập đủ thông tin và chọn file PDF" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Chỉ chấp nhận file PDF" }, { status: 400 });
  }

  const id = `custom-${randomUUID()}`;
  const fileName = `${id}.pdf`;
  const publicDir = path.join(process.cwd(), "public", "documents", "nvqs");
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, fileName), Buffer.from(await file.arrayBuffer()));

  await queryExecute(
    `INSERT INTO legal_documents
      (id, code, title, issuer, issued_date, effective_date, doc_type, priority,
       summary, source_url, file_name, file_path, content_text, tags_json, is_active, hierarchy_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, 100, ?, ?, ?, ?, '', JSON_ARRAY(), 1, ?)`,
    [id, code, title, issuer, issuedDate || null, effectiveDate || null, docType,
      summary, sourceUrl, fileName, `public/documents/nvqs/${fileName}`, session.hierarchyLevel],
  );
  return NextResponse.json({ data: { id, code, title } }, { status: 201 });
}
