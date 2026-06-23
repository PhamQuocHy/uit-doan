import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/data';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const docs = db.documents.findForUnit(session.unitCode, session.hierarchyLevel);
  return NextResponse.json({ data: docs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, content, toUnits, urgent, type } = body;

  if (!title || !toUnits?.length) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
  }

  const now = new Date().toISOString().slice(0, 10);
  const count = db.documents.findAll().length + 1;
  const code = `${type === 'outgoing' ? 'CV' : 'BC'}-${new Date().getFullYear()}/${String(count).padStart(3, '0')}`;

  const doc = db.documents.create({
    code,
    title,
    content: content || '',
    type: type || 'outgoing',
    fromUnit: session.unitCode,
    toUnits,
    date: now,
    status: 'sent',
    urgent: !!urgent,
    createdBy: session.userId,
  });

  return NextResponse.json({ data: doc }, { status: 201 });
}
