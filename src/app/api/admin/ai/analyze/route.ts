import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAnalyticsDashboard } from "@/lib/analytics";
import { analyzeDashboardWithGemini } from "@/lib/analytics/gemini-analyze";
import { buildDemoAnalyticsDashboard } from "@/lib/analytics/demo-dashboard";
import { resolveScopeUnit } from "@/lib/analytics/scope";
import { isGeminiConfigured } from "@/lib/gemini";
import { pingDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      {
        error:
          "Chưa cấu hình GEMINI_API_KEY. Thêm vào .env và khởi động lại server.",
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const year =
      typeof body.year === "number"
        ? body.year
        : parseInt(String(body.year || new Date().getFullYear()), 10);
    const requestedUnit = body.unitCode as string | undefined;

    const scopeUnit = resolveScopeUnit(
      session.unitCode,
      session.hierarchyLevel,
      requestedUnit,
    );

    const dbOk = await pingDb();
    let dashboard;
    let dataSource: "mysql" | "demo" = "mysql";

    if (dbOk) {
      dashboard = await buildAnalyticsDashboard({
        year: Number.isFinite(year) ? year : new Date().getFullYear(),
        unitCode: requestedUnit,
        sessionUnitCode: session.unitCode,
        hierarchyLevel: session.hierarchyLevel,
      });
    } else {
      dashboard = buildDemoAnalyticsDashboard(scopeUnit);
      dataSource = "demo";
    }

    const { text, model } = await analyzeDashboardWithGemini(dashboard);

    return NextResponse.json({
      analysis: text,
      model,
      dataSource,
      scopeUnit,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Gemini analyze error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không tạo được phân tích AI",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/ai/analyze",
    configured: isGeminiConfigured(),
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
  });
}
