import { queryExecute } from "@/lib/db";

/** Refresh materialized feature mart used by analytics + future AI */
export async function refreshCitizenFeatures(): Promise<void> {
  await queryExecute(`
INSERT INTO analytics_citizen_features (
  citizen_id, age, unit_code, unit_level, education_level, job_proxy,
  health_grade, is_qualified_last, height, weight, bmi,
  military_status, deferment_reason, exam_count, years_since_last_exam,
  is_blacklisted, refreshed_at
)
SELECT
  c.id,
  TIMESTAMPDIFF(YEAR, c.date_of_birth, CURDATE()) AS age,
  c.unit_code,
  hu.level AS unit_level,
  edu.level AS education_level,
  edu.major AS job_proxy,
  c.health_grade,
  he.is_qualified AS is_qualified_last,
  he.height,
  he.weight,
  CASE
    WHEN he.height IS NOT NULL AND he.height > 0 AND he.weight IS NOT NULL
    THEN ROUND(he.weight / POWER(he.height / 100, 2), 2)
    ELSE NULL
  END AS bmi,
  c.military_status,
  c.deferment_reason,
  COALESCE(ec.exam_count, 0) AS exam_count,
  CASE
    WHEN he.exam_year IS NOT NULL THEN YEAR(CURDATE()) - he.exam_year
    ELSE NULL
  END AS years_since_last_exam,
  c.is_blacklisted,
  NOW()
FROM citizens c
LEFT JOIN hierarchy_units hu ON hu.code = c.unit_code
LEFT JOIN (
  SELECT e1.citizen_id, e1.level, e1.major
  FROM citizen_education e1
  INNER JOIN (
    SELECT citizen_id, MAX(id) AS max_id FROM citizen_education GROUP BY citizen_id
  ) latest ON latest.max_id = e1.id
) edu ON edu.citizen_id = c.id
LEFT JOIN (
  SELECT h1.citizen_id, h1.is_qualified, h1.height, h1.weight, h1.exam_year
  FROM health_exams h1
  INNER JOIN (
    SELECT citizen_id, MAX(exam_year) AS max_year FROM health_exams GROUP BY citizen_id
  ) hy ON hy.citizen_id = h1.citizen_id AND hy.max_year = h1.exam_year
) he ON he.citizen_id = c.id
LEFT JOIN (
  SELECT citizen_id, COUNT(*) AS exam_count FROM health_exams GROUP BY citizen_id
) ec ON ec.citizen_id = c.id
ON DUPLICATE KEY UPDATE
  age = VALUES(age),
  unit_code = VALUES(unit_code),
  unit_level = VALUES(unit_level),
  education_level = VALUES(education_level),
  job_proxy = VALUES(job_proxy),
  health_grade = VALUES(health_grade),
  is_qualified_last = VALUES(is_qualified_last),
  height = VALUES(height),
  weight = VALUES(weight),
  bmi = VALUES(bmi),
  military_status = VALUES(military_status),
  deferment_reason = VALUES(deferment_reason),
  exam_count = VALUES(exam_count),
  years_since_last_exam = VALUES(years_since_last_exam),
  is_blacklisted = VALUES(is_blacklisted),
  refreshed_at = NOW()
`);
}
