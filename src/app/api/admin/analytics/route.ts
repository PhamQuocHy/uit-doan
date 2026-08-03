import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAnalyticsDashboard, refreshCitizenFeatures } from "@/lib/analytics";
import { pingDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await pingDb())) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
  const unitCode = searchParams.get("unitCode") || undefined;

  try {
    const data = await buildAnalyticsDashboard({
      year,
      unitCode,
      sessionUnitCode: session.unitCode,
      hierarchyLevel: session.hierarchyLevel,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analytics failed" },
      { status: 500 }
    );
  }
}

/** Refresh feature mart (admin only) — AI-ready bridge */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.action !== "refresh-features") {
    return NextResponse.json(
      { error: "Unsupported action. Use { action: 'refresh-features' }" },
      { status: 400 }
    );
  }

  try {
    await refreshCitizenFeatures();
    return NextResponse.json({
      ok: true,
      message: "analytics_citizen_features refreshed",
      aiEndpointLater: "/api/admin/ai/risk-score",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
