/**
 * Bản đồ Quân khu / BTL Thủ đô ↔ tỉnh (sau sắp xếp 34 tỉnh, 1/7/2025)
 * + Quân đoàn chủ lực 12 / 34 (trực thuộc Bộ)
 * + Sư đoàn / trung đoàn nhận quân (nguồn công khai Wikipedia / QĐND, 2024–2025).
 *
 * Trung đoàn bộ binh: mỗi sư đoàn biên chế 03 trung đoàn — đặt tên TD 1/2/3
 * theo cơ cấu chuẩn (số hiệu trung đoàn nội bộ không công bố đầy đủ).
 */
import { hierarchyUnits, type HierarchyUnit } from "@/lib/data";

export type MilitaryKind =
  | "quankhu"
  | "quandoan"
  | "btl"
  | "sudoan"
  | "trungdoan"
  | "other";

export type MilitaryUnitDef = {
  code: string;
  name: string;
  kind: MilitaryKind;
  parentCode: string;
  /** Tỉnh trực thuộc — chỉ cấp quân khu / BTL */
  provinceCodes?: string[];
};

/** Quân khu / BTL + tỉnh thành trực thuộc (mã trong provinces.json) */
export const MILITARY_REGIONS: MilitaryUnitDef[] = [
  {
    code: "dv-qk1",
    name: "Quân khu 1",
    kind: "quankhu",
    parentCode: "bo",
    provinceCodes: ["4", "20", "24", "19"], // Cao Bằng, Lạng Sơn, Bắc Ninh, Thái Nguyên
  },
  {
    code: "dv-qk2",
    name: "Quân khu 2",
    kind: "quankhu",
    parentCode: "bo",
    provinceCodes: ["8", "15", "25", "14", "11", "12"], // Tuyên Quang, Lào Cai, Phú Thọ, Sơn La, Điện Biên, Lai Châu
  },
  {
    code: "dv-qk3",
    name: "Quân khu 3",
    kind: "quankhu",
    parentCode: "bo",
    provinceCodes: ["22", "31", "37", "33"], // Quảng Ninh, Hải Phòng, Ninh Bình, Hưng Yên
  },
  {
    code: "dv-qk4",
    name: "Quân khu 4",
    kind: "quankhu",
    parentCode: "bo",
    provinceCodes: ["38", "40", "42", "44", "46"], // Thanh Hóa, Nghệ An, Hà Tĩnh, Quảng Trị, Huế
  },
  {
    code: "dv-qk5",
    name: "Quân khu 5",
    kind: "quankhu",
    parentCode: "bo",
    provinceCodes: ["48", "51", "52", "66", "56"], // Đà Nẵng, Quảng Ngãi, Gia Lai, Đắk Lắk, Khánh Hòa
  },
  {
    code: "dv-qk7",
    name: "Quân khu 7",
    kind: "quankhu",
    parentCode: "bo",
    provinceCodes: ["79", "75", "80", "68"], // HCM, Đồng Nai, Tây Ninh, Lâm Đồng
  },
  {
    code: "dv-qk9",
    name: "Quân khu 9",
    kind: "quankhu",
    parentCode: "bo",
    // Đúng 5 tỉnh ĐBSCL sau sáp nhập 1/7/2025 (12 tỉnh cũ → 5).
    // Tây Ninh thuộc ĐBSCL địa lý nhưng sau sáp nhập gắn QK7 (Đông Nam Bộ).
    provinceCodes: ["92", "96", "91", "82", "86"], // Cần Thơ, Cà Mau, An Giang, Đồng Tháp, Vĩnh Long
  },
  {
    code: "dv-btl-hn",
    name: "Bộ Tư lệnh Thủ đô Hà Nội",
    kind: "btl",
    parentCode: "bo",
    provinceCodes: ["1"], // Hà Nội
  },
];

/** Quân đoàn chủ lực cơ động chiến lược — trực thuộc Bộ (không thuộc 1 quân khu) */
export const STRATEGIC_CORPS: MilitaryUnitDef[] = [
  {
    code: "dv-qd12",
    name: "Quân đoàn 12",
    kind: "quandoan",
    parentCode: "bo",
  },
  {
    code: "dv-qd34",
    name: "Quân đoàn 34",
    kind: "quandoan",
    parentCode: "bo",
  },
];

type DivisionSeed = { num: string; title?: string };

/** Sư đoàn bộ binh theo quân khu / BTL / quân đoàn (Wikipedia — danh sách sư đoàn QĐND) */
const DIVISIONS_BY_PARENT: Record<string, DivisionSeed[]> = {
  "dv-qk1": [
    { num: "3", title: "Sao Vàng" },
    { num: "346", title: "Tân Trào" },
    { num: "306" },
  ],
  "dv-qk2": [
    { num: "316", title: "Bông Lau" },
    { num: "355" },
    { num: "304", title: "Vinh Quang" },
  ],
  "dv-qk3": [{ num: "350" }, { num: "395" }],
  "dv-qk4": [{ num: "324" }, { num: "341" }, { num: "968" }],
  "dv-qk5": [{ num: "2" }, { num: "305" }, { num: "307" }, { num: "315" }],
  "dv-qk7": [{ num: "5" }, { num: "302" }, { num: "309" }, { num: "7" }],
  "dv-qk9": [{ num: "4" }, { num: "8" }, { num: "330" }],
  "dv-btl-hn": [{ num: "301" }],
  "dv-qd12": [{ num: "308" }, { num: "312" }, { num: "390" }, { num: "325" }],
  "dv-qd34": [{ num: "10" }, { num: "31" }, { num: "320" }, { num: "9" }],
};

