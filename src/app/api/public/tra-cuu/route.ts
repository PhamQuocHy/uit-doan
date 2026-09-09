import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { hierarchyUnits } from "@/lib/data";
import { pingDb, queryRows } from "@/lib/db";
import { ensureCitizenReceivingColumns } from "@/lib/citizens-db";
import { toDateOnlyString } from "@/lib/date-vn";

function unitName(code: string | null | undefined): string {
  if (!code) return "—";
  return hierarchyUnits.find((u) => u.code === code)?.name || code;
}

/** Tra cứu công khai danh sách đã công bố — không cần đăng nhập */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cccd = String(searchParams.get("cccd") || "").replace(/\D/g, "");
  const fullName = String(searchParams.get("fullName") || "").trim();

  if (cccd.length < 9 || fullName.length < 2) {
    return NextResponse.json(
      { error: "Nhập đủ số CCCD và họ tên để tra cứu" },
      { status: 400 },
    );
  }

  if (!(await pingDb())) {
    return NextResponse.json({ error: "Hệ thống tạm thời không khả dụng" }, { status: 503 });
  }

  await ensureCitizenReceivingColumns();

  const rows = await queryRows<
    (RowDataPacket & {
      full_name: string;
      cccd: string;
      date_of_birth: string | Date;
      receiving_unit_code: string | null;
      unit_code: string | null;
      health_grade: number | null;
    })[]
  >(
    `SELECT c.full_name, c.cccd, c.date_of_birth, c.receiving_unit_code,
            c.unit_code, c.health_grade
     FROM citizens c
     WHERE c.military_status = 'nhapngu'
       AND c.receiving_status = 'published'
       AND c.cccd = ?
       AND LOWER(TRIM(c.full_name)) = LOWER(?)
     LIMIT 1`,
    [cccd, fullName],
  );

  const row = rows[0];
  if (!row) {
    return NextResponse.json({
      found: false,
      message:
        "Không tìm thấy kết quả công khai khớp CCCD và họ tên. Kiểm tra lại hoặc danh sách chưa được Bộ công bố.",
    });
  }

  return NextResponse.json({
    found: true,
    data: {
      fullName: row.full_name,
      cccd: row.cccd,
      dateOfBirth: toDateOnlyString(row.date_of_birth) || "",
      receivingUnitName: unitName(row.receiving_unit_code),
      managingUnitName: unitName(row.unit_code),
      healthResult: row.health_grade != null ? `Loại ${row.health_grade}` : "—",
      statusLabel: "Đã công bố danh sách nhận quân",
    },
  });
}
