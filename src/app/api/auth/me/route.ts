import { withApiGuard } from "@/lib/security/api-guard";
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUnitByCode } from '@/lib/hierarchy';

async function GETHandler() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const unit = getUnitByCode(session.unitCode);
  return NextResponse.json({
    user: {
      ...session,
      unitName: unit?.name || session.unitCode,
    },
  });
}

export const GET = withApiGuard(GETHandler);
