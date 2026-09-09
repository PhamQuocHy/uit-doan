import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";
import {
  deleteCampaignInDb,
  findCampaignByIdFromDb,
  findCampaignsFromDb,
  updateCampaignInDb,
} from "@/lib/campaigns-db";

function requireBoAdmin(session: {
  role: string;
  hierarchyLevel: string;
} | null) {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.hierarchyLevel !== "bo") {
    return NextResponse.json(
      { error: "Chỉ cấp Bộ được tạo / sửa / xóa đợt khám tuyển" },
      { status: 403 },
    );
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const denied = requireBoAdmin(session);
  if (denied) return denied;

  const { id } = await context.params;
  const body = await request.json();

  const patch: {
    name?: string;
    year?: number;
    startDate?: string;
    endDate?: string;
    status?: "planning" | "ongoing" | "completed";
    targetQuota?: number;
  } = {};

  if (body.name !== undefined) patch.name = String(body.name || "").trim();
  if (body.year !== undefined) patch.year = Number(body.year);
  if (body.startDate !== undefined) patch.startDate = String(body.startDate);
  if (body.endDate !== undefined) patch.endDate = String(body.endDate);
  if (body.targetQuota !== undefined) patch.targetQuota = Number(body.targetQuota);
  if (
    body.status === "planning" ||
    body.status === "ongoing" ||
    body.status === "completed"
  ) {
    patch.status = body.status;
  }

  // DB sẵn sàng (có bảng) → chỉ dùng MySQL
  const probe = await findCampaignsFromDb({ page: 1, limit: 1 });
  if (probe) {
    const existing = await findCampaignByIdFromDb(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Không tìm thấy đợt khám" },
        { status: 404 },
      );
    }
    const fromDb = await updateCampaignInDb(id, patch);
    return NextResponse.json({
      data: fromDb || existing,
      meta: { source: "mysql" },
    });
  }

  const campaign = db.campaigns.update(id, {
    name: patch.name ?? String(body.name || "").trim(),
    year: patch.year ?? Number(body.year),
    startDate: patch.startDate ?? body.startDate,
    endDate: patch.endDate ?? body.endDate,
    status: patch.status ?? body.status,
    targetQuota: patch.targetQuota ?? Number(body.targetQuota),
  });
  if (!campaign) {
    return NextResponse.json({ error: "Không tìm thấy đợt khám" }, { status: 404 });
  }
  return NextResponse.json({ data: campaign, meta: { source: "memory" } });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const denied = requireBoAdmin(session);
  if (denied) return denied;

  const { id } = await context.params;

  const probe = await findCampaignsFromDb({ page: 1, limit: 1 });
  if (probe) {
    const existing = await findCampaignByIdFromDb(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Không tìm thấy đợt khám" },
        { status: 404 },
      );
    }
    const ok = await deleteCampaignInDb(id);
    if (!ok) {
      return NextResponse.json(
        { error: "Không thể xóa đợt khám" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, meta: { source: "mysql" } });
  }

  const ok = db.campaigns.delete(id);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy đợt khám" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, meta: { source: "memory" } });
}
