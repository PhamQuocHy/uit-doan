import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";
import {
  createCampaignInDb,
  findCampaignsFromDb,
} from "@/lib/campaigns-db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const status = searchParams.get("status") || undefined;
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!, 10)
    : undefined;

  const fromDb = await findCampaignsFromDb({ page, limit, status, year });
  if (fromDb) {
    return NextResponse.json({ ...fromDb, meta: { source: "mysql" } });
  }

  const result = db.campaigns.findAll({ page, limit, status, year });
  return NextResponse.json({ ...result, meta: { source: "memory" } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body.name || "").trim();
  const year = Number(body.year);
  const targetQuota = Number(body.targetQuota);
  if (!name || !year || !body.startDate || !body.endDate || !targetQuota) {
    return NextResponse.json(
      { error: "Vui lòng nhập đủ thông tin đợt khám" },
      { status: 400 },
    );
  }

  const status =
    body.status === "planning" ||
    body.status === "ongoing" ||
    body.status === "completed"
      ? body.status
      : "planning";

  const fromDb = await createCampaignInDb({
    name,
    year,
    startDate: String(body.startDate),
    endDate: String(body.endDate),
    status,
    targetQuota,
  });
  if (fromDb) {
    return NextResponse.json(
      { data: fromDb, meta: { source: "mysql" } },
      { status: 201 },
    );
  }

  const campaign = db.campaigns.create({
    name,
    year,
    startDate: body.startDate,
    endDate: body.endDate,
    status,
    targetQuota,
  });
  return NextResponse.json(
    { data: campaign, meta: { source: "memory" } },
    { status: 201 },
  );
}
