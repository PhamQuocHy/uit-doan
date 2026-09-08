import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createRoleInDb, ensureMedicalOfficerRole, findRolesFromDb } from "@/lib/roles-db";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;

  await ensureMedicalOfficerRole();

  const roles = await findRolesFromDb({ search });
  if (!roles) {
    return NextResponse.json({
      data: [],
      total: 0,
      meta: { source: "unavailable" },
    });
  }

  return NextResponse.json({
    data: roles,
    total: roles.length,
    meta: { source: "mysql" },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Vui lòng nhập tên vai trò" }, { status: 400 });
    }

    const role = await createRoleInDb({
      name,
      description: typeof body.description === "string" ? body.description : undefined,
    });
    if (!role) {
      return NextResponse.json({ error: "Không tạo được vai trò" }, { status: 500 });
    }

    await writeAuditLog({
      userId: session.userId,
      actionType: "CREATE",
      targetTable: "roles",
      targetId: String(role.id),
      dataSnapshot: { name: role.name, code: role.code },
    });

    return NextResponse.json(role, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
}
