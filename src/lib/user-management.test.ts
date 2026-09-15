import { test } from "node:test";
import assert from "node:assert/strict";
import { canManageUser, canManageMembers, canEditGlobalRoles, manageableUnitCodes, isAssignableRole } from "./user-management";
import { MILITARY_REGIONS, getAssignableReceivingUnits, getProvincesForMilitaryRegion } from "./military-regions";
import { hierarchyUnits } from "./data";

const region = MILITARY_REGIONS.find(r => getAssignableReceivingUnits(r.code).length && getProvincesForMilitaryRegion(r.code).length)!;
const province = getProvincesForMilitaryRegion(region.code)[0];
const commune = hierarchyUnits.find(u => u.parentCode === province && u.level === "xa")!;
const receiving = getAssignableReceivingUnits(region.code)[0];
const officer = { userId: "actor", role: "user", hierarchyLevel: "donvi", unitCode: region.code, functionalRole: "tuyen_quan" };
const provincial = { ...officer, hierarchyLevel: "tinh", unitCode: province };
const local = { ...officer, hierarchyLevel: "xa", unitCode: commune.code };
const recipient = { hierarchyLevel: "donvi", unitCode: receiving.code, functionalRole: "nhan_quan" };

test("province can manage only subordinate communes", () => {
  assert.equal(canManageUser(provincial, local), true);
  for (const target of [provincial, officer, recipient, { ...local, role: "admin" }]) assert.equal(canManageUser(provincial, target), false);
  assert.equal(canManageUser({ ...provincial, role: "admin" }, officer), false);
});
test("communes and receiving units cannot manage peers or higher levels", () => {
  assert.equal(canManageMembers(local), false);
  assert.equal(canManageUser(local, local), false);
  assert.equal(canManageMembers({ ...officer, ...recipient }), false);
  assert.deepEqual(manageableUnitCodes(local), []);
});
test("only the owning military region manages receiving accounts", () => {
  assert.equal(canManageUser(officer, recipient), true);
  assert.equal(canManageUser({ ...officer, unitCode: MILITARY_REGIONS.find(r => r.code !== region.code)!.code }, recipient), false);
  assert.equal(canManageUser({ ...officer, hierarchyLevel: "bo", unitCode: "bo", role: "admin" }, recipient), false);
  assert.equal(canManageUser(officer, provincial), true);
  assert.equal(canManageUser(officer, officer), false);
});
test("self-management, shared-role edits and administrative grants are blocked", () => {
  assert.equal(canManageUser(provincial, { ...local, id: "actor" }), false);
  assert.equal(canEditGlobalRoles({ ...provincial, role: "admin" }), false);
  assert.equal(canEditGlobalRoles({ ...officer, hierarchyLevel: "bo", unitCode: "bo", role: "admin" }), true);
  assert.equal(isAssignableRole("SUPER_ADMIN"), false);
  assert.equal(isAssignableRole("CUSTOM_ROLE"), false);
  assert.equal(isAssignableRole("UNIT_OFFICER"), true);
});

test("bulk scope preserves individual authorization decisions", () => {
  const targets = [province, commune.code, receiving.code, region.code, "bo", MILITARY_REGIONS.find(r => r.code !== region.code)!.code];
  for (const actor of [officer, provincial, local, { ...officer, hierarchyLevel: "bo", unitCode: "bo", role: "admin" }]) {
    const scope = new Set(manageableUnitCodes(actor));
    for (const code of targets) {
      const unit = hierarchyUnits.find(u => u.code === code)!;
      assert.equal(scope.has(code), canManageUser(actor, { unitCode: code, hierarchyLevel: unit.level }), `${actor.unitCode} -> ${code}`);
    }
  }
});

test("scope remains responsive with 10000 additional communes", () => {
  const originalLength = hierarchyUnits.length;
  try {
    for (let index = 0; index < 10000; index++) {
      hierarchyUnits.push({ code: `performance-${index}`, name: "Performance fixture", level: "xa", parentCode: province });
    }
    const start = performance.now();
    const scope = new Set(manageableUnitCodes(provincial));
    assert.equal(scope.has("performance-9999"), true);
    assert.equal(scope.has(region.code), false);
    const elapsed = performance.now() - start;
    console.log(`Scope over ${hierarchyUnits.length} units: ${elapsed.toFixed(1)} ms`);
    assert.ok(elapsed < 1000, `Scope computation blocked for ${elapsed} ms`);
  } finally {
    hierarchyUnits.splice(originalLength);
  }
});
