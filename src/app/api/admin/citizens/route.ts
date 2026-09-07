import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, getUnitDescendants, type Citizen } from "@/lib/data";
import { getUnitByCode, resolveViewUnit } from "@/lib/hierarchy";
import {
  archiveAllPendingInDb,
  archiveCitizensInDb,
  createCitizenInDb,
  filterCitizensByAgeScopeMemory,
  findCitizensFromDb,
} from "@/lib/citizens-db";
import { type CitizenAgeScope } from "@/lib/nvqs-age";

function parseAgeScope(raw: string | null): CitizenAgeScope {
  if (
    raw === "archive" ||
    raw === "all" ||
    raw === "active" ||
    raw === "pending"
  ) {
    return raw;
  }
  return "active";
}

function resolveUnitCodes(
  session: { unitCode: string; hierarchyLevel: string },
  requestedUnit: string | undefined,
) {
  const scopeUnit = resolveViewUnit(
    session.unitCode,
    session.hierarchyLevel as "bo" | "tinh" | "xa",
    requestedUnit || session.unitCode,
  );
  return {
    scopeUnit,
    unitCodes: getUnitDescendants(scopeUnit.code),
  };
}

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
  const ageScope = parseAgeScope(searchParams.get("ageScope"));

  const isBo = session.hierarchyLevel === "bo";
  // Cấp Bộ: không chọn tỉnh → chỉ cho nationwide khi có search / nationwide=1.
  // Duyệt danh sách đầy đủ vẫn cần chọn tỉnh/xã.
  const allowNationwide =
    searchParams.get("nationwide") === "1" ||
    searchParams.get("nationwide") === "true";
  const requiresUnitSelection = isBo && !requestedUnit && !allowNationwide;

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
        ageScope,
      },
    });
  }

  // nationwide=1 + không unitCode → toàn quốc (chỉ dùng cho quét CCCD)
  const nationwide = isBo && allowNationwide && (!requestedUnit || requestedUnit === "bo");
  const { scopeUnit, unitCodes } = nationwide
    ? {
        scopeUnit:
          getUnitByCode(session.unitCode) ||
          getUnitByCode("bo") ||
          ({
            code: "bo",
            name: "Bộ Quốc phòng",
            level: "bo" as const,
          }),
        unitCodes: undefined as string[] | undefined,
      }
    : resolveUnitCodes(session, requestedUnit);

  const fromDb = await findCitizensFromDb({
    page,
    limit,
    search,
    militaryStatus,
    callIntent,
    campaignId,
    unitCodes,
    ageScope,
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
        ageScope,
      },
    });
  }

  const all = db.citizens.findAll({
    page: 1,
    limit: 10000,
    search,
    militaryStatus,
    campaignId,
    unitCodes,
  });
  const filtered = filterCitizensByAgeScopeMemory(
    all.data as Citizen[],
    ageScope,
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const result = {
    data: filtered.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages,
  };

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
      ageScope,
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
    if (!body.fullName || !body.cccd || !body.dateOfBirth) {
      return NextResponse.json(
        { error: "Thiếu Họ tên, CCCD hoặc Ngày sinh" },
        { status: 400 },
      );
    }

    let unitCode = String(body.unitCode || "").trim();

    if (session.hierarchyLevel === "xa") {
      unitCode = session.unitCode;
    } else if (session.hierarchyLevel === "tinh") {
      if (!unitCode) {
        return NextResponse.json(
          { error: "Vui lòng chọn xã/phường đăng ký" },
          { status: 400 },
        );
      }
      const allowed = new Set(getUnitDescendants(session.unitCode));
      if (!allowed.has(unitCode) || unitCode === session.unitCode) {
        return NextResponse.json(
          { error: "Chỉ được chọn xã/phường thuộc tỉnh của bạn" },
          { status: 403 },
        );
      }
    } else if (session.hierarchyLevel === "bo") {
      if (!unitCode) {
        return NextResponse.json(
          { error: "Vui lòng chọn địa phương đăng ký (xã/phường)" },
          { status: 400 },
        );
      }
    } else if (!unitCode) {
      unitCode = session.unitCode;
    }

    const unit = getUnitByCode(unitCode);
    if (!unit || unit.level !== "xa") {
      return NextResponse.json(
        { error: "Địa phương đăng ký phải là xã/phường" },
        { status: 400 },
      );
    }

    const created = await createCitizenInDb({
      ...body,
      unitCode,
    });

    if (created?.ok) {
      return NextResponse.json(created.data, { status: 201 });
    }
    if (created && !created.ok) {
      return NextResponse.json(
        { error: created.error, code: created.code },
        { status: created.code === "DUPLICATE_CCCD" ? 409 : 500 },
      );
    }

    // Chỉ fallback bộ nhớ khi không có MySQL
    const newCitizen = db.citizens.create({
      ...body,
      unitCode,
    });
    return NextResponse.json(newCitizen, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
