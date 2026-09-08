import { NextResponse } from "next/server";
import {
  assertSessionToken,
  bearerToken,
  getSessionById,
  updateSessionStatus,
} from "@/lib/mobile/sessions";

export async function POST(req: Request) {
  const body = (await req.json()) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const row = await getSessionById(body.sessionId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = bearerToken(req.headers.get("authorization"));
  if (!assertSessionToken(row, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await updateSessionStatus(body.sessionId, "SCANNING");
  return NextResponse.json({
    scanId: crypto.randomUUID(),
    status: "SCANNING",
  });
}
