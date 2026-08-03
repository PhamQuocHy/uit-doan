import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, hierarchyNeedsEditPin, verifyUnitEditPin } from "@/lib/data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const citizen = db.citizens.findById(id);
  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
  }
  return NextResponse.json(citizen);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const existing = db.citizens.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
    }

    const updatesMilitaryStatus = body.militaryStatus !== undefined;
    const updatesReason = body.militaryStatusReason !== undefined;
    const touchesNvqs = updatesMilitaryStatus || updatesReason;

    if (existing.militaryStatusLocked && touchesNvqs) {
      const isBo = session.hierarchyLevel === "bo";
      const bypassLock = body.unlockViaProfile === true;

      if (!isBo && !bypassLock) {
        if (!hierarchyNeedsEditPin(session.hierarchyLevel)) {
          return NextResponse.json(
            { error: "Không thể cập nhật trạng thái NVQS đã khóa" },
            { status: 403 },
          );
        }
        const pin = typeof body.editPin === "string" ? body.editPin : "";
        if (!verifyUnitEditPin(session.unitCode, pin)) {
          return NextResponse.json(
            { error: "Cần mã PIN hợp lệ để sửa trạng thái NVQS đã lưu" },
            { status: 403 },
          );
        }
      }
    }

    const { editPin: _editPin, unlockViaProfile: _unlock, ...safeBody } = body;
    const payload = { ...safeBody };
    if (touchesNvqs && body.militaryStatusLocked !== false) {
      payload.militaryStatusLocked = true;
    }

    const updated = db.citizens.update(id, payload);
    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = db.citizens.delete(id);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
