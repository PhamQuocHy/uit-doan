import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findPermissionsFromDb, PERMISSION_MODULES } from "@/lib/roles-db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await findPermissionsFromDb();
  if (!permissions) {
    return NextResponse.json({
      data: [],
      modules: PERMISSION_MODULES,
      meta: { source: "unavailable" },
    });
  }

  return NextResponse.json({
    data: permissions,
    modules: PERMISSION_MODULES,
    meta: { source: "mysql" },
  });
}
