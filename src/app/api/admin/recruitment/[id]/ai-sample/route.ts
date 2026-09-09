import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pingDb } from "@/lib/db";
import { findCampaignByIdFromDb } from "@/lib/campaigns-db";
import {
  generateCampaignAiSample,
  sampleMeta,
} from "@/lib/ai-campaign-sample";
import { getUnitByCode } from "@/lib/hierarchy";
import { ensureMilitaryUnitsInMemory } from "@/lib/military-regions";

ensureMilitaryUnitsInMemory();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  return NextResponse.json({
    endpoint: `/api/admin/recruitment/${id}/ai-sample`,
    ...sampleMeta(),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await pingDb())) {
    return NextResponse.json(
      { error: "Database không khả dụng" },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const campaign = await findCampaignByIdFromDb(id);
  if (!campaign) {
    return NextResponse.json(
      { error: "Không tìm thấy đợt khám" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const limit =
    typeof body.limit === "number" ? body.limit : Number(body.limit) || undefined;

  const level = session.hierarchyLevel;
  const sessionUnit = (session.unitCode || "").trim();
  let unitCode: string | null = null;
  let hierarchyLevel = level;

  if (level === "xa" || level === "tinh" || level === "huyen") {
    // Chỉ tổng hợp đúng địa phương đăng nhập
    if (!sessionUnit) {
      return NextResponse.json(
        { error: "Tài khoản địa phương thiếu mã đơn vị — không chạy AI được" },
        { status: 400 },
      );
    }
    unitCode = sessionUnit;
    hierarchyLevel = level;
  } else if (level === "bo") {
    // Bộ: nên chọn tỉnh/xã; nếu không thì toàn quốc (cảnh báo trong summary)
    const requested =
      typeof body.unitCode === "string" ? body.unitCode.trim() : "";
    if (requested) {
      unitCode = requested;
      hierarchyLevel = requested.includes("-") ? "xa" : "tinh";
    } else {
      unitCode = null;
      hierarchyLevel = "bo";
    }
  } else {
    // QK / đơn vị khác: bắt buộc chọn địa phương
    const requested =
      typeof body.unitCode === "string" ? body.unitCode.trim() : "";
    if (!requested) {
      return NextResponse.json(
        {
          error:
            "AI danh sách mẫu chỉ tổng hợp theo địa phương. Chọn tỉnh/xã (unitCode) hoặc đăng nhập tài khoản xã/tỉnh.",
        },
        { status: 400 },
      );
    }
    unitCode = requested;
    hierarchyLevel = requested.includes("-") ? "xa" : "tinh";
  }

  const unitMeta = unitCode ? getUnitByCode(unitCode) : null;
  const scopeLabel = unitMeta
    ? `${unitMeta.name} (${unitCode})`
    : unitCode
      ? `Địa phương ${unitCode}`
      : "Toàn quốc — khuyến nghị chạy tại tài khoản xã/tỉnh";

  try {
    const result = await generateCampaignAiSample({
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignYear: campaign.year,
      targetQuota: campaign.targetQuota,
      unitCode,
      hierarchyLevel,
      limit,
      scopeLabel,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Không tạo được danh sách mẫu AI" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        year: campaign.year,
        targetQuota: campaign.targetQuota,
      },
      items: result.items,
      summary: result.summary,
      meta: {
        ...sampleMeta(),
        scopeLabel,
        scopeUnitCode: unitCode,
        hierarchyLevel,
      },
    });
  } catch (e) {
    console.error("recruitment ai-sample:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Không tạo được danh sách mẫu AI",
      },
      { status: 500 },
    );
  }
}
