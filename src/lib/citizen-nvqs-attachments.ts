/** Client-safe types & helpers for minh chứng NVQS (no Node fs). */

/** Mục đích lưu DB (underscore) */
export type NvqsAttachmentPurpose =
  | "giay_tam_hoan"
  | "giay_mien_goi"
  | "giay_kham_suc_khoe"
  /** legacy */
  | "khong_goi"
  | "tam_hoan";

/** Loại minh chứng người dùng chọn khi tải lên */
export type MinhChungLoai =
  | "giay_tam_hoan"
  | "giay_mien_goi"
  | "giay_kham_suc_khoe";

export const MINH_CHUNG_LOAI_OPTIONS: {
  value: MinhChungLoai;
  folder: string;
  label: string;
}[] = [
  {
    value: "giay_tam_hoan",
    folder: "giay-tam-hoan",
    label: "Giấy tạm hoãn",
  },
  {
    value: "giay_mien_goi",
    folder: "giay-mien-goi",
    label: "Giấy miễn gọi",
  },
  {
    value: "giay_kham_suc_khoe",
    folder: "giay-kham-suc-khoe",
    label: "Giấy khám sức khỏe",
  },
];

export function minhChungFolderSlug(purpose: string): string {
  const hit = MINH_CHUNG_LOAI_OPTIONS.find((o) => o.value === purpose);
  if (hit) return hit.folder;
  if (purpose === "tam_hoan") return "giay-tam-hoan";
  if (purpose === "khong_goi") return "giay-kham-suc-khoe";
  return "khac";
}

export function minhChungLabel(purpose: string): string {
  const hit = MINH_CHUNG_LOAI_OPTIONS.find((o) => o.value === purpose);
  if (hit) return hit.label;
  if (purpose === "tam_hoan") return "Giấy tạm hoãn";
  if (purpose === "khong_goi") return "Giấy khám sức khỏe";
  return purpose;
}

/** Các mã purpose hợp lệ khi đếm / lọc (gồm legacy) */
export function purposesEquivalentTo(
  loai: MinhChungLoai,
): NvqsAttachmentPurpose[] {
  if (loai === "giay_tam_hoan") return ["giay_tam_hoan", "tam_hoan"];
  if (loai === "giay_mien_goi") return ["giay_mien_goi"];
  return ["giay_kham_suc_khoe", "khong_goi"];
}

export function parseMinhChungLoai(raw: string | null): MinhChungLoai | null {
  if (
    raw === "giay_tam_hoan" ||
    raw === "giay_mien_goi" ||
    raw === "giay_kham_suc_khoe"
  ) {
    return raw;
  }
  if (raw === "tam_hoan") return "giay_tam_hoan";
  if (raw === "khong_goi") return "giay_kham_suc_khoe";
  return null;
}

export type CitizenNvqsAttachment = {
  id: string;
  citizenId: string;
  purpose: NvqsAttachmentPurpose;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string | null;
  createdAt: string;
  url: string;
};

export type MinhChungLocalityFolders = {
  tinh: string;
  xa: string;
  tinhCode: string;
  xaCode: string;
  tinhName: string;
  xaName: string;
};
