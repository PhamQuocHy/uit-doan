import { withApiGuard } from "@/lib/security/api-guard";
import { NextResponse } from 'next/server';
import { hierarchyUnits } from '@/lib/data';

async function GETHandler() {
  return NextResponse.json(hierarchyUnits);
}

export const GET = withApiGuard(GETHandler);
