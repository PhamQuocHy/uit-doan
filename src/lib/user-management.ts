import { getUnitDescendants, hierarchyUnits } from "@/lib/data";
import { isQuanKhuOrBtl, getQuanKhuRoot, getProvincesForMilitaryRegion } from "@/lib/military-regions";

type Actor = { userId?: string; role: string; hierarchyLevel: string; unitCode: string; functionalRole?: string };
type Target = { id?: string; role?: string; hierarchyLevel: string; unitCode: string; functionalRole?: string };

export function canEditGlobalRoles(actor: Actor | null): boolean {
  return !!actor && actor.role === "admin" && actor.hierarchyLevel === "bo" && actor.unitCode === "bo";
}

export function canManageMembers(actor: Actor | null): boolean {
  if (!actor) return false;
  if (isQuanKhuOrBtl(actor.unitCode)) return actor.functionalRole !== "y_te";
  return actor.functionalRole !== "nhan_quan" && actor.functionalRole !== "y_te" && ["bo", "tinh"].includes(actor.hierarchyLevel);
}

export function canManageUser(actor: Actor, target: Target): boolean {
  return canManageTarget(actor, target);
}

function canManageTarget(actor: Actor, target: Target, administrativeScope?: Set<string>): boolean {
  if (!canManageMembers(actor) || actor.userId === target.id || actor.unitCode === target.unitCode) return false;
  if (target.role === "admin" || target.hierarchyLevel === "bo") return false;
  const actorRegion = isQuanKhuOrBtl(actor.unitCode);
  const targetRegion = isQuanKhuOrBtl(target.unitCode);
  // Receiving accounts belong exclusively to their military region command.
  if (!targetRegion && (target.hierarchyLevel === "donvi" || target.functionalRole === "nhan_quan")) {
    return actorRegion && getQuanKhuRoot(target.unitCode) === actor.unitCode;
  }
  if (actor.hierarchyLevel === "bo") return true;
  if (targetRegion) return false;
  if (actorRegion) {
    if (administrativeScope) return administrativeScope.has(target.unitCode);
    return getProvincesForMilitaryRegion(actor.unitCode).some(code =>
      getUnitDescendants(code).includes(target.unitCode));
  }
  return actor.hierarchyLevel === "tinh" && target.hierarchyLevel === "xa" &&
    (administrativeScope ? administrativeScope.has(target.unitCode) : getUnitDescendants(actor.unitCode).includes(target.unitCode));
}

export function manageableUnitCodes(actor: Actor): string[] {
  if (!canManageMembers(actor)) return [];
  const roots = isQuanKhuOrBtl(actor.unitCode)
    ? getProvincesForMilitaryRegion(actor.unitCode)
    : actor.hierarchyLevel === "tinh" ? [actor.unitCode] : [];
  const children = new Map<string, string[]>();
  for (const unit of hierarchyUnits) {
    if (!unit.parentCode) continue;
    const siblings = children.get(unit.parentCode) || [];
    siblings.push(unit.code);
    children.set(unit.parentCode, siblings);
  }
  const scope = new Set<string>();
  const queue = [...roots];
  for (let index = 0; index < queue.length; index++) {
    const code = queue[index];
    if (scope.has(code)) continue;
    scope.add(code);
    queue.push(...(children.get(code) || []));
  }
  return hierarchyUnits.filter(unit => canManageTarget(actor, { hierarchyLevel: unit.level, unitCode: unit.code }, scope)).map(unit => unit.code);
}

export function isAssignableRole(code: string): boolean {
  // Only established non-administrative roles can be delegated.
  return ["UNIT_OFFICER", "COMMUNE_OFFICER", "LOCAL_OFFICER", "RECEIVING_UNIT", "MEDICAL_OFFICER"].includes(code);
}
