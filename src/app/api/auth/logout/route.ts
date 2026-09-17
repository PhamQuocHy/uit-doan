import { withApiGuard } from "@/lib/security/api-guard";
import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';

async function POSTHandler() {
  await deleteSession();
  return NextResponse.json({ success: true });
}

export const POST = withApiGuard(POSTHandler);
