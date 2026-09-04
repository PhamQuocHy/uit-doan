import { NextResponse } from "next/server";
import {
  assertSessionToken,
  bearerToken,
  getLatestScan,
  getSessionByCode,
  getSessionById,
  publicSession,
} from "@/lib/mobile/sessions";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const sessionId = url.searchParams.get("sessionId");

  const row = sessionId
    ? await getSessionById(sessionId)
    : code
      ? await getSessionByCode(code)
      : null;

  if (!row) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  const admin = await getSession();
  const token = bearerToken(req.headers.get("authorization"));
  const allowed = Boolean(admin) || assertSessionToken(row, token);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = publicSession(row);
  const scan = session.status === "COMPLETED" ? await getLatestScan(row.id) : null;

  return NextResponse.json({
    ...session,
    result: scan
      ? {
          scanId: scan.scan_id,
          nfc: scan.nfc_json,
          ocr: scan.ocr_json,
          verification: scan.verification_json,
          matched: Boolean(scan.matched),
          citizenId: scan.citizen_id,
        }
      : null,
  });
}
