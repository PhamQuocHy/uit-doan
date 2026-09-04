import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const status = searchParams.get("status") || undefined;
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;

  const result = db.campaigns.findAll({
    page,
    limit,
    status,
    year,
  });

  return NextResponse.json(result);
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
    return NextResponse.json({ error: "Vui lòng nhập đủ thông tin đợt khám" }, { status: 400 });
  }
  const campaign = db.campaigns.create({
    name,
    year,
    startDate: body.startDate,
    endDate: body.endDate,
    status: body.status || "planning",
    targetQuota,
  });
  return NextResponse.json({ data: campaign }, { status: 201 });
}
