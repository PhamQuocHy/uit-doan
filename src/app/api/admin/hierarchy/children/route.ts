import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChildUnits, getUnitDescendants } from "@/lib/data";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parentCode =
    new URL(request.url).searchParams.get("parentCode") || session.unitCode;

  if (session.hierarchyLevel !== "bo") {
    const allowed = new Set(getUnitDescendants(session.unitCode));
    if (!allowed.has(parentCode)) {
      return NextResponse.json({ error: "Không có quyền xem đơn vị này" }, { status: 403 });
    }
  }

  const items = getChildUnits(parentCode).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );

  return NextResponse.json({ items, total: items.length, parentCode });
}
