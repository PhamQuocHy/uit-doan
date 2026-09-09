import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hierarchyUnits, getUnitDescendants, db } from "@/lib/data";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import {
  ensureCitizenPipelineColumns,
  ensureCitizenApprovalCommentColumn,
} from "@/lib/citizens-db";
import type { PipelineStatus } from "@/lib/enlistment-approval";
import type { RowDataPacket } from "mysql2";
import {
  isQuanKhuOrBtl,
  ensureMilitaryUnitsInMemory,
} from "@/lib/military-regions";

ensureMilitaryUnitsInMemory();

type ForwardAction =
  | "xa_send_province"
  | "province_approve"
  | "province_approve_all"
  | "province_return"
  | "province_send_qk";

function unitName(code: string | null): string {
  if (!code) return "—";
  return hierarchyUnits.find((u) => u.code === code)?.name || code;
}

function scopeWhere(
  level: string,
  unitCode: string,
  requestedUnit?: string,
): { sql: string; params: string[] } {
  const selectedUnit = requestedUnit || unitCode;
  if (level === "bo" && !requestedUnit) {
    return { sql: "1=1", params: [] };
  }
  if (level === "xa") {
    return {
      sql: "c.unit_code = ?",
      params: [unitCode],
    };
  }
  if (level === "tinh") {
    return {
      sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
      params: [selectedUnit, selectedUnit],
    };
  }
  const allowed =
    level === "bo" || new Set(getUnitDescendants(unitCode)).has(selectedUnit);
  if (!allowed) return { sql: "1=0", params: [] };
  return {
    sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
    params: [selectedUnit, selectedUnit],
  };
}

