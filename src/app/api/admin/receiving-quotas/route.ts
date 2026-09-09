import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hierarchyUnits, db } from "@/lib/data";
import {
  findReceivingQuotas,
  findSubQuotasWithFilled,
  resolveProvinceCode,
  syncOneReceivingFromRecruitment,
  syncReceivingQuotasFromRecruitment,
  upsertSubQuota,
} from "@/lib/receiving-quotas-db";
import { sumBoRecruitmentQuotaToUnit } from "@/lib/quotas-db";
import {
  getProvincesForMilitaryRegion,
  getAssignableReceivingUnits,
  isQuanKhuOrBtl,
  MILITARY_REGIONS,
  ensureMilitaryUnitsInMemory,
} from "@/lib/military-regions";

ensureMilitaryUnitsInMemory();

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId") || undefined;
  const autoSync = searchParams.get("sync") !== "0";
  const level = session.hierarchyLevel;

  const regions = MILITARY_REGIONS.map((r) => ({
    code: r.code,
    name: r.name,
    provinces: (r.provinceCodes || []).map((code) => ({
      code,
      name: hierarchyUnits.find((u) => u.code === code)?.name || code,
    })),
  }));

  if (level === "bo") {
    // Đồng bộ nhận quân ← tuyển quân trước khi trả danh sách
    if (campaignId && autoSync) {
      await syncReceivingQuotasFromRecruitment(campaignId);
    }
    const data = await findReceivingQuotas({ campaignId });
    const enriched = await Promise.all(
      (data || []).map(async (q) => ({
        ...q,
        recruitmentAmount: await sumBoRecruitmentQuotaToUnit(
          q.receivingUnitCode,
          q.campaignId,
        ),
      })),
    );
    return NextResponse.json({
      data: enriched,
      subQuotas: [],
      regions,
      canCreate: false,
      canAllocateUnits: false,
      syncedFromRecruitment: true,
    });
  }

  if (level === "donvi" && isQuanKhuOrBtl(session.unitCode)) {
    if (campaignId && autoSync) {
      await syncOneReceivingFromRecruitment(campaignId, session.unitCode);
    }
    const data = await findReceivingQuotas({
      campaignId,
      receivingUnitCode: session.unitCode,
    });
    const subQuotas = campaignId
      ? await findSubQuotasWithFilled({
          campaignId,
          fromUnit: session.unitCode,
        })
      : [];
    const recruitmentAmount = campaignId
      ? await sumBoRecruitmentQuotaToUnit(session.unitCode, campaignId)
      : null;
    return NextResponse.json({
      data: data || [],
      subQuotas,
      regions: regions.filter((r) => r.code === session.unitCode),
      provinceOptions: getProvincesForMilitaryRegion(session.unitCode).map(
        (code) => ({
          code,
          name: hierarchyUnits.find((u) => u.code === code)?.name || code,
        }),
      ),
      receivingUnitOptions: getAssignableReceivingUnits(session.unitCode).map(
        (u) => ({
          code: u.code,
          name: u.name,
          kind: u.kind,
        }),
      ),
      recruitmentAmount,
      canCreate: false,
      canAllocateUnits: true,
    });
  }

  if (level === "tinh" || level === "xa") {
    return NextResponse.json({
      data: [],
      subQuotas: [],
      regions: [],
      canCreate: false,
      canAllocateUnits: false,
      provinceCode:
        level === "tinh"
          ? session.unitCode
          : resolveProvinceCode(session.unitCode),
    });
  }

  return NextResponse.json({
    data: [],
    subQuotas: [],
    regions: [],
    canCreate: false,
    canAllocateUnits: false,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "upsert");

  // Bộ: đồng bộ toàn bộ nhận quân theo chỉ tiêu tuyển quân của đợt
  if (action === "sync_from_recruitment") {
    if (session.hierarchyLevel !== "bo") {
      return NextResponse.json({ error: "Chỉ Bộ được đồng bộ" }, { status: 403 });
    }
    const campaignId = String(body.campaignId || "").trim();
    if (!campaignId) {
      return NextResponse.json({ error: "Thiếu đợt tuyển quân" }, { status: 400 });
    }
    const result = await syncReceivingQuotasFromRecruitment(campaignId);
    if (!result) {
      return NextResponse.json({ error: "Không đồng bộ được" }, { status: 503 });
    }
    return NextResponse.json({
      success: true,
      synced: result.synced,
      removed: result.removed,
      message: `Đã đồng bộ ${result.synced.length} quân khu theo chỉ tiêu tuyển quân`,
    });
  }

  // Bộ → Quân khu: không nhập tay lệch số — bắt buộc lấy từ chỉ tiêu tuyển quân
  if (action === "upsert") {
    if (session.hierarchyLevel !== "bo") {
      return NextResponse.json(
        { error: "Chỉ Bộ được giao chỉ tiêu nhận quân cho quân khu" },
        { status: 403 },
      );
    }
    const campaignId = String(body.campaignId || "").trim();
    const receivingUnitCode = String(body.receivingUnitCode || "").trim();
    if (!campaignId || !isQuanKhuOrBtl(receivingUnitCode)) {
      return NextResponse.json(
        { error: "Thiếu đợt / quân khu hợp lệ" },
        { status: 400 },
      );
    }
    const recruitmentAmount = await sumBoRecruitmentQuotaToUnit(
      receivingUnitCode,
      campaignId,
    );
    if (recruitmentAmount == null) {
      return NextResponse.json({ error: "Database không khả dụng" }, { status: 503 });
    }
    if (recruitmentAmount <= 0) {
      return NextResponse.json(
        {
          error:
            "Chưa có chỉ tiêu tuyển quân Bộ → quân khu này. Hãy giao tại menu Giao chỉ tiêu trước.",
        },
        { status: 400 },
      );
    }
    const row = await syncOneReceivingFromRecruitment(
      campaignId,
      receivingUnitCode,
    );
    if (!row) {
      return NextResponse.json({ error: "Không lưu được" }, { status: 503 });
    }
    db.notifications.create({
      toUnit: receivingUnitCode,
      type: "info",
      title: "Chỉ tiêu nhận quân (đồng bộ tuyển quân)",
      message: `Đợt ${campaignId}: ${recruitmentAmount} quân — khớp chỉ tiêu tuyển quân Bộ giao.`,
      relatedHref: "/admin/receiving",
    });
    return NextResponse.json({ success: true, data: row });
  }

  if (action === "allocate_unit" || action === "allocate_province") {
    if (
      session.hierarchyLevel !== "donvi" ||
      !isQuanKhuOrBtl(session.unitCode)
    ) {
      return NextResponse.json(
        { error: "Chỉ quân khu được giao chỉ tiêu xuống đơn vị nhận quân" },
        { status: 403 },
      );
    }
    const campaignId = String(body.campaignId || "").trim();
    const toUnit = String(body.toUnit || "").trim();
    const amount = Number(body.amount);
    if (!campaignId || !toUnit || !(amount >= 0)) {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
    }

    // Không vượt tổng chỉ tiêu nhận (= tuyển) Bộ giao cho QK
    const parent = await findReceivingQuotas({
      campaignId,
      receivingUnitCode: session.unitCode,
    });
    const parentAmount = parent?.[0]?.amount ?? 0;
    if (parentAmount > 0) {
      const siblings = await findSubQuotasWithFilled({
        campaignId,
        fromUnit: session.unitCode,
      });
      const others = siblings
        .filter((s) => s.toUnit !== toUnit)
        .reduce((sum, s) => sum + s.amount, 0);
      if (others + amount > parentAmount) {
        return NextResponse.json(
          {
            error: `Tổng giao xuống ĐV nhận không được vượt ${parentAmount} (chỉ tiêu tuyển/nhận Bộ giao). Đã giao đơn vị khác: ${others}.`,
          },
          { status: 400 },
        );
      }
    }

    const row = await upsertSubQuota({
      campaignId,
      fromUnit: session.unitCode,
      toUnit,
      amount,
      note: body.note != null ? String(body.note) : null,
    });
    if (!row) {
      return NextResponse.json(
        { error: "Đơn vị nhận không thuộc quân khu hoặc lỗi lưu" },
        { status: 400 },
      );
    }
    db.notifications.create({
      toUnit,
      type: "info",
      title: "Quân khu giao chỉ tiêu nhận quân",
      message: `${row.fromUnitName} giao ${amount} chỉ tiêu đợt ${campaignId}. Kiểm tra & xác nhận nhận đủ quân sau khi phân.`,
      relatedHref: "/admin/receiving",
    });
    return NextResponse.json({ success: true, data: row });
  }

  if (action === "delete") {
    if (session.hierarchyLevel !== "bo") {
      return NextResponse.json({ error: "Chỉ Bộ được xóa" }, { status: 403 });
    }
    return NextResponse.json(
      {
        error:
          "Chỉ tiêu nhận quân đồng bộ từ tuyển quân — hãy sửa/xóa tại menu Giao chỉ tiêu.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
}
