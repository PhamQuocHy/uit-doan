import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, getUnitDescendants } from "@/lib/data";
import { resolveViewUnit } from "@/lib/hierarchy";
import { findCitizensFromDb } from "@/lib/citizens-db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const search = searchParams.get("search") || undefined;
  const militaryStatus = searchParams.get("militaryStatus") || undefined;
  const callIntent = searchParams.get("callIntent") || undefined;
  const requestedUnit = searchParams.get("unitCode") || undefined;
  const campaignId = searchParams.get("campaignId") || undefined;

  const isBo = session.hierarchyLevel === "bo";
  const requiresUnitSelection = isBo && !requestedUnit;

  if (requiresUnitSelection) {
    return NextResponse.json({
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      meta: {
        requiresUnitSelection: true,
        scopeUnit: null,
        source: null,
      },
    });
  }

  const scopeUnit = resolveViewUnit(
    session.unitCode,
    session.hierarchyLevel,
    requestedUnit || session.unitCode,
  );
  const unitCodes = getUnitDescendants(scopeUnit.code);

  const fromDb = await findCitizensFromDb({
    page,
    limit,
    search,
    militaryStatus,
    callIntent,
    campaignId,
    unitCodes,
  });

  if (fromDb) {
    return NextResponse.json({
      ...fromDb,
      meta: {
        requiresUnitSelection: false,
        scopeUnit: {
          code: scopeUnit.code,
          name: scopeUnit.name,
          level: scopeUnit.level,
        },
        source: "mysql",
      },
    });
  }

  const result = db.citizens.findAll({
    page,
    limit,
    search,
    militaryStatus,
    campaignId,
    unitCodes,
  });

  return NextResponse.json({
    ...result,
    meta: {
      requiresUnitSelection: false,
      scopeUnit: {
        code: scopeUnit.code,
        name: scopeUnit.name,
        level: scopeUnit.level,
      },
      source: "memory",
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const newCitizen = db.citizens.create(body);
    return NextResponse.json(newCitizen, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
