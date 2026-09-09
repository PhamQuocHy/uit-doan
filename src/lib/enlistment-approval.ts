import type { Citizen } from "@/lib/data";

export type CallIntent =
  | "unset"
  | "du_kien_goi"
  | "khong_goi"
  | "du_bi"
  | "de_xuat_khong_goi";
export type ApprovalStatus = "none" | "pending" | "approved" | "rejected";
export type ApprovalKind = "goi" | "khong_goi" | "tam_hoan";

export const CALL_INTENT_LABELS: Record<CallIntent, string> = {
  unset: "Chưa xác định",
  du_kien_goi: "Dự kiến gọi",
  khong_goi: "Không gọi",
  du_bi: "Dự bị",
  de_xuat_khong_goi: "Đề xuất không gọi",
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
    if (c.approvalStatus === "pending") {
      return {
        label: "Tạm hoãn (chờ duyệt)",
        color: "var(--m3-primary, #1a73e8)",
        bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)",
      };
    }
    return {
      label: "Tạm hoãn",
      color: "var(--m3-primary, #1a73e8)",
      bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)",
    };
  }
  if (c.militaryStatus === "miengoi") {
    return {
      label: "Miễn gọi",
      color: "var(--m3-tertiary, #5a5f6e)",
      bg: "color-mix(in srgb, var(--m3-tertiary, #5a5f6e) 12%, transparent)",
    };
  }
  if (c.militaryStatus === "nhapngu" || (c.approvalStatus === "approved" && c.callIntent === "du_kien_goi")) {
    return {
      label: "Đã duyệt gọi",
      color: "var(--color-m3-success)",
      bg: "var(--color-m3-success-container)",
    };
  }
  if (c.callIntent === "du_bi") {
    return {
      label: "Dự bị",
      color: "var(--m3-tertiary, #5a5f6e)",
      bg: "color-mix(in srgb, var(--m3-tertiary, #5a5f6e) 14%, transparent)",
    };
  }
  if (c.callIntent === "de_xuat_khong_goi") {
    return {
      label: "Đề xuất không gọi",
      color: "var(--m3-error, #ba1a1a)",
      bg: "var(--m3-error-container, #ffdad6)",
    };
  }
  if (c.callIntent === "du_kien_goi" && c.approvalStatus === "pending") {
    return {
      label: "Dự kiến gọi",
      color: "var(--color-m3-warning)",
      bg: "var(--color-m3-warning-container)",
    };
  }
  if (c.callIntent === "khong_goi" || c.approvalStatus === "rejected") {
    return {
      label: "Không gọi",
      color: "var(--m3-error, #ba1a1a)",
      bg: "var(--m3-error-container, #ffdad6)",
    };
  }
  if (c.callIntent === "du_kien_goi") {
    return {
      label: "Dự kiến gọi",
      color: "var(--m3-primary, #1a73e8)",
      bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)",
    };
  }
  return {
    label: "Chưa xác định",
    color: "var(--m3-on-surface-variant, #475569)",
    bg: "var(--m3-surface-container-high, #eef1f4)",
  };
}

export function matchesCallDisplayFilter(
  c: {
    callIntent?: CallIntent | null;
    approvalStatus?: ApprovalStatus | null;
    militaryStatus?: Citizen["militaryStatus"];
  },
  filter: string,
): boolean {
  if (!filter) return true;
  const label = getCallDisplayLabel({
    callIntent: (c.callIntent || "unset") as CallIntent,
    approvalStatus: (c.approvalStatus || "none") as ApprovalStatus,
    militaryStatus: c.militaryStatus,
  }).label;
  if (filter === "du_kien_goi") return label === "Dự kiến gọi";
  if (filter === "khong_goi") {
    return label === "Không gọi";
  }
  if (filter === "de_xuat_khong_goi") return label === "Đề xuất không gọi";
  if (filter === "du_bi") return label === "Dự bị";
  if (filter === "unset") return label === "Chưa xác định";
  if (filter === "tamhoan" || filter === "__hoan__") {
    return label === "Tạm hoãn" || label === "Tạm hoãn (chờ duyệt)";
  }
  return true;
}

/** SQL WHERE khớp matchesCallDisplayFilter (alias bảng `c`). */
export function callDisplayFilterSql(filter: string): string | null {
  if (!filter) return null;
  const notFinal =
    "c.military_status NOT IN ('tamhoan','miengoi','nhapngu') AND IFNULL(c.approval_status,'none') <> 'approved'";
  if (filter === "du_kien_goi") {
    return `(${notFinal} AND c.call_intent = 'du_kien_goi' AND IFNULL(c.approval_status,'none') <> 'rejected')`;
  }
  if (filter === "khong_goi") {
    return `(
      c.military_status NOT IN ('tamhoan','miengoi','nhapngu') AND (
        c.call_intent = 'khong_goi'
        OR IFNULL(c.approval_status,'none') = 'rejected'
      )
    )`;
  }
  if (filter === "de_xuat_khong_goi") {
    return `(${notFinal} AND c.call_intent = 'de_xuat_khong_goi')`;
  }
  if (filter === "du_bi") {
    return `(${notFinal} AND c.call_intent = 'du_bi')`;
  }
  if (filter === "unset") {
    return `(${notFinal} AND IFNULL(c.call_intent,'unset') = 'unset' AND IFNULL(c.approval_status,'none') <> 'rejected')`;
  }
  if (filter === "tamhoan" || filter === "__hoan__") {
    return `(c.military_status = 'tamhoan')`;
  }
  return null;
}

