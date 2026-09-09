import type { RowDataPacket } from "mysql2";
import type { Citizen } from "@/lib/data";
import { getHealthConclusionMeaning } from "@/lib/data";
import { pingDb, queryRows } from "@/lib/db";
import {
  generateGeminiText,
  getGeminiModel,
  isGeminiConfigured,
} from "@/lib/gemini";
import {
  calcAgeInYear,
  isNvqsAgeInYear,
  NVQS_AGE_MAX,
  NVQS_AGE_MIN,
} from "@/lib/nvqs-age";
import { toDateOnlyString } from "@/lib/date-vn";

/** Số hồ sơ tối đa AI phân tích mỗi lần. */
export const AI_CAMPAIGN_SAMPLE_MAX = 250;
/** Số hồ sơ tối đa áp dụng mỗi lần. */
export const AI_CAMPAIGN_APPLY_MAX = 100;

export type CampaignSampleSuggestion =
  | "du_kien_goi"
  | "du_bi"
  | "khong_goi"
  | "tamhoan";

export type CampaignSampleItem = {
  citizenId: string;
  fullName: string;
  cccd: string;
  dateOfBirth: string;
  ageInYear: number;
  unitCode: string;
  healthGrade: number | null;
  previousCallIntent: string;
  previousMilitaryStatus: string;
  previousCampaignId: string | null;
  suggestion: CampaignSampleSuggestion;
  confidence: number;
  reasons: string[];
  draftNote: string;
  warnings: string[];
  source: "rules" | "rules+gemini";
  label: string;
  /** Đợt trước tạm hoãn → ưu tiên dự kiến gọi, không được bỏ qua / hạ dự bị vì chỉ tiêu */
  fromPreviousDeferral: boolean;
};

export type CampaignSampleSummary = {
  eligibleTotal: number;
  analyzed: number;
  counts: Record<CampaignSampleSuggestion, number>;
  previousDeferralRolled: number;
  narrative: string;
  gemini: boolean;
  model: string | null;
  scopeLabel: string;
  scopeUnitCode: string | null;
};

type EligibleRow = RowDataPacket & {
  id: string;
  full_name: string;
  cccd: string;
  date_of_birth: string | Date;
  unit_code: string | null;
  health_grade: number | string | null;
  call_intent: string | null;
  military_status: string | null;
  military_status_reason: string | null;
  campaign_id: string | null;
  education_level: string | null;
  job: string | null;
};

function parseHealthGrade(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const m = String(raw).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function clampConfidence(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0.05, Math.min(0.99, v));
}

