import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  connectSession,
  createMobileSession,
  getLatestScan,
  getSessionByCode,
  publicSession,
} from "@/lib/mobile/sessions";

/** Compatibility wrapper — desktop/mobile should use /api/mobile/session/* */
export async function POST() {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { session } = await createMobileSession(auth.userId);
  return NextResponse.json({
    code: session.connectionCode,
    sessionId: session.sessionId,
    connectionCode: session.connectionCode,
    status: session.status,
  });
}

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });
  const row = await getSessionByCode(code);
  if (!row) return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  const session = publicSession(row);
  const scan = session.status === "COMPLETED" ? await getLatestScan(row.id) : null;
  return NextResponse.json({
    code: session.connectionCode,
    status: session.status.toLowerCase(),
    result: scan
      ? {
          found: Boolean(scan.citizen_id),
          citizen: scan.nfc_json,
          prefill: scan.ocr_json,
        }
      : null,
  });
}

export async function PATCH(req: Request) {
  const { code } = await req.json();
  const result = await connectSession(String(code || ""), "ios");
  if (!result) return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
