import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAnalyticsDashboard } from "@/lib/analytics";
import { pingDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await pingDb();
  if (!ok) {
    return NextResponse.json(
      {
        error:
          "Không kết nối được MySQL. Kiểm tra .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) và chạy: npm run db:migrate && npm run db:seed-analytics",
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const unitCode = searchParams.get("unitCode") || undefined;
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  try {
    const data = await buildAnalyticsDashboard({
      year: Number.isFinite(year) ? year : new Date().getFullYear(),
      unitCode,
      sessionUnitCode: session.unitCode,
      hierarchyLevel: session.hierarchyLevel,
    });

    // Backward-compatible aliases used by older UI snippets
    return NextResponse.json({
      ...data,
      overview: {
        ...data.overview,
        deferred: data.overview.deferred,
        availableForDraft: data.overview.availableForDraft,
        inService: data.overview.inService,
        totalCitizens: data.overview.totalCitizens,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Lỗi aggregation analytics. Chạy npm run db:migrate && npm run db:seed-analytics",
      },
      { status: 500 }
    );
  }
}
