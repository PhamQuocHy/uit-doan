/**
 * Vòng đời hồ sơ NVQS — nguồn sự thật duy nhất (khép kín).
 *
 * 1. Hồ sơ công dân lưu VĨNH VIỄN (không xóa cứng khi hết tuổi).
 * 2. Độ tuổi NVQS: 18–27 (tuổi = năm lịch − năm sinh).
 * 3. Mỗi năm trong cửa sổ đó = 1 chu kỳ khám (Vòng 1 → Vòng 2), giữ lịch sử đối chiếu.
 * 4. Tuổi > 27 → chờ duyệt → archived_at → Hồ sơ lưu trữ (vẫn xem đủ lịch sử).
 * 5. Đợt tuyển quân năm N (vd. 2027) → năm khám N nằm trong cửa sổ nếu đủ tuổi năm đó,
 *    dù lịch máy đang là 2026.
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

export type NvqsExamYearOpts = {
  /**
   * Năm đợt tuyển / năm cần mở khám sớm (vd. 2027 khi tạo đợt 2027
   * trong khi máy tính vẫn đang 2026).
   */
  throughYear?: number | null;
  /** Các năm đợt đã gắn hồ sơ — luôn đưa vào cửa sổ nếu còn trong 18–27. */
  campaignYears?: number[] | null;
};

export function getBirthYear(dateOfBirth: string | Date): number | null {
  const dob =
    dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  return dob.getFullYear();
}

function resolveHorizonYear(at: Date, opts?: NvqsExamYearOpts): number {
  const current = at.getFullYear();
  let horizon = current;
  if (opts?.throughYear != null && Number.isFinite(opts.throughYear)) {
    horizon = Math.max(horizon, Number(opts.throughYear));
  }
  for (const y of opts?.campaignYears || []) {
    if (Number.isFinite(y)) horizon = Math.max(horizon, Number(y));
  }
  return horizon;
}

/**
 * Cửa sổ năm khám hợp lệ: [năm sinh+18 … min(horizon, năm sinh+27)].
 * horizon = max(năm máy, throughYear, campaignYears).
 * Trả years=[] nếu chưa đủ 18 tuổi trong horizon.
 */
export function getNvqsExamYearWindow(
  dateOfBirth: string | Date | undefined,
  at: Date = new Date(),
  opts?: NvqsExamYearOpts,
): { birthYear: number; fromYear: number; toYear: number; years: number[] } | null {
  if (!dateOfBirth) return null;
  const birthYear = getBirthYear(dateOfBirth);
  if (birthYear == null) return null;
  const horizon = resolveHorizonYear(at, opts);
  const fromYear = birthYear + NVQS_AGE_MIN;
  const toYear = Math.min(horizon, birthYear + NVQS_AGE_MAX);
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
  opts?: NvqsExamYearOpts,
): boolean {
  const win = getNvqsExamYearWindow(dateOfBirth, at, opts);
  if (!win) return false;
  return win.years.includes(year);
}

/** Năm chọn trên UI: cửa sổ NVQS ∪ năm đã có hồ sơ khám (đối chiếu). */
export function mergeStableHealthYears(
  dateOfBirth: string | Date | undefined,
  recordYears: number[],
  at: Date = new Date(),
  opts?: NvqsExamYearOpts,
): number[] {
  const win = getNvqsExamYearWindow(dateOfBirth, at, opts);
  const set = new Set<number>([...(win?.years ?? []), ...recordYears]);
  for (const y of opts?.campaignYears || []) {
    if (!Number.isFinite(y)) continue;
    const birth = dateOfBirth ? getBirthYear(dateOfBirth) : null;
    if (birth == null) continue;
    if (y >= birth + NVQS_AGE_MIN && y <= birth + NVQS_AGE_MAX) set.add(y);
  }
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
