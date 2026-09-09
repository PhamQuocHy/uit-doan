import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hierarchyUnits, getUnitDescendants, db } from "@/lib/data";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import {
  ensureCitizenReceivingColumns,
  ensureCitizenApprovalCommentColumn,
  ensureCitizenCallIntentDuBi,
  ensureProposalPendingMigration,
} from "@/lib/citizens-db";
import {
  resolveApprovalAction,
  resolveProposalDecision,
  toApprovalUiStatus,
  detectApprovalKind,
  type ApprovalKind,
  type ApprovalRow,
  type CallIntent,
} from "@/lib/enlistment-approval";
import type { RowDataPacket } from "mysql2";
import { toDateOnlyString } from "@/lib/date-vn";
import {
  citizenScopeForQuanKhu,
  getProvincesForMilitaryRegion,
  isQuanKhuOrBtl,
  ensureMilitaryUnitsInMemory,
} from "@/lib/military-regions";
import { listCitizenNvqsAttachments } from "@/lib/citizen-nvqs-attachments-db";

ensureMilitaryUnitsInMemory();

function scopeWhere(
  level: string,
  unitCode: string,
  requestedUnit?: string,
): { sql: string; params: string[] } {
  if (level === "donvi" && isQuanKhuOrBtl(unitCode)) {
    if (!requestedUnit) return citizenScopeForQuanKhu(unitCode);
    const provinces = getProvincesForMilitaryRegion(unitCode);
    const provinceRoot = requestedUnit.includes("-")
      ? requestedUnit.split("-")[0]
      : requestedUnit;
    if (!provinces.includes(provinceRoot)) {
      return { sql: "1=0", params: [] };
    }
    return {
      sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
      params: [requestedUnit, requestedUnit],
    };
  }
  const selectedUnit = requestedUnit || unitCode;
  if (level === "bo" && !requestedUnit) {
    return { sql: "1=1", params: [] };
  }
  const allowed =
    level === "bo" || new Set(getUnitDescendants(unitCode)).has(selectedUnit);
  if (!allowed) return { sql: "1=0", params: [] };
  return {
    sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
    params: [selectedUnit, selectedUnit],
  };
}

function unitName(code: string | null): string {
  if (!code) return "—";
  return hierarchyUnits.find((u) => u.code === code)?.name || code;
}

function notifyRecipients(unitCode: string | null, sessionUnit: string) {
  const targetUnit = unitCode || sessionUnit;
  const recipients = new Set<string>([targetUnit]);
  const managed = hierarchyUnits.find((u) => u.code === targetUnit);
  if (
    managed?.parentCode &&
    managed.parentCode !== "bo" &&
    managed.level !== "tinh"
  ) {
    recipients.add(managed.parentCode);
  }
  return recipients;
}

type KindFilter = ApprovalKind | "all" | "";

function parseKind(raw: string | null): KindFilter {
  if (raw === "goi" || raw === "khong_goi" || raw === "tam_hoan" || raw === "all") {
    return raw;
  }
  return "";
}

