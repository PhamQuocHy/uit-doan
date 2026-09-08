import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findAuditLogs } from "@/lib/audit-log";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const search = searchParams.get("search") || undefined;
  const actionType = searchParams.get("actionType") || undefined;

  const fromDb = await findAuditLogs({ page, limit, search, actionType });
  if (!fromDb) {
    return NextResponse.json({
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      meta: { source: "unavailable" },
    });
  }

  return NextResponse.json({ ...fromDb, meta: { source: "mysql" } });
}