export function sampleLabel(s: CampaignSampleSuggestion): string {
  switch (s) {
    case "du_kien_goi":
      return "Dự kiến gọi";
    case "du_bi":
      return "Dự bị";
    case "khong_goi":
      return "Đề xuất không gọi";
    case "tamhoan":
      return "Tạm hoãn";
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Áp dụng gợi ý mẫu vào đợt mới — gắn đợt + dự kiến, chưa đẩy pipeline tỉnh/QK.
 */
export function buildCampaignSampleApplyPatch(args: {
  suggestion: CampaignSampleSuggestion;
  campaignId: string;
  draftNote: string;
  existingMilitaryStatus?: Citizen["militaryStatus"];
}): Partial<Citizen> | null {
  if (
    args.existingMilitaryStatus === "nhapngu" ||
    args.existingMilitaryStatus === "miengoi"
  ) {
    return null;
  }

  const note = `[AI mẫu đợt] ${args.draftNote}`.slice(0, 500);
  const base: Partial<Citizen> = {
    campaignId: args.campaignId,
    approvalStatus: "none",
    militaryStatusLocked: false,
    approvalComment: null,
    provinceComment: null,
    pipelineStatus: "none",
    receivingStatus: null,
    receivingUnitCode: null,
    militaryStatusReason: note,
  };

  switch (args.suggestion) {
    case "du_kien_goi":
      return {
        ...base,
        callIntent: "du_kien_goi",
        militaryStatus: "trungtuyen",
      };
    case "du_bi":
      return {
        ...base,
        callIntent: "du_bi",
        militaryStatus: "trungtuyen",
      };
    case "khong_goi":
      return {
        ...base,
        callIntent: "de_xuat_khong_goi",
        militaryStatus: "trungtuyen",
      };
    case "tamhoan":
      return {
        ...base,
        callIntent: "unset",
        militaryStatus: "tamhoan",
      };
  }
}

function ruleSuggestForRow(
  row: EligibleRow,
  campaignYear: number,
): CampaignSampleItem {
  const dob = toDateOnlyString(row.date_of_birth) || "";
  const ageInYear = calcAgeInYear(dob, campaignYear);
  const grade = parseHealthGrade(row.health_grade);
  const prevIntent = row.call_intent || "unset";
  const prevStatus = row.military_status || "chuakham";
  const edu = (row.education_level || "").toLowerCase();
  const reasonPrev = (row.military_status_reason || "").trim();

  const reasons: string[] = [];
  const warnings: string[] = [];
  let suggestion: CampaignSampleSuggestion = "du_bi";
  let confidence = 0.5;
  let draftNote = "";
  let fromPreviousDeferral = false;

  reasons.push(
    `Tuổi trong năm ${campaignYear}: ${ageInYear} (khung ${NVQS_AGE_MIN}–${NVQS_AGE_MAX})`,
  );

  const studying =
    edu.includes("đại học") ||
    edu.includes("dai hoc") ||
    edu.includes("cao đẳng") ||
    edu.includes("cao dang") ||
    /đang học|dang hoc|sinh viên|sinh vien/i.test(reasonPrev);

  // Đợt trước tạm hoãn → đợt mới đưa vào dự kiến gọi (không bỏ qua / không giữ tạm hoãn mặc định)
  if (prevStatus === "tamhoan") {
    fromPreviousDeferral = true;
    suggestion = "du_kien_goi";
    confidence = 0.86;
    reasons.push("Đợt trước đã tạm hoãn — chuyển diện dự kiến gọi đợt mới");
    draftNote = `Dự kiến gọi năm ${campaignYear}: đợt trước tạm hoãn${reasonPrev ? ` (${reasonPrev})` : ""}. Cần cập nhật tình trạng / minh chứng sau.`;
    warnings.push(
      "Cần cập nhật sau: lý do tạm hoãn còn hiệu lực hay đã hết (học tập, sức khỏe, hoàn cảnh…)",
    );
    if (studying) {
      warnings.push(
        "Có dấu hiệu đang học — xác nhận còn được tạm hoãn hay đưa vào gọi",
      );
    }
    if (grade != null && grade >= 4) {
      warnings.push(
        `Sức khỏe hiện ${grade != null ? `Loại ${grade}` : "chưa rõ"} — rà soát trước khi chốt gọi`,
      );
    }
  } else if (grade != null && grade >= 5) {
    suggestion = "khong_goi";
    confidence = 0.88;
    reasons.push(
      `Sức khỏe Loại ${grade}: ${getHealthConclusionMeaning(`Loại ${grade}`, "Khám tuyển cấp tỉnh")}`,
    );
    draftNote = `Đề xuất không gọi — sức khỏe Loại ${grade}.`;
  } else if (grade === 4) {
    suggestion = "tamhoan";
    confidence = 0.84;
    reasons.push(
      `Sức khỏe Loại 4: ${getHealthConclusionMeaning("Loại 4", "Khám tuyển cấp tỉnh")}`,
    );
    draftNote = "Đề xuất tạm hoãn theo phân loại sức khỏe Loại 4.";
  } else if (
    prevIntent === "khong_goi" ||
    prevIntent === "de_xuat_khong_goi" ||
    prevStatus === "truottuyen"
  ) {
    if (grade != null && grade >= 1 && grade <= 3) {
      suggestion = "du_bi";
      confidence = 0.62;
      reasons.push("Từng đề xuất không gọi / trượt nhưng sức khỏe hiện đạt 1–3");
      draftNote =
        "Đưa vào dự bị — sức khỏe đạt nhưng có lịch sử không gọi; cần kiểm tra lại.";
      warnings.push("Cần rà soát lý do không gọi đợt trước");
    } else {
      suggestion = "khong_goi";
      confidence = 0.8;
      reasons.push("Kế thừa đề xuất không gọi / trượt tuyển đợt trước");
      draftNote = "Đề xuất không gọi — kế thừa kết quả đợt trước.";
    }
  } else if (grade != null && grade >= 1 && grade <= 3) {
    if (prevIntent === "du_bi") {
      suggestion = "du_bi";
      confidence = grade === 1 ? 0.78 : 0.72;
      reasons.push(`Sức khỏe Loại ${grade}; đợt trước ở diện dự bị`);
      draftNote = `Tiếp tục dự bị — sức khỏe Loại ${grade}.`;
    } else {
      suggestion = "du_kien_goi";
      confidence = grade === 1 ? 0.9 : grade === 2 ? 0.84 : 0.76;
      reasons.push(
        `Sức khỏe Loại ${grade}: ${getHealthConclusionMeaning(`Loại ${grade}`, "Khám tuyển cấp tỉnh")}`,
      );
      draftNote = `Dự kiến gọi — đủ tuổi năm ${campaignYear}, sức khỏe Loại ${grade}.`;
      if (studying) {
        warnings.push(
          "Có dấu hiệu đang học — cập nhật sau nếu còn thuộc diện tạm hoãn theo quy định",
        );
      }
    }
  } else if (grade == null) {
    // Chưa khám: vẫn đưa vào dự kiến gọi nếu sắp hết tuổi; còn lại dự bị chờ khám
    if (ageInYear >= NVQS_AGE_MAX - 1) {
      suggestion = "du_kien_goi";
      confidence = 0.55;
      reasons.push("Chưa có SK nhưng sắp hết tuổi — ưu tiên dự kiến gọi");
      draftNote = `Dự kiến gọi năm ${campaignYear} — chưa có kết luận SK; cần khám và cập nhật sau.`;
      warnings.push("Bắt buộc khám sức khỏe trong đợt trước khi chốt");
    } else {
      suggestion = "du_bi";
      confidence = 0.45;
      reasons.push("Chưa có phân loại sức khỏe gần nhất");
      warnings.push("Cần khám sức khỏe trong đợt mới trước khi chốt gọi");
      draftNote = "Dự bị chờ khám — chưa có kết luận sức khỏe.";
    }
  } else {
    suggestion = "khong_goi";
    confidence = 0.6;
    reasons.push("Phân loại sức khỏe không phù hợp gọi nhập ngũ");
    draftNote = "Đề xuất không gọi — cần kiểm tra lại hồ sơ sức khỏe.";
  }

  if (ageInYear >= NVQS_AGE_MAX - 1 && suggestion === "du_bi") {
    warnings.push(
      `Sắp hết tuổi NVQS (${ageInYear}) — ưu tiên xem xét gọi nếu đủ điều kiện`,
    );
  }

  return {
    citizenId: row.id,
    fullName: row.full_name,
    cccd: row.cccd,
    dateOfBirth: dob,
    ageInYear,
    unitCode: row.unit_code || "",
    healthGrade: grade,
    previousCallIntent: prevIntent,
    previousMilitaryStatus: prevStatus,
    previousCampaignId: row.campaign_id,
    suggestion,
    confidence: clampConfidence(confidence, 0.5),
    reasons,
    draftNote,
    warnings,
    source: "rules",
    label: sampleLabel(suggestion),
    fromPreviousDeferral,
  };
}

/**
 * Cân chỉ tiêu: thừa dự kiến gọi → chuyển dự bị (ưu tiên giữ điểm cao).
 * Không hạ hồ sơ đợt trước tạm hoãn (fromPreviousDeferral).
 */
function balanceByQuota(
  items: CampaignSampleItem[],
  targetQuota: number,
): CampaignSampleItem[] {
  if (targetQuota <= 0) return items;
  const goi = items
    .filter((i) => i.suggestion === "du_kien_goi")
    .sort((a, b) => {
      // Ưu tiên giữ hồ sơ tạm hoãn đợt trước
      if (a.fromPreviousDeferral !== b.fromPreviousDeferral) {
        return a.fromPreviousDeferral ? -1 : 1;
      }
      const ga = a.healthGrade ?? 99;
      const gb = b.healthGrade ?? 99;
      if (ga !== gb) return ga - gb;
      return b.confidence - a.confidence;
    });
  if (goi.length <= targetQuota) return items;

  const keep = new Set(goi.slice(0, targetQuota).map((i) => i.citizenId));
  // Luôn giữ thêm mọi hồ sơ tạm hoãn đợt trước dù vượt chỉ tiêu mẫu
  for (const i of goi) {
    if (i.fromPreviousDeferral) keep.add(i.citizenId);
  }

  return items.map((item) => {
    if (item.suggestion !== "du_kien_goi" || keep.has(item.citizenId)) {
      return item;
    }
    if (item.fromPreviousDeferral) return item;
    return {
      ...item,
      suggestion: "du_bi" as const,
      label: sampleLabel("du_bi"),
      confidence: clampConfidence(item.confidence - 0.08, 0.5),
      reasons: [
        ...item.reasons,
        `Vượt chỉ tiêu đợt (~${targetQuota}) — chuyển dự bị`,
      ],
      draftNote: `${item.draftNote} (chuyển dự bị do vượt chỉ tiêu mẫu).`,
      warnings: [...item.warnings, "Điều chỉnh theo chỉ tiêu đợt"],
    };
  });
}

async function refineNarrativeWithGemini(args: {
  campaignName: string;
  campaignYear: number;
  targetQuota: number;
  items: CampaignSampleItem[];
}): Promise<string | null> {
  if (!isGeminiConfigured()) return null;

  const counts = {
    du_kien_goi: args.items.filter((i) => i.suggestion === "du_kien_goi").length,
    du_bi: args.items.filter((i) => i.suggestion === "du_bi").length,
    khong_goi: args.items.filter((i) => i.suggestion === "khong_goi").length,
    tamhoan: args.items.filter((i) => i.suggestion === "tamhoan").length,
  };

  const sample = args.items.slice(0, 40).map((i) => ({
    name: i.fullName,
    age: i.ageInYear,
    health: i.healthGrade,
    suggestion: i.suggestion,
    note: i.draftNote,
  }));

  try {
    const text = await generateGeminiText(
      `Đợt: ${args.campaignName} (năm ${args.campaignYear}), chỉ tiêu ${args.targetQuota}.
Thống kê gợi ý: dự kiến gọi ${counts.du_kien_goi}, dự bị ${counts.du_bi}, không gọi ${counts.khong_goi}, tạm hoãn ${counts.tamhoan}.
Mẫu hồ sơ: ${JSON.stringify(sample)}
Hãy tóm tắt nhận định và lưu ý triển khai đợt.`,
      {
        systemInstruction: `Bạn là trợ lý AI hỗ trợ cán bộ NVQS Việt Nam lập kế hoạch đợt khám tuyển.
Viết ngắn gọn bằng tiếng Việt (4–7 câu). Không bịa số liệu ngoài dữ liệu được cung cấp.
Nhấn mạnh: chỉ phân tích đúng phạm vi địa phương; hồ sơ tạm hoãn đợt trước phải chuyển dự kiến gọi và ghi chú cập nhật sau — không bỏ qua.`,
      },
    );
    return text.trim() || null;
  } catch (e) {
    console.error("ai-campaign-sample gemini narrative:", e);
    return null;
  }
}

async function refineEdgeCasesWithGemini(
  items: CampaignSampleItem[],
): Promise<CampaignSampleItem[]> {
  if (!isGeminiConfigured() || items.length === 0) return items;

  const edges = items
    .filter(
      (i) =>
        i.warnings.length > 0 ||
        i.confidence < 0.6 ||
        (i.suggestion === "du_bi" && i.healthGrade != null && i.healthGrade <= 2),
    )
    .slice(0, 25);

  if (edges.length === 0) return items;

  try {
    const text = await generateGeminiText(
      JSON.stringify(
        edges.map((i) => ({
          citizenId: i.citizenId,
          ageInYear: i.ageInYear,
          healthGrade: i.healthGrade,
          previousCallIntent: i.previousCallIntent,
          previousMilitaryStatus: i.previousMilitaryStatus,
          currentSuggestion: i.suggestion,
          reasons: i.reasons,
          warnings: i.warnings,
        })),
      ),
      {
        systemInstruction: `Bạn tư vấn phân loại NVQS cho đợt khám mới.
Chỉ trả một JSON: {"updates":[{"citizenId":"...","suggestion":"du_kien_goi|du_bi|khong_goi|tamhoan","confidence":0.0-1,"draftNote":"...","reason":"..."}]}.
Không markdown. Chỉ đổi khi có lý do rõ; không bịa giấy tờ.`,
      },
    );

    const parsed = extractJsonObject(text);
    const updates = Array.isArray(parsed?.updates) ? parsed!.updates : [];
    if (updates.length === 0) return items;

    const byId = new Map<string, Record<string, unknown>>();
    for (const u of updates) {
      if (!u || typeof u !== "object") continue;
      const rec = u as Record<string, unknown>;
      const id = String(rec.citizenId || "").trim();
      const sug = String(rec.suggestion || "");
      if (
        !id ||
        !["du_kien_goi", "du_bi", "khong_goi", "tamhoan"].includes(sug)
      ) {
        continue;
      }
      byId.set(id, rec);
    }

    return items.map((item) => {
      const u = byId.get(item.citizenId);
      if (!u) return item;
      const suggestion = u.suggestion as CampaignSampleSuggestion;
      const draftNote =
        typeof u.draftNote === "string" && u.draftNote.trim()
          ? u.draftNote.trim()
          : item.draftNote;
      const reason =
        typeof u.reason === "string" && u.reason.trim()
          ? u.reason.trim()
          : "Gemini điều chỉnh phân loại biên";
      return {
        ...item,
        suggestion,
        label: sampleLabel(suggestion),
        confidence: clampConfidence(u.confidence, item.confidence),
        draftNote,
        reasons: [...item.reasons, reason],
        source: "rules+gemini" as const,
      };
    });
  } catch (e) {
    console.error("ai-campaign-sample gemini refine:", e);
    return items;
  }
}

export async function listEligibleForCampaignSample(args: {
  campaignYear: number;
  unitCode?: string | null;
  hierarchyLevel?: string;
  limit?: number;
}): Promise<{ rows: EligibleRow[]; total: number } | null> {
  if (!(await pingDb())) return null;

  const limit = Math.max(
    1,
    Math.min(AI_CAMPAIGN_SAMPLE_MAX, args.limit || AI_CAMPAIGN_SAMPLE_MAX),
  );
  const where: string[] = [
    "c.archived_at IS NULL",
    "IFNULL(c.military_status,'chuakham') NOT IN ('nhapngu','miengoi')",
    // Đã duyệt gọi: không đưa sang đợt mới bằng AI
    "IFNULL(c.approval_status,'none') <> 'approved'",
    // ? = năm đợt (số). Không bọc YEAR(?) — MySQL YEAR(2027) = NULL.
    `(? - YEAR(c.date_of_birth)) BETWEEN ${NVQS_AGE_MIN} AND ${NVQS_AGE_MAX}`,
  ];
  const params: unknown[] = [args.campaignYear];

  const unit = (args.unitCode || "").trim();
  const level = args.hierarchyLevel || "";
  // Địa phương (xã/tỉnh): bắt buộc lọc đúng đơn vị — không tổng hợp toàn quốc
  if (level === "xa" || level === "tinh" || level === "huyen") {
    if (!unit) {
      return { rows: [], total: 0 };
    }
    where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
    params.push(unit, unit);
  } else if (level !== "bo" && unit) {
    where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
    params.push(unit, unit);
  } else if (level === "bo" && unit) {
    // Bộ chọn một tỉnh/xã cụ thể
    where.push("(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))");
    params.push(unit, unit);
  }

  try {
    const countRows = await queryRows<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM citizens c WHERE ${where.join(" AND ")}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await queryRows<EligibleRow[]>(
      `SELECT
         c.id, c.full_name, c.cccd, c.date_of_birth, c.unit_code,
         c.health_grade, c.call_intent, c.military_status, c.military_status_reason,
         c.campaign_id,
         (SELECT ce.level FROM citizen_education ce
            WHERE ce.citizen_id = c.id ORDER BY ce.id DESC LIMIT 1) AS education_level,
         (SELECT ce.major FROM citizen_education ce
            WHERE ce.citizen_id = c.id ORDER BY ce.id DESC LIMIT 1) AS job
       FROM citizens c
       WHERE ${where.join(" AND ")}
       ORDER BY
         CASE WHEN IFNULL(c.military_status,'') = 'tamhoan' THEN 0 ELSE 1 END,
         CASE
           WHEN c.health_grade BETWEEN 1 AND 3 THEN 0
           WHEN c.health_grade = 4 THEN 1
           WHEN c.health_grade IS NULL THEN 2
           ELSE 3
         END,
         (? - YEAR(c.date_of_birth)) DESC,
         c.full_name ASC
       LIMIT ?`,
      [...params, args.campaignYear, limit],
    );

    return { rows, total };
  } catch (e) {
    console.error("listEligibleForCampaignSample:", e);
    return null;
  }
}

export async function generateCampaignAiSample(args: {
  campaignId: string;
  campaignName: string;
  campaignYear: number;
  targetQuota: number;
  unitCode?: string | null;
  hierarchyLevel?: string;
  limit?: number;
  scopeLabel?: string;
}): Promise<{
  items: CampaignSampleItem[];
  summary: CampaignSampleSummary;
} | null> {
  const listed = await listEligibleForCampaignSample({
    campaignYear: args.campaignYear,
    unitCode: args.unitCode,
    hierarchyLevel: args.hierarchyLevel,
    limit: args.limit,
  });
  if (!listed) return null;

  const eligible = listed.rows.filter((r) =>
    isNvqsAgeInYear(r.date_of_birth, args.campaignYear),
  );

  let items = eligible.map((r) => ruleSuggestForRow(r, args.campaignYear));
  items = balanceByQuota(items, args.targetQuota);
  items = await refineEdgeCasesWithGemini(items);
  // Gemini không được đẩy hồ sơ tạm hoãn đợt trước khỏi dự kiến gọi
  items = items.map((item) => {
    if (!item.fromPreviousDeferral) return item;
    if (item.suggestion === "du_kien_goi") return item;
    return {
      ...item,
      suggestion: "du_kien_goi",
      label: sampleLabel("du_kien_goi"),
      confidence: Math.max(item.confidence, 0.8),
      draftNote: item.draftNote.includes("tạm hoãn")
        ? item.draftNote
        : `Dự kiến gọi năm ${args.campaignYear}: đợt trước tạm hoãn — cần cập nhật sau.`,
      reasons: [
        ...item.reasons,
        "Giữ dự kiến gọi vì đợt trước tạm hoãn (không bỏ qua)",
      ],
      source: item.source === "rules" ? "rules" : "rules+gemini",
    };
  });
  items = balanceByQuota(items, args.targetQuota);

  const counts: Record<CampaignSampleSuggestion, number> = {
    du_kien_goi: 0,
    du_bi: 0,
    khong_goi: 0,
    tamhoan: 0,
  };
  let previousDeferralRolled = 0;
  for (const i of items) {
    counts[i.suggestion] += 1;
    if (i.fromPreviousDeferral) previousDeferralRolled += 1;
  }

  const scopeLabel =
    args.scopeLabel ||
    (args.unitCode
      ? `Địa phương ${args.unitCode}`
      : "Toàn quốc (khuyến nghị chạy tại tài khoản xã/tỉnh)");

  const geminiNarrative = await refineNarrativeWithGemini({
    campaignName: args.campaignName,
    campaignYear: args.campaignYear,
    targetQuota: args.targetQuota,
    items,
  });

  const fallbackNarrative = `Phạm vi ${scopeLabel}. Năm ${args.campaignYear}: phân tích ${items.length}/${listed.total} thanh niên còn trong tuổi. Gợi ý — dự kiến gọi ${counts.du_kien_goi} (trong đó ${previousDeferralRolled} chuyển từ tạm hoãn đợt trước, cần cập nhật sau), dự bị ${counts.du_bi}, không gọi ${counts.khong_goi}, tạm hoãn ${counts.tamhoan}. Danh sách mẫu theo địa phương — cán bộ rà soát trước khi áp dụng.`;

  return {
    items,
    summary: {
      eligibleTotal: listed.total,
      analyzed: items.length,
      counts,
      previousDeferralRolled,
      narrative: geminiNarrative || fallbackNarrative,
      gemini: isGeminiConfigured(),
      model: isGeminiConfigured() ? getGeminiModel() : null,
      scopeLabel,
      scopeUnitCode: args.unitCode || null,
    },
  };
}

export function sampleMeta() {
  return {
    maxAnalyze: AI_CAMPAIGN_SAMPLE_MAX,
    maxApply: AI_CAMPAIGN_APPLY_MAX,
    gemini: isGeminiConfigured(),
    model: isGeminiConfigured() ? getGeminiModel() : null,
    ageMin: NVQS_AGE_MIN,
    ageMax: NVQS_AGE_MAX,
  };
}
