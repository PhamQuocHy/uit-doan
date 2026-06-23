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

  // Not implemented in DB mock yet, just returning a stub
  return NextResponse.json({ message: "Not implemented in mock DB" }, { status: 501 });
}
