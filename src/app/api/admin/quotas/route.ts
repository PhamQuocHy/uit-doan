import { NextRequest, NextResponse } from "next/server";
import { db, hierarchyUnits } from "@/lib/data";
import { getSession } from "@/lib/auth";
import {
  getUnitRecruitmentCapacity,
  getUnitEnlistedCount,
} from "@/lib/quota-capacity";
import {
  getRecruitmentQuotaChildUnits,
  isQuanKhuOrBtl,
  ensureMilitaryUnitsInMemory,
} from "@/lib/military-regions";
import { createQuota, findQuotasForUnit, findQuotaByCampaignTarget } from "@/lib/quotas-db";
import type { Quota } from "@/lib/data";
import { syncOneReceivingFromRecruitment } from "@/lib/receiving-quotas-db";

ensureMilitaryUnitsInMemory();

function resolveUnitName(code: string): string {
  if (code === "bo") return "Bộ Quốc phòng";
  return hierarchyUnits.find((u) => u.code === code)?.name || code;
}

async function loadQuotas(
  unitCode: string,
  hierarchyLevel: string,
): Promise<Quota[]> {
  const fromDb = await findQuotasForUnit(unitCode, hierarchyLevel);
  if (fromDb) return fromDb;
  return db.quotas.findForUnit(unitCode, hierarchyLevel);
}

async function enrichQuotas(quotas: Quota[]) {
  return Promise.all(
    quotas.map(async (q) => ({
      ...q,
      filled: await getUnitEnlistedCount(q.toUnit, q.campaignId),
      fromUnitName: resolveUnitName(q.fromUnit),
    })),
  );
}

function canIssueRecruitmentQuota(level: string, unitCode: string): boolean {
  if (level === "xa") return false;
  if (level === "bo" || level === "tinh" || level === "huyen") return true;
  return level === "donvi" && isQuanKhuOrBtl(unitCode);
}

