import { withApiGuard } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AI_FEATURE_COLUMNS, AI_RISK_SCORE_PATH } from "@/lib/analytics";

/**
 * Stub for phase AI — Data Mining phase chỉ chuẩn bị feature mart.
 * Implement ML scoring later; reads analytics_citizen_features.
 */
async function POSTHandler(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  return NextResponse.json(
    {
      status: "not_implemented",
      message:
        "Phase AI chưa triển khai. Feature mart analytics_citizen_features đã sẵn sàng. Làm mới mart: POST /api/admin/analytics { action: 'refresh-features' }",
      endpoint: AI_RISK_SCORE_PATH,
      featureColumns: AI_FEATURE_COLUMNS,
      received: body,
    },
    { status: 501 }
  );
}

async function GETHandler() {
  return NextResponse.json({
    endpoint: AI_RISK_SCORE_PATH,
    status: "stub",
    featureColumns: AI_FEATURE_COLUMNS,
  });
}

export const POST = withApiGuard(POSTHandler);
export const GET = withApiGuard(GETHandler);
