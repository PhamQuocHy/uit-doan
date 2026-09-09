import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pingDb } from "@/lib/db";
import { findCampaignByIdFromDb } from "@/lib/campaigns-db";
import {
  findCitizenByIdFromDb,
  updateCitizenInDb,
} from "@/lib/citizens-db";
import {
  AI_CAMPAIGN_APPLY_MAX,
  buildCampaignSampleApplyPatch,
  sampleLabel,
  type CampaignSampleSuggestion,
} from "@/lib/ai-campaign-sample";
import {
  isFinalApprovedCall,
  snapshotFromCitizen,
  upsertCitizenCampaignHistory,
} from "@/lib/citizen-campaigns-db";
import { getUnitDescendants } from "@/lib/data";
import {
  ensureMilitaryUnitsInMemory,
  getProvincesForMilitaryRegion,
  isQuanKhuOrBtl,
} from "@/lib/military-regions";

ensureMilitaryUnitsInMemory();

const ALLOWED = new Set<CampaignSampleSuggestion>([
  "du_kien_goi",
  "du_bi",
  "khong_goi",
  "tamhoan",
]);

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
  return (
    allowed.has(code) || code === sessionUnit || code.startsWith(`${sessionUnit}-`)
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id: campaignId } = await context.params;
  const campaign = await findCampaignByIdFromDb(campaignId);
  if (!campaign) {
    return NextResponse.json(
      { error: "Không tìm thấy đợt khám" },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json(
      { error: "Chọn ít nhất một hồ sơ để áp dụng" },
      { status: 400 },
    );
  }

  type ApplyIn = {
    citizenId: string;
    suggestion: CampaignSampleSuggestion;
    draftNote: string;
  };

  const parsed: ApplyIn[] = [];
  for (const raw of rawItems.slice(0, AI_CAMPAIGN_APPLY_MAX)) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const citizenId = String(rec.citizenId || "").trim();
    const suggestion = String(rec.suggestion || "") as CampaignSampleSuggestion;
    if (!citizenId || !ALLOWED.has(suggestion)) continue;
    parsed.push({
      citizenId,
      suggestion,
      draftNote:
        typeof rec.draftNote === "string" && rec.draftNote.trim()
          ? rec.draftNote.trim()
          : sampleLabel(suggestion),
    });
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "Danh sách áp dụng không hợp lệ" },
      { status: 400 },
    );
  }

  const applied: { citizenId: string; suggestion: string; label: string }[] =
    [];
  const skipped: { citizenId: string; reason: string }[] = [];

  for (const item of parsed) {
    const citizen = await findCitizenByIdFromDb(item.citizenId);
    if (!citizen) {
      skipped.push({ citizenId: item.citizenId, reason: "Không tìm thấy" });
      continue;
    }
    if (
      !unitInScope(
        citizen.unitCode || "",
        session.hierarchyLevel,
        session.unitCode,
      )
    ) {
      skipped.push({
        citizenId: item.citizenId,
        reason: "Ngoài phạm vi quản lý",
      });
      continue;
    }

    // Chỉ loại đã duyệt gọi / nhập ngũ — tạm hoãn, chưa gọi, rớt… vẫn áp dụng đợt mới
    if (isFinalApprovedCall(citizen)) {
      skipped.push({
        citizenId: item.citizenId,
        reason: "Đã duyệt gọi / nhập ngũ — giữ nguyên đợt cũ, không chuyển AI",
      });
      continue;
    }

    const patch = buildCampaignSampleApplyPatch({
      suggestion: item.suggestion,
      campaignId,
      draftNote: item.draftNote,
      existingMilitaryStatus: citizen.militaryStatus,
    });
    if (!patch) {
      skipped.push({
        citizenId: item.citizenId,
        reason: "Đã nhập ngũ / miễn gọi — không áp dụng",
      });
      continue;
    }

    const previous = snapshotFromCitizen(citizen);
    // Ghi lịch sử: giữ đợt cũ + thêm đợt mới (không xóa khỏi 2026 khi gắn 2027)
    await upsertCitizenCampaignHistory({
      citizenId: item.citizenId,
      campaignId,
      previous,
      next: {
        callIntent: patch.callIntent || "unset",
        approvalStatus: patch.approvalStatus || "none",
        militaryStatus: patch.militaryStatus || null,
        militaryStatusReason: patch.militaryStatusReason || null,
        pipelineStatus: patch.pipelineStatus || "none",
        note: item.draftNote,
      },
      source: "ai_sample",
    });

    const updated = await updateCitizenInDb(item.citizenId, patch);
    if (!updated) {
      skipped.push({ citizenId: item.citizenId, reason: "Lỗi cập nhật DB" });
      continue;
    }
    applied.push({
      citizenId: item.citizenId,
      suggestion: item.suggestion,
      label: sampleLabel(item.suggestion),
    });
  }

  return NextResponse.json({
    applied,
    skipped,
    meta: {
      campaignId,
      appliedCount: applied.length,
      skippedCount: skipped.length,
      maxApply: AI_CAMPAIGN_APPLY_MAX,
    },
  });
}
