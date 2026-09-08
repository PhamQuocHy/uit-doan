import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createMobileSession } from "@/lib/mobile/sessions";

export async function POST() {
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
  } catch (error) {
    console.error("[mobile/session/create]", error instanceof Error ? error.message : "failed");
    return NextResponse.json({ error: "Không tạo được phiên kết nối" }, { status: 500 });
  }
}
