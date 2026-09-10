import type { Citizen } from "@/lib/data";

export type CallIntent =
  | "unset"
  | "du_kien_goi"
  | "khong_goi"
  | "du_bi"
  | "de_xuat_khong_goi";
export type ApprovalStatus = "none" | "pending" | "approved" | "rejected";
export type ApprovalKind = "goi" | "khong_goi" | "tam_hoan";

/** Luồng chuyển hồ sơ Xã → Tỉnh → Quân khu */
export type PipelineStatus =
  | "none"
  | "local_ready"
  | "province_pending"
  | "province_ok"
  | "province_returned"
  | "qk_pending";

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  none: "—",
  local_ready: "Chờ gửi tỉnh",
  province_pending: "Chờ tỉnh đồng tình",
  province_ok: "Tỉnh đã đồng tình",
  province_returned: "Tỉnh trả về",
  qk_pending: "Đã gửi Quân khu",
};

/** Đánh dấu hồ sơ QK không duyệt tạm hoãn (lưu military_status_reason). */
export const RETURN_TAM_HOAN_MARKER = "khong_duyet_tam_hoan";

export const CALL_INTENT_LABELS: Record<CallIntent, string> = {
  unset: "Hồ sơ mới",
  du_kien_goi: "Dự kiến gọi",
  khong_goi: "Không gọi",
  du_bi: "Dự bị",
  de_xuat_khong_goi: "Đề xuất không gọi",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  none: "—",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Không gọi",
};

