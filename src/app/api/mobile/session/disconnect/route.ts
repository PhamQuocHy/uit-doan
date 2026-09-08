import { NextResponse } from "next/server";
import {
  assertSessionToken,
  bearerToken,
  disconnectSession,
  getSessionById,
} from "@/lib/mobile/sessions";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = body.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const row = await getSessionById(sessionId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = bearerToken(req.headers.get("authorization"));
  if (!assertSessionToken(row, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await disconnectSession(sessionId);
  return NextResponse.json({ ok: true, status: "DISCONNECTED" });
}
