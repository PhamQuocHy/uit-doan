import type { FunctionalRole } from "@/lib/functional-roles";
import type { HierarchyLevel } from "@/lib/data";

export type LoginPortal =
  | "cap_bo"
  | "quan_khu"
  | "dia_phuong"
  | "don_vi_nhan_quan"
  | "can_bo_y_te";

export const LOGIN_PORTAL_OPTIONS: {
  value: LoginPortal;
  label: string;
  description: string;
}[] = [
  {
    value: "cap_bo",
    label: "Cấp bộ",
    description: "Bộ Quốc phòng — quản lý toàn quốc",
  },
  {
    value: "quan_khu",
    label: "Quân khu",
    description: "Quân khu / BTL — quản lý tỉnh thuộc địa bàn",
  },
  {
    value: "dia_phuong",
    label: "Địa phương",
    description: "Cấp Tỉnh/TP hoặc Phường/Xã",
  },
  {
    value: "don_vi_nhan_quan",
    label: "Đơn vị nhận quân",
    description: "Chọn QK/BTL rồi sư đoàn · trung đoàn · quân đoàn",
  },
  {
    value: "can_bo_y_te",
    label: "Cán bộ y tế",
    description: "Khám sức khỏe, đợt khám tuyển",
  },
];

export function portalNeedsUnitStep(portal: LoginPortal): boolean {
  return portal !== "cap_bo";
}

export function resolveLoginContext(input: {
  portal: LoginPortal;
  localLevel: "tinh" | "xa";
  tinhCode: string;
  xaCode: string;
  donviCode: string;
}): {
  hierarchyLevel: HierarchyLevel;
  functionalRole: FunctionalRole;
  unitCode: string;
} {
  const { portal, localLevel, tinhCode, xaCode, donviCode } = input;

  switch (portal) {
    case "cap_bo":
      return {
        hierarchyLevel: "bo",
        functionalRole: "tuyen_quan",
        unitCode: "bo",
      };
    case "quan_khu":
      return {
        hierarchyLevel: "donvi",
        functionalRole: "nhan_quan",
        unitCode: donviCode,
      };
    case "dia_phuong":
      if (localLevel === "xa") {
        return {
          hierarchyLevel: "xa",
          functionalRole: "tuyen_quan",
          unitCode: xaCode,
        };
      }
      return {
        hierarchyLevel: "tinh",
        functionalRole: "tuyen_quan",
        unitCode: tinhCode,
      };
    case "don_vi_nhan_quan":
      return {
        hierarchyLevel: "donvi",
        functionalRole: "nhan_quan",
        unitCode: donviCode,
      };
    case "can_bo_y_te":
      if (localLevel === "xa") {
        return {
          hierarchyLevel: "xa",
          functionalRole: "y_te",
          unitCode: xaCode,
        };
      }
      return {
        hierarchyLevel: "tinh",
        functionalRole: "y_te",
        unitCode: tinhCode,
      };
  }
}
