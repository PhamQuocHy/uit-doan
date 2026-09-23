import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { notifyHumanChecks, listHumanCheckNotifications, readHumanCheckNotifications } from "../src/lib/human-check-notifications";
import { getPool, queryExecute } from "../src/lib/db";

loadEnvConfig(process.cwd(), true);
async function main() {
  const userId = `hc-test-${randomUUID()}`;
  const recipient = { userId, unitCode: "test-unit" };
  const other = { userId: `${userId}-other`, unitCode: "test-unit" };
  const item = { citizenId: "synthetic-test", fullName: "Human Check test fixture", label: "Test only", confidence: 0.5, warnings: [], source: "rules+gemini" };
  try {
    await notifyHumanChecks(recipient, [item], "test", "/admin/citizens");
    await notifyHumanChecks(recipient, [item], "test", "/admin/citizens");
    let rows = await listHumanCheckNotifications(recipient);
    assert.equal(rows.length, 1, "duplicate requests must not flood notifications");
    assert.equal(rows[0].read, false);
    assert.match(rows[0].href, /^\/admin\/citizens\?search=/);
    assert.equal((await listHumanCheckNotifications(other)).length, 0);
    assert.equal((await listHumanCheckNotifications({ ...recipient, unitCode: "different-unit" })).length, 0);
    assert.equal(await readHumanCheckNotifications(other, rows[0].id), false);
    assert.equal(await readHumanCheckNotifications(recipient, rows[0].id), true);
    await notifyHumanChecks(recipient, [item], "test", "/admin/citizens");
    rows = await listHumanCheckNotifications(recipient);
    assert.equal(rows[0].read, true, "repeat result must preserve read status");
    await notifyHumanChecks(recipient, [{ ...item, warnings: ["New evidence needed"] }], "test", "/admin/citizens");
    rows = await listHumanCheckNotifications(recipient);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter(row => !row.read).length, 1);
    await readHumanCheckNotifications(recipient);
    assert.ok((await listHumanCheckNotifications(recipient)).every(row => row.read));
    await notifyHumanChecks(other, [{ ...item, confidence: 0.95 }], "test", "/admin/citizens");
    assert.equal((await listHumanCheckNotifications(other)).length, 0, "clear result must not generate an alert");
    console.log("PASS: persistence, deduplication, user/unit isolation, read state, changed result and clear result.");
  } finally {
    await queryExecute("DELETE FROM human_check_notifications WHERE user_id IN (?, ?)", [userId, other.userId]);
    await getPool().end();
  }
}
main().catch(error => { console.error("Human Check integration test failed:", error instanceof assert.AssertionError ? error.message : "database unavailable or schema missing"); process.exitCode = 1; });
