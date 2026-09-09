import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hierarchyUnits, getUnitDescendants, db } from "@/lib/data";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import {
  ensureCitizenReceivingColumns,
  ensureCitizenApprovalCommentColumn,
  ensureCitizenCallIntentDuBi,
  ensureProposalPendingMigration,
  ensureCitizenPipelineColumns,
} from "@/lib/citizens-db";
import {
  resolveApprovalAction,
  resolveProposalDecision,
  toApprovalUiStatus,
  detectApprovalKind,
  healthGradeFitnessLabel,
  RETURN_TAM_HOAN_MARKER,
  type ApprovalKind,
  type ApprovalRow,
  type CallIntent,
  type PipelineStatus,
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
  if (level === "xa") {
    return { sql: "c.unit_code = ?", params: [unitCode] };
  }
  if (level === "tinh") {
    const selectedUnit = requestedUnit || unitCode;
    return {
      sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
      params: [selectedUnit, selectedUnit],
    };
  }
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

/** Lọc loại hồ sơ ở bước xã/tỉnh (chưa có quyết định QK). */
function localKindWhereSql(kind: KindFilter): string | null {
  if (!kind || kind === "all") return null;
  if (kind === "goi") return `(c.call_intent = 'du_kien_goi')`;
  if (kind === "khong_goi") return `(c.call_intent = 'de_xuat_khong_goi')`;
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
  const pipelineFilter = (searchParams.get("pipeline") || "").trim();

  const dbOk = await pingDb();
  if (!dbOk) {
    return NextResponse.json({
      data: [],
      counts: {
        pending: 0,
        approved: 0,
        rejected: 0,
        khongDongY: 0,
        khongDuyetTamHoan: 0,
        khongGoi: 0,
        pendingGoi: 0,
        pendingKhongGoi: 0,
        pendingTamHoan: 0,
        localReady: 0,
        provincePending: 0,
        provinceOk: 0,
        provinceReturned: 0,
        qkPending: 0,
      },
      role: session.hierarchyLevel,
    });
  }

  await ensureCitizenCallIntentDuBi();
  await ensureCitizenApprovalCommentColumn();
  await ensureCitizenPipelineColumns();
  await ensureProposalPendingMigration();
  await ensureCitizenReceivingColumns();

  const scope = scopeWhere(
    session.hierarchyLevel,
    session.unitCode,
    requestedUnit || undefined,
  );

  const isLocalPipeline =
    session.hierarchyLevel === "xa" || session.hierarchyLevel === "tinh";

  const baseWhere: string[] = [scope.sql];
  if (isLocalPipeline) {
    baseWhere.push(
      `IFNULL(c.pipeline_status,'none') IN ('local_ready','province_pending','province_ok','province_returned','qk_pending')`,
    );
  } else {
    // QK/Bộ: chỉ hồ sơ đã gửi QK
    baseWhere.push(`IFNULL(c.pipeline_status,'none') = 'qk_pending'`);
    baseWhere.push(`(
      (c.call_intent = 'du_kien_goi' AND c.approval_status IN ('pending','approved','rejected'))
      OR (c.call_intent = 'de_xuat_khong_goi' AND c.approval_status = 'pending')
      OR (c.call_intent = 'khong_goi' AND c.approval_status IN ('approved','rejected'))
      OR (c.military_status = 'tamhoan' AND c.approval_status IN ('pending','approved'))
      OR (
        IFNULL(c.approval_status,'none') = 'none'
        AND IFNULL(c.military_status_locked,0) = 1
        AND IFNULL(c.approval_comment,'') <> ''
      )
    )`);
  }
  const baseParams = [...scope.params];
  if (campaignId) {
    baseWhere.push("c.campaign_id = ?");
    baseParams.push(campaignId);
  }
  if (search) {
    baseWhere.push("(c.full_name LIKE ? OR c.cccd LIKE ?)");
    const s = `%${search}%`;
    baseParams.push(s, s);
  }

  const kindSql = isLocalPipeline
    ? localKindWhereSql(kind)
    : kindWhereSql(kind);
  const listWhere = kindSql ? [...baseWhere, kindSql] : [...baseWhere];
  const listParams = [...baseParams];

  if (
    isLocalPipeline &&
    pipelineFilter &&
    [
      "local_ready",
      "province_pending",
      "province_ok",
      "province_returned",
      "qk_pending",
    ].includes(pipelineFilter)
  ) {
    listWhere.push("c.pipeline_status = ?");
    listParams.push(pipelineFilter);
  }

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    khongDongY: 0,
    khongDuyetTamHoan: 0,
    khongGoi: 0,
    pendingGoi: 0,
    pendingKhongGoi: 0,
    pendingTamHoan: 0,
    localReady: 0,
    provincePending: 0,
    provinceOk: 0,
    provinceReturned: 0,
    qkPending: 0,
  };

  if (isLocalPipeline) {
    const pipeRows = await queryRows<
      (RowDataPacket & { pipeline_status: string; n: number })[]
    >(
      `SELECT IFNULL(c.pipeline_status,'none') AS pipeline_status, COUNT(*) AS n
       FROM citizens c
       WHERE ${baseWhere.join(" AND ")}
       GROUP BY IFNULL(c.pipeline_status,'none')`,
      baseParams,
    );
    for (const r of pipeRows) {
      const n = Number(r.n) || 0;
      if (r.pipeline_status === "local_ready") counts.localReady += n;
      else if (r.pipeline_status === "province_pending") counts.provincePending += n;
      else if (r.pipeline_status === "province_ok") counts.provinceOk += n;
      else if (r.pipeline_status === "province_returned") counts.provinceReturned += n;
      else if (r.pipeline_status === "qk_pending") counts.qkPending += n;
    }
    counts.pending =
      counts.localReady +
      counts.provincePending +
      counts.provinceOk +
      counts.provinceReturned;

    // Đếm theo loại đề xuất trong hàng chờ cấp hiện tại (xã: local_ready, tỉnh: province_pending)
    const pendingPipe =
      session.hierarchyLevel === "tinh" ? "province_pending" : "local_ready";
    const kindCountRows = await queryRows<
      (RowDataPacket & {
        call_intent: string | null;
        military_status: string;
        n: number;
      })[]
    >(
      `SELECT c.call_intent, c.military_status, COUNT(*) AS n
       FROM citizens c
       WHERE ${baseWhere.join(" AND ")}
         AND c.pipeline_status = ?
       GROUP BY c.call_intent, c.military_status`,
      [...baseParams, pendingPipe],
    );
    for (const r of kindCountRows) {
      const n = Number(r.n) || 0;
      if (r.military_status === "tamhoan") {
        counts.pendingTamHoan += n;
      } else if (r.call_intent === "de_xuat_khong_goi") {
        counts.pendingKhongGoi += n;
      } else if (r.call_intent === "du_kien_goi") {
        counts.pendingGoi += n;
      }
    }
  } else {
  // Đếm theo loại pending QK
  const countKindRows = await queryRows<
    (RowDataPacket & {
      call_intent: string | null;
      military_status: string;
      approval_status: string;
      military_status_locked: number | null;
      military_status_reason: string | null;
      has_comment: number;
      n: number;
    })[]
  >(
    `SELECT c.call_intent, c.military_status, c.approval_status,
            c.military_status_locked, c.military_status_reason,
            CASE WHEN IFNULL(c.approval_comment,'') <> '' THEN 1 ELSE 0 END AS has_comment,
            COUNT(*) AS n
     FROM citizens c
     WHERE ${baseWhere.join(" AND ")}
     GROUP BY c.call_intent, c.military_status, c.approval_status,
              c.military_status_locked, c.military_status_reason,
              CASE WHEN IFNULL(c.approval_comment,'') <> '' THEN 1 ELSE 0 END`,
    baseParams,
  );

  for (const r of countKindRows) {
    const n = Number(r.n) || 0;
    const statusNone = !r.approval_status || r.approval_status === "none";
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
      counts.khongGoi += n;
      counts.rejected += n;
    } else if (
      statusNone &&
      Number(r.military_status_locked) === 1 &&
      Number(r.has_comment) === 1
    ) {
      if (r.military_status_reason === RETURN_TAM_HOAN_MARKER) {
        counts.khongDuyetTamHoan += n;
      } else {
        counts.khongDongY += n;
      }
    }
  }
  }

  if (!isLocalPipeline) {
  if (statusFilter === "pending" || statusFilter === "approved") {
    listWhere.push("c.approval_status = ?");
    listParams.push(statusFilter);
  } else if (statusFilter === "rejected" || statusFilter === "khong_goi") {
    listWhere.push("c.approval_status = 'rejected'");
  } else if (statusFilter === "khong_dong_y") {
    listWhere.push(
      `IFNULL(c.approval_status,'none') = 'none'
       AND IFNULL(c.military_status_locked,0) = 1
       AND IFNULL(c.approval_comment,'') <> ''
       AND IFNULL(c.military_status_reason,'') <> ?`,
    );
    listParams.push(RETURN_TAM_HOAN_MARKER);
  } else if (statusFilter === "khong_duyet_tam_hoan") {
    listWhere.push(
      `IFNULL(c.approval_status,'none') = 'none'
       AND IFNULL(c.military_status_locked,0) = 1
       AND IFNULL(c.approval_comment,'') <> ''
       AND c.military_status_reason = ?`,
    );
    listParams.push(RETURN_TAM_HOAN_MARKER);
  }
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
      military_status_locked: number | null;
      pipeline_status: string | null;
      province_comment: string | null;
    })[]
  >(
    `SELECT c.id, c.full_name, c.cccd, c.date_of_birth, c.unit_code,
          c.health_grade, c.approval_status, c.campaign_id,
          c.military_status_reason, c.approval_comment, c.call_intent,
          c.military_status, c.military_status_locked,
          c.pipeline_status, c.province_comment
     FROM citizens c
     WHERE ${listWhere.join(" AND ")}
     ORDER BY
       FIELD(c.pipeline_status, 'local_ready','province_returned','province_pending','province_ok','qk_pending','none'),
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
    const pipelineStatus = (r.pipeline_status ||
      "none") as PipelineStatus;
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
      politicalResult: healthGradeFitnessLabel(
        r.health_grade != null ? Number(r.health_grade) : null,
      ),
      status: toApprovalUiStatus(approvalStatus, {
        militaryStatusLocked: Number(r.military_status_locked) === 1,
        approvalComment: r.approval_comment,
        militaryStatusReason: r.military_status_reason,
      }),
      kind: kindDetected,
      callIntent,
      militaryStatus,
      campaignId: r.campaign_id || undefined,
      note:
        r.military_status_reason === RETURN_TAM_HOAN_MARKER
          ? undefined
          : r.military_status_reason || undefined,
      approvalComment: r.approval_comment || undefined,
      pipelineStatus,
      provinceComment: r.province_comment || undefined,
    };
  });

  const total = isLocalPipeline
    ? counts.localReady +
      counts.provincePending +
      counts.provinceOk +
      counts.provinceReturned +
      counts.qkPending
    : counts.pending +
      counts.approved +
      counts.khongGoi +
      counts.khongDongY +
      counts.khongDuyetTamHoan;

  return NextResponse.json({
    data,
    counts,
    total,
    role: session.hierarchyLevel,
  });
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
  await ensureCitizenPipelineColumns();
  await ensureCitizenReceivingColumns();

  const scope = scopeWhere(
    session.hierarchyLevel,
    session.unitCode,
    filterUnit || undefined,
  );

  let pendingFilter = "";
  if (kind === "goi") {
    pendingFilter = `c.call_intent = 'du_kien_goi' AND c.approval_status = 'pending' AND IFNULL(c.pipeline_status,'none') = 'qk_pending'`;
  } else if (kind === "khong_goi") {
    pendingFilter = `c.call_intent = 'de_xuat_khong_goi' AND c.approval_status = 'pending' AND IFNULL(c.pipeline_status,'none') = 'qk_pending'`;
  } else {
    pendingFilter = `c.military_status = 'tamhoan' AND c.approval_status = 'pending' AND IFNULL(c.pipeline_status,'none') = 'qk_pending'`;
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
    const purpose = kind === "khong_goi" ? "giay_kham_suc_khoe" : "giay_tam_hoan";
    for (const c of beforeRows) {
      const files = await listCitizenNvqsAttachments(
        c.id,
        purpose === "giay_tam_hoan"
          ? ["giay_tam_hoan", "tam_hoan"]
          : ["giay_kham_suc_khoe", "khong_goi"],
      );
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
  // Phân biệt tab Không duyệt tạm hoãn vs Không duyệt không gọi
  const militaryStatusReasonValue =
    kind === "tam_hoan" && action === "reject"
      ? RETURN_TAM_HOAN_MARKER
      : kind === "khong_goi" && action === "reject"
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
  } else if (militaryStatusReasonValue !== undefined) {
    setParts.push("military_status_reason = ?");
    setParams.push(militaryStatusReasonValue);
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
            relatedHref: "/admin/citizens?callIntent=khong_goi",
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
          relatedHref:
            kind === "khong_goi"
              ? "/admin/citizens?callIntent=khong_goi"
              : "/admin/citizens",
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
              ? "Không duyệt không gọi — trả về"
              : "Không duyệt tạm hoãn — trả về",
          message: `${c.full_name} (CCCD ${c.cccd}) tại ${locality} đã chuyển về Hồ sơ mới và bị khóa. Nhận xét QK: ${note}. Vui lòng kiểm tra minh chứng / ghi chú rồi gửi duyệt lại.`,
          relatedHref:
            kind === "khong_goi"
              ? "/admin/citizens?callIntent=khong_duyet_khong_goi"
              : "/admin/citizens?callIntent=khong_duyet_tam_hoan",
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
