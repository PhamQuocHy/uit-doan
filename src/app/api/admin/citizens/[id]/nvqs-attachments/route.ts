import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findCitizenByIdFromDb } from "@/lib/citizens-db";
import {
  countCitizenNvqsAttachments,
  deleteCitizenNvqsAttachment,
  listCitizenNvqsAttachments,
  saveCitizenNvqsFiles,
  type NvqsAttachmentPurpose,
} from "@/lib/citizen-nvqs-attachments-db";

function parsePurpose(raw: string | null): NvqsAttachmentPurpose | null {
  if (raw === "khong_goi" || raw === "tam_hoan") return raw;
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const purpose = parsePurpose(
    new URL(request.url).searchParams.get("purpose"),
  );
  const citizen = await findCitizenByIdFromDb(id);
  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
  }
  const data = await listCitizenNvqsAttachments(id, purpose || undefined);
  return NextResponse.json({ data });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const citizen = await findCitizenByIdFromDb(id);
  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
  }

  const form = await request.formData();
  const purpose = parsePurpose(String(form.get("purpose") || ""));
  if (!purpose) {
    return NextResponse.json(
      { error: "purpose phải là khong_goi hoặc tam_hoan" },
      { status: 400 },
    );
  }

  const files = form
    .getAll("files")
    .filter((f): f is File => typeof File !== "undefined" && f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Chưa chọn tệp minh chứng" }, { status: 400 });
  }

  try {
    const saved = await saveCitizenNvqsFiles(
      id,
      purpose,
      files,
      session.username || session.unitCode,
    );
    const total = await countCitizenNvqsAttachments(id, purpose);
    return NextResponse.json({ data: saved, total }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không tải lên được" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const attachmentId = new URL(request.url).searchParams.get("attachmentId");
  if (!attachmentId) {
    return NextResponse.json({ error: "Thiếu attachmentId" }, { status: 400 });
  }
  const ok = await deleteCitizenNvqsAttachment(id, attachmentId);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
