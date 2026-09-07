import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hierarchyUnits, getUnitDescendants } from "@/lib/data";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import {
  resolveApprovalAction,
  toApprovalUiStatus,
  type ApprovalRow,
} from "@/lib/enlistment-approval";
import type { RowDataPacket } from "mysql2";
import { toDateOnlyString } from "@/lib/date-vn";

function scopeWhere(level: string, unitCode: string, requestedUnit?: string): { sql: string; params: string[] } {
  const selectedUnit = requestedUnit || unitCode;
  if (level === "bo" && !requestedUnit) {
    return { sql: "1=1", params: [] };
  }
  const allowed = level === "bo" || new Set(getUnitDescendants(unitCode)).has(selectedUnit);
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

  const dbOk = await pingDb();
  if (!dbOk) {
    return NextResponse.json({ data: [], counts: { pending: 0, approved: 0, rejected: 0 } });
  }

  const scope = scopeWhere(session.hierarchyLevel, session.unitCode, requestedUnit || undefined);
  const baseWhere: string[] = [
    scope.sql,
    // Dự kiến gọi đang xét + hồ sơ đã từ chối (kể cả bản cũ call_intent=khong_goi)
    `(c.call_intent = 'du_kien_goi' OR c.approval_status = 'rejected')`,
    "c.approval_status IN ('pending','approved','rejected')",
  ];
  const baseParams = [...scope.params];
  if (campaignId) {
    // Hồ sơ chưa gán đợt vẫn hiện khi đang chọn đợt (để gắn/duyệt vào đợt đó)
    baseWhere.push("(c.campaign_id = ? OR c.campaign_id IS NULL)");
    baseParams.push(campaignId);
  }
  if (search) {
    baseWhere.push("(c.full_name LIKE ? OR c.cccd LIKE ?)");
    const s = `%${search}%`;
    baseParams.push(s, s);
  }

  // Đếm tab: luôn theo toàn bộ (không theo statusFilter) — tránh chọn “Chờ duyệt” làm “Đã duyệt” về 0
  const countRows = await queryRows<
    (RowDataPacket & { approval_status: string; n: number })[]
  >(
    `SELECT c.approval_status, COUNT(*) AS n
     FROM citizens c
     WHERE ${baseWhere.join(" AND ")}
     GROUP BY c.approval_status`,
    baseParams,
  );
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const r of countRows) {
    const n = Number(r.n) || 0;
    if (r.approval_status === "pending") counts.pending = n;
    else if (r.approval_status === "approved") counts.approved = n;
    else if (r.approval_status === "rejected") counts.rejected = n;
  }

  const where = [...baseWhere];
  const params = [...baseParams];
  if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
    where.push("c.approval_status = ?");
    params.push(statusFilter);
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
    })[]
  >(
    `SELECT c.id, c.full_name, c.cccd, c.date_of_birth, c.unit_code,
          c.health_grade, c.approval_status, c.campaign_id
     FROM citizens c
     WHERE ${where.join(" AND ")}
     ORDER BY
       FIELD(c.approval_status, 'pending', 'approved', 'rejected'),
       c.updated_at DESC
     LIMIT 500`,
    params,
  );

  const data: ApprovalRow[] = rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    cccd: r.cccd,
    dateOfBirth: toDateOnlyString(r.date_of_birth) || "",
    unitName: unitName(r.unit_code),
    healthResult: r.health_grade != null ? `Loại ${r.health_grade}` : "—",
    politicalResult: "Đạt",
    status: toApprovalUiStatus(r.approval_status as "pending" | "approved" | "rejected"),
    callIntent: "du_kien_goi",
    campaignId: r.campaign_id || undefined,
  }));

  return NextResponse.json({ data, counts });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const id = String(body.id || "");
  const action = body.action as "approve" | "reject";
  const campaignId = String(body.campaignId || "");

  if (!id || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Thiếu id hoặc action không hợp lệ" }, { status: 400 });
  }

  const resolved = resolveApprovalAction(action);

  const dbOk = await pingDb();
  if (!dbOk) {
    return NextResponse.json({ error: "Database không khả dụng" }, { status: 503 });
  }

  const scope = scopeWhere(session.hierarchyLevel, session.unitCode);
  const result = await queryExecute(
    `UPDATE citizens c SET
      approval_status = ?,
      campaign_id = ?,
      call_intent = ?,
      military_status = ?,
      military_status_locked = ?,
      updated_at = NOW()
     WHERE c.id = ?
       AND ${scope.sql}
       AND c.call_intent = 'du_kien_goi'
       AND c.approval_status = 'pending'`,
    [
      resolved.approvalStatus,
      campaignId || null,
      resolved.callIntent,
      resolved.militaryStatus,
      resolved.militaryStatusLocked ? 1 : 0,
      id,
      ...scope.params,
    ],
  );

  if (result.affectedRows === 0) {
    return NextResponse.json(
      { error: "Không tìm thấy hồ sơ chờ duyệt hoặc không có quyền" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    action,
    message:
      action === "approve"
        ? "Đã duyệt gọi nhập ngũ — hồ sơ công dân đã khóa không sửa được"
        : "Đã đánh Không đạt — đã cập nhật hồ sơ công dân",
  });
}
