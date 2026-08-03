export type DefermentReason =
  | "hoc_tap"
  | "suc_khoe"
  | "gia_dinh"
  | "chua_du_tuoi"
  | "khac";

export interface AnalyticsFilters {
  year?: number;
  unitCode?: string;
  /** Session unit — descendants are always scoped */
  sessionUnitCode: string;
  hierarchyLevel: string;
}

export interface OverviewKpi {
  totalCitizens: number;
  availableForDraft: number;
  deferred: number;
  exempted: number;
  inService: number;
  examining: number;
  passed: number;
}

export interface FunnelStep {
  status: string;
  label: string;
  count: number;
}

export interface YearStat {
  year: string;
  called: number;
  passed: number;
  enlisted: number;
  failed: number;
  deferred: number;
}

export interface DefermentItem {
  reason: string;
  label: string;
  value: number;
  percentage: number;
}

export interface CrossTabCell {
  row: string;
  col: string;
  count: number;
}

export interface QuotaStat {
  unitCode: string;
  unitName: string;
  amount: number;
  filled: number;
  fillRate: number;
}

export interface UnitRate {
  unitCode: string;
  unitName: string;
  total: number;
  qualified: number;
  qualifyRate: number;
}

export interface CorrelationMatrix {
  labels: string[];
  matrix: number[][];
  sampleSize: number;
}

export interface AnalyticsDashboard {
  overview: OverviewKpi;
  funnel: FunnelStep[];
  recruitmentStatsByYear: YearStat[];
  defermentReasons: DefermentItem[];
  educationVsHealth: CrossTabCell[];
  healthGradeByYear: CrossTabCell[];
  unitQualifyRates: UnitRate[];
  quotas: QuotaStat[];
  correlations: CorrelationMatrix;
  meta: {
    year: number | null;
    unitCode: string;
    generatedAt: string;
    source: "mysql";
  };
}

export const DEFERMENT_LABELS: Record<string, string> = {
  hoc_tap: "Học tập (ĐH/CĐ)",
  suc_khoe: "Sức khỏe không đạt",
  gia_dinh: "Hoàn cảnh gia đình",
  chua_du_tuoi: "Chưa đủ tuổi",
  khac: "Khác",
};

export const STATUS_LABELS: Record<string, string> = {
  chuakham: "Chưa khám",
  dangkham: "Đang khám",
  trungtuyen: "Đậu",
  truottuyen: "Rớt",
  tamhoan: "Tạm hoãn",
  miengoi: "Miễn gọi",
  nhapngu: "Nhập ngũ",
};
