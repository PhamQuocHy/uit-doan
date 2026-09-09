import { findCitizenByIdFromDb } from "@/lib/citizens-db";
import { findEducationByCitizenId, findHealthByCitizenId } from "@/lib/citizen-profile-db";
import {
  listCitizenNvqsAttachments,
  purposesEquivalentTo,
} from "@/lib/citizen-nvqs-attachments-db";
import type { MinhChungLoai } from "@/lib/citizen-nvqs-attachments";
import {
  calcAgeYears,
  isNvqsActiveAge,
  NVQS_AGE_MAX,
  NVQS_AGE_MIN,
} from "@/lib/nvqs-age";
import {
  detectApprovalKind,
  type ApprovalKind,
} from "@/lib/enlistment-approval";
import {
  generateGeminiText,
  getGeminiModel,
  isGeminiConfigured,
} from "@/lib/gemini";
import { getHealthConclusionMeaning } from "@/lib/data";

export const AI_APPROVAL_SUGGEST_BATCH_MAX = 20;

/** Giá trị UI tab NVQS (địa phương). */
export type LocalNvqsSuggestion =
  | "unset"
  | "du_kien_goi"
  | "du_bi"
  | "khong_goi"
  | "tamhoan"
  | "miengoi";

export type SuggestMode = "local" | "qk";

export type ApprovalSuggestItem = {
  citizenId: string;
  fullName?: string;
  /** Địa phương: trạng thái NVQS gợi ý */
  suggestion?: LocalNvqsSuggestion;
  /** Quân khu: duyệt / không duyệt */
  action?: "approve" | "reject";
  kind?: ApprovalKind;
  confidence: number;
  reasons: string[];
  draftNote: string;
  warnings: string[];
  source: "rules" | "gemini" | "rules+gemini";
  label: string;
};

export type CitizenSuggestSnapshot = {
  citizenId: string;
  fullName: string;
  cccd: string;
  age: number;
  ageOk: boolean;
  unitCode: string;
  educationLevel: string | null;
  job: string | null;
  healthGrade: number | null;
  healthLabel: string | null;
  healthMeaning: string | null;
  latestExam: {
    year: number;
    phase: string;
    height: number;
    weight: number;
    conclusion: string;
    note?: string;
  } | null;
  militaryStatus: string;
  militaryStatusReason: string | null;
  callIntent: string;
  approvalStatus: string;
  campaignId: string | null;
  attachments: string[];
  hasGiayKham: boolean;
  hasGiayTamHoan: boolean;
  hasGiayMienGoi: boolean;
  kind: ApprovalKind;
};

const LOCAL_ALLOWED = new Set<LocalNvqsSuggestion>([
  "unset",
  "du_kien_goi",
  "du_bi",
  "khong_goi",
  "tamhoan",
  "miengoi",
]);

