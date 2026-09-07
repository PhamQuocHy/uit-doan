import { NextRequest, NextResponse } from "next/server";
import { db, getUnitDescendants } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getUnitByCode } from "@/lib/hierarchy";
import {
  createUserInDb,
  findUsersFromDb,
  inferFunctionalRoleFromRoleCode,
} from "@/lib/auth-users";
import { ensureMedicalOfficerRole, findRoleById } from "@/lib/roles-db";
import { writeAuditLog } from "@/lib/audit-log";
import { persistUnitEditPin } from "@/lib/unit-pin";
import type { FunctionalRole } from "@/lib/functional-roles";

/** Ai được quản lý thành viên trong phạm vi đơn vị (không chỉ SUPER_ADMIN). */
function canManageMembers(session: {
  role: string;
  hierarchyLevel: string;
  functionalRole?: string;
} | null): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  if (!["bo", "tinh", "xa"].includes(session.hierarchyLevel)) return false;
  // Đơn vị nhận quân không quản lý thành viên hành chính
  if (session.functionalRole === "nhan_quan") return false;
  return true;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let unitCodes: string[] | undefined;
  let levelFilter: string | undefined;
  if (session.hierarchyLevel === "bo") {
    // Bộ: danh sách tài khoản cấp tỉnh (gọn)
    levelFilter = "tinh";
  } else if (session.hierarchyLevel === "tinh") {
    // Tỉnh: tài khoản xã thuộc tỉnh (kể cả xã tự thêm)
    unitCodes = getUnitDescendants(session.unitCode);
    levelFilter = "xa";
  } else if (session.hierarchyLevel === "xa") {
    unitCodes = [session.unitCode];
  } else if (session.hierarchyLevel !== "bo") {
    unitCodes = getUnitDescendants(session.unitCode);
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const search = searchParams.get("search") || undefined;
  const role = searchParams.get("role") || undefined;
  const status = searchParams.get("status") || undefined;

  await ensureMedicalOfficerRole();

  const fromDb = await findUsersFromDb({
    search,
    role,
    status,
    unitCodes,
    levelFilter,
    page,
    limit,
  });
  if (fromDb) {
    return NextResponse.json({ ...fromDb, meta: { source: "mysql" } });
  }

  const result = db.users.findAll({
    search,
    role,
    status,
    page,
    limit,
    unitCodes,
  });
  return NextResponse.json({ ...result, meta: { source: "memory" } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!canManageMembers(session)) {
    return NextResponse.json(
      { error: "Không có quyền thêm thành viên" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const status =
      body.status === "inactive" || body.status === "locked"
        ? body.status
        : "active";
    const unitCode = String(body.unitCode || "").trim();
    const roleId = Number(body.roleId);
    const editPin =
      typeof body.editPin === "string" ? body.editPin.trim() : "";

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "Thiếu tên đăng nhập, mật khẩu hoặc họ tên" },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu phải có ít nhất 6 ký tự" },
        { status: 400 },
      );
    }
    if (!unitCode) {
      return NextResponse.json(
        { error: "Vui lòng chọn đơn vị (Bộ / tỉnh / xã / đơn vị nhận quân)" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn vai trò" },
        { status: 400 },
      );
    }

    const unit = getUnitByCode(unitCode);
    if (!unit) {
      return NextResponse.json(
        { error: "Đơn vị không hợp lệ" },
        { status: 400 },
      );
    }

    // Phân quyền tạo theo cấp: Bộ→tỉnh; Tỉnh→xã; Xã→chỉ xã mình
    if (session.hierarchyLevel === "bo") {
      if (unit.level !== "tinh") {
        return NextResponse.json(
          { error: "Cấp Bộ chỉ được tạo tài khoản cấp tỉnh / thành phố" },
          { status: 400 },
        );
      }
    } else if (session.hierarchyLevel === "tinh") {
      const allowed = new Set(getUnitDescendants(session.unitCode));
      if (unit.level !== "xa" || !allowed.has(unitCode)) {
        return NextResponse.json(
          { error: "Cấp tỉnh chỉ được tạo tài khoản xã / phường thuộc tỉnh mình" },
          { status: 400 },
        );
      }
    } else if (session.hierarchyLevel === "xa") {
      if (unitCode !== session.unitCode) {
        return NextResponse.json(
          { error: "Cấp xã chỉ được tạo tài khoản trong xã của bạn" },
          { status: 403 },
        );
      }
    } else {
      const allowed = new Set(getUnitDescendants(session.unitCode));
      if (!allowed.has(unitCode)) {
        return NextResponse.json(
          { error: "Không được tạo tài khoản ngoài phạm vi đơn vị của bạn" },
          { status: 403 },
        );
      }
    }

    await ensureMedicalOfficerRole();
    const role = await findRoleById(roleId);
    if (!role) {
      return NextResponse.json({ error: "Vai trò không tồn tại" }, { status: 400 });
    }

    const functionalRole: FunctionalRole =
      (body.functionalRole as FunctionalRole) ||
      inferFunctionalRoleFromRoleCode(role.code, role.name);

    const created = await createUserInDb({
      username,
      passwordHash: hashPassword(password),
      name,
      email,
      phone,
      roleId,
      unitCode,
      functionalRole,
      status,
    });

    if (created && "error" in created) {
      return NextResponse.json(
        { error: created.error },
        { status: created.code === "DUPLICATE" ? 409 : 500 },
      );
    }

    if (created) {
      if (editPin && (unit.level === "tinh" || unit.level === "xa")) {
        await persistUnitEditPin(unitCode, editPin);
      }
      await writeAuditLog({
        userId: session.userId,
        actionType: "CREATE",
        targetTable: "users",
        targetId: username,
        dataSnapshot: { unitCode, roleId, functionalRole },
      });
      return NextResponse.json(
        { ...created, editPin: editPin || null },
        { status: 201 },
      );
    }

    // Fallback memory (DB offline)
    const existing = db.users.findByUsername(username);
    if (existing) {
      return NextResponse.json({ error: "Tên đăng nhập đã tồn tại" }, { status: 400 });
    }
    const user = db.users.create({
      username,
      password: hashPassword(password),
      name,
      email: email || "",
      phone,
      role: role.code.toUpperCase().includes("ADMIN") ? "admin" : "user",
      department: unit.name,
      status,
      hierarchyLevel: unit.level,
      unitCode,
      functionalRole,
      editPin: editPin || null,
    });
    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
}
