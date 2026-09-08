import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  deleteRoleInDb,
  findRoleById,
  findRoleMembers,
  findRolePermissionIds,
  setRolePermissions,
  updateRoleInDb,
} from "@/lib/roles-db";
import { writeAuditLog } from "@/lib/audit-log";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const role = await findRoleById(id);
  if (!role) {
    return NextResponse.json({ error: "Không tìm thấy vai trò" }, { status: 404 });
  }

  const [permissionIds, members] = await Promise.all([
    findRolePermissionIds(id),
    findRoleMembers(id),
  ]);

  return NextResponse.json({
    ...role,
    permissionIds: permissionIds || [],
    members: members || [],
    meta: { source: "mysql" },
  });
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  try {
    const body = await request.json();

    if (Array.isArray(body.permissionIds)) {
      const ids = body.permissionIds
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isFinite(n));
      const ok = await setRolePermissions(id, ids);
      if (!ok) {
        return NextResponse.json({ error: "Không lưu được quyền hạn" }, { status: 500 });
      }
      await writeAuditLog({
        userId: session.userId,
        actionType: "UPDATE",
        targetTable: "role_permissions",
        targetId: String(id),
        dataSnapshot: { permissionIds: ids },
      });
    }

    const updated = await updateRoleInDb(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy vai trò" }, { status: 404 });
    }

    const permissionIds = (await findRolePermissionIds(id)) || [];
    const members = (await findRoleMembers(id)) || [];

    return NextResponse.json({ ...updated, permissionIds, members });
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const result = await deleteRoleInDb(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Không xóa được" }, { status: 400 });
  }

  await writeAuditLog({
    userId: session.userId,
    actionType: "DELETE",
    targetTable: "roles",
    targetId: String(id),
  });

  return NextResponse.json({ success: true });
}