/** Nhãn hiển thị cột Dự kiến gọi trên danh sách hồ sơ */
export function getCallDisplayLabel(c: {
  callIntent?: CallIntent;
  approvalStatus?: ApprovalStatus;
  militaryStatus?: Citizen["militaryStatus"];
  militaryStatusLocked?: boolean;
  approvalComment?: string | null;
  militaryStatusReason?: string | null;
  pipelineStatus?: Citizen["pipelineStatus"] | string | null;
}): { label: string; color: string; bg: string } {
  if (c.pipelineStatus === "province_returned") {
    return {
      label: "Tỉnh trả về",
      color: "var(--m3-error, #ba1a1a)",
      bg: "var(--m3-error-container, #ffdad6)",
    };
  }
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

  // QK trả về địa phương (chỉ có hiệu lực trong đợt gắn campaign_id)
  const returnedLocal =
    (c.approvalStatus === "none" || !c.approvalStatus) &&
    Boolean(c.militaryStatusLocked) &&
    Boolean(c.approvalComment?.trim());
  if (returnedLocal) {
    if (c.militaryStatusReason === RETURN_TAM_HOAN_MARKER) {
      return {
        label: "Không duyệt tạm hoãn",
        color: "var(--m3-error, #ba1a1a)",
        bg: "var(--m3-error-container, #ffdad6)",
      };
    }
    return {
      label: "Không duyệt không gọi",
      color: "var(--m3-error, #ba1a1a)",
      bg: "var(--m3-error-container, #ffdad6)",
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
  if (c.callIntent === "du_kien_goi") {
    return {
      label: "Dự kiến gọi",
      color: "var(--m3-primary, #1a73e8)",
      bg: "color-mix(in srgb, var(--m3-primary, #1a73e8) 12%, transparent)",
    };
  }
  // Không gọi đã chốt (QK duyệt đề xuất / không duyệt gọi) — khóa hồ sơ trong đợt
  if (c.callIntent === "khong_goi" || c.approvalStatus === "rejected") {
    return {
      label: "Không gọi (khóa)",
      color: "var(--m3-error, #ba1a1a)",
      bg: "var(--m3-error-container, #ffdad6)",
    };
  }
  return {
    label: "Hồ sơ mới",
    color: "var(--m3-on-surface-variant, #475569)",
    bg: "var(--m3-surface-container-high, #eef1f4)",
  };
}

/** SQL nhận diện hồ sơ QK trả về (không duyệt không gọi / tạm hoãn). */
export function returnedLocalSql(kind: "khong_goi" | "tam_hoan" | "any"): string {
  const base = `(
    IFNULL(c.approval_status,'none') = 'none'
    AND IFNULL(c.military_status_locked,0) = 1
    AND IFNULL(c.approval_comment,'') <> ''
    AND c.military_status NOT IN ('tamhoan','miengoi','nhapngu')
  )`;
  if (kind === "tam_hoan") {
    return `(${base} AND c.military_status_reason = '${RETURN_TAM_HOAN_MARKER}')`;
  }
  if (kind === "khong_goi") {
    return `(${base} AND IFNULL(c.military_status_reason,'') <> '${RETURN_TAM_HOAN_MARKER}')`;
  }
  return base;
}

export function matchesCallDisplayFilter(
  c: {
    callIntent?: CallIntent | null;
    approvalStatus?: ApprovalStatus | null;
    militaryStatus?: Citizen["militaryStatus"];
    militaryStatusLocked?: boolean;
    approvalComment?: string | null;
    militaryStatusReason?: string | null;
    pipelineStatus?: Citizen["pipelineStatus"] | string | null;
  },
  filter: string,
): boolean {
  if (!filter) return true;
  if (filter === "province_returned" || filter === "__tinh_tra_ve__") {
    return c.pipelineStatus === "province_returned";
  }
  if (c.pipelineStatus === "province_returned") {
    // Chỉ hiện ở tab Tỉnh trả về / Tất cả
    return false;
  }
  const label = getCallDisplayLabel({
    callIntent: (c.callIntent || "unset") as CallIntent,
    approvalStatus: (c.approvalStatus || "none") as ApprovalStatus,
    militaryStatus: c.militaryStatus,
    militaryStatusLocked: c.militaryStatusLocked,
    approvalComment: c.approvalComment,
    militaryStatusReason: c.militaryStatusReason,
    pipelineStatus: c.pipelineStatus,
  }).label;
  if (filter === "du_kien_goi") return label === "Dự kiến gọi";
  if (filter === "khong_goi") {
    return label === "Không gọi (khóa)" || label === "Không gọi";
  }
  if (filter === "khong_duyet_khong_goi") return label === "Không duyệt không gọi";
  if (filter === "khong_duyet_tam_hoan") return label === "Không duyệt tạm hoãn";
  if (filter === "de_xuat_khong_goi") return label === "Đề xuất không gọi";
  if (filter === "du_bi") return label === "Dự bị";
  if (filter === "unset") return label === "Hồ sơ mới";
  if (filter === "tamhoan" || filter === "__hoan__") {
    return label === "Tạm hoãn" || label === "Tạm hoãn (chờ duyệt)";
  }
  return true;
}

/** SQL WHERE khớp matchesCallDisplayFilter (alias bảng `c`). */
export function callDisplayFilterSql(filter: string): string | null {
  if (!filter) return null;
  if (filter === "province_returned" || filter === "__tinh_tra_ve__") {
    return `(IFNULL(c.pipeline_status,'none') = 'province_returned')`;
  }
  const notProvinceReturned = `IFNULL(c.pipeline_status,'none') <> 'province_returned'`;
  const notFinal =
    "c.military_status NOT IN ('tamhoan','miengoi','nhapngu') AND IFNULL(c.approval_status,'none') <> 'approved'";
  const notReturned = `NOT ${returnedLocalSql("any")}`;
  if (filter === "du_kien_goi") {
    return `(${notProvinceReturned} AND ${notFinal} AND c.call_intent = 'du_kien_goi' AND IFNULL(c.approval_status,'none') <> 'rejected')`;
  }
  if (filter === "khong_goi") {
    return `(
      ${notProvinceReturned}
      AND c.military_status NOT IN ('tamhoan','miengoi','nhapngu')
      AND ${notReturned}
      AND (
        c.call_intent = 'khong_goi'
        OR IFNULL(c.approval_status,'none') = 'rejected'
      )
    )`;
  }
  if (filter === "khong_duyet_khong_goi") {
    return `(${notProvinceReturned} AND ${returnedLocalSql("khong_goi")})`;
  }
  if (filter === "khong_duyet_tam_hoan") {
    return `(${notProvinceReturned} AND ${returnedLocalSql("tam_hoan")})`;
  }
  if (filter === "de_xuat_khong_goi") {
    return `(${notProvinceReturned} AND ${notFinal} AND c.call_intent = 'de_xuat_khong_goi')`;
  }
  if (filter === "du_bi") {
    return `(${notProvinceReturned} AND ${notFinal} AND c.call_intent = 'du_bi')`;
  }
  if (filter === "unset") {
    return `(${notProvinceReturned} AND ${notFinal} AND ${notReturned} AND IFNULL(c.call_intent,'unset') = 'unset' AND IFNULL(c.approval_status,'none') <> 'rejected')`;
  }
  if (filter === "tamhoan" || filter === "__hoan__") {
    return `(${notProvinceReturned} AND c.military_status = 'tamhoan')`;
  }
  return null;
}

/**
 * Đổi đợt khám tuyển → reset luồng xét duyệt (chỉ giữ nhập ngũ / miễn gọi).
 * Trạng thái không gọi / trả về chỉ có hiệu lực trong đợt cũ.
 */
export function resetNvqsForNewCampaign(existing: {
  militaryStatus?: Citizen["militaryStatus"];
}): Partial<Citizen> | null {
  if (
    existing.militaryStatus === "nhapngu" ||
    existing.militaryStatus === "miengoi"
  ) {
    return null;
  }
  return {
    callIntent: "unset",
    approvalStatus: "none",
    militaryStatus: "chuakham",
    militaryStatusLocked: false,
    approvalComment: null,
    militaryStatusReason: "",
    pipelineStatus: "none",
    provinceComment: null,
    receivingStatus: null,
    receivingUnitCode: null,
  };
}

/**
 * Cấp xã/tỉnh lưu NVQS:
 * - không gọi → đề xuất không gọi (chờ gửi tỉnh)
 * - tạm hoãn / dự kiến gọi → local_ready (chưa lên QK)
 */
export function resolveCallIntentUpdate(
  callIntent: CallIntent,
  militaryStatus?: Citizen["militaryStatus"],
): {
  callIntent: CallIntent;
  approvalStatus: ApprovalStatus;
  pipelineStatus: PipelineStatus;
  militaryStatus?: Citizen["militaryStatus"];
  clearApprovalComment?: boolean;
} {
  if (militaryStatus === "miengoi") {
    return {
      callIntent: "unset",
      approvalStatus: "none",
      pipelineStatus: "none",
      militaryStatus,
      clearApprovalComment: true,
    };
  }

  if (militaryStatus === "tamhoan") {
    return {
      callIntent: "unset",
      approvalStatus: "none",
      pipelineStatus: "local_ready",
      militaryStatus: "tamhoan",
      clearApprovalComment: true,
    };
  }

  if (callIntent === "du_kien_goi") {
    return {
      callIntent: "du_kien_goi",
      approvalStatus: "none",
      pipelineStatus: "local_ready",
      militaryStatus:
        militaryStatus === "nhapngu" ? "nhapngu" : ("trungtuyen" as const),
      clearApprovalComment: true,
    };
  }

  if (callIntent === "du_bi") {
    return {
      callIntent: "du_bi",
      approvalStatus: "none",
      pipelineStatus: "none",
      militaryStatus:
        militaryStatus === "nhapngu" ? "nhapngu" : ("trungtuyen" as const),
      clearApprovalComment: true,
    };
  }

  // Địa phương chỉ được đề xuất — chờ gửi tỉnh → QK mới chốt
  if (callIntent === "khong_goi" || callIntent === "de_xuat_khong_goi") {
    return {
      callIntent: "de_xuat_khong_goi",
      approvalStatus: "none",
      pipelineStatus: "local_ready",
      militaryStatus:
        militaryStatus === "nhapngu" ? "nhapngu" : ("trungtuyen" as const),
      clearApprovalComment: true,
    };
  }

  return {
    callIntent: "unset",
    approvalStatus: "none",
    pipelineStatus: "none",
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
  /** Đạt SK theo phân loại: Loại 1–3 Đạt, 4–6 Không đạt */
  politicalResult: string;
  status: "pending" | "approved" | "rejected" | "returned" | "returned_tam_hoan";
  kind: ApprovalKind;
  callIntent: CallIntent;
  militaryStatus?: Citizen["militaryStatus"];
  campaignId?: string;
  note?: string;
  approvalComment?: string;
  pipelineStatus?: PipelineStatus;
  provinceComment?: string;
};

/** Loại 1–3 đủ tiêu chuẩn SK; 4–6 không đạt. */
export function healthGradeFitnessLabel(
  grade: number | null | undefined,
): "Đạt" | "Không đạt" | "—" {
  if (grade == null || !Number.isFinite(grade)) return "—";
  if (grade >= 1 && grade <= 3) return "Đạt";
  if (grade >= 4 && grade <= 6) return "Không đạt";
  return "—";
}

export function toApprovalUiStatus(
  approvalStatus?: ApprovalStatus,
  opts?: {
    militaryStatusLocked?: boolean;
    approvalComment?: string | null;
    militaryStatusReason?: string | null;
  },
): "pending" | "approved" | "rejected" | "returned" | "returned_tam_hoan" {
  if (approvalStatus === "approved") return "approved";
  // QK không duyệt gọi → tab Không gọi
  if (approvalStatus === "rejected") return "rejected";
  // QK trả về địa phương (none + nhận xét + khóa)
  if (
    (approvalStatus === "none" || !approvalStatus) &&
    opts?.militaryStatusLocked &&
    Boolean(opts.approvalComment?.trim())
  ) {
    if (opts.militaryStatusReason === RETURN_TAM_HOAN_MARKER) {
      return "returned_tam_hoan";
    }
    return "returned";
  }
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
