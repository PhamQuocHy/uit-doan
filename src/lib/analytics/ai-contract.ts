/**
 * AI bridge contract (phase sau — KHÔNG train model ở phase Data Mining).
 *
 * Feature mart: bảng `analytics_citizen_features`
 * Refresh: `npx tsx scripts/refresh-features.ts` hoặc gọi refreshCitizenFeatures()
 *
 * Planned endpoint (stub only for now):
 *   POST /api/admin/ai/risk-score
 *   Body: { citizenId: string } | { unitCode?: string, limit?: number }
 *   Reads: analytics_citizen_features
 *   Returns: { citizenId, riskScore, factors[] }  // XAI factors later
 *
 * Feature columns intended for Logistic Regression / Random Forest:
 *   age, unit_level, education_level, job_proxy, health_grade,
 *   is_qualified_last, bmi, exam_count, years_since_last_exam,
 *   military_status, deferment_reason, is_blacklisted
 */

export const AI_RISK_SCORE_PATH = "/api/admin/ai/risk-score";

export const AI_FEATURE_COLUMNS = [
  "age",
  "unit_level",
  "education_level",
  "job_proxy",
  "health_grade",
  "is_qualified_last",
  "bmi",
  "exam_count",
  "years_since_last_exam",
  "military_status",
  "deferment_reason",
  "is_blacklisted",
] as const;

export type AiFeatureColumn = (typeof AI_FEATURE_COLUMNS)[number];
