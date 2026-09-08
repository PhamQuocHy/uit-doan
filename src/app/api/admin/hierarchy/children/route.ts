import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import {
  getChildUnits,
  getUnitDescendants,
  hierarchyUnits,
  type HierarchyUnit,
} from "@/lib/data";
import {
  getProvincesForMilitaryRegion,
  isQuanKhuOrBtl,
} from "@/lib/military-regions";
import { pingDb, queryRows } from "@/lib/db";

function canQuanKhuAccessParent(
  quanKhuCode: string,
  parentCode: string,
): boolean {
  if (parentCode === quanKhuCode) return true;
  const provinces = getProvincesForMilitaryRegion(quanKhuCode);
  if (parentCode === "bo") return true;
  if (provinces.includes(parentCode)) return true;
  if (parentCode.includes("-")) {
    const root = parentCode.split("-")[0];
    if (provinces.includes(root)) return true;
  }
  const military = new Set(getUnitDescendants(quanKhuCode));
  return military.has(parentCode);
}

async function childrenFromDb(parentCode: string): Promise<HierarchyUnit[]> {
  if (!(await pingDb())) return [];
  try {
    const rows = await queryRows<
      (RowDataPacket & {
        code: string;
        name: string;
        level: string;
        parent_code: string | null;
      })[]
    >(
      `SELECT code, name, level, parent_code
       FROM hierarchy_units
       WHERE parent_code = ? AND IFNULL(is_active, 1) = 1
       ORDER BY name`,
      [parentCode],
    );
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      level: r.level as HierarchyUnit["level"],
      parentCode: r.parent_code || undefined,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parentCode =
    new URL(request.url).searchParams.get("parentCode") || session.unitCode;

  if (session.hierarchyLevel === "bo") {
    // full access
  } else if (
    session.hierarchyLevel === "donvi" &&
    isQuanKhuOrBtl(session.unitCode)
  ) {
    if (!canQuanKhuAccessParent(session.unitCode, parentCode)) {
      return NextResponse.json(
        { error: "Không có quyền xem đơn vị này" },
        { status: 403 },
      );
    }
  } else {
    const allowed = new Set(getUnitDescendants(session.unitCode));
    if (!allowed.has(parentCode)) {
      return NextResponse.json(
        { error: "Không có quyền xem đơn vị này" },
        { status: 403 },
      );
    }
  }

  let items = await childrenFromDb(parentCode);
  if (items.length === 0) {
    items = getChildUnits(parentCode);
  }

  if (
    session.hierarchyLevel === "donvi" &&
    isQuanKhuOrBtl(session.unitCode) &&
    parentCode === "bo"
  ) {
    const provinces = new Set(getProvincesForMilitaryRegion(session.unitCode));
    items = items.filter((i) => i.level === "tinh" && provinces.has(i.code));
    if (items.length === 0) {
      items = hierarchyUnits.filter(
        (i) => i.level === "tinh" && provinces.has(i.code),
      );
    }
  }

  items = items.sort((a, b) => a.name.localeCompare(b.name, "vi"));

  return NextResponse.json({ items, total: items.length, parentCode });
}
