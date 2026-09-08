import { NextResponse } from "next/server";
import { connectSession } from "@/lib/mobile/sessions";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      connectionCode?: string;
      code?: string;
      device?: { platform?: string };
    };
    const code = (body.connectionCode || body.code || "").trim().toUpperCase();
    if (code.length < 4) {
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
  } catch (error) {
    console.error("[mobile/session/connect]", error instanceof Error ? error.message : "failed");
    return NextResponse.json({ error: "Không kết nối được phiên" }, { status: 500 });
  }
}
