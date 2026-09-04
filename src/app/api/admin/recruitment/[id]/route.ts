import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await request.json();
  const campaign = db.campaigns.update(id, {
    name: String(body.name || "").trim(),
    year: Number(body.year),
    startDate: body.startDate,
    endDate: body.endDate,
    status: body.status,
    targetQuota: Number(body.targetQuota),
  });
  if (!campaign) return NextResponse.json({ error: "Không tìm thấy đợt khám" }, { status: 404 });
  return NextResponse.json({ data: campaign });
}