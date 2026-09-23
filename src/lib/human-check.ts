/** Advisory signal only: a model score is not a calibrated probability. */
export const HUMAN_CHECK_THRESHOLD = 0.8;
export type HumanCheck = { required: boolean; reasons: string[]; threshold: number };
export type HumanCheckInput = {
  confidence: number;
  warnings: string[];
  source: string;
  needsHumanReview?: boolean;
};

export function assessHumanCheck(item: HumanCheckInput, requireGemini = false): HumanCheck {
  const reasons: string[] = [];
  if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) {
    reasons.push("Không có điểm tin cậy hợp lệ.");
  } else if (item.confidence < HUMAN_CHECK_THRESHOLD) {
    reasons.push(`Điểm tin cậy tham khảo dưới ${HUMAN_CHECK_THRESHOLD * 100}%.`);
  }
  if (item.needsHumanReview) reasons.push("Kết quả AI cần được người dùng kiểm tra lại.");
  if (requireGemini && item.source === "rules") reasons.push("Chưa có kết quả Gemini hợp lệ; hiện chỉ có gợi ý theo quy tắc.");
  reasons.push(...item.warnings.filter(w => typeof w === "string" && w.trim()).map(w => w.slice(0, 500)));
  return { required: reasons.length > 0, reasons: [...new Set(reasons)], threshold: HUMAN_CHECK_THRESHOLD };
}

export function validAiConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Preserve missing-data warnings and flag disagreement even if Gemini claims confidence. */
export function reviewSignals(base: { warnings: string[]; suggestion?: string; action?: string }, row: Record<string, unknown>) {
  const warnings = [...new Set([...base.warnings,
    ...(Array.isArray(row.warnings) ? row.warnings.filter((w): w is string => typeof w === "string").slice(0, 6) : []),
  ])];
  const changed = (typeof row.suggestion === "string" && row.suggestion !== base.suggestion) ||
    (typeof row.action === "string" && row.action !== base.action);
  if (changed) warnings.push("Gợi ý Gemini khác với kết quả kiểm tra theo quy tắc; cần đối chiếu hồ sơ.");
  return { warnings, needsHumanReview: row.needsHumanReview === true || !validAiConfidence(row.confidence) ||
    (typeof row.confidence === "number" && row.confidence < HUMAN_CHECK_THRESHOLD) || changed };
}
