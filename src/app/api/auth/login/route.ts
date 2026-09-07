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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, unitCode, functionalRole } = body;

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
      if (!user) {
        return NextResponse.json(
          {
            error:
              "Tài khoản không tồn tại trong database. Kiểm tra bảng users (username / password_hash).",
          },
          { status: 401 },
        );
      }
    } else {
      user = fromMemory(username);
      authSource = "memory";
    }

    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json(
        {
          error:
            authSource === "mysql"
              ? "Tên đăng nhập hoặc mật khẩu không đúng"
              : "Tên đăng nhập hoặc mật khẩu không đúng (MySQL offline — đang dùng demo in-memory)",
        },
        { status: 401 },
      );
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
    console.error("Login error:", error);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
