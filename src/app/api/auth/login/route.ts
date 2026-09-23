import { withApiGuard } from "@/lib/security/api-guard";
import { consumeLimit, opaqueKey, readJson, validLogin, InputError, securityEvent } from "@/lib/security/controls";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/data";
import { createSession } from "@/lib/auth";
import {
  findUserByUsernameFromDb,
  isHashed,
  touchLastLogin,
  upgradePasswordHash,
  verifyPassword,
  type AuthUser,
} from "@/lib/auth-users";
import { pingDb } from "@/lib/db";
import type { FunctionalRole } from "@/lib/functional-roles";
import { writeAuditLog } from "@/lib/audit-log";

function fromMemory(username: string): AuthUser | null {
  const user = db.users.findByUsername(username);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    password: user.password,
    name: user.name,
    role: user.role,
    hierarchyLevel: user.hierarchyLevel,
    unitCode: user.unitCode,
    functionalRole: user.functionalRole,
    status: user.status,
  };
}

async function POSTHandler(request: NextRequest) {
  try {
    const body = await readJson(request, 4096);
    if (!validLogin(body)) throw new InputError("Thông tin đăng nhập không hợp lệ");
    const { username, password, unitCode, functionalRole } = body as { username: string; password: string; unitCode?: string; functionalRole?: string };
    const actor = opaqueKey(username.trim().toLowerCase());
    const retry = consumeLimit(`login:${actor}`, 10, 15 * 60 * 1000);
    if (retry) {
      securityEvent("login_rate_limited", { actor, status: 429 });
      return NextResponse.json({ error: "Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(retry) } });
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên đăng nhập và mật khẩu" },
        { status: 400 },
      );
    }

    const dbOnline = await pingDb();
    let user: AuthUser | null = null;
    let authSource: "mysql" | "memory" = "memory";

    if (dbOnline) {
      // DB đang chạy → chỉ xác thực qua MySQL (không còn fallback 123)
      user = await findUserByUsernameFromDb(username);
      authSource = "mysql";
    } else if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_AUTH === "true") {
      user = fromMemory(username);
    } else {
      securityEvent("auth_backend_unavailable", { status: 503 });
      return NextResponse.json({ error: "Hệ thống xác thực tạm thời không khả dụng" }, { status: 503 });
    }

    if (!user || !verifyPassword(password, user.password)) {
      securityEvent("login_failed", { actor, status: 401 });
      return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" }, { status: 401 });
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { error: "Tài khoản đã bị vô hiệu hóa" },
        { status: 403 },
      );
    }

    if (unitCode && user.unitCode !== unitCode) {
      return NextResponse.json(
        {
          error:
            "Tài khoản không thuộc cấp/đơn vị bạn đã chọn. Vui lòng kiểm tra lại.",
        },
        { status: 403 },
      );
    }

    const selectedRole = (functionalRole || "tuyen_quan") as FunctionalRole;
    if (
      user.role !== "admin" &&
      user.functionalRole &&
      user.functionalRole !== selectedRole
    ) {
      return NextResponse.json(
        {
          error:
            "Tài khoản không có quyền chức năng bạn đã chọn. Vui lòng chọn đúng mục Tuyển quân / Nhận quân / Y tế.",
        },
        { status: 403 },
      );
    }

    await createSession({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      hierarchyLevel: user.hierarchyLevel,
      unitCode: user.unitCode,
      functionalRole: selectedRole,
    });

    if (authSource === "mysql") {
      // Tự nâng cấp mật khẩu plaintext cũ lên scrypt hash ngay khi khớp
      if (!isHashed(user.password)) {
        await upgradePasswordHash(user.id, password);
      }
      await touchLastLogin(user.id);
      const forwarded = request.headers.get("x-forwarded-for");
      await writeAuditLog({
        userId: user.id,
        actionType: "LOGIN",
        targetTable: "users",
        targetId: user.id,
        dataSnapshot: { username: user.username },
        ipAddress: forwarded?.split(",")[0]?.trim() || null,
      });
    }

    securityEvent("login_succeeded", { actor, status: 200 });
    return NextResponse.json({
      success: true,
      authSource,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        hierarchyLevel: user.hierarchyLevel,
        unitCode: user.unitCode,
        functionalRole: selectedRole,
      },
    });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
    securityEvent("login_error", { status: 500 });
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export const POST = withApiGuard(POSTHandler);
