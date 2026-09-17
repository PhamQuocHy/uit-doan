import { withApiGuard } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { connectSession } from "@/lib/mobile/sessions";

async function POSTHandler(req: Request) {
  try {
    const body = (await req.json()) as {
      connectionCode?: string;
      code?: string;
      device?: { platform?: string };
    };
    const rawCode = body.connectionCode || body.code;
    const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)) {
      return NextResponse.json({ error: "Mã kết nối không hợp lệ" }, { status: 400 });
    }

    const result = await connectSession(code, body.device?.platform ?? "ios");
    if (!result) {
      return NextResponse.json(
        { error: "Mã không hợp lệ hoặc phiên đã hết hạn" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      sessionId: result.session.sessionId,
      connectionCode: result.session.connectionCode,
      status: result.session.status,
      expiresAt: result.session.expiresAt,
      sessionToken: result.sessionToken,
    });
  } catch {
    console.error("[mobile/session/connect]", "failed");
    return NextResponse.json({ error: "Không kết nối được phiên" }, { status: 500 });
  }
}

export const POST = withApiGuard(POSTHandler);