function divisionName(d: DivisionSeed): string {
  return d.title
    ? `Sư đoàn Bộ binh ${d.num} (${d.title})`
    : `Sư đoàn Bộ binh ${d.num}`;
}

function divisionCode(parentCode: string, num: string): string {
  const prefix = parentCode.replace(/^dv-/, "");
  return `dv-${prefix}-sd${num}`;
}

function buildDivisionsAndRegiments(): MilitaryUnitDef[] {
  const out: MilitaryUnitDef[] = [];

  for (const [parent, list] of Object.entries(DIVISIONS_BY_PARENT)) {
    for (const d of list) {
      const sdCode = divisionCode(parent, d.num);
      out.push({
        code: sdCode,
        name: divisionName(d),
        kind: "sudoan",
        parentCode: parent,
      });
      // 03 trung đoàn bộ binh theo biên chế sư đoàn chuẩn
      for (let i = 1; i <= 3; i++) {
        out.push({
          code: `${sdCode}-td${i}`,
          name: `Trung đoàn Bộ binh ${i} — Sư đoàn ${d.num}`,
          kind: "trungdoan",
          parentCode: sdCode,
        });
      }
    }
  }

  // Trung đoàn độc lập công bố công khai (QK9)
  out.push({
    code: "dv-qk9-td152",
    name: "Trung đoàn Bộ binh 152",
    kind: "trungdoan",
    parentCode: "dv-qk9",
  });

  return out;
}

export const MILITARY_SUB_UNITS: MilitaryUnitDef[] = [
  ...STRATEGIC_CORPS,
  ...buildDivisionsAndRegiments(),
];

export const ALL_MILITARY_UNITS: MilitaryUnitDef[] = [
  ...MILITARY_REGIONS,
  ...MILITARY_SUB_UNITS,
];

const regionByProvince = new Map<string, string>();
for (const r of MILITARY_REGIONS) {
  for (const p of r.provinceCodes || []) {
    regionByProvince.set(p, r.code);
  }
}

const unitByCode = new Map(ALL_MILITARY_UNITS.map((u) => [u.code, u]));

export function getMilitaryRegionForProvince(provinceCode: string): string | null {
  return regionByProvince.get(provinceCode) || null;
}

export function getProvincesForMilitaryRegion(regionCode: string): string[] {
  return (
    MILITARY_REGIONS.find((r) => r.code === regionCode)?.provinceCodes || []
  );
}

export function getMilitaryUnit(unitCode: string): MilitaryUnitDef | undefined {
  return unitByCode.get(unitCode);
}

/** dv-qk9-sd330 → dv-qk9 ; dv-qd12-sd308 → null (không thuộc quân khu) */
export function getQuanKhuRoot(unitCode: string): string | null {
  if (!unitCode) return null;
  if (MILITARY_REGIONS.some((r) => r.code === unitCode)) return unitCode;
  let cur = unitByCode.get(unitCode);
  const guard = new Set<string>();
  while (cur) {
    if (guard.has(cur.code)) break;
    guard.add(cur.code);
    if (MILITARY_REGIONS.some((r) => r.code === cur!.parentCode)) {
      return cur.parentCode;
    }
    if (cur.parentCode === "bo") return null;
    cur = unitByCode.get(cur.parentCode);
  }
  return null;
}

export function isQuanKhuOrBtl(unitCode: string): boolean {
  return MILITARY_REGIONS.some((r) => r.code === unitCode);
}

/** Cha khi đăng nhập đơn vị nhận: Quân khu / BTL (+ quân đoàn chủ lực trực thuộc Bộ) */
export const RECEIVING_LOGIN_PARENTS: MilitaryUnitDef[] = [
  ...MILITARY_REGIONS,
  ...STRATEGIC_CORPS,
];

/** Đơn vị nhận quân (SĐ / TĐ / QĐ…) thuộc một quân khu, BTL hoặc quân đoàn */
export function getReceivingUnitsUnderParent(
  parentCode: string,
): MilitaryUnitDef[] {
  if (!parentCode) return [];
  const parent = unitByCode.get(parentCode);
  const out: MilitaryUnitDef[] = [];

  // Quân đoàn chủ lực cũng đăng nhập được như đơn vị nhận
  if (parent?.kind === "quandoan") {
    out.push(parent);
  }

  if (isQuanKhuOrBtl(parentCode)) {
    for (const u of ALL_MILITARY_UNITS) {
      if (u.code === parentCode) continue;
      if (isQuanKhuOrBtl(u.code)) continue;
      if (getQuanKhuRoot(u.code) === parentCode) out.push(u);
    }
    return out;
  }

  // Con cháu của quân đoàn / sư đoàn…
  const scope = new Set(receivingScopeUnitCodes(parentCode));
  for (const u of ALL_MILITARY_UNITS) {
    if (u.code === parentCode) continue;
    if (!scope.has(u.code)) continue;
    if (isQuanKhuOrBtl(u.code)) continue;
    out.push(u);
  }
  return out;
}