function notifyUnits(unitCode: string | null, sessionUnit: string) {
  const target = unitCode || sessionUnit;
  const set = new Set<string>([target]);
  const u = hierarchyUnits.find((x) => x.code === target);
  if (u?.parentCode && u.parentCode !== "bo") set.add(u.parentCode);
  return set;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await pingDb())) {
    return NextResponse.json({ error: "Database không khả dụng" }, { status: 503 });
  }

  await ensureCitizenApprovalCommentColumn();
  await ensureCitizenPipelineColumns();

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "") as ForwardAction;
  const note = String(body.note || "").trim();
  const campaignId = String(body.campaignId || "").trim();
  const filterUnit = String(body.unitCode || "").trim();
  const kindFilter = String(body.kind || "").trim();
  const idsFromBody: string[] = Array.isArray(body.ids)
    ? body.ids.map(String).filter(Boolean)
    : [];

  const level = session.hierarchyLevel;
  const isXa = level === "xa";
  const isTinh = level === "tinh";

  if (action === "xa_send_province" && !isXa) {
    return NextResponse.json(
      { error: "Chỉ cấp xã được gửi hồ sơ lên tỉnh" },
      { status: 403 },
    );
  }
  if (
    (action === "province_approve" ||
      action === "province_approve_all" ||
      action === "province_return" ||
      action === "province_send_qk") &&
    !isTinh &&
    level !== "bo"
  ) {
    return NextResponse.json(
      { error: "Chỉ cấp tỉnh / Bộ được thao tác bước tỉnh" },
      { status: 403 },
    );
  }
  if (level === "donvi" && isQuanKhuOrBtl(session.unitCode)) {
    return NextResponse.json(
      { error: "Quân khu dùng API xét duyệt QK, không dùng forward" },
      { status: 403 },
    );
  }

  if (action === "province_return" && !note) {
    return NextResponse.json(
      { error: "Vui lòng nhập lý do trả về (cần cập nhật bổ sung gì)" },
      { status: 400 },
    );
  }

  const scope = scopeWhere(level, session.unitCode, filterUnit || undefined);

  let fromPipeline: PipelineStatus[] = [];
  let toPipeline: PipelineStatus = "none";
  let setApprovalPending = false;
  let setProvinceComment: string | null | undefined = undefined;
  let unlock = false;
  let clearProvinceComment = false;

  let touchProvinceReviewedAt = false;

  switch (action) {
    case "xa_send_province":
      fromPipeline = ["local_ready", "province_returned"];
      toPipeline = "province_pending";
      clearProvinceComment = true;
      break;
    case "province_approve":
    case "province_approve_all":
      fromPipeline = ["province_pending"];
      toPipeline = "province_ok";
      touchProvinceReviewedAt = true;
      break;
    case "province_return":
      fromPipeline = ["province_pending"];
      toPipeline = "province_returned";
      setProvinceComment = note;
      unlock = true;
      touchProvinceReviewedAt = true;
      break;
    case "province_send_qk":
      fromPipeline = ["province_ok"];
      toPipeline = "qk_pending";
      setApprovalPending = true;
      touchProvinceReviewedAt = true;
      break;
    default:
      return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  }

  let targetIds = idsFromBody;
  if (action === "province_approve_all") {
    const params: unknown[] = [...scope.params];
    let sql = `SELECT c.id FROM citizens c
       WHERE ${scope.sql}
         AND c.pipeline_status = 'province_pending'
         AND c.archived_at IS NULL`;
    if (campaignId) {
      sql += " AND c.campaign_id = ?";
      params.push(campaignId);
    }
    if (kindFilter === "goi") {
      sql += " AND c.call_intent = 'du_kien_goi' AND c.military_status <> 'tamhoan'";
    } else if (kindFilter === "khong_goi") {
      sql += " AND c.call_intent = 'de_xuat_khong_goi'";
    } else if (kindFilter === "tam_hoan") {
      sql += " AND c.military_status = 'tamhoan'";
    }
    sql += " ORDER BY c.updated_at DESC LIMIT 5000";
    const rows = await queryRows<(RowDataPacket & { id: string })[]>(sql, params);
    targetIds = rows.map((r) => r.id);
  } else if (action === "xa_send_province" && targetIds.length === 0) {
    // Gửi toàn bộ hồ sơ chờ gửi tỉnh (gọi + không gọi + tạm hoãn), không theo tab
    const params: unknown[] = [...scope.params];
    let sql = `SELECT c.id FROM citizens c
       WHERE ${scope.sql}
         AND c.pipeline_status = 'local_ready'
         AND c.archived_at IS NULL`;
    if (campaignId) {
      sql += " AND c.campaign_id = ?";
      params.push(campaignId);
    }
    sql += " ORDER BY c.updated_at DESC LIMIT 5000";
    const rows = await queryRows<(RowDataPacket & { id: string })[]>(sql, params);
    targetIds = rows.map((r) => r.id);
  }

  if (targetIds.length === 0) {
    return NextResponse.json(
      { error: "Không có hồ sơ phù hợp" },
      { status: 404 },
    );
  }

  const placeholders = targetIds.map(() => "?").join(",");
  const pipePh = fromPipeline.map(() => "?").join(",");
  const beforeRows = await queryRows<
    (RowDataPacket & {
      id: string;
      full_name: string;
      cccd: string;
      unit_code: string | null;
      pipeline_status: string;
    })[]
  >(
    `SELECT c.id, c.full_name, c.cccd, c.unit_code, c.pipeline_status
     FROM citizens c
     WHERE c.id IN (${placeholders})
       AND ${scope.sql}
       AND c.pipeline_status IN (${pipePh})
       AND c.archived_at IS NULL`,
    [...targetIds, ...scope.params, ...fromPipeline],
  );

  if (beforeRows.length === 0) {
    return NextResponse.json(
      { error: "Không tìm thấy hồ sơ ở trạng thái phù hợp hoặc không có quyền" },
      { status: 404 },
    );
  }

  const okIds = beforeRows.map((r) => r.id);
  const okPh = okIds.map(() => "?").join(",");
  const sets: string[] = ["pipeline_status = ?", "updated_at = NOW()"];
  const setParams: unknown[] = [toPipeline];
  if (touchProvinceReviewedAt) {
    sets.push("province_reviewed_at = NOW()");
  }

  if (setApprovalPending) {
    sets.push("approval_status = 'pending'");
  }
  if (setProvinceComment !== undefined) {
    sets.push("province_comment = ?");
    setParams.push(setProvinceComment);
  }
  if (clearProvinceComment) {
    sets.push("province_comment = NULL");
  }
  if (unlock) {
    sets.push("military_status_locked = 0");
  }

  await queryExecute(
    `UPDATE citizens c SET ${sets.join(", ")}
     WHERE c.id IN (${okPh})`,
    [...setParams, ...okIds],
  );

  // Notifications
  if (action === "xa_send_province") {
    const parent =
      hierarchyUnits.find((u) => u.code === session.unitCode)?.parentCode ||
      session.unitCode.split("-")[0];
    if (parent) {
      db.notifications.create({
        toUnit: parent,
        type: "info",
        title: "Hồ sơ xã gửi lên tỉnh",
        message: `${session.unitCode}: ${okIds.length} hồ sơ chờ đồng tình.`,
        relatedHref: "/admin/approval",
      });
    }
  } else if (action === "province_return") {
    for (const c of beforeRows) {
      for (const toUnit of notifyUnits(c.unit_code, session.unitCode)) {
        if (toUnit === session.unitCode && level === "tinh") continue;
        db.notifications.create({
          toUnit,
          type: "citizen_proposal_returned",
          title: "Tỉnh trả về — cần bổ sung",
          message: `${c.full_name} (CCCD ${c.cccd}): ${note}`,
          relatedHref: "/admin/approval?pipeline=province_returned",
        });
      }
    }
  } else if (action === "province_send_qk") {
    db.notifications.create({
      toUnit: session.unitCode,
      type: "info",
      title: "Đã gửi Quân khu",
      message: `Đã chuyển ${okIds.length} hồ sơ lên hàng chờ Quân khu.`,
      relatedHref: "/admin/approval",
    });
  }

  const labels: Record<ForwardAction, string> = {
    xa_send_province: `Đã gửi ${okIds.length} hồ sơ về tỉnh`,
    province_approve: `Đã đồng tình ${okIds.length} hồ sơ`,
    province_approve_all: `Đã đồng tình toàn bộ ${okIds.length} hồ sơ`,
    province_return: `Đã trả về ${okIds.length} hồ sơ`,
    province_send_qk: `Đã gửi ${okIds.length} hồ sơ lên Quân khu`,
  };

  return NextResponse.json({
    success: true,
    action,
    processed: okIds.length,
    message: labels[action],
  });
}
