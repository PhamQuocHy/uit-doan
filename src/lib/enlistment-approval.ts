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
    return { label: "Tạm hoãn", color: "#007aff", bg: "rgba(0,122,255,0.12)" };
  }
  if (c.militaryStatus === "miengoi") {
    return { label: "Miễn gọi", color: "#8944ab", bg: "rgba(175,82,222,0.12)" };
  }
  if (c.militaryStatus === "nhapngu" || c.approvalStatus === "approved") {
    return { label: "Đã duyệt gọi", color: "#059669", bg: "#d1fae5" };
  }
  if (c.callIntent === "du_kien_goi" && c.approvalStatus === "pending") {
    return { label: "Dự kiến gọi", color: "#d97706", bg: "#fef3c7" };
  }
  if (c.callIntent === "khong_goi" || c.approvalStatus === "rejected") {
    return { label: "Không gọi", color: "#dc2626", bg: "#fee2e2" };
  }
  if (c.callIntent === "du_kien_goi") {
    return { label: "Dự kiến gọi", color: "#007aff", bg: "rgba(0,122,255,0.12)" };
  }
  return { label: "Chưa xác định", color: "#636366", bg: "#f5f5f7" };
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
};

export function toApprovalUiStatus(
  approvalStatus?: ApprovalStatus,
): ApprovalRow["status"] {
  if (approvalStatus === "approved") return "approved";
  if (approvalStatus === "rejected") return "rejected";
  return "pending";
}
