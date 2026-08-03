import { NextRequest, NextResponse } from 'next/server';
import { db, getChildUnits } from '@/lib/data';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const quotas = db.quotas.findForUnit(session.unitCode, session.hierarchyLevel);
  // Also attach available child units so the client can build the dropdown
  const children = getChildUnits(session.unitCode);

  return NextResponse.json({ data: quotas, childUnits: children });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 'xa' level cannot assign quotas down (no children)
  if (session.hierarchyLevel === 'xa') {
    return NextResponse.json({ error: 'Cấp xã không thể giao chỉ tiêu' }, { status: 403 });
  }

  const body = await request.json();
  const { toUnit, toUnitName, amount, year, note } = body;

  if (!toUnit || !toUnitName || !amount) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
  }

  // Verify the target is a direct child of the caller
  const children = getChildUnits(session.unitCode);
  const validChild = children.find((c) => c.code === toUnit);
  if (!validChild) {
    return NextResponse.json({ error: 'Đơn vị không hợp lệ hoặc không thuộc quyền quản lý' }, { status: 400 });
  }

  const levelMap: Record<string, string> = { bo: 'tinh', tinh: 'xa' };

  const quota = db.quotas.create({
    year: year || new Date().getFullYear(),
    fromLevel: session.hierarchyLevel as 'bo' | 'tinh' | 'xa',
    fromUnit: session.unitCode,
    toLevel: levelMap[session.hierarchyLevel] as 'bo' | 'tinh' | 'xa',
    toUnit,
    toUnitName,
    amount: Number(amount),
    filled: 0,
    note: note || '',
  });

  return NextResponse.json({ data: quota }, { status: 201 });
}
