import { withApiGuard } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createMobileSession } from "@/lib/mobile/sessions";

async function POSTHandler() {
  const auth = await getSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { session } = await createMobileSession(auth.userId);
    return NextResponse.json({
      sessionId: session.sessionId,
      connectionCode: session.connectionCode,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    });
  } catch {
    console.error("[mobile/session/create]", "failed");
    return NextResponse.json({ error: "Không tạo được phiên kết nối" }, { status: 500 });
  }
}

export const POST = withApiGuard(POSTHandler);
