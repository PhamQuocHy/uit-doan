import { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";
import {
  AnalyticsDashboard,
  AnalyticsFilters,
  DEFERMENT_LABELS,
  STATUS_LABELS,
} from "./types";
import { getDescendantUnitCodes, resolveScopeUnit } from "./scope";
import { medicalGradeToOrdinal, pearsonMatrix } from "./correlation";

function placeholders(n: number) {
  return Array(n).fill("?").join(",");
}

export async function buildAnalyticsDashboard(
  filters: AnalyticsFilters
): Promise<AnalyticsDashboard> {
  const scopeRoot = resolveScopeUnit(
    filters.sessionUnitCode,
    filters.hierarchyLevel,
    filters.unitCode
  );
  const unitCodes = await getDescendantUnitCodes(scopeRoot);
  if (unitCodes.length === 0) {
    unitCodes.push(scopeRoot);
  }

  const year = filters.year ?? new Date().getFullYear();
  const inUnits = placeholders(unitCodes.length);

  const overview = await getOverview(unitCodes, inUnits);
  const funnel = await getFunnel(unitCodes, inUnits);
  const recruitmentStatsByYear = await getYearStats(unitCodes, inUnits);
  const defermentReasons = await getDeferment(unitCodes, inUnits);
  const educationVsHealth = await getEduVsHealth(unitCodes, inUnits);
  const healthGradeByYear = await getHealthByYear(unitCodes, inUnits, year);
  const unitQualifyRates = await getUnitRates(unitCodes, inUnits);
  const quotas = await getQuotas(unitCodes, inUnits, year);
  const correlations = await getCorrelations(unitCodes, inUnits);

  return {
    overview,
    funnel,
    recruitmentStatsByYear,
    defermentReasons,
    educationVsHealth,
    healthGradeByYear,
    unitQualifyRates,
    quotas,
    correlations,
    meta: {
      year,
      unitCode: scopeRoot,
      generatedAt: new Date().toISOString(),
      source: "mysql",
    },
  };
}

async function getOverview(unitCodes: string[], inUnits: string) {
  const rows = await queryRows<(RowDataPacket & { military_status: string; cnt: number })[]>(
    `SELECT military_status, COUNT(*) AS cnt
     FROM citizens
     WHERE unit_code IN (${inUnits})
     GROUP BY military_status`,
    unitCodes
  );
  const map = Object.fromEntries(rows.map((r) => [r.military_status, Number(r.cnt)]));
  const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
  return {
    totalCitizens: total,
    availableForDraft: (map.chuakham || 0) + (map.dangkham || 0),
    deferred: map.tamhoan || 0,
    exempted: map.miengoi || 0,
    inService: map.nhapngu || 0,
    examining: map.dangkham || 0,
    passed: map.trungtuyen || 0,
  };
}

async function getFunnel(unitCodes: string[], inUnits: string) {
  const order = [
    "chuakham",
    "dangkham",
    "trungtuyen",
    "tamhoan",
    "miengoi",
    "nhapngu",
  ];
  const rows = await queryRows<(RowDataPacket & { military_status: string; cnt: number })[]>(
    `SELECT military_status, COUNT(*) AS cnt
     FROM citizens WHERE unit_code IN (${inUnits})
     GROUP BY military_status`,
    unitCodes
  );
  const map = Object.fromEntries(rows.map((r) => [r.military_status, Number(r.cnt)]));
  return order.map((status) => ({
    status,
    label: STATUS_LABELS[status] || status,
    count: map[status] || 0,
  }));
}

async function getYearStats(unitCodes: string[], inUnits: string) {
  const rows = await queryRows<
    (RowDataPacket & {
      year: number;
      called: number;
      passed: number;
      enlisted: number;
      failed: number;
      deferred: number;
    })[]
  >(
    `SELECT
       er.year AS year,
       COUNT(*) AS called,
       SUM(ep.result = 'passed') AS passed,
       SUM(ep.result = 'enlisted') AS enlisted,
       SUM(ep.result = 'failed') AS failed,
       SUM(ep.result = 'deferred') AS deferred
     FROM exam_participants ep
     INNER JOIN exam_rounds er ON er.id = ep.round_id
     INNER JOIN citizens c ON c.id = ep.citizen_id
     WHERE c.unit_code IN (${inUnits})
     GROUP BY er.year
     ORDER BY er.year`,
    unitCodes
  );

  if (rows.length > 0) {
    return rows.map((r) => ({
      year: String(r.year),
      called: Number(r.called),
      passed: Number(r.passed),
      enlisted: Number(r.enlisted),
      failed: Number(r.failed),
      deferred: Number(r.deferred),
    }));
  }

  // Fallback from health_exams if no exam_participants
  const he = await queryRows<
    (RowDataPacket & { year: number; called: number; passed: number })[]
  >(
    `SELECT exam_year AS year, COUNT(*) AS called, SUM(is_qualified = 1) AS passed
     FROM health_exams h
     INNER JOIN citizens c ON c.id = h.citizen_id
     WHERE c.unit_code IN (${inUnits})
     GROUP BY exam_year
     ORDER BY exam_year`,
    unitCodes
  );
  return he.map((r) => ({
    year: String(r.year),
    called: Number(r.called),
    passed: Number(r.passed),
    enlisted: 0,
    failed: Number(r.called) - Number(r.passed),
    deferred: 0,
  }));
}

async function getDeferment(unitCodes: string[], inUnits: string) {
  const rows = await queryRows<(RowDataPacket & { deferment_reason: string; cnt: number })[]>(
    `SELECT deferment_reason, COUNT(*) AS cnt
     FROM citizens
     WHERE unit_code IN (${inUnits})
       AND military_status IN ('tamhoan','miengoi')
       AND deferment_reason IS NOT NULL
     GROUP BY deferment_reason`,
    unitCodes
  );
  const total = rows.reduce((s, r) => s + Number(r.cnt), 0) || 1;
  return rows.map((r) => ({
    reason: r.deferment_reason,
    label: DEFERMENT_LABELS[r.deferment_reason] || r.deferment_reason,
    value: Number(r.cnt),
    percentage: Math.round((Number(r.cnt) / total) * 1000) / 10,
  }));
}

async function getEduVsHealth(unitCodes: string[], inUnits: string) {
  const rows = await queryRows<
    (RowDataPacket & { education_level: string; qualified: string; cnt: number })[]
  >(
    `SELECT
       COALESCE(edu.level, 'Chưa rõ') AS education_level,
       CASE WHEN c.health_grade IS NULL THEN 'Chưa rõ'
            WHEN c.health_grade <= 3 THEN 'Đạt (1-3)'
            ELSE 'Không đạt (4-6)' END AS qualified,
       COUNT(*) AS cnt
     FROM citizens c
     LEFT JOIN (
       SELECT e1.citizen_id, e1.level
       FROM citizen_education e1
       INNER JOIN (
         SELECT citizen_id, MAX(id) AS max_id FROM citizen_education GROUP BY citizen_id
       ) t ON t.max_id = e1.id
     ) edu ON edu.citizen_id = c.id
     WHERE c.unit_code IN (${inUnits})
     GROUP BY education_level, qualified`,
    unitCodes
  );
  return rows.map((r) => ({
    row: r.education_level,
    col: r.qualified,
    count: Number(r.cnt),
  }));
}

async function getHealthByYear(unitCodes: string[], inUnits: string, year: number) {
  const rows = await queryRows<
    (RowDataPacket & { exam_year: number; medical_grade: string; cnt: number })[]
  >(
    `SELECT h.exam_year, COALESCE(h.medical_grade, 'Chưa rõ') AS medical_grade, COUNT(*) AS cnt
     FROM health_exams h
     INNER JOIN citizens c ON c.id = h.citizen_id
     WHERE c.unit_code IN (${inUnits})
       AND h.exam_year BETWEEN ? AND ?
     GROUP BY h.exam_year, h.medical_grade
     ORDER BY h.exam_year, h.medical_grade`,
    [...unitCodes, year - 3, year]
  );
  return rows.map((r) => ({
    row: String(r.exam_year),
    col: r.medical_grade,
    count: Number(r.cnt),
  }));
}

async function getUnitRates(unitCodes: string[], inUnits: string) {
  const rows = await queryRows<
    (RowDataPacket & {
      unit_code: string;
      unit_name: string;
      total: number;
      qualified: number;
    })[]
  >(
    `SELECT
       c.unit_code,
       COALESCE(hu.name, c.unit_code) AS unit_name,
       COUNT(*) AS total,
       SUM(CASE WHEN c.health_grade IS NOT NULL AND c.health_grade <= 3 THEN 1 ELSE 0 END) AS qualified
     FROM citizens c
     LEFT JOIN hierarchy_units hu ON hu.code = c.unit_code
     WHERE c.unit_code IN (${inUnits})
     GROUP BY c.unit_code, hu.name
     ORDER BY total DESC
     LIMIT 15`,
    unitCodes
  );
  return rows.map((r) => ({
    unitCode: r.unit_code,
    unitName: r.unit_name,
    total: Number(r.total),
    qualified: Number(r.qualified),
    qualifyRate:
      Number(r.total) > 0
        ? Math.round((Number(r.qualified) / Number(r.total)) * 1000) / 10
        : 0,
  }));
}

async function getQuotas(unitCodes: string[], inUnits: string, year: number) {
  const rows = await queryRows<
    (RowDataPacket & {
      to_unit: string;
      unit_name: string;
      amount: number;
      filled: number;
    })[]
  >(
    `SELECT q.to_unit, COALESCE(hu.name, q.to_unit) AS unit_name,
            SUM(q.amount) AS amount, SUM(q.filled) AS filled
     FROM quotas q
     LEFT JOIN hierarchy_units hu ON hu.code = q.to_unit
     WHERE q.year = ? AND q.to_unit IN (${inUnits})
     GROUP BY q.to_unit, hu.name
     ORDER BY amount DESC
     LIMIT 20`,
    [year, ...unitCodes]
  );
  return rows.map((r) => ({
    unitCode: r.to_unit,
    unitName: r.unit_name,
    amount: Number(r.amount),
    filled: Number(r.filled),
    fillRate:
      Number(r.amount) > 0
        ? Math.round((Number(r.filled) / Number(r.amount)) * 1000) / 10
        : 0,
  }));
}

async function getCorrelations(unitCodes: string[], inUnits: string) {
  const labels = ["age", "height", "weight", "bmi", "health_grade"];
  const rows = await queryRows<
    (RowDataPacket & {
      age: number;
      height: number | null;
      weight: number | null;
      bmi: number | null;
      health_grade: number | null;
      medical_grade: string | null;
    })[]
  >(
    `SELECT
       TIMESTAMPDIFF(YEAR, c.date_of_birth, CURDATE()) AS age,
       h.height, h.weight,
       CASE WHEN h.height > 0 THEN ROUND(h.weight / POWER(h.height/100, 2), 2) ELSE NULL END AS bmi,
       c.health_grade,
       h.medical_grade
     FROM citizens c
     INNER JOIN health_exams h ON h.citizen_id = c.id
     WHERE c.unit_code IN (${inUnits})
     LIMIT 2000`,
    unitCodes
  );

  const data = rows.map((r) => ({
    age: Number(r.age),
    height: r.height != null ? Number(r.height) : null,
    weight: r.weight != null ? Number(r.weight) : null,
    bmi: r.bmi != null ? Number(r.bmi) : null,
    health_grade:
      r.health_grade != null
        ? Number(r.health_grade)
        : medicalGradeToOrdinal(r.medical_grade),
  }));

  const { matrix, sampleSize } = pearsonMatrix(data, labels);
  return { labels, matrix, sampleSize };
}
