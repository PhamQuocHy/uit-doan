import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/data';
import { createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, unitCode } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập tên đăng nhập và mật khẩu' },
        { status: 400 }
      );
    }

    const user = db.users.findByUsername(username);
    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: 'Tên đăng nhập hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'Tài khoản đã bị vô hiệu hóa' },
        { status: 403 }
      );
    }

    if (unitCode && user.unitCode !== unitCode) {
      return NextResponse.json(
        { error: 'Tài khoản không thuộc cấp/đơn vị bạn đã chọn. Vui lòng kiểm tra lại.' },
        { status: 403 }
      );
    }

    await createSession({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      hierarchyLevel: user.hierarchyLevel,
      unitCode: user.unitCode,
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role, name: user.name, hierarchyLevel: user.hierarchyLevel, unitCode: user.unitCode },
    });
  } catch {
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
