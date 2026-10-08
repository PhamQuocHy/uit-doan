import assert from "node:assert/strict";
import { test, mock, after } from "node:test";
import { detectCitizenQueryIntent, resolveCitizenLocality, buildDirectCitizenStatsReply } from "./chat-context";
import { getPool } from "@/lib/db";

const national = { hierarchyLevel: "bo", unitCode: "bo", name: "Test" };
after(async () => { await getPool().end(); });

test("recognizes total counts and Vietnamese status filters", () => {
  assert.deepEqual(detectCitizenQueryIntent("Xã Phú Lộc thành phố Cần Thơ có bao nhiêu hồ sơ?")?.statuses, []);
  assert.deepEqual(detectCitizenQueryIntent("Phu Loc Can Tho co bao nhieu nguoi tam hoan?")?.statuses, ["tamhoan"]);
  assert.equal(detectCitizenQueryIntent("Luật quy định độ tuổi nghĩa vụ quân sự thế nào?"), null);
});

test("resolves Phu Loc to a commune rather than all Can Tho", () => {
  const result = resolveCitizenLocality(national, "xã phú lộc thành phố cần thơ có bao nhiêu hồ sơ");
  assert.equal(result.error, undefined);
  assert.equal(result.targets.length, 1);
  assert.match(result.targets[0].code, /^92-/);
  assert.match(result.targets[0].name, /Phú Lộc/);
  assert.deepEqual(resolveCitizenLocality(national, "Phu Loc Can Tho co bao nhieu ho so").targets, result.targets);
});

test("unknown, ambiguous and unauthorized communes never become province totals", () => {
  assert.ok(resolveCitizenLocality(national, "xã Không Tồn Tại thành phố Cần Thơ").error);
  assert.ok(resolveCitizenLocality(national, "xã Tân Phú").error);
  assert.ok(resolveCitizenLocality({ ...national, hierarchyLevel: "tinh", unitCode: "1" }, "xã Phú Lộc Cần Thơ").error);
});

test("SQL counts use both session and commune filters, with optional status", async () => {
  const target = resolveCitizenLocality(national, "xã Phú Lộc Cần Thơ").targets[0];
  const calls: { sql: string; params: string[] }[] = [];
  const execute = mock.method(getPool(), "execute", async (sql: string, params: string[]) => {
    calls.push({ sql, params });
    return [[{ unit_code: target.code, military_status: "tamhoan", cnt: 7 }], []];
  });
  try {
    const scope = { ...national, hierarchyLevel: "tinh", unitCode: "92" };
    const total = await buildDirectCitizenStatsReply(scope, "xã Phú Lộc Cần Thơ có bao nhiêu hồ sơ?");
    assert.match(total!, /Tổng: 7 hồ sơ/);
    assert.match(total!, /Phú Lộc/);
    assert.deepEqual(calls[0].params, ["92", "92", target.code, target.code]);
    assert.doesNotMatch(calls[0].sql, /military_status IN/);
    await buildDirectCitizenStatsReply(scope, "xã Phú Lộc Cần Thơ có bao nhiêu hồ sơ tạm hoãn?");
    assert.deepEqual(calls[1].params, ["92", "92", target.code, target.code, "tamhoan"]);
    assert.match(calls[1].sql, /military_status IN/);
  } finally { execute.mock.restore(); }
});

test("DB failure is reported instead of returning demo counts", async () => {
  const execute = mock.method(getPool(), "execute", async () => { throw new Error("offline"); });
  const log = mock.method(console, "error", () => {});
  try {
    const reply = await buildDirectCitizenStatsReply(national, "xã Phú Lộc Cần Thơ có bao nhiêu hồ sơ?");
    assert.match(reply!, /chưa truy vấn được/);
    assert.doesNotMatch(reply!, /Tổng:/);
  } finally { execute.mock.restore(); log.mock.restore(); }
});
