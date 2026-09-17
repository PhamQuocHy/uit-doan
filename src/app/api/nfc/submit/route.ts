import { withApiGuard } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSessionByCode, saveScanResult, updateSessionStatus } from "@/lib/mobile/sessions";
import { compareNfcAndOcr } from "@/lib/mobile/verify";

/** Compatibility wrapper — prefer POST /api/mobile/scan-result */
async function POSTHandler(req: Request) {
  const auth = await getSession();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code, nfcData } = (await req.json()) as {
    code: string;
    nfcData: {
      cccd?: string;
      fullName?: string;
      dateOfBirth?: string;
      gender?: string;
      address?: string;
    };
  };

  const row = await getSessionByCode(code);
  if (!row) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  if (row.created_by_user_id !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["WAITING", "CONNECTED"].includes(row.status)) return NextResponse.json({ error: "Session inactive" }, { status: 409 });

  const nfc = {
    fullName: nfcData.fullName ?? "",
    personalId: nfcData.cccd ?? "",
    dateOfBirth: nfcData.dateOfBirth ?? "",
    gender: nfcData.gender ?? "",
    nationality: "Việt Nam",
    placeOfOrigin: "",
    placeOfResidence: nfcData.address ?? "",
  };
  const verification = compareNfcAndOcr(nfc, nfc);
  await updateSessionStatus(row.id, "PROCESSING");
  const saved = await saveScanResult({
    sessionId: row.id,
    scanId: crypto.randomUUID(),
    nfc,
    ocr: nfc,
    verification,
    device: { platform: "legacy-web" },
  });
  return NextResponse.json({ ok: true, found: saved.citizenFound });
}

export const POST = withApiGuard(POSTHandler);
