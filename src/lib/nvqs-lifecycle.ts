/**
 * Vòng đời hồ sơ NVQS — nguồn sự thật duy nhất (khép kín).
 *
 * 1. Hồ sơ công dân lưu VĨNH VIỄN (không xóa cứng khi hết tuổi).
 * 2. Độ tuổi NVQS: 18–27 (tuổi = năm hiện tại − năm sinh).
 * 3. Mỗi năm trong cửa sổ đó = 1 chu kỳ khám (Vòng 1 → Vòng 2), giữ lịch sử đối chiếu.
 * 4. Tuổi > 27 → chờ duyệt → archived_at → Hồ sơ lưu trữ (vẫn xem đủ lịch sử).
 */
import {
  calcAgeYears,
  NVQS_AGE_MAX,
  NVQS_AGE_MIN,
  type CitizenAgeScope,
} from "@/lib/nvqs-age";

export type NvqsLifecycleStage =
  | "pre_age"
  | "active"
  | "pending_archive"
  | "archived";

/** Số mốc năm lịch trong cửa sổ 18–27 (bao gồm cả hai đầu). */
export const NVQS_EXAM_YEAR_SPAN = NVQS_AGE_MAX - NVQS_AGE_MIN + 1;

export function getBirthYear(dateOfBirth: string | Date): number | null {
  const dob =
    dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  return dob.getFullYear();
}

/**
 * Cửa sổ năm khám hợp lệ: [năm sinh+18 … min(năm hiện tại, năm sinh+27)].
 * Trả years=[] nếu chưa đủ 18 tuổi.
 */
export function getNvqsExamYearWindow(
  dateOfBirth: string | Date | undefined,
  at: Date = new Date(),
): { birthYear: number; fromYear: number; toYear: number; years: number[] } | null {
  if (!dateOfBirth) return null;
  const birthYear = getBirthYear(dateOfBirth);
  if (birthYear == null) return null;
  const current = at.getFullYear();
  const fromYear = birthYear + NVQS_AGE_MIN;
  const toYear = Math.min(current, birthYear + NVQS_AGE_MAX);
  if (toYear < fromYear) {
    return { birthYear, fromYear, toYear: fromYear - 1, years: [] };
  }
  const years: number[] = [];
  for (let y = toYear; y >= fromYear; y--) years.push(y);
  return { birthYear, fromYear, toYear, years };
}

export function isValidNvqsExamYear(
  dateOfBirth: string | Date | undefined,
  year: number,
  at: Date = new Date(),
): boolean {
  const win = getNvqsExamYearWindow(dateOfBirth, at);
  if (!win) return false;
  return win.years.includes(year);
}

/** Năm chọn trên UI: cửa sổ NVQS ∪ năm đã có hồ sơ khám (đối chiếu). */
export function mergeStableHealthYears(
  dateOfBirth: string | Date | undefined,
  recordYears: number[],
  at: Date = new Date(),
): number[] {
  const win = getNvqsExamYearWindow(dateOfBirth, at);
  const set = new Set<number>([...(win?.years ?? []), ...recordYears]);
  return [...set].sort((a, b) => b - a);
}

export function resolveLifecycleStage(
  dateOfBirth: string | Date,
  archivedAt?: string | null,
  at: Date = new Date(),
): NvqsLifecycleStage {
  if (archivedAt) return "archived";
  const age = calcAgeYears(dateOfBirth, at);
  if (age < NVQS_AGE_MIN) return "pre_age";
  if (age > NVQS_AGE_MAX) return "pending_archive";
  return "active";
}

export function lifecycleToAgeScope(
  stage: NvqsLifecycleStage,
): CitizenAgeScope | null {
  if (stage === "active" || stage === "pre_age") return "active";
  if (stage === "pending_archive") return "pending";
  if (stage === "archived") return "archive";
  return null;
}

export function lifecycleStageLabel(stage: NvqsLifecycleStage): string {
  switch (stage) {
    case "pre_age":
      return "Chưa đủ tuổi NVQS";
    case "active":
      return "Đang trong độ tuổi NVQS (18–27)";
    case "pending_archive":
      return "Hết tuổi — chờ duyệt lưu trữ";
    case "archived":
      return "Đã lưu trữ vĩnh viễn";
  }
}
