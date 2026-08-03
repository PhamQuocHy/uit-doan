import { RowDataPacket } from "mysql2";
import { queryRows } from "@/lib/db";

/** All unit codes under (and including) root — recursive CTE */
export async function getDescendantUnitCodes(rootCode: string): Promise<string[]> {
  if (!rootCode || rootCode === "bo") {
    const rows = await queryRows<(RowDataPacket & { code: string })[]>(
      "SELECT code FROM hierarchy_units WHERE is_active = 1"
    );
    return rows.map((r) => r.code);
  }

  const rows = await queryRows<(RowDataPacket & { code: string })[]>(
    `WITH RECURSIVE unit_tree AS (
       SELECT code FROM hierarchy_units WHERE code = ?
       UNION ALL
       SELECT h.code FROM hierarchy_units h
       INNER JOIN unit_tree t ON h.parent_code = t.code
     )
     SELECT code FROM unit_tree`,
    [rootCode]
  );
  return rows.map((r) => r.code);
}

export function resolveScopeUnit(
  sessionUnitCode: string,
  hierarchyLevel: string,
  requestedUnitCode?: string
): string {
  // Chỉ cấp Bộ được chọn đơn vị khác; các cấp còn lại luôn scope theo session
  if (hierarchyLevel === "bo" && requestedUnitCode) {
    return requestedUnitCode;
  }
  return sessionUnitCode;
}
