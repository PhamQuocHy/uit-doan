import { withApiGuard } from "@/lib/security/api-guard";
import { validatePdf, safePdfName } from "@/lib/security/controls";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLegalDocument } from "@/lib/legal-docs";
import { queryExecute } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

async function GETHandler(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const doc = await getLegalDocument(decodeURIComponent(id), session.hierarchyLevel);
  if (!doc) {
    return NextResponse.json({ error: "Không tìm thấy văn bản" }, { status: 404 });
  }

  return NextResponse.json({ data: doc });
}

async function PATCHHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  const code = String(form.get("code") || "").trim();
  const title = String(form.get("title") || "").trim();
  const issuer = String(form.get("issuer") || "").trim();
  const issuedDate = String(form.get("issuedDate") || "").trim();
  const effectiveDate = String(form.get("effectiveDate") || "").trim();
  const docType = String(form.get("docType") || "khac").trim();
  const summary = String(form.get("summary") || "").trim();
  const sourceUrl = String(form.get("sourceUrl") || "").trim();
  if (!code || !title || !issuer) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }
  if (file instanceof File && file.size > 0) {
    const pdfError = await validatePdf(file);
    if (pdfError) return NextResponse.json({ error: pdfError }, { status: 400 });
  }
  const result = await queryExecute(
    `UPDATE legal_documents
     SET code = ?, title = ?, issuer = ?, issued_date = ?, effective_date = ?,
         doc_type = ?, summary = ?, source_url = ?
     WHERE id = ? AND hierarchy_level = ? AND is_active = 1`,
    [code, title, issuer, issuedDate || null, effectiveDate || null,
      docType, summary, sourceUrl, id, session.hierarchyLevel],
  );
  if (!result.affectedRows) return NextResponse.json({ error: "Không tìm thấy văn bản ở cấp của bạn" }, { status: 404 });
  if (file instanceof File && file.size > 0) {
    const current = await getLegalDocument(id, session.hierarchyLevel);
    if (current && safePdfName(current.file_name)) {
      const publicDir = path.join(process.cwd(), "public", "documents", "nvqs");
      await fs.writeFile(path.join(publicDir, current.file_name), Buffer.from(await file.arrayBuffer()));
    }
  }
  return NextResponse.json({ ok: true });
}

async function DELETEHandler(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const doc = await getLegalDocument(decodeURIComponent(id), session.hierarchyLevel);
  if (!doc) return NextResponse.json({ error: "Không tìm thấy văn bản ở cấp của bạn" }, { status: 404 });
  const result = await queryExecute(
    "UPDATE legal_documents SET is_active = 0 WHERE id = ? AND hierarchy_level = ?",
    [id, session.hierarchyLevel],
  );
  if (result.affectedRows && doc.file_name.startsWith("custom-") && safePdfName(doc.file_name)) {
    await fs.rm(path.join(process.cwd(), "public", "documents", "nvqs", doc.file_name), { force: true });
  }
  return NextResponse.json({ ok: true });
}

export const GET = withApiGuard(GETHandler);
export const PATCH = withApiGuard(PATCHHandler);
export const DELETE = withApiGuard(DELETEHandler);
