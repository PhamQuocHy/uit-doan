import type { HealthExamPhase, HealthRecord, HierarchyLevel } from "@/lib/data";
import { isDetailedHealthPhase } from "@/lib/data";
import {
  mergeStableHealthYears,
  getNvqsExamYearWindow,
  type NvqsExamYearOpts,
} from "@/lib/nvqs-lifecycle";

export type HealthExamRound = "screening" | "detailed";

export const NVQS_HEALTH_PERIOD = "01/11 – 31/12 hàng năm";

/** @deprecated dùng getNvqsExamYearWindow / mergeStableHealthYears */
export function nvqsExamYears(
  dateOfBirth: string | Date | undefined,
  at: Date = new Date(),
  opts?: NvqsExamYearOpts,
): number[] {
  return getNvqsExamYearWindow(dateOfBirth, at, opts)?.years ?? [];
}

/** @deprecated dùng mergeStableHealthYears */
export function mergeHealthYearOptions(
  dateOfBirth: string | Date | undefined,
  recordYears: number[],
  at: Date = new Date(),
  opts?: NvqsExamYearOpts,
): number[] {
  return mergeStableHealthYears(dateOfBirth, recordYears, at, opts);
}

export function yearHasOpenExamSlot(
  records: HealthRecord[],
  year: number,
): boolean {
  return getAvailableExamRounds(records, year).length > 0;
}

export const NVQS_WORKFLOW_STEPS = [
  {
    id: "list",
    label: "Lập danh sách",
    description: "BCHQS cấp xã lập danh sách công dân đủ điều kiện",
  },
  {
    id: "summons",
    label: "Phát lệnh gọi",
    description: "Gửi lệnh gọi khám sức khỏe trước ngày khám",
  },
  {
    id: "round1",
    label: "Vòng 1 — Sơ tuyển",
    description: "Khám thể lực, dị tật tại Trạm Y tế xã",
  },
  {
    id: "round2",
    label: "Vòng 2 — Khám chi tiết",
    description: "Khám chuyên khoa tại TTYT huyện / tỉnh",
  },
  {
    id: "paraclinical",
    label: "Cận lâm sàng",
    description: "Xét nghiệm, siêu âm, X-quang, sàng lọc ma túy/HIV",
  },
  {
    id: "classify",
    label: "Phân loại & công bố",
    description: "Chấm điểm, phân loại Loại 1–6 theo quy định BQP",
  },
] as const;

export const HEALTH_CONCLUSIONS = [
  "Loại 1",
  "Loại 2",
  "Loại 3",
  "Loại 4",
  "Loại 5",
  "Loại 6",
] as const;

export function canEnterHealthRecords(
  functionalRole: string | null,
  userRole?: string,
): boolean {
  if (userRole === "admin") return true;
  if (functionalRole === "y_te" || functionalRole === "tuyen_quan") return true;
  return Boolean(userRole);
}

/**
 * Phân quyền vòng khám theo cấp đơn vị:
 * - Xã: Vòng 1 (sơ tuyển)
 * - Tỉnh: Vòng 2 (khám chi tiết)
 * - Bộ: cả hai
 */
export function allowedExamRoundsForHierarchy(
  hierarchyLevel: string | null | undefined,
): HealthExamRound[] {
  if (hierarchyLevel === "bo") return ["screening", "detailed"];
  if (hierarchyLevel === "tinh") return ["detailed"];
  if (hierarchyLevel === "xa") return ["screening"];
  return [];
}

export function canEnterExamRoundAtLevel(
  round: HealthExamRound,
  hierarchyLevel: string | null | undefined,
): boolean {
  return allowedExamRoundsForHierarchy(hierarchyLevel).includes(round);
}

export function screeningRecordForYear(
  records: HealthRecord[],
  year: number,
): HealthRecord | undefined {
  return records.find(
    (r) => r.year === year && r.phase === "Sơ tuyển cấp xã",
  );
}