function kindWhereSql(kind: KindFilter): string | null {
  if (!kind || kind === "all") return null;
  if (kind === "goi") {
    return `(c.call_intent = 'du_kien_goi' OR (c.approval_status = 'rejected' AND c.call_intent = 'khong_goi' AND c.military_status <> 'tamhoan'))`;
  }
  if (kind === "khong_goi") {
    return `(c.call_intent = 'de_xuat_khong_goi' OR (c.call_intent = 'khong_goi' AND c.approval_status = 'approved' AND c.military_status = 'truottuyen'))`;
  }
  return `(c.military_status = 'tamhoan')`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "";
  const campaignId = searchParams.get("campaignId") || "";
  const requestedUnit = searchParams.get("unitCode") || "";
  const search = (searchParams.get("search") || "").trim();
  const kind = parseKind(searchParams.get("kind"));

  const dbOk = await pingDb();
  if (!dbOk) {
    return NextResponse.json({
      data: [],
      counts: {
        pending: 0,
        approved: 0,
        rejected: 0,
        pendingGoi: 0,
        pendingKhongGoi: 0,
        pendingTamHoan: 0,
      },
    });
  }

  await ensureCitizenCallIntentDuBi();
  await ensureCitizenApprovalCommentColumn();
  await ensureProposalPendingMigration();
  await ensureCitizenReceivingColumns();

  const scope = scopeWhere(
    session.hierarchyLevel,
    session.unitCode,
    requestedUnit || undefined,
  );

  // Hồ sơ thuộc luồng xét duyệt QK
  const baseWhere: string[] = [
    scope.sql,
    `(
      (c.call_intent = 'du_kien_goi' AND c.approval_status IN ('pending','approved','rejected'))
      OR (c.call_intent = 'de_xuat_khong_goi' AND c.approval_status = 'pending')
      OR (c.call_intent = 'khong_goi' AND c.approval_status IN ('approved','rejected'))
      OR (c.military_status = 'tamhoan' AND c.approval_status IN ('pending','approved'))
    )`,
  ];
  const baseParams = [...scope.params];
  if (campaignId) {
    // Đề xuất/tạm hoãn cũ có thể chưa gắn đợt — vẫn hiện khi lọc theo campaign
    baseWhere.push("(c.campaign_id = ? OR c.campaign_id IS NULL)");
    baseParams.push(campaignId);
  }
  if (search) {
    baseWhere.push("(c.full_name LIKE ? OR c.cccd LIKE ?)");
    const s = `%${search}%`;
    baseParams.push(s, s);
  }

  const kindSql = kindWhereSql(kind);
  const listWhere = kindSql ? [...baseWhere, kindSql] : [...baseWhere];
  const listParams = [...baseParams];

  // Đếm theo loại pending
  const countKindRows = await queryRows<
    (RowDataPacket & {
      call_intent: string | null;
      military_status: string;
      approval_status: string;
      n: number;
    })[]
  >(
    `SELECT c.call_intent, c.military_status, c.approval_status, COUNT(*) AS n
     FROM citizens c
     WHERE ${baseWhere.join(" AND ")}
     GROUP BY c.call_intent, c.military_status, c.approval_status`,
    baseParams,
  );

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    pendingGoi: 0,
    pendingKhongGoi: 0,
    pendingTamHoan: 0,
  };

  for (const r of countKindRows) {
    const n = Number(r.n) || 0;
    if (r.military_status === "tamhoan" && r.approval_status === "pending") {
      counts.pendingTamHoan += n;
      counts.pending += n;
    } else if (r.call_intent === "de_xuat_khong_goi" && r.approval_status === "pending") {
      counts.pendingKhongGoi += n;
      counts.pending += n;
    } else if (r.call_intent === "du_kien_goi" && r.approval_status === "pending") {
      counts.pendingGoi += n;
      counts.pending += n;
    } else if (r.approval_status === "approved") {
      counts.approved += n;
    } else if (r.approval_status === "rejected") {
      counts.rejected += n;
    }
  }

  if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
    listWhere.push("c.approval_status = ?");
    listParams.push(statusFilter);
  }

  const rows = await queryRows<
    (RowDataPacket & {
      id: string;
      full_name: string;
      cccd: string;
      date_of_birth: string | Date;
      unit_code: string | null;
      health_grade: number | null;
      approval_status: string;
      campaign_id: string | null;
      military_status_reason: string | null;
      approval_comment: string | null;
      call_intent: string | null;
      military_status: string;
    })[]
  >(
    `SELECT c.id, c.full_name, c.cccd, c.date_of_birth, c.unit_code,
          c.health_grade, c.approval_status, c.campaign_id,
          c.military_status_reason, c.approval_comment, c.call_intent, c.military_status
     FROM citizens c
     WHERE ${listWhere.join(" AND ")}
     ORDER BY
       FIELD(c.approval_status, 'pending', 'approved', 'rejected', 'none'),
       c.updated_at DESC
     LIMIT 5000`,
    listParams,
  );

  const data: ApprovalRow[] = rows.map((r) => {
    const callIntent = (r.call_intent || "unset") as CallIntent;
    const militaryStatus = r.military_status as ApprovalRow["militaryStatus"];
    const approvalStatus = r.approval_status as
      | "none"
      | "pending"
      | "approved"
      | "rejected";
    const kindDetected = detectApprovalKind({
      callIntent,
      militaryStatus,
      approvalStatus,
    });
    return {
      id: r.id,
      fullName: r.full_name,
      cccd: r.cccd,
      dateOfBirth: toDateOnlyString(r.date_of_birth) || "",
      unitName: unitName(r.unit_code),
      unitCode: r.unit_code || undefined,
      healthResult: r.health_grade != null ? `Loại ${r.health_grade}` : "—",
      politicalResult: "Đạt",
      status: toApprovalUiStatus(approvalStatus),
      kind: kindDetected,
      callIntent,
      militaryStatus,
      campaignId: r.campaign_id || undefined,
      note: r.military_status_reason || undefined,
      approvalComment: r.approval_comment || undefined,
    };
  });

  const total =
    counts.pending + counts.approved + counts.rejected;

  return NextResponse.json({ data, counts, total });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !(
      (session.hierarchyLevel === "donvi" &&
        isQuanKhuOrBtl(session.unitCode)) ||
      session.hierarchyLevel === "bo"
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Chỉ Quân khu (hoặc Bộ) được xét duyệt danh sách. Tỉnh/xã hoàn thiện hồ sơ và đề xuất.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const action = body.action as "approve" | "reject";
  const campaignId = String(body.campaignId || "");
  const note = String(body.note || body.reason || "").trim();
  const filterUnit = String(body.unitCode || "").trim();
  const approveAll = body.approveAll === true;
  const kind = (body.kind || "goi") as ApprovalKind;
  const idsFromBody = Array.isArray(body.ids)
    ? body.ids.map((x: unknown) => String(x || "").trim()).filter(Boolean)
    : body.id
      ? [String(body.id)]
      : [];

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  }
  if (kind !== "goi" && kind !== "khong_goi" && kind !== "tam_hoan") {
    return NextResponse.json({ error: "Loại xét duyệt không hợp lệ" }, { status: 400 });
  }
  if (kind === "goi" && !campaignId) {
    return NextResponse.json(
      { error: "Vui lòng chọn đợt tuyển quân trước khi duyệt gọi" },
      { status: 400 },
    );
  }
  if (action === "reject" && !note) {
    return NextResponse.json(
      {
        error:
          kind === "goi"
            ? "Vui lòng nhập lý do không duyệt gọi"
            : "Vui lòng nhập nhận xét / lý do không đồng tình (yêu cầu bổ sung)",
      },
      { status: 400 },
    );
  }
  if (!approveAll && idsFromBody.length === 0) {
    return NextResponse.json({ error: "Thiếu danh sách hồ sơ" }, { status: 400 });
  }

  const dbOk = await pingDb();
  if (!dbOk) {
    return NextResponse.json({ error: "Database không khả dụng" }, { status: 503 });
  }

  await ensureCitizenCallIntentDuBi();
  await ensureCitizenApprovalCommentColumn();
  await ensureCitizenReceivingColumns();

  const scope = scopeWhere(
    session.hierarchyLevel,
    session.unitCode,
    filterUnit || undefined,
  );

  let pendingFilter = "";
  if (kind === "goi") {
    pendingFilter = `c.call_intent = 'du_kien_goi' AND c.approval_status = 'pending'`;
  } else if (kind === "khong_goi") {
    pendingFilter = `c.call_intent = 'de_xuat_khong_goi' AND c.approval_status = 'pending'`;
  } else {
    pendingFilter = `c.military_status = 'tamhoan' AND c.approval_status = 'pending'`;
  }

  let targetIds = idsFromBody;
  if (approveAll) {
    if (action !== "approve" || kind !== "goi") {
      return NextResponse.json(
        { error: "Duyệt tất cả chỉ áp dụng cho duyệt gọi nhập ngũ" },
        { status: 400 },
      );
    }
    const pending = await queryRows<(RowDataPacket & { id: string })[]>(
      `SELECT c.id FROM citizens c
       WHERE ${scope.sql}
         AND ${pendingFilter}
         AND c.campaign_id = ?
       ORDER BY c.updated_at DESC
       LIMIT 5000`,
      [...scope.params, campaignId],
    );
    targetIds = pending.map((r) => r.id);
  }

  if (targetIds.length === 0) {
    return NextResponse.json(
      { error: "Không có hồ sơ chờ duyệt phù hợp" },
      { status: 404 },
    );
  }

  const placeholders = targetIds.map(() => "?").join(",");
  const beforeRows = await queryRows<
    (RowDataPacket & {
      id: string;
      full_name: string;
      cccd: string;
      unit_code: string | null;
    })[]
  >(
    `SELECT c.id, c.full_name, c.cccd, c.unit_code FROM citizens c
     WHERE c.id IN (${placeholders})
       AND ${scope.sql}
       AND ${pendingFilter}`,
    [...targetIds, ...scope.params],
  );

  if (beforeRows.length === 0) {
    return NextResponse.json(
      { error: "Không tìm thấy hồ sơ chờ duyệt hoặc không có quyền" },
      { status: 404 },
    );
  }

  // Minh chứng bắt buộc khi đồng tình không gọi / tạm hoãn
  if (action === "approve" && (kind === "khong_goi" || kind === "tam_hoan")) {
    const purpose = kind === "khong_goi" ? "khong_goi" : "tam_hoan";
    for (const c of beforeRows) {
      const files = await listCitizenNvqsAttachments(c.id, purpose);
      if (files.length < 1) {
        return NextResponse.json(
          {
            error: `${c.full_name}: thiếu tệp minh chứng — yêu cầu địa phương bổ sung trước khi đồng tình`,
          },
          { status: 400 },
        );
      }
    }
  }

  const resolved =
    kind === "goi"
      ? resolveApprovalAction(action)
      : resolveProposalDecision(kind, action);

  const okIds = beforeRows.map((r) => r.id);
  const okPlaceholders = okIds.map(() => "?").join(",");

  const reasonForGoiReject =
    kind === "goi" && action === "reject" ? note : undefined;
  const approvalCommentValue =
    kind !== "goi" && action === "reject"
      ? note
      : kind !== "goi" && action === "approve"
        ? null
        : undefined;

  const setParts = [
    "approval_status = ?",
    "call_intent = ?",
    "military_status = ?",
    "military_status_locked = ?",
    "receiving_status = ?",
    "receiving_unit_code = ?",
    "updated_at = NOW()",
  ];
  const setParams: unknown[] = [
    resolved.approvalStatus,
    resolved.callIntent,
    resolved.militaryStatus,
    resolved.militaryStatusLocked ? 1 : 0,
    resolved.receivingStatus ?? null,
    null,
  ];

  if (kind === "goi" && campaignId) {
    setParts.push("campaign_id = ?");
    setParams.push(campaignId);
  }
  if (reasonForGoiReject !== undefined) {
    setParts.push("military_status_reason = ?");
    setParams.push(reasonForGoiReject);
  }
  if (approvalCommentValue !== undefined) {
    setParts.push("approval_comment = ?");
    setParams.push(approvalCommentValue);
  }

  const result = await queryExecute(
    `UPDATE citizens c SET ${setParts.join(", ")}
     WHERE c.id IN (${okPlaceholders})
       AND ${scope.sql}
       AND ${pendingFilter}`,
    [...setParams, ...okIds, ...scope.params],
  );

  const affected = Number(result.affectedRows || 0);

  if (kind === "goi") {
    if (action === "approve") {
      const byUnit = new Map<string, string[]>();
      for (const c of beforeRows) {
        for (const toUnit of notifyRecipients(c.unit_code, session.unitCode)) {
          const list = byUnit.get(toUnit) || [];
          list.push(c.full_name);
          byUnit.set(toUnit, list);
        }
      }
      for (const [toUnit, names] of byUnit) {
        const preview =
          names.length <= 3
            ? names.join(", ")
            : `${names.slice(0, 3).join(", ")} và ${names.length - 3} hồ sơ khác`;
        db.notifications.create({
          toUnit,
          type: "citizen_approved",
          title:
            names.length === 1
              ? "Thanh niên được duyệt gọi nhập ngũ"
              : `${names.length} thanh niên được duyệt gọi nhập ngũ`,
          message: `${preview} thuộc đơn vị quản lý đã được duyệt gọi nhập ngũ.`,
          relatedHref: "/admin/approval",
        });
      }
    } else {
      for (const c of beforeRows) {
        const locality = unitName(c.unit_code);
        for (const toUnit of notifyRecipients(c.unit_code, session.unitCode)) {
          db.notifications.create({
            toUnit,
            type: "citizen_rejected",
            title: "Không duyệt gọi nhập ngũ",
            message: `${c.full_name} (CCCD ${c.cccd}) tại ${locality}: ${note}`,
            relatedHref: "/admin/citizens",
          });
        }
      }
    }
  } else if (action === "approve") {
    for (const c of beforeRows) {
      for (const toUnit of notifyRecipients(c.unit_code, session.unitCode)) {
        db.notifications.create({
          toUnit,
          type: "citizen_approved",
          title:
            kind === "khong_goi"
              ? "Quân khu đồng tình đề xuất không gọi"
              : "Quân khu duyệt tạm hoãn",
          message: `${c.full_name} (CCCD ${c.cccd}) đã được Quân khu chấp thuận.`,
          relatedHref: "/admin/citizens",
        });
      }
    }
  } else {
    // Trả về — khóa + chưa xác định + thông báo tỉnh/xã
    for (const c of beforeRows) {
      const locality = unitName(c.unit_code);
      for (const toUnit of notifyRecipients(c.unit_code, session.unitCode)) {
        db.notifications.create({
          toUnit,
          type: "citizen_proposal_returned",
          title:
            kind === "khong_goi"
              ? "QK không đồng tình đề xuất không gọi — cần bổ sung"
              : "QK hủy tạm hoãn — cần kiểm tra lại",
          message: `${c.full_name} (CCCD ${c.cccd}) tại ${locality} đã chuyển về Chưa xác định và bị khóa. Nhận xét QK: ${note}. Vui lòng kiểm tra minh chứng / ghi chú rồi gửi duyệt lại.`,
          relatedHref: `/admin/citizens`,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    action,
    kind,
    processed: affected,
    message:
      action === "approve"
        ? kind === "goi"
          ? `Đã duyệt gọi ${affected} hồ sơ`
          : kind === "khong_goi"
            ? `Đã đồng tình không gọi ${affected} hồ sơ`
            : `Đã duyệt tạm hoãn ${affected} hồ sơ`
        : kind === "goi"
          ? `Đã đánh không gọi ${affected} hồ sơ`
          : `Đã trả về ${affected} hồ sơ — thông báo tỉnh/xã bổ sung`,
  });
}
