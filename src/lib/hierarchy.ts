import {
  hierarchyUnits,
  getChildUnits,
  getUnitAncestors,
  getUnitDescendants,
  type HierarchyLevel,
  type HierarchyUnit,
} from "@/lib/data";

export const LEVEL_LABEL: Record<string, string> = {
  bo: "Bộ",
  tinh: "Tỉnh / Thành phố",
  huyen: "Huyện / Quận (cũ)",
  xa: "Xã / Phường",
  donvi: "Đơn vị nhận quân",
};

/** Cấp con trực tiếp — sau sáp nhập: Bộ → Tỉnh → Xã */
export const CHILD_LEVEL_LABEL: Record<string, string> = {
  bo: "Các tỉnh / thành phố",
  tinh: "Các xã / phường",
  huyen: "",
  xa: "",
  donvi: "",
};

export function getUnitByCode(code: string): HierarchyUnit | undefined {
  return hierarchyUnits.find((u) => u.code === code);
}

/** Đơn vị đang xem phải nằm trong phạm vi tài khoản đăng nhập */
export function resolveViewUnit(
  sessionUnitCode: string,
  sessionLevel: string,
  requestedUnit?: string | null
): HierarchyUnit {
  const sessionUnit =
    getUnitByCode(sessionUnitCode) ||
    ({
      code: sessionUnitCode,
      name: sessionUnitCode,
      level: (sessionLevel || "xa") as HierarchyLevel,
    } satisfies HierarchyUnit);

  if (!requestedUnit || requestedUnit === sessionUnitCode) {
    return sessionUnit;
  }

  if (sessionLevel === "bo") {
    return getUnitByCode(requestedUnit) || sessionUnit;
  }

  const allowed = new Set(getUnitDescendants(sessionUnitCode));
  if (allowed.has(requestedUnit)) {
    return getUnitByCode(requestedUnit) || sessionUnit;
  }

  return sessionUnit;
}

export function getBreadcrumb(unitCode: string): HierarchyUnit[] {
  const ancestors = getUnitAncestors(unitCode).reverse();
  return ancestors
    .map((code) => getUnitByCode(code))
    .filter(Boolean) as HierarchyUnit[];
}

export function listChildUnits(parentCode: string, limit = 24): {
  items: HierarchyUnit[];
  total: number;
} {
  const items = getChildUnits(parentCode);
  return { items: items.slice(0, limit), total: items.length };
}
