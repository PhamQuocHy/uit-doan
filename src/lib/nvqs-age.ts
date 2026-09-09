/** Độ tuổi NVQS theo luật hiện hành (18–27). */
export const NVQS_AGE_MIN = 18;
export const NVQS_AGE_MAX = 27;

export type CitizenAgeScope = "active" | "archive" | "pending" | "all";

/**
 * Tuổi theo năm lịch (năm hiện tại − năm sinh), đúng yêu cầu quản lý NVQS theo năm.
 */
export function calcAgeYears(
  dateOfBirth: string | Date,
  at: Date = new Date(),
): number {
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  return at.getFullYear() - dob.getFullYear();
}

/** Tuổi theo năm đợt khám (năm đợt − năm sinh). */
export function calcAgeInYear(
  dateOfBirth: string | Date,
  campaignYear: number,
): number {
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  return campaignYear - dob.getFullYear();
}

/** Còn trong khung tuổi NVQS trong năm đợt. */
export function isNvqsAgeInYear(
  dateOfBirth: string | Date,
  campaignYear: number,
): boolean {
  const age = calcAgeInYear(dateOfBirth, campaignYear);
  return age >= NVQS_AGE_MIN && age <= NVQS_AGE_MAX;
}

/** Biểu thức SQL tuổi theo năm (cột date_of_birth, có thể kèm alias bảng). */
export function sqlAgeYear(column = "c.date_of_birth"): string {
  return `(YEAR(CURDATE()) - YEAR(${column}))`;
}

/** @deprecated dùng sqlAgeYear() */
export const SQL_AGE_YEAR = sqlAgeYear("c.date_of_birth");

export function isNvqsActiveAge(dateOfBirth: string | Date): boolean {
  const age = calcAgeYears(dateOfBirth);
  return age >= NVQS_AGE_MIN && age <= NVQS_AGE_MAX;
}

/** Hết tuổi NVQS — chờ / đã vào lưu trữ */
export function isNvqsExpiredAge(dateOfBirth: string | Date): boolean {
  return calcAgeYears(dateOfBirth) > NVQS_AGE_MAX;
}

/** Highlight dòng danh sách công dân: 27 đỏ, 26 vàng */
export function citizenRowAgeTone(
  dateOfBirth: string | Date,
): "danger" | "warn" | null {
  const age = calcAgeYears(dateOfBirth);
  if (age >= NVQS_AGE_MAX) return "danger";
  if (age === NVQS_AGE_MAX - 1) return "warn";
  return null;
}
