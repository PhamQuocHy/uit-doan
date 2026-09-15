import { test } from "node:test";
import assert from "node:assert/strict";
import type { HealthRecord } from "./data";
import { selectPrintExam } from "./print-exam-selection";
import { buildCitizenHealthPrintHtml } from "./citizen-health-print";
import type { Citizen } from "./data";
const first = { id: "first", citizenId: "a", year: 2026, phase: "Sơ tuyển cấp xã", createdAt: "2026-09-01" } as HealthRecord;
const second = { ...first, id: "second", phase: "Khám tuyển cấp tỉnh", detail: { facility: "Hospital test", bloodTest: "Blood result test", drugHivScreen: "Screen result test" } } as HealthRecord;
test("round two is offered only for the selected citizen and year", () => {
  for (const history of [[first], [first, { ...second, citizenId: "b" }], [first, { ...second, year: 2025 }]]) {
    const result = selectPrintExam(history, "a", 2026, 2);
    assert.equal(result.hasRoundTwo, false);
    assert.equal(result.round, 1);
    assert.equal(result.record?.id, "first");
  }
  assert.equal(selectPrintExam([first, second], "a", 2026, 2).record?.id, "second");
  assert.equal(selectPrintExam([first, second], "a", 2026, 1).record?.id, "first");
  assert.equal(selectPrintExam([second], "a", 2026, 1).record, undefined);
});
test("detailed appendix is included only when printing round two", () => {
  const citizen = { id: "a", fullName: "Test", dateOfBirth: "2005-01-01" } as Citizen;
  const screening = buildCitizenHealthPrintHtml(citizen, first);
  const detailed = buildCitizenHealthPrintHtml(citizen, second);
  assert.ok(!screening.includes('section class="round-two"'));
  for (const text of ["Hospital test", "Blood result test", "Screen result test", 'section class="round-two"']) assert.ok(detailed.includes(text));
});
