import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/data';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const result = db.departments.findAll({
    search: searchParams.get('search') || undefined,
    status: searchParams.get('status') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '10'),
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { name, code, description, headName, memberCount, status } = body;

  if (!name || !code) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
  }

  const dept = db.departments.create({
    name,
    code,
    description: description || '',
    headName: headName || '',
    memberCount: memberCount || 0,
    status: status || 'active',
  });
  return NextResponse.json(dept, { status: 201 });
}
