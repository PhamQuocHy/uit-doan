export type FunctionalRole = "tuyen_quan" | "nhan_quan" | "y_te";

export const FUNCTIONAL_ROLE_OPTIONS: {
  value: FunctionalRole;
  label: string;
  description: string;
}[] = [
  {
    value: "tuyen_quan",
    label: "Tuyển quân",
    description: "Khám tuyển, giao chỉ tiêu, xét duyệt danh sách",
  },
  {
    value: "nhan_quan",
    label: "Nhận quân",
    description: "Đơn vị tiếp nhận quân nhân nhập ngũ",
  },
  {
    value: "y_te",
    label: "Cán bộ y tế",
    description: "Nhập khám sức khỏe, theo dõi đợt khám tuyển",
  },
];

export const FUNCTIONAL_ROLE_LABELS: Record<FunctionalRole, string> = {
  tuyen_quan: "Tuyển quân",
  nhan_quan: "Nhận quân",
  y_te: "Cán bộ y tế",
};

/** Gợi ý quyền theo cấp đơn vị đăng nhập */
export function suggestedFunctionalRoles(
  hierarchyLevel: string,
): FunctionalRole[] {
  if (hierarchyLevel === "donvi") return ["nhan_quan"];
  return ["tuyen_quan", "y_te"];
}
