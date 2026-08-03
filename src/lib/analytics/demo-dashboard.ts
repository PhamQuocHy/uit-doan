import { db } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/analytics/types";
import type { AnalyticsDashboard } from "@/lib/analytics/types";

/** Tổng hợp nhanh từ in-memory khi chưa có MySQL — chỉ để demo phân tích AI */
export function buildDemoAnalyticsDashboard(unitCode = "bo"): AnalyticsDashboard {
  const all = db.citizens.findAll({ limit: 10000 }).data;
  const citizens = unitCode && unitCode !== "bo"
    ? all.filter((c) => c.unitCode?.startsWith(unitCode) || c.unitCode === unitCode)
    : all;

  const statusCounts: Record<string, number> = {};
  for (const c of citizens) {
    statusCounts[c.militaryStatus] = (statusCounts[c.militaryStatus] || 0) + 1;
  }

  const funnel = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status] || status,
    count,
  }));

  const deferred = statusCounts.tamhoan || 0;
  const exempted = statusCounts.miengoi || 0;
  const inService = statusCounts.nhapngu || 0;
  const examining = statusCounts.dangkham || 0;
  const passed = statusCounts.trungtuyen || 0;

  const defermentMap = citizens
    .filter((c) => c.militaryStatusReason && c.militaryStatus === "tamhoan")
    .reduce<Record<string, number>>((acc, c) => {
      const key = c.militaryStatusReason || "Khác";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const defermentTotal = Object.values(defermentMap).reduce((a, b) => a + b, 0);
  const defermentReasons = Object.entries(defermentMap).map(([reason, value]) => ({
    reason,
    label: reason,
    value,
    percentage: defermentTotal ? Math.round((value / defermentTotal) * 100) : 0,
  }));

  return {
    overview: {
      totalCitizens: citizens.length,
      availableForDraft: (statusCounts.chuakham || 0) + examining,
      deferred,
      exempted,
      inService,
      examining,
      passed,
    },
    funnel,
    recruitmentStatsByYear: [
      {
        year: String(new Date().getFullYear()),
        called: citizens.length,
        passed,
        enlisted: inService,
        failed: statusCounts.truottuyen || 0,
        deferred,
      },
    ],
    defermentReasons,
    educationVsHealth: [],
    healthGradeByYear: [],
    unitQualifyRates: [],
    quotas: [],
    correlations: { labels: [], matrix: [], sampleSize: 0 },
    meta: {
      year: new Date().getFullYear(),
      unitCode,
      generatedAt: new Date().toISOString(),
      source: "demo",
    },
  } as AnalyticsDashboard & { meta: { source: string } };
}
