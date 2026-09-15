import type { HealthRecord } from "./data";

export function isRoundTwo(record: HealthRecord): boolean {
  return record.phase === "Khám tuyển cấp tỉnh" || record.phase === "Khám tuyển cấp huyện";
}

export function selectPrintExam(records: HealthRecord[], citizenId: string, year: number, round: 1 | 2) {
  const history = records.filter(record => record.citizenId === citizenId && record.year === year)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const hasRoundTwo = history.some(isRoundTwo);
  const effectiveRound = hasRoundTwo ? round : 1;
  return {
    hasRoundTwo,
    round: effectiveRound,
    record: history.find(record => effectiveRound === 2 ? isRoundTwo(record) : record.phase === "Sơ tuyển cấp xã"),
  };
}
