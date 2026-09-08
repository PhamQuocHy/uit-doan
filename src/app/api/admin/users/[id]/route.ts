import { NextRequest, NextResponse } from "next/server";
import { db, getUnitDescendants } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { hashPassword, isHashed } from "@/lib/password";
import {
  inferFunctionalRoleFromRoleCode,
  updateUserInDb,
} from "@/lib/auth-users";
import { writeAuditLog } from "@/lib/audit-log";
import { persistUnitEditPin } from "@/lib/unit-pin";
import { getUnitByCode } from "@/lib/hierarchy";
import { ensureMedicalOfficerRole, findRoleById } from "@/lib/roles-db";
import type { FunctionalRole } from "@/lib/functional-roles";

function canManageMembers(session: {
  role: string;
  hierarchyLevel: string;
  functionalRole?: string;
} | null): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  if (!["bo", "tinh", "xa"].includes(session.hierarchyLevel)) return false;
  if (session.functionalRole === "nhan_quan") return false;
  return true;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const user = db.users.findById(id);
  if (!user) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!canManageMembers(session)) {
    return NextResponse.json(
      { error: "Không có quyền cập nhật thành viên" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await request.json();

  const existingMemory = db.users.findById(id);
  const usernameHint =
    typeof body.username === "string"
      ? body.username
      : existingMemory?.username;

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
    username: _username,
    id: _id,
    ...rest
  } = body;

  let passwordHash: string | undefined;
  if (typeof password === "string" && password.trim()) {
    if (password.trim().length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 6 ký tự" },
        { status: 400 },
      );
    }
    passwordHash = isHashed(password) ? password : hashPassword(password);
  }

  let unitCode =
    typeof bodyUnitCode === "string" ? bodyUnitCode.trim() : undefined;
  let roleId =
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
    if (session.hierarchyLevel === "bo") {
      if (unit.level !== "tinh") {
        return NextResponse.json(
          { error: "Cấp Bộ chỉ được gán tài khoản cấp tỉnh / thành phố" },
          { status: 400 },
        );
      }
    } else if (session.hierarchyLevel === "tinh") {
      const allowed = new Set(getUnitDescendants(session.unitCode));
      if (unit.level !== "xa" || !allowed.has(unitCode)) {
        return NextResponse.json(
          { error: "Cấp tỉnh chỉ được gán tài khoản xã / phường thuộc tỉnh mình" },
          { status: 400 },
        );
      }
    } else if (session.hierarchyLevel === "xa") {
      if (unitCode !== session.unitCode) {
        return NextResponse.json(
          { error: "Cấp xã chỉ được gán tài khoản trong xã của bạn" },
          { status: 403 },
        );
      }
    } else {
      const allowed = new Set(getUnitDescendants(session.unitCode));
      if (!allowed.has(unitCode)) {
        return NextResponse.json(
          { error: "Không được gán ngoài phạm vi đơn vị của bạn" },
          { status: 403 },
        );
      }
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
    if (!functionalRole) {
      functionalRole = inferFunctionalRoleFromRoleCode(roleRow.code, roleRow.name);
    }
  }

  const dbOk = await updateUserInDb(
    { id, username: usernameHint },
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
    unitCode || existingMemory?.unitCode || undefined;
  if (typeof editPin === "string" && editPin.trim() && pinUnit) {
    await persistUnitEditPin(pinUnit, editPin.trim());
  }

  const memoryPatch: Record<string, unknown> = { ...rest };
  if (name !== undefined) memoryPatch.name = name;
  if (email !== undefined) memoryPatch.email = email;
  if (phone !== undefined) memoryPatch.phone = phone;
  if (role !== undefined) memoryPatch.role = role;
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!canManageMembers(session)) {
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
