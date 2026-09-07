import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";
import {
  findCampaignByIdFromDb,
  findCampaignsFromDb,
  updateCampaignInDb,
} from "@/lib/campaigns-db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
