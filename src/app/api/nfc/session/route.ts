import { withApiGuard } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createMobileSession,
  getLatestScan,
  getSessionByCode,
  publicSession,
} from "@/lib/mobile/sessions";

/** Compatibility wrapper — desktop/mobile should use /api/mobile/session/* */
async function POSTHandler() {
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

async function GETHandler(req: Request) {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });
  const row = await getSessionByCode(code);
  if (!row) return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  if (row.created_by_user_id !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

async function PATCHHandler() {
  return NextResponse.json({ error: "Sử dụng /api/mobile/session/connect để nhận token" }, { status: 410 });
}

export const POST = withApiGuard(POSTHandler);
export const GET = withApiGuard(GETHandler);
export const PATCH = withApiGuard(PATCHHandler);
