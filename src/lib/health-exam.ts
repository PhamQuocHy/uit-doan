import type { HealthExamPhase, HealthRecord, HierarchyLevel } from "@/lib/data";
import { isDetailedHealthPhase } from "@/lib/data";

export type HealthExamRound = "screening" | "detailed";

export const NVQS_HEALTH_PERIOD = "01/11 – 31/12 hàng năm";

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
  return functionalRole === "y_te" || functionalRole === "tuyen_quan";
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

export function getAvailableExamRounds(
  records: HealthRecord[],
  year: number,
): HealthExamRound[] {
  const screening = screeningRecordForYear(records, year);
  const detailed = detailedRecordForYear(records, year);

  if (!screening) return ["screening"];
  if (isScreeningPass(screening.conclusion) && !detailed) return ["detailed"];
  return [];
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
