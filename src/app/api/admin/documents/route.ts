import { NextRequest, NextResponse } from "next/server";
import { db, getChildUnits, hierarchyUnits, type HierarchyUnit } from "@/lib/data";
import { getSession } from "@/lib/auth";
import {
  createOfficialDocumentInDb,
  findOfficialDocumentsFromDb,
  nextOfficialDocCode,
} from "@/lib/official-documents-db";
import type { MilitaryDocument } from "@/lib/data";
import { pingDb } from "@/lib/db";
import {
  ensureMilitaryUnitsInMemory,
  getProvincesForMilitaryRegion,
  isQuanKhuOrBtl,
  MILITARY_REGIONS,
} from "@/lib/military-regions";

ensureMilitaryUnitsInMemory();

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 8;
const ALLOWED_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".zip",
  ".rar",
  ".txt",
]);

function isAllowedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
  return ALLOWED_EXT.has(ext);
}

type RecipientUnit = Pick<HierarchyUnit, "code" | "name" | "level">;

function uniqueUnits(units: HierarchyUnit[]): RecipientUnit[] {
  const seen = new Set<string>();
  return units
    .filter((unit) => {
      if (seen.has(unit.code)) return false;
      seen.add(unit.code);
      return true;
    })
    .map(({ code, name, level }) => ({ code, name, level }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

function unitByCode(code: string): HierarchyUnit | undefined {
  return hierarchyUnits.find((unit) => unit.code === code);
}

function recipientUnitsFor(unitCode: string, level: string): {
  outgoing: RecipientUnit[];
  incoming: RecipientUnit[];
} {
  if (level === "bo" || unitCode === "bo") {
    return { outgoing: uniqueUnits(getChildUnits("bo")), incoming: [] };
  }

  if (level === "donvi" && isQuanKhuOrBtl(unitCode)) {
    const provinces = getProvincesForMilitaryRegion(unitCode)
      .map(unitByCode)
      .filter((unit): unit is HierarchyUnit => Boolean(unit));
    return {
      outgoing: uniqueUnits([...provinces, ...getChildUnits(unitCode)]),
      incoming: [{ code: "bo", name: "Bộ Quốc phòng", level: "bo" }],
    };
  }

  const current = unitByCode(unitCode);
  const directChildren = getChildUnits(unitCode);
  const administrativeParent = current?.parentCode
    ? unitByCode(current.parentCode)
    : undefined;
  const militaryRegion =
    level === "tinh"
      ? MILITARY_REGIONS.find((region) =>
          region.provinceCodes?.includes(unitCode),
        )
      : undefined;
  const parents = [
    administrativeParent,
    militaryRegion ? unitByCode(militaryRegion.code) : undefined,
  ].filter((unit): unit is HierarchyUnit => Boolean(unit));

  return {
    outgoing: uniqueUnits(directChildren),
    incoming: uniqueUnits(parents),
  };
}

async function parseBody(request: NextRequest): Promise<{
  title: string;
  content: string;
  toUnits: string[];
  urgent: boolean;
  type: "incoming" | "outgoing";
  files: File[];
  error?: string;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const content = String(form.get("content") || "").trim();
    const urgent = String(form.get("urgent") || "") === "1" || String(form.get("urgent")) === "true";
    const typeRaw = String(form.get("type") || "outgoing");
    const type = typeRaw === "incoming" ? "incoming" : "outgoing";
    let toUnits: string[] = [];
    const rawUnits = form.get("toUnits");
    if (typeof rawUnits === "string" && rawUnits.trim()) {
      try {
        const parsed = JSON.parse(rawUnits);
        if (Array.isArray(parsed)) toUnits = parsed.map(String);
      } catch {
        toUnits = rawUnits.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    form.getAll("toUnits[]").forEach((v) => {
      if (typeof v === "string" && v.trim()) toUnits.push(v.trim());
    });
    toUnits = [...new Set(toUnits)];

    const files: File[] = [];
    for (const key of ["files", "file", "attachments"]) {
      for (const item of form.getAll(key)) {
        if (item instanceof File && item.size > 0) files.push(item);
      }
    }

    if (files.length > MAX_FILES) {
      return {
        title,
        content,
        toUnits,
        urgent,
        type,
        files: [],
        error: `Tối đa ${MAX_FILES} tệp đính kèm`,
      };
    }
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        return {
          title,
          content,
          toUnits,
          urgent,
          type,
          files: [],
          error: `Tệp “${f.name}” vượt quá 12MB`,
        };
      }
      if (!isAllowedFile(f)) {
        return {
          title,
          content,
          toUnits,
          urgent,
          type,
          files: [],
          error: `Định dạng không hỗ trợ: ${f.name}`,
        };
      }
    }

    return { title, content, toUnits, urgent, type, files };
  }

  const body = await request.json();
  return {
    title: String(body.title || "").trim(),
    content: String(body.content || "").trim(),
    toUnits: Array.isArray(body.toUnits) ? body.toUnits.map(String) : [],
    urgent: Boolean(body.urgent),
    type: body.type === "incoming" ? "incoming" : "outgoing",
    files: [],
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromDb = await findOfficialDocumentsFromDb({
    unitCode: session.unitCode,
    hierarchyLevel: session.hierarchyLevel,
  });
  const recipients = recipientUnitsFor(
    session.unitCode,
    session.hierarchyLevel,
  );
  const forViewer = (documents: MilitaryDocument[]) =>
    documents.map((document) => ({
      ...document,
      type: document.fromUnit === session.unitCode ? "outgoing" : "incoming",
    }));
  if (fromDb) {
    const memoryDocs = db.documents.findForUnit(
      session.unitCode,
      session.hierarchyLevel,
    );
    const persistedIds = new Set(fromDb.map((document) => document.id));
    const merged = [
      ...fromDb,
      ...memoryDocs.filter((document) => !persistedIds.has(document.id)),
    ];
    return NextResponse.json({
      data: forViewer(merged),
      recipientUnits: recipients,
      meta: { source: "mysql" },
    });
  }

  const docs = db.documents.findForUnit(
    session.unitCode,
    session.hierarchyLevel,
  );
  return NextResponse.json({
    data: forViewer(docs),
    recipientUnits: recipients,
    meta: { source: "memory" },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await pingDb())) {
    return NextResponse.json(
      { error: "Không kết nối được cơ sở dữ liệu. Công văn chưa được gửi." },
      { status: 503 },
    );
  }

  const parsed = await parseBody(request);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { title, content, toUnits, urgent, type, files } = parsed;

  if (!title || !toUnits.length) {
    return NextResponse.json(
      { error: "Thiếu tiêu đề hoặc đơn vị nhận" },
      { status: 400 },
    );
  }

  const recipientOptions = recipientUnitsFor(
    session.unitCode,
    session.hierarchyLevel,
  );
  const allowedRecipients = new Set(recipientOptions[type].map((unit) => unit.code));
  const invalidRecipients = toUnits.filter((unit) => !allowedRecipients.has(unit));
  if (invalidRecipients.length > 0) {
    return NextResponse.json(
      { error: "Đơn vị nhận không hợp lệ hoặc không thuộc phạm vi gửi công văn" },
      { status: 403 },
    );
  }

  const now = new Date().toISOString().slice(0, 10);
  const code = await nextOfficialDocCode(type);

  let doc: MilitaryDocument;
  try {
    const saved = await createOfficialDocumentInDb({
      code,
      title,
      content: content || "",
      type,
      fromUnit: session.unitCode,
      toUnits,
      date: now,
      status: "sent",
      urgent,
      createdBy: session.userId,
      files,
    });
    if (!saved) throw new Error("Database unavailable");
    doc = saved;
  } catch (error) {
    console.error("POST /api/admin/documents:", error);
    return NextResponse.json(
      { error: "Không lưu được công văn vào cơ sở dữ liệu. Vui lòng thử lại." },
      { status: 500 },
    );
  }

  for (const unit of toUnits) {
    if (unit === session.unitCode) continue;
    db.notifications.create({
      toUnit: unit,
      type: "document_incoming",
      title: urgent ? "Công văn đến (khẩn)" : "Công văn đến",
      message: `${session.name} gửi: ${title}`,
      relatedHref: "/admin/documents",
    });
  }
  db.notifications.create({
    toUnit: session.unitCode,
    type: "document_outgoing",
    title: urgent ? "Công văn đi (khẩn)" : "Công văn đi",
    message: `Đã gửi “${title}” tới ${toUnits.length} đơn vị.`,
    relatedHref: "/admin/documents",
  });

  return NextResponse.json(
    { data: doc, meta: { source: "mysql" } },
    { status: 201 },
  );
}
