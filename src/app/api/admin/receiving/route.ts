import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth";
import { hierarchyUnits, db } from "@/lib/data";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import { ensureCitizenReceivingColumns } from "@/lib/citizens-db";
import { toDateOnlyString } from "@/lib/date-vn";
import {
  citizenScopeForQuanKhu,
  getAssignableReceivingUnits,
  getProvincesForMilitaryRegion,
  getQuanKhuRoot,
  isQuanKhuOrBtl,
  isReceivingOperationalUnit,
  receivingScopeUnitCodes,
  ensureMilitaryUnitsInMemory,
  MILITARY_REGIONS,
} from "@/lib/military-regions";

ensureMilitaryUnitsInMemory();

function unitName(code: string | null | undefined): string {
  if (!code) return "—";
  return hierarchyUnits.find((u) => u.code === code)?.name || code;
}

function bucketSql(alias = "c") {
  return `CASE
    WHEN ${alias}.receiving_status = 'unit_confirmed' THEN 'unit_confirmed'
    WHEN ${alias}.receiving_status = 'published' THEN 'published'
    WHEN ${alias}.receiving_status = 'bo_approved' THEN 'bo_approved'
    WHEN ${alias}.receiving_status = 'submitted_to_bo' THEN 'submitted_to_bo'
    WHEN ${alias}.receiving_status = 'chua_phan_quan'
      OR ${alias}.receiving_status IS NULL
      OR ${alias}.receiving_unit_code IS NULL
      OR ${alias}.receiving_unit_code = ''
    THEN 'chua_phan_quan'
    ELSE 'da_phan_quan'
  END`;
}

function statusFilterSql(status: string): string | null {
  if (status === "chua_phan_quan") {
    return `(c.receiving_status = 'chua_phan_quan' OR c.receiving_status IS NULL OR c.receiving_unit_code IS NULL OR c.receiving_unit_code = '')`;
  }
  if (status === "da_phan_quan") return `c.receiving_status = 'da_phan_quan'`;
  if (status === "submitted_to_bo") return `c.receiving_status = 'submitted_to_bo'`;
  if (status === "bo_approved") return `c.receiving_status = 'bo_approved'`;
  if (status === "published") return `c.receiving_status = 'published'`;
  if (status === "unit_confirmed") return `c.receiving_status = 'unit_confirmed'`;
  return null;
}

const emptyCounts = {
  chua_phan_quan: 0,
  da_phan_quan: 0,
  submitted_to_bo: 0,
  bo_approved: 0,
  published: 0,
  unit_confirmed: 0,
};

