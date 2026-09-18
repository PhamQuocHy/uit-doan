import test from "node:test";
import assert from "node:assert/strict";
import { assessHumanCheck, reviewSignals } from "./human-check";

const clear = { confidence: 0.9, warnings: [], source: "rules+gemini" };
test("Human Check: threshold is strictly below 0.8", () => {
  assert.equal(assessHumanCheck({ ...clear, confidence: 0.79 }).required, true);
  assert.equal(assessHumanCheck({ ...clear, confidence: 0.8 }).required, false);
});
test("Human Check: invalid scores and model uncertainty require review", () => {
  for (const confidence of [NaN, Infinity, -1, 2]) assert.equal(assessHumanCheck({ ...clear, confidence }).required, true);
  assert.equal(assessHumanCheck({ ...clear, needsHumanReview: true }).required, true);
});
test("Human Check: warnings override high confidence; rule fallback is explicit", () => {
  assert.equal(assessHumanCheck({ ...clear, warnings: ["Missing evidence"] }).required, true);
  assert.equal(assessHumanCheck({ ...clear, source: "rules" }, true).required, true);
  assert.equal(assessHumanCheck({ ...clear, source: "rules" }).required, false);
});
test("Human Check: Gemini cannot erase rule warnings or hide disagreement", () => {
  const review = reviewSignals({ warnings: ["Missing health record"], suggestion: "unset" },
    { warnings: [], confidence: 0.99, suggestion: "du_kien_goi", needsHumanReview: false });
  assert.ok(review.warnings.includes("Missing health record"));
  assert.equal(review.needsHumanReview, true);
});
test("Human Check: absent, string and invalid model confidence is not trusted", () => {
  for (const confidence of [undefined, null, "0.95", NaN, 1.1]) {
    assert.equal(reviewSignals({ warnings: [] }, { confidence }).needsHumanReview, true);
  }
  assert.equal(reviewSignals({ warnings: [] }, { confidence: 0.9 }).needsHumanReview, false);
});
test("Human Check: low model confidence remains flagged after later score adjustment", () => {
  const signals = reviewSignals({ warnings: [], suggestion: "du_kien_goi" }, { confidence: 0.5, suggestion: "du_kien_goi" });
  assert.equal(assessHumanCheck({ ...clear, ...signals, confidence: 0.9 }).required, true);
});
