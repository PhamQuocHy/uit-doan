import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/data';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const dept = db.departments.findById(id);
  if (!dept) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
  return NextResponse.json(dept);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const updated = db.departments.update(id, body);
  if (!updated) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const deleted = db.departments.delete(id);
  if (!deleted) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
  return NextResponse.json({ success: true });
}
