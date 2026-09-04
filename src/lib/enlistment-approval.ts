import type { Citizen } from "@/lib/data";

export type CallIntent = "unset" | "du_kien_goi" | "khong_goi";
export type ApprovalStatus = "none" | "pending" | "approved" | "rejected";

export const CALL_INTENT_LABELS: Record<CallIntent, string> = {
  unset: "Chưa xác định",
  du_kien_goi: "Dự kiến gọi",
  khong_goi: "Không gọi",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  none: "—",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Không đạt",
};

/** Nhãn hiển thị cột Dự kiến gọi trên danh sách hồ sơ */
export function getCallDisplayLabel(c: {
  callIntent?: CallIntent;
  approvalStatus?: ApprovalStatus;
  militaryStatus?: Citizen["militaryStatus"];
}): { label: string; color: string; bg: string } {
  if (c.militaryStatus === "tamhoan") {
    return { label: "Tạm hoãn", color: "var(--m3-primary, #1a73e8)", bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)" };
  }
  if (c.militaryStatus === "miengoi") {
    return { label: "Miễn gọi", color: "var(--m3-tertiary, #5a5f6e)", bg: "color-mix(in srgb, var(--m3-tertiary, #5a5f6e) 12%, transparent)" };
  }
  if (c.militaryStatus === "nhapngu" || c.approvalStatus === "approved") {
    return { label: "Đã duyệt gọi", color: "var(--color-m3-success)", bg: "var(--color-m3-success-container)" };
  }
  if (c.callIntent === "du_kien_goi" && c.approvalStatus === "pending") {
    return { label: "Dự kiến gọi", color: "var(--color-m3-warning)", bg: "var(--color-m3-warning-container)" };
  }
  if (c.callIntent === "khong_goi" || c.approvalStatus === "rejected") {
    return { label: "Không gọi", color: "var(--m3-error, #ba1a1a)", bg: "var(--m3-error-container, var(--m3-error-container, #ffdad6))" };
  }
  if (c.callIntent === "du_kien_goi") {
    return { label: "Dự kiến gọi", color: "var(--m3-primary, #1a73e8)", bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)" };
  }
  return { label: "Chưa xác định", color: "var(--m3-on-surface-variant, #475569)", bg: "var(--m3-surface-container-high, #eef1f4)" };
}

/** Khi cán bộ lưu dự kiến gọi từ hồ sơ công dân */
export function resolveCallIntentUpdate(
  callIntent: CallIntent,
  militaryStatus?: Citizen["militaryStatus"],
): {
  callIntent: CallIntent;
  approvalStatus: ApprovalStatus;
  militaryStatus?: Citizen["militaryStatus"];
} {
  if (militaryStatus === "tamhoan" || militaryStatus === "miengoi") {
    return {
      callIntent: "unset",
      approvalStatus: "none",
      militaryStatus,
    };
  }

  if (callIntent === "du_kien_goi") {
    return {
      callIntent: "du_kien_goi",
      approvalStatus: "pending",
      militaryStatus:
        militaryStatus === "nhapngu" ? "nhapngu" : ("trungtuyen" as const),
    };
  }

  if (callIntent === "khong_goi") {
    return {
      callIntent: "khong_goi",
      approvalStatus: "none",
      militaryStatus:
        militaryStatus === "nhapngu" ? "nhapngu" : ("truottuyen" as const),
    };
  }

  return {
    callIntent: "unset",
    approvalStatus: "none",
    militaryStatus: militaryStatus === "nhapngu" ? "nhapngu" : "chuakham",
  };
}

export function resolveApprovalAction(
  action: "approve" | "reject",
): {
  approvalStatus: ApprovalStatus;
  callIntent: CallIntent;
  militaryStatus: Citizen["militaryStatus"];
} {
  if (action === "approve") {
    return {
      approvalStatus: "approved",
      callIntent: "du_kien_goi",
      militaryStatus: "nhapngu",
    };
  }
  return {
    approvalStatus: "rejected",
    callIntent: "khong_goi",
    militaryStatus: "truottuyen",
  };
}

export type ApprovalRow = {
  id: string;
  fullName: string;
  cccd: string;
  dateOfBirth: string;
  unitName: string;
  healthResult: string;
  politicalResult: string;
  status: "pending" | "approved" | "rejected";
  callIntent: CallIntent;
  campaignId?: string;
};

export function toApprovalUiStatus(
  approvalStatus?: ApprovalStatus,
): ApprovalRow["status"] {
  if (approvalStatus === "approved") return "approved";
  if (approvalStatus === "rejected") return "rejected";
  return "pending";
}