/**
 * Cấp xã/tỉnh lưu NVQS:
 * - không gọi → đề xuất không gọi (chờ QK)
 * - tạm hoãn → chờ QK duyệt
 */
export function resolveCallIntentUpdate(
  callIntent: CallIntent,
  militaryStatus?: Citizen["militaryStatus"],
): {
  callIntent: CallIntent;
  approvalStatus: ApprovalStatus;
  militaryStatus?: Citizen["militaryStatus"];
  clearApprovalComment?: boolean;
} {
  if (militaryStatus === "miengoi") {
    return {
      callIntent: "unset",
      approvalStatus: "none",
      militaryStatus,
      clearApprovalComment: true,
    };
  }

  if (militaryStatus === "tamhoan") {
    return {
      callIntent: "unset",
      approvalStatus: "pending",
      militaryStatus: "tamhoan",
      clearApprovalComment: true,
    };
  }

  if (callIntent === "du_kien_goi") {
    return {
      callIntent: "du_kien_goi",
      approvalStatus: "pending",
      militaryStatus:
        militaryStatus === "nhapngu" ? "nhapngu" : ("trungtuyen" as const),
      clearApprovalComment: true,
    };
  }

  if (callIntent === "du_bi") {
    return {
      callIntent: "du_bi",
      approvalStatus: "none",
      militaryStatus:
        militaryStatus === "nhapngu" ? "nhapngu" : ("trungtuyen" as const),
      clearApprovalComment: true,
    };
  }

  // Địa phương chỉ được đề xuất — QK mới chốt "Không gọi"
  if (callIntent === "khong_goi" || callIntent === "de_xuat_khong_goi") {
    return {
      callIntent: "de_xuat_khong_goi",
      approvalStatus: "pending",
      militaryStatus:
        militaryStatus === "nhapngu" ? "nhapngu" : ("trungtuyen" as const),
      clearApprovalComment: true,
    };
  }

  return {
    callIntent: "unset",
    approvalStatus: "none",
    militaryStatus: militaryStatus === "nhapngu" ? "nhapngu" : "chuakham",
  };
}

/** Duyệt dự kiến gọi nhập ngũ (tab chờ duyệt gọi). */
export function resolveApprovalAction(
  action: "approve" | "reject",
): {
  approvalStatus: ApprovalStatus;
  callIntent: CallIntent;
  militaryStatus: Citizen["militaryStatus"];
  militaryStatusLocked: boolean;
  receivingStatus?: Citizen["receivingStatus"];
} {
  if (action === "approve") {
    return {
      approvalStatus: "approved",
      callIntent: "du_kien_goi",
      militaryStatus: "nhapngu",
      militaryStatusLocked: true,
      receivingStatus: "chua_phan_quan",
    };
  }
  // QK không duyệt gọi → chốt không gọi
  return {
    approvalStatus: "rejected",
    callIntent: "khong_goi",
    militaryStatus: "truottuyen",
    militaryStatusLocked: true,
    receivingStatus: null,
  };
}

/** Duyệt đề xuất không gọi / tạm hoãn. */
export function resolveProposalDecision(
  kind: "khong_goi" | "tam_hoan",
  action: "approve" | "reject",
): {
  approvalStatus: ApprovalStatus;
  callIntent: CallIntent;
  militaryStatus: Citizen["militaryStatus"];
  militaryStatusLocked: boolean;
  receivingStatus?: Citizen["receivingStatus"] | null;
} {
  if (kind === "khong_goi") {
    if (action === "approve") {
      return {
        approvalStatus: "approved",
        callIntent: "khong_goi",
        militaryStatus: "truottuyen",
        militaryStatusLocked: true,
        receivingStatus: null,
      };
    }
    return {
      approvalStatus: "none",
      callIntent: "unset",
      militaryStatus: "chuakham",
      militaryStatusLocked: true,
      receivingStatus: null,
    };
  }

  // tam_hoan
  if (action === "approve") {
    return {
      approvalStatus: "approved",
      callIntent: "unset",
      militaryStatus: "tamhoan",
      militaryStatusLocked: true,
      receivingStatus: null,
    };
  }
  return {
    approvalStatus: "none",
    callIntent: "unset",
    militaryStatus: "chuakham",
    militaryStatusLocked: true,
    receivingStatus: null,
  };
}

export type ApprovalRow = {
  id: string;
  fullName: string;
  cccd: string;
  dateOfBirth: string;
  unitName: string;
  unitCode?: string;
  healthResult: string;
  politicalResult: string;
  status: "pending" | "approved" | "rejected" | "returned";
  kind: ApprovalKind;
  callIntent: CallIntent;
  militaryStatus?: Citizen["militaryStatus"];
  campaignId?: string;
  note?: string;
  approvalComment?: string;
};

export function toApprovalUiStatus(
  approvalStatus?: ApprovalStatus,
): "pending" | "approved" | "rejected" {
  if (approvalStatus === "approved") return "approved";
  if (approvalStatus === "rejected") return "rejected";
  return "pending";
}

export function detectApprovalKind(c: {
  callIntent?: CallIntent | null;
  militaryStatus?: Citizen["militaryStatus"] | null;
  approvalStatus?: ApprovalStatus | null;
}): ApprovalKind {
  if (c.militaryStatus === "tamhoan") return "tam_hoan";
  if (c.callIntent === "de_xuat_khong_goi") return "khong_goi";
  if (c.callIntent === "khong_goi" && c.approvalStatus === "approved") {
    return "khong_goi";
  }
  return "goi";
}
