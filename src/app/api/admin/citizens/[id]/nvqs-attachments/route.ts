import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findCitizenByIdFromDb } from "@/lib/citizens-db";
import {
  countCitizenNvqsAttachments,
  deleteCitizenNvqsAttachment,
  listCitizenNvqsAttachments,
  parseMinhChungLoai,
  purposesEquivalentTo,
  saveCitizenNvqsFiles,
  type MinhChungLoai,
} from "@/lib/citizen-nvqs-attachments-db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const purposeRaw = new URL(request.url).searchParams.get("purpose");
  const loai = parseMinhChungLoai(purposeRaw);
  const citizen = await findCitizenByIdFromDb(id);
  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
  }
  const data = await listCitizenNvqsAttachments(
    id,
    loai ? purposesEquivalentTo(loai) : undefined,
  );
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
  const purpose = parseMinhChungLoai(String(form.get("purpose") || ""));
  if (!purpose) {
    return NextResponse.json(
      {
        error:
          "Vui lòng chọn loại minh chứng: giấy tạm hoãn, giấy miễn gọi hoặc giấy khám sức khỏe",
      },
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
    const result = await saveCitizenNvqsFiles(id, purpose as MinhChungLoai, files, {
      uploadedBy: session.username || session.unitCode,
      uploaderLevel: session.hierarchyLevel,
      uploaderUnitCode: session.unitCode,
      citizenUnitCode: citizen.unitCode,
    });
    const total = await countCitizenNvqsAttachments(id, purpose);
    return NextResponse.json(
      {
        data: result.attachments,
        total,
        locality: {
          tinh: result.locality.tinhName,
          xa: result.locality.xaName,
          tinhCode: result.locality.tinhCode,
          xaCode: result.locality.xaCode,
          folder: `minh-chung/${result.locality.tinh}/${result.locality.xa}`,
        },
      },
      { status: 201 },
    );
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
