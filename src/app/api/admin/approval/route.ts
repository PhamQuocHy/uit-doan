import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hierarchyUnits } from "@/lib/data";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import {
  resolveApprovalAction,
  toApprovalUiStatus,
  type ApprovalRow,
} from "@/lib/enlistment-approval";
import type { RowDataPacket } from "mysql2";

function scopeWhere(level: string, unitCode: string): { sql: string; params: string[] } {
  if (level === "bo") {
    return { sql: "1=1", params: [] };
  }
  return {
    sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
    params: [unitCode, unitCode],
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
  const search = (searchParams.get("search") || "").trim();

  const dbOk = await pingDb();
  if (!dbOk) {
    return NextResponse.json({ data: [], counts: { pending: 0, approved: 0, rejected: 0 } });
  }

  const scope = scopeWhere(session.hierarchyLevel, session.unitCode);
  const where: string[] = [
    scope.sql,
    "c.call_intent = 'du_kien_goi'",
    "c.approval_status IN ('pending','approved','rejected')",
  ];
  const params = [...scope.params];

  if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
    where.push("c.approval_status = ?");
    params.push(statusFilter);
  }

  if (search) {
    where.push("(c.full_name LIKE ? OR c.cccd LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s);
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
    })[]
  >(
    `SELECT c.id, c.full_name, c.cccd, c.date_of_birth, c.unit_code,
            c.health_grade, c.approval_status
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
    dateOfBirth:
      r.date_of_birth instanceof Date
        ? r.date_of_birth.toISOString().slice(0, 10)
        : String(r.date_of_birth).slice(0, 10),
    unitName: unitName(r.unit_code),
    healthResult: r.health_grade != null ? `Loại ${r.health_grade}` : "—",
    politicalResult: "Đạt",
    status: toApprovalUiStatus(r.approval_status as "pending" | "approved" | "rejected"),
    callIntent: "du_kien_goi",
  }));

  const counts = {
    pending: data.filter((d) => d.status === "pending").length,
    approved: data.filter((d) => d.status === "approved").length,
    rejected: data.filter((d) => d.status === "rejected").length,
  };

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
       call_intent = ?,
       military_status = ?,
       updated_at = NOW()
     WHERE c.id = ?
       AND ${scope.sql}
       AND c.call_intent = 'du_kien_goi'
       AND c.approval_status = 'pending'`,
    [
      resolved.approvalStatus,
      resolved.callIntent,
      resolved.militaryStatus,
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
        ? "Đã duyệt gọi nhập ngũ"
        : "Đã từ chối — chuyển sang không gọi",
  });
}
