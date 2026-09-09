import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUnitDescendants } from "@/lib/data";
import { pingDb } from "@/lib/db";
import {
  AI_APPROVAL_SUGGEST_BATCH_MAX,
  loadCitizenSuggestSnapshot,
  suggestApprovalBatch,
  suggestApprovalForCitizen,
  suggestMeta,
  type SuggestMode,
} from "@/lib/ai-approval-suggest";
import type { ApprovalKind } from "@/lib/enlistment-approval";
import {
  getProvincesForMilitaryRegion,
  isQuanKhuOrBtl,
  ensureMilitaryUnitsInMemory,
} from "@/lib/military-regions";

ensureMilitaryUnitsInMemory();

function parseMode(raw: unknown): SuggestMode | null {
  if (raw === "local" || raw === "qk") return raw;
  return null;
}

function parseKind(raw: unknown): ApprovalKind | undefined {
  if (raw === "goi" || raw === "khong_goi" || raw === "tam_hoan") return raw;
  return undefined;
}

function unitInScope(
  citizenUnit: string,
  level: string,
  sessionUnit: string,
): boolean {
  const code = (citizenUnit || "").trim();
  if (!code) return false;

  if (level === "bo") return true;

  if (level === "donvi" && isQuanKhuOrBtl(sessionUnit)) {
    const provinces = getProvincesForMilitaryRegion(sessionUnit);
    if (provinces.length === 0) return false;
    const root = code.includes("-") ? code.split("-")[0] : code;
    return provinces.includes(root) || provinces.includes(code);
  }

  if (level === "tinh" || level === "xa") {
    return code === sessionUnit || code.startsWith(`${sessionUnit}-`);
  }

  const allowed = new Set(getUnitDescendants(sessionUnit));
  return allowed.has(code) || code === sessionUnit || code.startsWith(`${sessionUnit}-`);
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/ai/approval-suggest",
    ...suggestMeta(),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await pingDb())) {
    return NextResponse.json(
      { error: "Database không khả dụng" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const mode =
    parseMode(body.mode) ||
    (session.hierarchyLevel === "donvi" || session.hierarchyLevel === "bo"
      ? "qk"
      : "local");

  // Xã/tỉnh chỉ dùng mode local; QK/Bộ dùng qk (hoặc local khi xem chi tiết)
  if (
    mode === "qk" &&
    session.hierarchyLevel !== "bo" &&
    !(
      session.hierarchyLevel === "donvi" &&
      isQuanKhuOrBtl(session.unitCode)
    )
  ) {
    return NextResponse.json(
      { error: "Chỉ Quân khu / Bộ dùng chế độ gợi ý xét duyệt QK" },
      { status: 403 },
    );
  }

  const kind = parseKind(body.kind);
  const singleId =
    typeof body.citizenId === "string" ? body.citizenId.trim() : "";
  const batchIds: string[] = Array.isArray(body.citizenIds)
    ? body.citizenIds.map(String).map((s: string) => s.trim()).filter(Boolean)
    : [];

  const ids = singleId
    ? [singleId]
    : [...new Set(batchIds)].slice(0, AI_APPROVAL_SUGGEST_BATCH_MAX);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Thiếu citizenId hoặc citizenIds" },
      { status: 400 },
    );
  }

  const allowedIds: string[] = [];
  for (const id of ids) {
    const snap = await loadCitizenSuggestSnapshot(id);
    if (!snap) continue;
    if (
      !unitInScope(snap.unitCode, session.hierarchyLevel, session.unitCode)
    ) {
      continue;
    }
    allowedIds.push(id);
  }

  if (allowedIds.length === 0) {
    return NextResponse.json(
      { error: "Không có hồ sơ hợp lệ trong phạm vi quản lý" },
      { status: 404 },
    );
  }

  try {
    const items: Awaited<ReturnType<typeof suggestApprovalBatch>> = [];
    if (allowedIds.length === 1) {
      const one = await suggestApprovalForCitizen({
        citizenId: allowedIds[0],
        mode,
        kind,
      });
      if (one) items.push(one);
    } else {
      items.push(
        ...(await suggestApprovalBatch({
          citizenIds: allowedIds,
          mode,
          kind,
        })),
      );
    }

    return NextResponse.json({
      items,
      meta: {
        ...suggestMeta(),
        requested: ids.length,
        returned: items.length,
        mode,
        kind: kind || null,
      },
    });
  } catch (e) {
    console.error("approval-suggest:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Không tạo được gợi ý AI",
      },
      { status: 500 },
    );
  }
}
