import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, hierarchyNeedsEditPin, verifyUnitEditPin } from "@/lib/data";
import {
  findCitizenByIdFromDb,
  updateCitizenInDb,
} from "@/lib/citizens-db";
import { pingDb, queryExecute } from "@/lib/db";
import {
  resolveCallIntentUpdate,
  type CallIntent,
} from "@/lib/enlistment-approval";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const fromDb = await findCitizenByIdFromDb(id);
  const citizen = fromDb || db.citizens.findById(id);
  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
  }
  return NextResponse.json(citizen);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const existing =
      (await findCitizenByIdFromDb(id)) || db.citizens.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
    }

    const updatesMilitaryStatus = body.militaryStatus !== undefined;
    const updatesCallIntent = body.callIntent !== undefined;
    const updatesReason = body.militaryStatusReason !== undefined;
    const touchesNvqs = updatesMilitaryStatus || updatesCallIntent || updatesReason;

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

    if (updatesCallIntent || body.militaryStatus === "tamhoan" || body.militaryStatus === "miengoi") {
      if (body.militaryStatus === "tamhoan" || body.militaryStatus === "miengoi") {
        payload.callIntent = "unset";
        payload.approvalStatus = "none";
        payload.militaryStatus = body.militaryStatus;
      } else {
        const callIntent = (body.callIntent || "unset") as CallIntent;
        const resolved = resolveCallIntentUpdate(callIntent, existing.militaryStatus);
        payload.callIntent = resolved.callIntent;
        payload.approvalStatus = resolved.approvalStatus;
        if (resolved.militaryStatus) {
          payload.militaryStatus = resolved.militaryStatus;
        }
      }
    }

    if (touchesNvqs && body.militaryStatusLocked !== false) {
      payload.militaryStatusLocked = true;
    }

    const updatedDb = await updateCitizenInDb(id, payload);
    if (updatedDb) return NextResponse.json(updatedDb);

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
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (await pingDb()) {
    try {
      const result = await queryExecute("DELETE FROM citizens WHERE id = ?", [id]);
      if (result.affectedRows > 0) {
        return NextResponse.json({ success: true });
      }
    } catch (e) {
      console.error("DELETE citizen mysql:", e);
    }
  }

  const ok = db.citizens.delete(id);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