function parseHealthGrade(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const m = String(raw).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function localLabel(s: LocalNvqsSuggestion): string {
  switch (s) {
    case "du_kien_goi":
      return "Dự kiến gọi";
    case "du_bi":
      return "Dự bị";
    case "khong_goi":
      return "Đề xuất không gọi";
    case "tamhoan":
      return "Tạm hoãn";
    case "miengoi":
      return "Miễn gọi";
    default:
      return "Hồ sơ mới";
  }
}

function qkActionLabel(action: "approve" | "reject", kind: ApprovalKind): string {
  if (action === "approve") {
    if (kind === "goi") return "Duyệt gọi";
    if (kind === "khong_goi") return "Đồng tình không gọi";
    return "Duyệt tạm hoãn";
  }
  if (kind === "goi") return "Không gọi";
  if (kind === "khong_goi") return "Không duyệt không gọi";
  return "Không duyệt tạm hoãn";
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

function clampConfidence(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0.05, Math.min(0.99, v));
}

export async function loadCitizenSuggestSnapshot(
  citizenId: string,
): Promise<CitizenSuggestSnapshot | null> {
  const citizen = await findCitizenByIdFromDb(citizenId);
  if (!citizen) return null;

  const [educationList, healthList, attachments] = await Promise.all([
    findEducationByCitizenId(citizenId),
    findHealthByCitizenId(citizenId),
    listCitizenNvqsAttachments(citizenId),
  ]);
  const education = educationList?.[0] || null;

  const age = citizen.dateOfBirth ? calcAgeYears(citizen.dateOfBirth) : 0;
  const grade =
    parseHealthGrade(citizen.healthStatus) ??
    parseHealthGrade(healthList?.[0]?.conclusion ?? null);

  const latest = healthList?.[0] || null;
  const purposes = attachments.map((a) => a.purpose);
  const hasPurpose = (loai: MinhChungLoai) =>
    purposesEquivalentTo(loai).some((p) => purposes.includes(p));

  const kind = detectApprovalKind({
    callIntent: (citizen.callIntent || "unset") as
      | "unset"
      | "du_kien_goi"
      | "du_bi"
      | "de_xuat_khong_goi"
      | "khong_goi",
    militaryStatus: citizen.militaryStatus || "chuakham",
    approvalStatus: (citizen.approvalStatus || "none") as
      | "none"
      | "pending"
      | "approved"
      | "rejected",
  });

  return {
    citizenId: citizen.id,
    fullName: citizen.fullName,
    cccd: citizen.cccd,
    age,
    ageOk: citizen.dateOfBirth ? isNvqsActiveAge(citizen.dateOfBirth) : false,
    unitCode: citizen.unitCode || "",
    educationLevel: education?.level || citizen.educationLevel || null,
    job: citizen.job || null,
    healthGrade: grade,
    healthLabel: grade != null ? `Loại ${grade}` : null,
    healthMeaning:
      grade != null
        ? getHealthConclusionMeaning(
            `Loại ${grade}`,
            latest?.phase || "Khám tuyển cấp tỉnh",
          )
        : null,
    latestExam: latest
      ? {
          year: latest.year,
          phase: latest.phase,
          height: latest.height,
          weight: latest.weight,
          conclusion: latest.conclusion,
          note: latest.note || latest.detail?.physicalDefects,
        }
      : null,
    militaryStatus: citizen.militaryStatus || "chuakham",
    militaryStatusReason: citizen.militaryStatusReason || null,
    callIntent: citizen.callIntent || "unset",
    approvalStatus: citizen.approvalStatus || "none",
    campaignId: citizen.campaignId || null,
    attachments: [...new Set(purposes)],
    hasGiayKham: hasPurpose("giay_kham_suc_khoe"),
    hasGiayTamHoan: hasPurpose("giay_tam_hoan"),
    hasGiayMienGoi: hasPurpose("giay_mien_goi"),
    kind,
  };
}

function ruleSuggestLocal(snap: CitizenSuggestSnapshot): ApprovalSuggestItem {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let suggestion: LocalNvqsSuggestion = "unset";
  let confidence = 0.55;
  let draftNote = "";

  if (!snap.ageOk) {
    suggestion = "khong_goi";
    confidence = 0.9;
    reasons.push(
      `Tuổi ${snap.age} ngoài khung NVQS ${NVQS_AGE_MIN}–${NVQS_AGE_MAX}`,
    );
    draftNote = `Không đủ điều kiện tuổi NVQS (${snap.age} tuổi).`;
    if (!snap.hasGiayKham) {
      warnings.push("Thiếu giấy khám sức khỏe khi đề xuất không gọi");
      confidence = 0.7;
    }
  } else if (snap.healthGrade == null) {
    suggestion = "unset";
    confidence = 0.4;
    reasons.push("Chưa có phân loại sức khỏe");
    warnings.push("Cần hoàn tất khám sức khỏe trước khi đề xuất gọi");
    draftNote = "Chưa có kết luận sức khỏe — giữ Hồ sơ mới.";
  } else if (snap.healthGrade >= 5) {
    suggestion = "miengoi";
    confidence = 0.88;
    reasons.push(`Sức khỏe ${snap.healthLabel}: ${snap.healthMeaning}`);
    draftNote = `Đề xuất miễn gọi theo phân loại sức khỏe ${snap.healthLabel}.`;
    if (!snap.hasGiayMienGoi) {
      warnings.push("Thiếu giấy miễn gọi");
      confidence = 0.72;
    }
  } else if (snap.healthGrade === 4) {
    suggestion = "tamhoan";
    confidence = 0.85;
    reasons.push(`Sức khỏe ${snap.healthLabel}: ${snap.healthMeaning}`);
    draftNote = `Đề xuất tạm hoãn theo phân loại sức khỏe ${snap.healthLabel}.`;
    if (!snap.hasGiayTamHoan) {
      warnings.push("Thiếu giấy tạm hoãn");
      confidence = 0.68;
    }
  } else if (snap.healthGrade >= 1 && snap.healthGrade <= 3) {
    suggestion = "du_kien_goi";
    confidence = snap.healthGrade === 1 ? 0.9 : snap.healthGrade === 2 ? 0.84 : 0.76;
    reasons.push(`Sức khỏe ${snap.healthLabel}: ${snap.healthMeaning}`);
    reasons.push(`Trong độ tuổi NVQS (${snap.age})`);
    draftNote = `Đủ điều kiện sức khỏe ${snap.healthLabel} — đề xuất dự kiến gọi.`;
    if (!snap.campaignId) {
      warnings.push("Chưa gắn đợt tuyển quân");
      confidence -= 0.08;
    }
    const edu = (snap.educationLevel || "").toLowerCase();
    if (
      edu.includes("đại học") ||
      edu.includes("dai hoc") ||
      edu.includes("thạc") ||
      edu.includes("tiến sĩ")
    ) {
      warnings.push(
        `Học vấn ${snap.educationLevel} — cân nhắc tạm hoãn nếu đang học đúng quy định`,
      );
    }
  } else {
    suggestion = "khong_goi";
    confidence = 0.6;
    reasons.push("Phân loại sức khỏe không phù hợp gọi nhập ngũ");
    draftNote = "Đề xuất không gọi — cần kiểm tra lại hồ sơ sức khỏe.";
  }

  if (snap.militaryStatusReason) {
    reasons.push(`Lý do hiện có: ${snap.militaryStatusReason}`);
  }

  return {
    citizenId: snap.citizenId,
    fullName: snap.fullName,
    suggestion,
    confidence: clampConfidence(confidence, 0.5),
    reasons,
    draftNote,
    warnings,
    source: "rules",
    label: localLabel(suggestion),
  };
}

function ruleSuggestQk(
  snap: CitizenSuggestSnapshot,
  kind: ApprovalKind,
): ApprovalSuggestItem {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let action: "approve" | "reject" = "approve";
  let confidence = 0.6;
  let draftNote = "";

  if (kind === "goi") {
    if (!snap.ageOk) {
      action = "reject";
      confidence = 0.92;
      reasons.push(`Tuổi ${snap.age} ngoài khung NVQS`);
      draftNote = `Không duyệt gọi — tuổi ${snap.age} ngoài ${NVQS_AGE_MIN}–${NVQS_AGE_MAX}.`;
    } else if (snap.healthGrade != null && snap.healthGrade >= 4) {
      action = "reject";
      confidence = 0.88;
      reasons.push(`Sức khỏe ${snap.healthLabel} không đủ gọi nhập ngũ`);
      draftNote = `Không duyệt gọi — sức khỏe ${snap.healthLabel} (${snap.healthMeaning}).`;
    } else if (snap.healthGrade != null && snap.healthGrade <= 3) {
      action = "approve";
      confidence = 0.82;
      reasons.push(`Sức khỏe ${snap.healthLabel}: ${snap.healthMeaning}`);
      reasons.push("Địa phương đã đề xuất dự kiến gọi");
      draftNote = `Đủ điều kiện gọi theo sức khỏe ${snap.healthLabel}.`;
      if (!snap.campaignId) {
        warnings.push("Hồ sơ chưa gắn đợt — cần chọn đợt trước khi duyệt");
        confidence -= 0.1;
      }
    } else {
      action = "reject";
      confidence = 0.55;
      reasons.push("Chưa rõ phân loại sức khỏe");
      draftNote = "Không duyệt gọi — thiếu kết luận sức khỏe rõ ràng.";
      warnings.push("Cần đối chiếu lại phiếu khám");
    }
  } else if (kind === "khong_goi") {
    if (snap.healthGrade != null && snap.healthGrade >= 4) {
      action = "approve";
      confidence = 0.86;
      reasons.push(`Sức khỏe ${snap.healthLabel} phù hợp đề xuất không gọi`);
      draftNote = `Đồng tình không gọi — sức khỏe ${snap.healthLabel}.`;
    } else if (snap.healthGrade != null && snap.healthGrade <= 3) {
      action = "reject";
      confidence = 0.78;
      reasons.push(
        `Sức khỏe ${snap.healthLabel} vẫn đủ điều kiện gọi — cân nhắc trả về`,
      );
      draftNote =
        "Không duyệt đề xuất không gọi — sức khỏe còn đạt tiêu chuẩn gọi nhập ngũ. Đề nghị địa phương bổ sung minh chứng hoặc chuyển dự kiến gọi.";
    } else if (!snap.ageOk) {
      action = "approve";
      confidence = 0.9;
      reasons.push(`Tuổi ${snap.age} ngoài khung NVQS`);
      draftNote = `Đồng tình không gọi — ngoài độ tuổi NVQS.`;
    } else {
      action = "approve";
      confidence = 0.55;
      reasons.push("Địa phương đã đề xuất không gọi");
      draftNote = "Đồng tình theo đề xuất địa phương — cần kiểm tra minh chứng.";
    }
    if (!snap.hasGiayKham) {
      warnings.push("Thiếu giấy khám sức khỏe đính kèm");
      confidence -= 0.12;
      if (action === "approve") confidence = Math.min(confidence, 0.55);
    }
  } else {
    // tam_hoan
    if (snap.healthGrade === 4) {
      action = "approve";
      confidence = 0.86;
      reasons.push(`Sức khỏe Loại 4 — phù hợp tạm hoãn`);
      draftNote = "Duyệt tạm hoãn theo phân loại sức khỏe Loại 4.";
    } else if (snap.healthGrade != null && snap.healthGrade <= 3) {
      action = "reject";
      confidence = 0.75;
      reasons.push(
        `Sức khỏe ${snap.healthLabel} đạt tiêu chuẩn gọi — cân nhắc trả về`,
      );
      draftNote =
        "Không duyệt tạm hoãn — sức khỏe còn đạt. Đề nghị địa phương kiểm tra lại lý do / minh chứng.";
    } else if (snap.healthGrade != null && snap.healthGrade >= 5) {
      action = "reject";
      confidence = 0.7;
      reasons.push("Loại 5–6 thường thuộc miễn gọi, không phải tạm hoãn");
      draftNote =
        "Không duyệt tạm hoãn — phân loại sức khỏe nghiêng về miễn gọi. Đề nghị điều chỉnh hồ sơ.";
    } else {
      action = "approve";
      confidence = 0.55;
      reasons.push("Địa phương đã gửi tạm hoãn");
      draftNote = "Duyệt tạm hoãn theo hồ sơ địa phương — cần kiểm tra giấy tờ.";
    }
    if (!snap.hasGiayTamHoan) {
      warnings.push("Thiếu giấy tạm hoãn");
      confidence -= 0.15;
    }
    if (snap.militaryStatusReason) {
      reasons.push(`Lý do: ${snap.militaryStatusReason}`);
    }
  }

  return {
    citizenId: snap.citizenId,
    fullName: snap.fullName,
    action,
    kind,
    confidence: clampConfidence(confidence, 0.5),
    reasons,
    draftNote,
    warnings,
    source: "rules",
    label: qkActionLabel(action, kind),
  };
}

async function refineWithGemini(args: {
  mode: SuggestMode;
  kind?: ApprovalKind;
  snap: CitizenSuggestSnapshot;
  base: ApprovalSuggestItem;
}): Promise<ApprovalSuggestItem> {
  if (!isGeminiConfigured()) return args.base;

  const systemInstruction = `Bạn là trợ lý AI hỗ trợ cán bộ NVQS Việt Nam.
Chỉ gợi ý trong tập nhãn cho phép. Không bịa số liệu ngoài JSON.
Trả đúng một JSON, không markdown.
Cán bộ vẫn phải xác nhận — bạn chỉ tư vấn.`;

  const allowedLocal = [...LOCAL_ALLOWED];
  const prompt =
    args.mode === "local"
      ? `Dựa trên hồ sơ sau, gợi ý trạng thái NVQS cho cấp xã/tỉnh.

Nhãn cho phép: ${allowedLocal.join(", ")}
(khong_goi = đề xuất không gọi chờ Quân khu)

Rule gợi ý sẵn (có thể tinh chỉnh nếu có lý do rõ):
${JSON.stringify({
  suggestion: args.base.suggestion,
  confidence: args.base.confidence,
  reasons: args.base.reasons,
  warnings: args.base.warnings,
  draftNote: args.base.draftNote,
})}

Hồ sơ:
${JSON.stringify(args.snap)}

Trả JSON:
{"suggestion":"...","confidence":0.0,"reasons":["..."],"draftNote":"...","warnings":["..."]}`
      : `Dựa trên hồ sơ đang chờ xét duyệt Quân khu (kind=${args.kind}), gợi ý approve hoặc reject.

Rule gợi ý sẵn:
${JSON.stringify({
  action: args.base.action,
  confidence: args.base.confidence,
  reasons: args.base.reasons,
  warnings: args.base.warnings,
  draftNote: args.base.draftNote,
})}

Hồ sơ:
${JSON.stringify(args.snap)}

Trả JSON:
{"action":"approve"|"reject","confidence":0.0,"reasons":["..."],"draftNote":"...","warnings":["..."]}`;

  try {
    const raw = await generateGeminiText(prompt, {
      systemInstruction,
    });
    const obj = extractJsonObject(raw);
    if (!obj) return { ...args.base, source: "rules" };

    if (args.mode === "local") {
      const sug = String(obj.suggestion || "") as LocalNvqsSuggestion;
      if (!LOCAL_ALLOWED.has(sug)) return args.base;
      const reasons = Array.isArray(obj.reasons)
        ? obj.reasons.map(String).filter(Boolean).slice(0, 6)
        : args.base.reasons;
      const warnings = Array.isArray(obj.warnings)
        ? obj.warnings.map(String).filter(Boolean).slice(0, 6)
        : args.base.warnings;
      const draftNote =
        typeof obj.draftNote === "string" && obj.draftNote.trim()
          ? obj.draftNote.trim()
          : args.base.draftNote;
      return {
        ...args.base,
        suggestion: sug,
        confidence: clampConfidence(obj.confidence, args.base.confidence),
        reasons: reasons.length ? reasons : args.base.reasons,
        warnings,
        draftNote,
        source: "rules+gemini",
        label: localLabel(sug),
      };
    }

    const action = obj.action === "reject" ? "reject" : obj.action === "approve" ? "approve" : null;
    if (!action || !args.kind) return args.base;
    const reasons = Array.isArray(obj.reasons)
      ? obj.reasons.map(String).filter(Boolean).slice(0, 6)
      : args.base.reasons;
    const warnings = Array.isArray(obj.warnings)
      ? obj.warnings.map(String).filter(Boolean).slice(0, 6)
      : args.base.warnings;
    const draftNote =
      typeof obj.draftNote === "string" && obj.draftNote.trim()
        ? obj.draftNote.trim()
        : args.base.draftNote;
    return {
      ...args.base,
      action,
      kind: args.kind,
      confidence: clampConfidence(obj.confidence, args.base.confidence),
      reasons: reasons.length ? reasons : args.base.reasons,
      warnings,
      draftNote,
      source: "rules+gemini",
      label: qkActionLabel(action, args.kind),
    };
  } catch (e) {
    console.error("ai-approval-suggest Gemini:", e);
    return args.base;
  }
}

export async function suggestApprovalForCitizen(args: {
  citizenId: string;
  mode: SuggestMode;
  kind?: ApprovalKind;
}): Promise<ApprovalSuggestItem | null> {
  const snap = await loadCitizenSuggestSnapshot(args.citizenId);
  if (!snap) return null;

  const kind = args.kind || snap.kind;
  const base =
    args.mode === "local" ? ruleSuggestLocal(snap) : ruleSuggestQk(snap, kind);

  return refineWithGemini({
    mode: args.mode,
    kind: args.mode === "qk" ? kind : undefined,
    snap,
    base,
  });
}

export async function suggestApprovalBatch(args: {
  citizenIds: string[];
  mode: SuggestMode;
  kind?: ApprovalKind;
}): Promise<ApprovalSuggestItem[]> {
  const ids = [...new Set(args.citizenIds.map(String).filter(Boolean))].slice(
    0,
    AI_APPROVAL_SUGGEST_BATCH_MAX,
  );
  const out: ApprovalSuggestItem[] = [];
  for (const id of ids) {
    const item = await suggestApprovalForCitizen({
      citizenId: id,
      mode: args.mode,
      kind: args.kind,
    });
    if (item) out.push(item);
  }
  return out;
}

export function suggestMeta() {
  return {
    configured: isGeminiConfigured(),
    model: getGeminiModel(),
    batchMax: AI_APPROVAL_SUGGEST_BATCH_MAX,
  };
}
