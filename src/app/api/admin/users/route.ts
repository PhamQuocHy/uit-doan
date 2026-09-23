import { withApiGuard } from "@/lib/security/api-guard";
import { canManageMembers, canManageUser, manageableUnitCodes, isAssignableRole } from "@/lib/user-management";
import { NextRequest, NextResponse } from "next/server";
import { db, hierarchyUnits } from "@/lib/data";
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
import {
  ALL_MILITARY_UNITS,
  isQuanKhuOrBtl,
} from "@/lib/military-regions";

function isMilitaryDonvi(unitCode: string): boolean {
  return ALL_MILITARY_UNITS.some((u) => u.code === unitCode);
}

/** Ai được quản lý thành viên trong phạm vi đơn vị (không chỉ SUPER_ADMIN). */
async function GETHandler(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const search = searchParams.get("search") || undefined;
  const role = searchParams.get("role") || undefined;
  const status = searchParams.get("status") || undefined;

  const unitCodes = manageableUnitCodes(session);
  const levelFilter = undefined;
  await ensureMedicalOfficerRole();

  const fromDb = await findUsersFromDb({
    search,
    role,
    status,
    unitCodes,
    levelFilter,
    managedOnly: true,
    page,
    limit,
  });
  if (fromDb) {
    return NextResponse.json({ ...fromDb, canManage: canManageMembers(session), units: hierarchyUnits.filter(u => unitCodes.includes(u.code)), meta: { source: "mysql" } });
  }

  const result = db.users.findAll({
    search,
    role,
    status,
    page: 1,
    limit: Number.MAX_SAFE_INTEGER,
    unitCodes,
  });
  const visible = result.data.filter(user => canManageUser(session, user));
  return NextResponse.json({ data: visible.slice((page - 1) * limit, page * limit), total: visible.length, page, limit, totalPages: Math.ceil(visible.length / limit), canManage: canManageMembers(session), units: hierarchyUnits.filter(u => unitCodes.includes(u.code)), meta: { source: "memory" } });
}

async function POSTHandler(request: NextRequest) {
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
    if (password.length < 12 || password.length > 256) {
      return NextResponse.json(
        { error: "Mật khẩu phải có từ 12 đến 256 ký tự" },
        { status: 400 },
      );
    }
    if (!unitCode) {
      return NextResponse.json(
        {
          error:
            "Vui lòng chọn đơn vị (tỉnh / quân khu / xã / đơn vị nhận quân)",
        },
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

    // Phân quyền tạo: Bộ→tỉnh hoặc đơn vị quân sự; Tỉnh→xã; Xã→chỉ xã mình
    await ensureMedicalOfficerRole();
    const role = await findRoleById(roleId);
    if (!role) {
      return NextResponse.json({ error: "Vai trò không tồn tại" }, { status: 400 });
    }

    if (isQuanKhuOrBtl(unitCode) && role.code !== "UNIT_OFFICER") return NextResponse.json({ error: "Military region requires UNIT_OFFICER" }, { status: 403 });

    let functionalRole: FunctionalRole =
      (body.functionalRole as FunctionalRole) ||
      inferFunctionalRoleFromRoleCode(role.code, role.name);

    // Đơn vị quân sự (QK / sư đoàn…) luôn là nhận quân — không gắn tỉnh
    if (unit.level === "donvi" && isMilitaryDonvi(unitCode)) {
      functionalRole = isQuanKhuOrBtl(unitCode) ? "tuyen_quan" : "nhan_quan";
    }

    if (!isAssignableRole(role.code) || !canManageUser(session!, { unitCode, hierarchyLevel: unit.level, functionalRole })) {
      return NextResponse.json({ error: "Forbidden: target must be a subordinate within your scope" }, { status: 403 });
    }

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
        userId: session!.userId,
        actionType: "CREATE",
        targetTable: "users",
        targetId: username,
        dataSnapshot: {
          unitCode,
          roleId,
          functionalRole,
          isQuanKhu: isQuanKhuOrBtl(unitCode),
        },
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

export const GET = withApiGuard(GETHandler);
export const POST = withApiGuard(POSTHandler);
