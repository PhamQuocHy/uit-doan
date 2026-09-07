import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUnitDescendants } from "@/lib/data";
import { resolveViewUnit } from "@/lib/hierarchy";
import {
  archiveAllPendingInDb,
  archiveCitizensInDb,
} from "@/lib/citizens-db";

/** Duyệt chuyển hồ sơ hết tuổi sang lưu trữ (từng hồ sơ hoặc tất cả). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const requestedUnit =
      typeof body.unitCode === "string" ? body.unitCode : undefined;

    const isBo = session.hierarchyLevel === "bo";
    if (isBo && !requestedUnit && body.approveAll) {
      return NextResponse.json(
        { error: "Chọn địa phương trước khi duyệt tất cả" },
        { status: 400 },
      );
    }

    const scopeUnit = resolveViewUnit(
      session.unitCode,
      session.hierarchyLevel,
      requestedUnit || session.unitCode,
    );
    const unitCodes = getUnitDescendants(scopeUnit.code);

    if (body.approveAll === true) {
      const count = await archiveAllPendingInDb(unitCodes);
      return NextResponse.json({ ok: true, archived: count, mode: "all" });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => String(id).trim()).filter(Boolean)
      : body.id
        ? [String(body.id).trim()]
        : [];

    if (!ids.length) {
      return NextResponse.json(
        { error: "Thiếu danh sách hồ sơ cần duyệt" },
        { status: 400 },
      );
    }

    const count = await archiveCitizensInDb(ids);
    if (count <= 0) {
      return NextResponse.json(
        { error: "Không chuyển được hồ sơ (có thể đã lưu trữ hoặc chưa hết tuổi)", archived: 0 },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, archived: count, mode: "ids", ids });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
