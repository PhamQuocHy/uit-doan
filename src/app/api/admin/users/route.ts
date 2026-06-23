import { NextRequest, NextResponse } from 'next/server';
import { db, getUnitDescendants } from '@/lib/data';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let unitCodes: string[] | undefined = undefined;
  if (session.hierarchyLevel !== 'bo') {
    unitCodes = getUnitDescendants(session.unitCode);
  }

  const { searchParams } = new URL(request.url);
  const result = db.users.findAll({
    search: searchParams.get('search') || undefined,
    role: searchParams.get('role') || undefined,
    status: searchParams.get('status') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '10'),
    unitCodes,
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { username, password, name, email, phone, role, department, status } = body;

  if (!username || !password || !name || !email) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
  }

  // Check duplicate username
  const existing = db.users.findByUsername(username);
  if (existing) {
    return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 400 });
  }

  const user = db.users.create({ 
    username, 
    password, 
    name, 
    email, 
    phone: phone || '', 
    role: role || 'user', 
    department: department || '', 
    status: status || 'active',
    hierarchyLevel: session.hierarchyLevel,
    unitCode: session.unitCode,
  } as any);
  return NextResponse.json(user, { status: 201 });
}