/** Sư đoàn / trung đoàn / quân đoàn — chỉ xem quân số đã phân & xác nhận nhận */
export function isReceivingOperationalUnit(unitCode: string): boolean {
  const u = unitByCode.get(unitCode);
  if (!u) return false;
  if (u.kind === "quankhu" || u.kind === "btl") return false;
  return (
    u.kind === "sudoan" ||
    u.kind === "trungdoan" ||
    u.kind === "quandoan" ||
    u.kind === "other"
  );
}

/** Mã đơn vị nhận thuộc phạm vi xem của 1 đơn vị (chính nó + cấp dưới) */
export function receivingScopeUnitCodes(unitCode: string): string[] {
  const codes = [unitCode];
  for (const u of ALL_MILITARY_UNITS) {
    let cur: MilitaryUnitDef | undefined = u;
    const guard = new Set<string>();
    while (cur) {
      if (guard.has(cur.code)) break;
      guard.add(cur.code);
      if (cur.parentCode === unitCode) {
        codes.push(u.code);
        break;
      }
      if (cur.parentCode === "bo" || isQuanKhuOrBtl(cur.parentCode)) break;
      cur = unitByCode.get(cur.parentCode);
    }
  }
  // Also include deeper descendants (td under sd under qd)
  const set = new Set(codes);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of ALL_MILITARY_UNITS) {
      if (!set.has(u.code) && set.has(u.parentCode)) {
        set.add(u.code);
        grew = true;
      }
    }
  }
  return [...set];
}

export function getAssignableReceivingUnits(quanKhuCode: string): MilitaryUnitDef[] {
  return ALL_MILITARY_UNITS.filter((u) => {
    if (u.code === quanKhuCode) return false;
    const root = getQuanKhuRoot(u.code);
    if (root !== quanKhuCode) return false;
    return (
      u.kind === "sudoan" ||
      u.kind === "trungdoan" ||
      u.kind === "quandoan" ||
      u.kind === "other"
    );
  });
}

/**
 * Chỉ tiêu tuyển quân (không phải nhận quân):
 * Bộ → Quân khu/BTL → tỉnh thuộc địa bàn → xã/phường.
 */
export function getRecruitmentQuotaChildUnits(
  parentCode: string,
): HierarchyUnit[] {
  ensureMilitaryUnitsInMemory();
  if (parentCode === "bo") {
    return MILITARY_REGIONS.map((r) => ({
      code: r.code,
      name: r.name,
      level: "donvi" as const,
      parentCode: "bo",
    }));
  }
  if (isQuanKhuOrBtl(parentCode)) {
    return getProvincesForMilitaryRegion(parentCode)
      .map((code) => {
        const u = hierarchyUnits.find((h) => h.code === code);
        return {
          code,
          name: u?.name || code,
          level: "tinh" as const,
          parentCode,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }
  return hierarchyUnits
    .filter((u) => u.parentCode === parentCode)
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** SQL scope: công dân thuộc tỉnh trong địa bàn quân khu */
export function citizenScopeForQuanKhu(quanKhuCode: string): {
  sql: string;
  params: string[];
} {
  const provinces = getProvincesForMilitaryRegion(quanKhuCode);
  if (provinces.length === 0) return { sql: "1=0", params: [] };
  const parts = provinces.map(
    () => "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
  );
  const params: string[] = [];
  for (const p of provinces) params.push(p, p);
  return { sql: `(${parts.join(" OR ")})`, params };
}

export function ensureMilitaryUnitsInMemory(): HierarchyUnit[] {
  const existing = new Set(hierarchyUnits.map((u) => u.code));
  const added: HierarchyUnit[] = [];
  for (const u of ALL_MILITARY_UNITS) {
    if (existing.has(u.code)) {
      const row = hierarchyUnits.find((h) => h.code === u.code);
      if (row) {
        row.name = u.name;
        row.parentCode = u.parentCode;
        row.level = "donvi";
      }
      continue;
    }
    const row: HierarchyUnit = {
      code: u.code,
      name: u.name,
      level: "donvi",
      parentCode: u.parentCode,
    };
    hierarchyUnits.push(row);
    added.push(row);
    existing.add(u.code);
  }
  // Remap legacy donvi-f330 under QK9 → sư đoàn 330
  const legacy = hierarchyUnits.find((h) => h.code === "donvi-f330");
  if (legacy) {
    legacy.parentCode = "dv-qk9";
    legacy.name = "Sư đoàn Bộ binh 330 (demo cũ)";
  }
  return added;
}

ensureMilitaryUnitsInMemory();
