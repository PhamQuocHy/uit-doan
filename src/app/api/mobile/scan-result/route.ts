import { NextResponse } from "next/server";
import {
  assertSessionToken,
  bearerToken,
  getSessionById,
  saveScanResult,
  updateSessionStatus,
} from "@/lib/mobile/sessions";
import type { ScanResultPayload } from "@/lib/mobile/types";
import { compareNfcAndOcr } from "@/lib/mobile/verify";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ScanResultPayload>;
  if (!body.sessionId || !body.scanId) {
    return NextResponse.json({ error: "sessionId and scanId required" }, { status: 400 });
  }

  const row = await getSessionById(body.sessionId);
  if (!row) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  const token = bearerToken(req.headers.get("authorization"));
  if (!assertSessionToken(row, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (["EXPIRED", "DISCONNECTED"].includes(row.status)) {
    return NextResponse.json({ error: "Session is no longer active" }, { status: 409 });
  }

  await updateSessionStatus(body.sessionId, "PROCESSING");

  const nfc = body.nfc ?? {};
  const ocr = body.ocr ?? {};
  const verification = body.verification ?? compareNfcAndOcr(nfc, ocr);

  try {
    const saved = await saveScanResult({
      sessionId: body.sessionId,
      scanId: body.scanId,
      nfc,
      ocr,
      verification,
      device: body.device ?? { platform: "ios" },
    });

    if (saved.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true, status: "COMPLETED" });
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      status: "COMPLETED",
      found: saved.citizenFound,
      citizen: saved.citizen ?? null,
      verification,
    });
  } catch (error) {
    await updateSessionStatus(body.sessionId, "ERROR", "scan_persist_failed");
    console.error("[mobile/scan-result]", error instanceof Error ? error.message : "failed");
    return NextResponse.json({ error: "Không lưu được kết quả quét" }, { status: 500 });
  }
}
