import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findCitizenByIdFromDb } from "@/lib/citizens-db";
import {
  clearCitizenAvatarFile,
  saveCitizenAvatarFile,
} from "@/lib/citizen-avatar-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pickUploadFile(form: FormData): File | null {
  const raw = form.get("file");
  if (raw && typeof raw !== "string" && typeof (raw as Blob).arrayBuffer === "function") {
    return raw as File;
  }
  return null;
}

/** POST multipart: citizenId + file — tránh lỗi Nest route [id]/avatar với Turbopack. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const id = String(form.get("citizenId") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Thiếu mã hồ sơ" }, { status: 400 });
  }

  const citizen = await findCitizenByIdFromDb(id);
  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
  }

  const file = pickUploadFile(form);
  if (!file) {
    return NextResponse.json({ error: "Chưa chọn ảnh" }, { status: 400 });
  }

  try {
    const result = await saveCitizenAvatarFile(id, file, {
      uploaderLevel: session.hierarchyLevel,
      uploaderUnitCode: session.unitCode,
      citizenUnitCode: citizen.unitCode,
    });
    const updated = await findCitizenByIdFromDb(id);
    return NextResponse.json({
      data: updated,
      avatar: result.avatar,
      folder: `avatars/${result.locality.tinh}/${result.locality.xa}/anh-the`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không tải được ảnh" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("citizenId") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Thiếu mã hồ sơ" }, { status: 400 });
  }

  const citizen = await findCitizenByIdFromDb(id);
  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ" }, { status: 404 });
  }

  try {
    await clearCitizenAvatarFile(id);
    const updated = await findCitizenByIdFromDb(id);
    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không xóa được ảnh" },
      { status: 400 },
    );
  }
}
