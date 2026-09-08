import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, getUnitDescendants, hierarchyNeedsEditPin, type Citizen } from "@/lib/data";
import { getUnitByCode, resolveViewUnit } from "@/lib/hierarchy";
import {
  archiveAllPendingInDb,
  archiveCitizensInDb,
  countCitizenStatusSummaryFromDb,
  createCitizenInDb,
  filterCitizensByAgeScopeMemory,
  findCitizensFromDb,
  type CitizenStatusSummary,
} from "@/lib/citizens-db";
import { type CitizenAgeScope } from "@/lib/nvqs-age";
import { matchesCallDisplayFilter } from "@/lib/enlistment-approval";
import { verifyEditPinAsync } from "@/lib/unit-pin";

function summarizeCitizensMemory(citizens: Citizen[]): CitizenStatusSummary {
  return {
    du_kien_goi: citizens.filter((c) => matchesCallDisplayFilter(c, "du_kien_goi"))
      .length,
    du_bi: citizens.filter((c) => matchesCallDisplayFilter(c, "du_bi")).length,
    hoan: citizens.filter((c) => c.militaryStatus === "tamhoan").length,
    khong_goi: citizens.filter((c) => matchesCallDisplayFilter(c, "khong_goi"))
      .length,
  };
}

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
  const educationLevel = searchParams.get("educationLevel") || undefined;
  const healthGrade = searchParams.get("healthGrade") || undefined;
  const ageScope = parseAgeScope(searchParams.get("ageScope"));
  // Box số liệu luôn theo tuổi NVQS đang quản lý — không theo tab "Tại ngũ" (ageScope=all)
  const summaryAgeScope = parseAgeScope(
    searchParams.get("summaryAgeScope") ||
      (ageScope === "all" ? "active" : null),
  );

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
      summary: {
        du_kien_goi: 0,
        du_bi: 0,
        hoan: 0,
        khong_goi: 0,
      },
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

  const summaryQuery = {
    search,
    campaignId,
    educationLevel,
    healthGrade,
    unitCodes,
    ageScope: summaryAgeScope,
  };

  const fromDb = await findCitizensFromDb({
    page,
    limit,
    search,
    militaryStatus,
    callIntent,
    campaignId,
    educationLevel,
    healthGrade,
    unitCodes,
    ageScope,
  });

  if (fromDb) {
    const summary =
      (await countCitizenStatusSummaryFromDb(summaryQuery)) || {
        du_kien_goi: 0,
        du_bi: 0,
        hoan: 0,
        khong_goi: 0,
      };
    return NextResponse.json({
      ...fromDb,
      summary,
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
  let filtered = filterCitizensByAgeScopeMemory(
    all.data as Citizen[],
    ageScope,
  );
  if (callIntent) {
    filtered = filtered.filter((c) => matchesCallDisplayFilter(c, callIntent));
  }
  if (educationLevel) {
    const levels =
      educationLevel === "THPT" || educationLevel === "pho_thong"
        ? ["THPT", "12/12", "9/12", "THCS", "PTTH"]
        : educationLevel === "Sau đại học" || educationLevel === "sau_dai_hoc"
          ? ["Sau đại học", "Thạc sĩ", "Tiến sĩ", "ThS", "TS"]
          : [educationLevel];
    filtered = filtered.filter((c) =>
      levels.some(
        (lv) => (c.educationLevel || "").toLowerCase() === lv.toLowerCase(),
      ),
    );
  }
  if (healthGrade === "none") {
    filtered = filtered.filter((c) => !c.healthStatus);
  } else if (healthGrade) {
    filtered = filtered.filter(
      (c) => c.healthStatus === `Loại ${healthGrade}`,
    );
  }

  const allForSummary = db.citizens.findAll({
    page: 1,
    limit: 10000,
    search,
    campaignId,
    unitCodes,
  });
  let summaryBase = filterCitizensByAgeScopeMemory(
    allForSummary.data as Citizen[],
    summaryAgeScope,
  );
  if (educationLevel) {
    const levels =
      educationLevel === "THPT" || educationLevel === "pho_thong"
        ? ["THPT", "12/12", "9/12", "THCS", "PTTH"]
        : educationLevel === "Sau đại học" || educationLevel === "sau_dai_hoc"
          ? ["Sau đại học", "Thạc sĩ", "Tiến sĩ", "ThS", "TS"]
          : [educationLevel];
    summaryBase = summaryBase.filter((c) =>
      levels.some(
        (lv) => (c.educationLevel || "").toLowerCase() === lv.toLowerCase(),
      ),
    );
  }
  if (healthGrade === "none") {
    summaryBase = summaryBase.filter((c) => !c.healthStatus);
  } else if (healthGrade) {
    summaryBase = summaryBase.filter(
      (c) => c.healthStatus === `Loại ${healthGrade}`,
    );
  }

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
    summary: summarizeCitizensMemory(summaryBase),
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

    if (hierarchyNeedsEditPin(session.hierarchyLevel)) {
      const pin = typeof body.editPin === "string" ? body.editPin : "";
      if (!(await verifyEditPinAsync(session.unitCode, pin))) {
        return NextResponse.json(
          { error: "Cần mã PIN địa phương hợp lệ để lưu hồ sơ" },
          { status: 403 },
        );
      }
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