function scopeForSession(
  level: string,
  unitCode: string,
  localityFilter?: string,
  quanKhuFilter?: string,
): {
  sql: string;
  params: string[];
} {
  if (level === "bo") {
    if (quanKhuFilter && isQuanKhuOrBtl(quanKhuFilter)) {
      return citizenScopeForQuanKhu(quanKhuFilter);
    }
    if (!localityFilter) return { sql: "1=1", params: [] };
    return {
      sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
      params: [localityFilter, localityFilter],
    };
  }
  if (level === "donvi" && isQuanKhuOrBtl(unitCode)) {
    if (!localityFilter) return citizenScopeForQuanKhu(unitCode);
    const provinces = getProvincesForMilitaryRegion(unitCode);
    const provinceRoot = localityFilter.includes("-")
      ? localityFilter.split("-")[0]
      : localityFilter;
    if (!provinces.includes(provinceRoot)) return { sql: "1=0", params: [] };
    return {
      sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
      params: [localityFilter, localityFilter],
    };
  }
  if (level === "donvi") {
    const codes = receivingScopeUnitCodes(unitCode);
    return {
      sql: `c.receiving_unit_code IN (${codes.map(() => "?").join(",")})`,
      params: codes,
    };
  }
  return {
    sql: "(c.unit_code = ? OR c.unit_code LIKE CONCAT(?, '-%'))",
    params: [unitCode, unitCode],
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignId = (searchParams.get("campaignId") || "").trim();
  const statusFilter = searchParams.get("status") || "";
  const search = (searchParams.get("search") || "").trim();
  const localityFilter = (searchParams.get("unitCode") || "").trim();
  const quanKhuFilter = (searchParams.get("quanKhuCode") || "").trim();
  const level = session.hierarchyLevel;

  const quanKhuCode =
    level === "donvi" ? getQuanKhuRoot(session.unitCode) : null;
  const assignable =
    quanKhuCode && isQuanKhuOrBtl(session.unitCode)
      ? getAssignableReceivingUnits(session.unitCode).map((u) => ({
          code: u.code,
          name: u.name,
          kind: u.kind,
        }))
      : [];
  const militaryRegions =
    level === "bo"
      ? MILITARY_REGIONS.map((r) => ({ code: r.code, name: r.name }))
      : [];

  if (!(await pingDb()) || !campaignId) {
    return NextResponse.json({
      data: [],
      counts: emptyCounts,
      assignableUnits: assignable,
      militaryRegions,
      campaignId: campaignId || null,
      canAssign: false,
      canSubmit: false,
      canApprove: level === "bo",
      canPublish: level === "bo",
      canConfirm:
        level === "donvi" && isReceivingOperationalUnit(session.unitCode),
      message: campaignId ? undefined : "Chọn đợt tuyển quân",
    });
  }

  await ensureCitizenReceivingColumns();
  const scope = scopeForSession(
    level,
    session.unitCode,
    localityFilter || undefined,
    quanKhuFilter || undefined,
  );
  const baseWhere = [
    scope.sql,
    "c.military_status = 'nhapngu'",
    "c.archived_at IS NULL",
    "c.campaign_id = ?",
  ];
  const baseParams: unknown[] = [...scope.params, campaignId];
  if (search) {
    baseWhere.push("(c.full_name LIKE ? OR c.cccd LIKE ?)");
    baseParams.push(`%${search}%`, `%${search}%`);
  }

  const countRows = await queryRows<
    (RowDataPacket & { bucket: string; n: number })[]
  >(
    `SELECT ${bucketSql("c")} AS bucket, COUNT(*) AS n
     FROM citizens c WHERE ${baseWhere.join(" AND ")} GROUP BY bucket`,
    baseParams,
  );
  const counts = { ...emptyCounts };
  for (const r of countRows) {
    const k = r.bucket as keyof typeof counts;
    if (k in counts) counts[k] = Number(r.n) || 0;
  }

  const where = [...baseWhere];
  const params = [...baseParams];
  const filterSql = statusFilterSql(statusFilter);
  if (filterSql) where.push(filterSql);

  const rows = await queryRows<
    (RowDataPacket & {
      id: string;
      full_name: string;
      cccd: string;
      date_of_birth: string | Date;
      unit_code: string | null;
      health_grade: number | null;
      receiving_status: string | null;
      receiving_unit_code: string | null;
      campaign_id: string | null;
      bucket: string;
    })[]
  >(
    `SELECT c.id, c.full_name, c.cccd, c.date_of_birth, c.unit_code,
            c.health_grade, c.receiving_status, c.receiving_unit_code, c.campaign_id,
            ${bucketSql("c")} AS bucket
     FROM citizens c
     WHERE ${where.join(" AND ")}
     ORDER BY FIELD(${bucketSql("c")}, 'chua_phan_quan','da_phan_quan','submitted_to_bo','bo_approved','published','unit_confirmed'),
              c.updated_at DESC
     LIMIT 5000`,
    params,
  );

  const isQk = level === "donvi" && isQuanKhuOrBtl(session.unitCode);
  const isOps =
    level === "donvi" && isReceivingOperationalUnit(session.unitCode);

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      cccd: r.cccd,
      dateOfBirth: toDateOnlyString(r.date_of_birth) || "",
      unitName: unitName(r.unit_code),
      healthResult: r.health_grade != null ? `Loại ${r.health_grade}` : "—",
      receivingStatus: r.bucket,
      receivingUnitCode: r.receiving_unit_code,
      receivingUnitName: unitName(r.receiving_unit_code),
      campaignId: r.campaign_id || undefined,
    })),
    counts,
    assignableUnits: assignable,
    militaryRegions,
    campaignId,
    canAssign: isQk,
    canSubmit: isQk,
    canApprove: level === "bo",
    canPublish: level === "bo",
    canConfirm: isOps,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const campaignId = String(body.campaignId || "").trim();
  if (!campaignId) {
    return NextResponse.json({ error: "Thiếu đợt tuyển quân" }, { status: 400 });
  }
  if (!(await pingDb())) {
    return NextResponse.json({ error: "Database không khả dụng" }, { status: 503 });
  }
  await ensureCitizenReceivingColumns();

  // Quân khu: phân về sư đoàn / trung đoàn
  if (action === "assign") {
    if (
      session.hierarchyLevel !== "donvi" ||
      !isQuanKhuOrBtl(session.unitCode)
    ) {
      return NextResponse.json(
        { error: "Chỉ quân khu được phân quân xuống đơn vị trực thuộc" },
        { status: 403 },
      );
    }
    const id = String(body.id || "");
    const receivingUnitCode = String(body.receivingUnitCode || "").trim();
    const allowed = getAssignableReceivingUnits(session.unitCode);
    if (!id || !allowed.some((u) => u.code === receivingUnitCode)) {
      return NextResponse.json(
        { error: "Đơn vị nhận không thuộc quân khu" },
        { status: 400 },
      );
    }
    const scope = citizenScopeForQuanKhu(session.unitCode);
    const result = await queryExecute(
      `UPDATE citizens c SET
         receiving_unit_code = ?,
         receiving_status = 'da_phan_quan',
         updated_at = NOW()
       WHERE c.id = ?
         AND ${scope.sql}
         AND c.campaign_id = ?
         AND c.military_status = 'nhapngu'
         AND c.archived_at IS NULL
         AND (
           c.receiving_status IS NULL
           OR c.receiving_status IN ('chua_phan_quan','da_phan_quan')
         )`,
      [receivingUnitCode, id, ...scope.params, campaignId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Không phân được (sai phạm vi / đã gửi Bộ)" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      message: `Đã phân về ${unitName(receivingUnitCode)}`,
    });
  }

  // Quân khu: chốt & gửi Bộ
  if (action === "submit") {
    if (
      session.hierarchyLevel !== "donvi" ||
      !isQuanKhuOrBtl(session.unitCode)
    ) {
      return NextResponse.json({ error: "Chỉ quân khu được chốt gửi Bộ" }, { status: 403 });
    }
    const scope = citizenScopeForQuanKhu(session.unitCode);
    const result = await queryExecute(
      `UPDATE citizens c SET receiving_status = 'submitted_to_bo', updated_at = NOW()
       WHERE ${scope.sql}
         AND c.campaign_id = ?
         AND c.military_status = 'nhapngu'
         AND c.receiving_status = 'da_phan_quan'
         AND c.receiving_unit_code IS NOT NULL
         AND c.receiving_unit_code <> ''`,
      [...scope.params, campaignId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Không có hồ sơ đã phân quân để chốt" },
        { status: 400 },
      );
    }
    db.notifications.create({
      toUnit: "bo",
      type: "info",
      title: "Quân khu chốt danh sách nhận quân",
      message: `${session.name || session.unitCode} gửi ${result.affectedRows} hồ sơ đợt ${campaignId} chờ Bộ duyệt & công bố.`,
      relatedHref: "/admin/receiving",
    });
    return NextResponse.json({
      success: true,
      affected: result.affectedRows,
      message: `Đã chốt & gửi ${result.affectedRows} hồ sơ lên Bộ`,
    });
  }

  // Bộ: duyệt
  if (action === "approve") {
    if (session.hierarchyLevel !== "bo") {
      return NextResponse.json({ error: "Chỉ Bộ được duyệt danh sách" }, { status: 403 });
    }
    const quanKhuFilter = String(body.quanKhuCode || "").trim();
    const scope = scopeForSession("bo", "bo", undefined, quanKhuFilter || undefined);
    const result = await queryExecute(
      `UPDATE citizens c SET receiving_status = 'bo_approved', updated_at = NOW()
       WHERE ${scope.sql}
         AND c.military_status = 'nhapngu'
         AND c.campaign_id = ?
         AND c.receiving_status = 'submitted_to_bo'
         AND c.archived_at IS NULL`,
      [...scope.params, campaignId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Không có hồ sơ chờ duyệt" }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      affected: result.affectedRows,
      message: `Đã duyệt ${result.affectedRows} hồ sơ — có thể công bố`,
    });
  }

  // Bộ: công bố
  if (action === "publish") {
    if (session.hierarchyLevel !== "bo") {
      return NextResponse.json({ error: "Chỉ Bộ được công bố" }, { status: 403 });
    }
    const quanKhuFilter = String(body.quanKhuCode || "").trim();
    const scope = scopeForSession("bo", "bo", undefined, quanKhuFilter || undefined);
    const result = await queryExecute(
      `UPDATE citizens c SET receiving_status = 'published', updated_at = NOW()
       WHERE ${scope.sql}
         AND c.military_status = 'nhapngu'
         AND c.campaign_id = ?
         AND c.receiving_status = 'bo_approved'
         AND c.archived_at IS NULL`,
      [...scope.params, campaignId],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Không có hồ sơ đã duyệt để công bố" }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      affected: result.affectedRows,
      message: `Đã công bố ${result.affectedRows} hồ sơ — tra cứu tại /tra-cuu`,
    });
  }

  // Đơn vị nhận (sư đoàn / trung đoàn / quân đoàn): xác nhận đã nhận quân
  if (action === "confirm") {
    if (
      session.hierarchyLevel !== "donvi" ||
      !isReceivingOperationalUnit(session.unitCode)
    ) {
      return NextResponse.json(
        { error: "Chỉ đơn vị nhận quân được xác nhận nhận quân" },
        { status: 403 },
      );
    }
    const codes = receivingScopeUnitCodes(session.unitCode);
    const id = String(body.id || "").trim();
    const whereId = id ? "c.id = ?" : "1=1";
    const idParams = id ? [id] : [];
    const result = await queryExecute(
      `UPDATE citizens c SET receiving_status = 'unit_confirmed', updated_at = NOW()
       WHERE ${whereId}
         AND c.campaign_id = ?
         AND c.military_status = 'nhapngu'
         AND c.archived_at IS NULL
         AND c.receiving_unit_code IN (${codes.map(() => "?").join(",")})
         AND c.receiving_status IN (
           'da_phan_quan','submitted_to_bo','bo_approved','published'
         )`,
      [...idParams, campaignId, ...codes],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Không có hồ sơ đủ điều kiện để xác nhận" },
        { status: 400 },
      );
    }
    return NextResponse.json({
      success: true,
      affected: result.affectedRows,
      message: id
        ? "Đã xác nhận nhận quân nhân này"
        : `Đã xác nhận nhận ${result.affectedRows} quân nhân`,
    });
  }

  return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
}