function toLevelFor(
  fromLevel: string,
  toUnitLevel: string,
): "bo" | "tinh" | "xa" | "donvi" {
  if (fromLevel === "bo") return "donvi";
  if (fromLevel === "donvi") return "tinh";
  if (toUnitLevel === "xa" || toUnitLevel === "huyen") return "xa";
  return "tinh";
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const capacityFor = searchParams.get("capacityFor");
  const children = getRecruitmentQuotaChildUnits(session.unitCode);

  if (capacityFor) {
    const allowed =
      session.hierarchyLevel === "bo" ||
      children.some((c) => c.code === capacityFor) ||
      capacityFor === session.unitCode;
    if (!allowed) {
      return NextResponse.json(
        { error: "Không có quyền xem đơn vị này" },
        { status: 403 },
      );
    }
    const capacity = await getUnitRecruitmentCapacity(capacityFor);
    return NextResponse.json({ capacity });
  }

  const quotas = await enrichQuotas(
    await loadQuotas(session.unitCode, session.hierarchyLevel),
  );

  return NextResponse.json({
    data: quotas,
    childUnits: children,
    sessionUnitName: resolveUnitName(session.unitCode),
    canCreate: canIssueRecruitmentQuota(
      session.hierarchyLevel,
      session.unitCode,
    ),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canIssueRecruitmentQuota(session.hierarchyLevel, session.unitCode)) {
    return NextResponse.json(
      { error: "Cấp này không giao chỉ tiêu tuyển quân" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { toUnit, toUnitName, amount, year, note, campaignId } = body;

  if (!toUnit || !toUnitName || !amount) {
    return NextResponse.json(
      { error: "Thiếu thông tin bắt buộc" },
      { status: 400 },
    );
  }

  const children = getRecruitmentQuotaChildUnits(session.unitCode);
  const validChild = children.find((c) => c.code === toUnit);
  if (!validChild) {
    return NextResponse.json(
      { error: "Đơn vị không hợp lệ hoặc không thuộc quyền quản lý" },
      { status: 400 },
    );
  }

  const qty = Number(amount);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json(
      { error: "Số chỉ tiêu không hợp lệ" },
      { status: 400 },
    );
  }

  const campId = String(campaignId || "").trim();
  if (!campId) {
    return NextResponse.json(
      { error: "Vui lòng chọn đợt tuyển quân" },
      { status: 400 },
    );
  }

  const existing = await findQuotaByCampaignTarget(
    session.unitCode,
    toUnit,
    campId,
  );
  if (existing) {
    return NextResponse.json(
      {
        error: `Đã giao chỉ tiêu cho ${validChild.name} trong đợt này. Sửa chỉ tiêu hiện có hoặc chọn đơn vị khác — không giao trùng.`,
      },
      { status: 409 },
    );
  }

  // memory fallback
  const memDup = db.quotas
    .findForUnit(session.unitCode, session.hierarchyLevel)
    .find(
      (q) =>
        q.fromUnit === session.unitCode &&
        q.toUnit === toUnit &&
        q.campaignId === campId,
    );
  if (memDup) {
    return NextResponse.json(
      {
        error: `Đã giao chỉ tiêu cho ${validChild.name} trong đợt này. Không giao trùng.`,
      },
      { status: 409 },
    );
  }

  const capacity = await getUnitRecruitmentCapacity(toUnit);
  const shortage = qty > capacity.eligible;
  const shortageAmount = Math.max(0, qty - capacity.eligible);

  const payload = {
    campaignId: campId,
    year: year || new Date().getFullYear(),
    fromLevel: session.hierarchyLevel as "bo" | "tinh" | "xa" | "donvi",
    fromUnit: session.unitCode,
    toLevel: toLevelFor(session.hierarchyLevel, validChild.level),
    toUnit,
    toUnitName: validChild.name || toUnitName,
    amount: qty,
    filled: 0,
    note: note || "",
  };

  const quota =
    (await createQuota(payload)) || db.quotas.create(payload);

  // Bộ → QK: chỉ tiêu nhận quân = chỉ tiêu tuyển quân (cùng đợt)
  if (
    session.hierarchyLevel === "bo" &&
    isQuanKhuOrBtl(toUnit) &&
    quota.campaignId
  ) {
    await syncOneReceivingFromRecruitment(quota.campaignId, toUnit);
  }

  db.notifications.create({
    toUnit,
    type: "quota_assigned",
    title: "Nhận chỉ tiêu tuyển quân mới",
    message:
      `${session.name} đã giao chỉ tiêu ${qty} cho ${validChild.name} (năm ${quota.year}).` +
      (shortage
        ? ` Cảnh báo: đơn vị chỉ có ${capacity.eligible}/${capacity.totalCitizens} hồ sơ đủ điều kiện — thiếu ${shortageAmount}.`
        : ` Hiện có ${capacity.eligible} hồ sơ đủ điều kiện tuyển.`),
    relatedQuotaId: quota.id,
    relatedHref: "/admin/quota",
  });

  if (shortage) {
    db.notifications.create({
      toUnit,
      type: "quota_shortage",
      title: "Cảnh báo thiếu nguồn tuyển quân",
      message:
        `Chỉ tiêu được giao: ${qty}, nhưng ${validChild.name} chỉ có ${capacity.eligible} hồ sơ đủ điều kiện ` +
        `(chưa khám / đang khám / đậu) trên tổng ${capacity.totalCitizens} hồ sơ. ` +
        `Thiếu khoảng ${shortageAmount}. Vui lòng rà soát, bổ sung nguồn hoặc báo cáo cấp trên.`,
      relatedQuotaId: quota.id,
      relatedHref: "/admin/quota",
    });
  }

  return NextResponse.json(
    {
      data: quota,
      capacity,
      warning: shortage
        ? {
            shortage: true,
            shortageAmount,
            eligible: capacity.eligible,
            totalCitizens: capacity.totalCitizens,
            message: `${validChild.name} chỉ có ${capacity.eligible} hồ sơ đủ điều kiện, thiếu ${shortageAmount} so với chỉ tiêu ${qty}. Đã gửi thông báo cho admin đơn vị nhận.`,
          }
        : null,
    },
    { status: 201 },
  );
}