export function detailedRecordForYear(
  records: HealthRecord[],
  year: number,
): HealthRecord | undefined {
  return records.find(
    (r) => r.year === year && isDetailedHealthPhase(r.phase),
  );
}

export function isScreeningPass(conclusion: string): boolean {
  return ["Loại 1", "Loại 2", "Loại 3"].includes(conclusion);
}

export function resolveDetailedPhase(
  hierarchyLevel: HierarchyLevel | string,
): HealthExamPhase {
  if (hierarchyLevel === "tinh" || hierarchyLevel === "bo") {
    return "Khám tuyển cấp tỉnh";
  }
  return "Khám tuyển cấp huyện";
}

export function normalizeExamPhase(phaseRaw: string): HealthExamPhase {
  const s = phaseRaw || "";
  if (/sơ tuyển|cấp xã|vòng\s*1/i.test(s)) return "Sơ tuyển cấp xã";
  if (/tỉnh/i.test(s)) return "Khám tuyển cấp tỉnh";
  if (/chi tiết|huyện|vòng\s*2/i.test(s)) return "Khám tuyển cấp huyện";
  if (isDetailedHealthPhase(s as HealthExamPhase)) return s as HealthExamPhase;
  return "Sơ tuyển cấp xã";
}

export function getAvailableExamRounds(
  records: HealthRecord[],
  year: number,
  hierarchyLevel?: string | null,
): HealthExamRound[] {
  const screening = screeningRecordForYear(records, year);
  const detailed = detailedRecordForYear(records, year);

  let rounds: HealthExamRound[] = [];
  if (!screening) rounds = ["screening"];
  else if (isScreeningPass(screening.conclusion) && !detailed) {
    rounds = ["detailed"];
  }

  if (hierarchyLevel != null && hierarchyLevel !== "") {
    const allowed = allowedExamRoundsForHierarchy(hierarchyLevel);
    rounds = rounds.filter((r) => allowed.includes(r));
  }
  return rounds;
}

export function getYearExamStatusLabel(
  records: HealthRecord[],
  year: number,
): string {
  const screening = screeningRecordForYear(records, year);
  const detailed = detailedRecordForYear(records, year);
  if (!screening && !detailed) return "Chưa khám";
  if (detailed) return `Đã khám chi tiết · ${detailed.conclusion}`;
  if (screening && !isScreeningPass(screening.conclusion)) {
    return `Kết thúc sơ tuyển · ${screening.conclusion}`;
  }
  if (screening) return `Đã sơ tuyển · chờ vòng 2`;
  return "Đang xử lý";
}

export function getWorkflowStepStatus(
  records: HealthRecord[],
  year: number,
): Record<(typeof NVQS_WORKFLOW_STEPS)[number]["id"], "done" | "current" | "pending"> {
  const screening = screeningRecordForYear(records, year);
  const detailed = detailedRecordForYear(records, year);

  const screeningDone = Boolean(screening);
  const screeningPass = screening ? isScreeningPass(screening.conclusion) : false;
  const detailedDone = Boolean(detailed);
  const classified = detailedDone || (screeningDone && !screeningPass);

  return {
    list: screeningDone || detailedDone ? "done" : "current",
    summons: screeningDone || detailedDone ? "done" : "pending",
    round1: screeningDone
      ? "done"
      : classified
        ? "pending"
        : "current",
    round2: detailedDone
      ? "done"
      : screeningPass
        ? "current"
        : screeningDone
          ? "pending"
          : "pending",
    paraclinical: detailedDone
      ? "done"
      : screeningPass && !detailedDone
        ? "current"
        : "pending",
    classify: classified ? "done" : detailedDone ? "current" : "pending",
  };
}

export function defaultFacilityForRound(
  round: HealthExamRound,
  hierarchyLevel: string,
): string {
  if (round === "screening") return "Trạm Y tế xã";
  if (hierarchyLevel === "tinh" || hierarchyLevel === "bo") {
    return "Trung tâm Y tế / Bệnh viện tỉnh";
  }
  return "Trung tâm Y tế huyện";
}
