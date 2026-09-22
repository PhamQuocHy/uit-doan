import { withApiGuard } from "@/lib/security/api-guard";
import { canManageMembers, canManageUser, isAssignableRole } from "@/lib/user-management";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import {
  findUserByIdFromDb,
  inferFunctionalRoleFromRoleCode,
  updateUserInDb,
} from "@/lib/auth-users";
import { writeAuditLog } from "@/lib/audit-log";
import { persistUnitEditPin } from "@/lib/unit-pin";
import { getUnitByCode } from "@/lib/hierarchy";
import { ensureMedicalOfficerRole, findRoleById } from "@/lib/roles-db";
import type { FunctionalRole } from "@/lib/functional-roles";
import { ALL_MILITARY_UNITS, isQuanKhuOrBtl } from "@/lib/military-regions";

function isMilitaryDonvi(unitCode: string): boolean {
  return ALL_MILITARY_UNITS.some((u) => u.code === unitCode);
}

async function GETHandler(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const user = await findUserByIdFromDb(id) || db.users.findById(id);
  if (!user) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  if (!canManageUser(session, user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const safeUser = { ...user } as Record<string, unknown>;
  delete safeUser.password;
  return NextResponse.json(safeUser);
}

async function PUTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || !canManageMembers(session)) {
    return NextResponse.json(
      { error: "Không có quyền cập nhật thành viên" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await request.json();

  const existingMemory = db.users.findById(id);
  const existing = await findUserByIdFromDb(id) || existingMemory;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageUser(session!, existing)) return NextResponse.json({ error: "Forbidden: target must be a subordinate within your scope" }, { status: 403 });
  const usernameHint = existing.username;

  const {
    password,
    name,
    email,
    phone,
    role,
    department,
    status,
    editPin,
    unitCode: bodyUnitCode,
    roleId: bodyRoleId,
    functionalRole: bodyFunctionalRole,
  } = body;

  let passwordHash: string | undefined;
  if (typeof password === "string" && password.trim()) {
    if (password.trim().length < 12 || password.length > 256) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có từ 12 đến 256 ký tự" },
        { status: 400 },
      );
    }
    passwordHash = hashPassword(password);
  }

  const unitCode =
    typeof bodyUnitCode === "string" ? bodyUnitCode.trim() : undefined;
  const roleId =
    bodyRoleId != null && bodyRoleId !== ""
      ? Number(bodyRoleId)
      : undefined;
  let functionalRole: FunctionalRole | undefined =
    bodyFunctionalRole === "tuyen_quan" ||
    bodyFunctionalRole === "nhan_quan" ||
    bodyFunctionalRole === "y_te"
      ? bodyFunctionalRole
      : undefined;

  if (unitCode) {
    const unit = getUnitByCode(unitCode);
    if (!unit) {
      return NextResponse.json({ error: "Đơn vị không hợp lệ" }, { status: 400 });
    }
  }

  if (roleId != null) {
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return NextResponse.json({ error: "Vai trò không hợp lệ" }, { status: 400 });
    }
    await ensureMedicalOfficerRole();
    const roleRow = await findRoleById(roleId);
    if (!roleRow) {
      return NextResponse.json({ error: "Vai trò không tồn tại" }, { status: 400 });
    }
    if (!isAssignableRole(roleRow.code)) return NextResponse.json({ error: "Forbidden role" }, { status: 403 });
    if (isQuanKhuOrBtl(unitCode || existing.unitCode) && roleRow.code !== "UNIT_OFFICER") return NextResponse.json({ error: "Military region requires UNIT_OFFICER" }, { status: 403 });
    if (!functionalRole) {
      functionalRole = inferFunctionalRoleFromRoleCode(roleRow.code, roleRow.name);
    }
  }

  if (unitCode && isMilitaryDonvi(unitCode)) {
    functionalRole = isQuanKhuOrBtl(unitCode) ? "tuyen_quan" : "nhan_quan";
  }

  const destination = getUnitByCode(unitCode || existing.unitCode);
  if (!destination || !canManageUser(session!, { ...existing, unitCode: destination.code, hierarchyLevel: destination.level, functionalRole: functionalRole || existing.functionalRole })) {
    return NextResponse.json({ error: "Forbidden destination" }, { status: 403 });
  }

  const dbOk = await updateUserInDb(
    { id },
    {
      passwordHash,
      name: typeof name === "string" ? name : undefined,
      email: typeof email === "string" ? email : undefined,
      phone: typeof phone === "string" ? phone : undefined,
      status:
        status === "active" || status === "inactive" || status === "locked"
          ? status
          : undefined,
      unitCode: unitCode ?? undefined,
      roleId: roleId ?? undefined,
      functionalRole,
    },
  );

  if (passwordHash && !dbOk && !existingMemory) {
    return NextResponse.json(
      {
        error:
          "Không cập nhật được mật khẩu trên cơ sở dữ liệu. Kiểm tra kết nối MySQL / bảng users.",
      },
      { status: 500 },
    );
  }

  const pinUnit =
    unitCode || existing.unitCode || undefined;
  if (typeof editPin === "string" && editPin.trim() && pinUnit) {
    await persistUnitEditPin(pinUnit, editPin.trim());
  }

  const memoryPatch: Record<string, unknown> = {};
  if (name !== undefined) memoryPatch.name = name;
  if (email !== undefined) memoryPatch.email = email;
  if (phone !== undefined) memoryPatch.phone = phone;
  if (roleId != null) memoryPatch.role = "user";
  if (department !== undefined) memoryPatch.department = department;
  if (status !== undefined) memoryPatch.status = status;
  if (passwordHash) memoryPatch.password = passwordHash;
  if (typeof editPin === "string") memoryPatch.editPin = editPin.trim();
  if (unitCode) {
    memoryPatch.unitCode = unitCode;
    const unit = getUnitByCode(unitCode);
    if (unit) {
      memoryPatch.hierarchyLevel = unit.level;
      memoryPatch.department = unit.name;
    }
  }
  if (functionalRole) memoryPatch.functionalRole = functionalRole;

  let updated = existingMemory
    ? db.users.update(id, memoryPatch)
    : null;

  if (!updated && dbOk) {
    // DB-only user — trả về payload tối thiểu
    updated = {
      id,
      username: usernameHint || id,
      name: typeof name === "string" ? name : "",
      email: typeof email === "string" ? email : "",
      phone: typeof phone === "string" ? phone : "",
      role: (role as "admin" | "user") || "user",
      department:
        (unitCode && getUnitByCode(unitCode)?.name) ||
        (typeof department === "string" ? department : ""),
      hierarchyLevel: unitCode
        ? getUnitByCode(unitCode)?.level || "xa"
        : "xa",
      unitCode: unitCode || "",
      functionalRole: functionalRole || "tuyen_quan",
      status:
        status === "inactive" || status === "locked" ? status : "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editPin: typeof editPin === "string" ? editPin.trim() : null,
    };
  }

  if (!updated && !dbOk) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }

  const changed: string[] = [];
  if (passwordHash) changed.push("password");
  if (name !== undefined) changed.push("name");
  if (email !== undefined) changed.push("email");
  if (phone !== undefined) changed.push("phone");
  if (status !== undefined) changed.push("status");
  if (role !== undefined || roleId != null) changed.push("role");
  if (unitCode) changed.push("unitCode");
  if (typeof editPin === "string" && editPin.trim()) changed.push("editPin");
  if (changed.length > 0) {
    await writeAuditLog({
      userId: session.userId,
      actionType: "UPDATE",
      targetTable: "users",
      targetId: usernameHint || id,
      dataSnapshot: {
        fields: changed,
        targetUsername: usernameHint,
        unitCode,
        roleId,
      },
    });
  }

  return NextResponse.json(updated);
}

async function DELETEHandler(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || !canManageMembers(session)) {
    return NextResponse.json(
      { error: "Không có quyền xóa thành viên" },
      { status: 403 },
    );
  }
  const { id } = await params;
  if (id === session!.userId) {
    return NextResponse.json(
      { error: "Không thể xóa tài khoản đang đăng nhập" },
      { status: 400 },
    );
  }

  const existing = await findUserByIdFromDb(id) || db.users.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageUser(session!, existing)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Soft-delete on MySQL if present
  const { pingDb, queryExecute } = await import("@/lib/db");
  if (await pingDb()) {
    try {
      await queryExecute(`UPDATE users SET status = 'inactive' WHERE id = ?`, [id]);
    } catch {
      // ignore
    }
  }

  const deleted = db.users.delete(id);
  if (!deleted) {
    // DB-only: still ok if we inactivated
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: true });
}

export const GET = withApiGuard(GETHandler);
export const PUT = withApiGuard(PUTHandler);
export const DELETE = withApiGuard(DELETEHandler);
