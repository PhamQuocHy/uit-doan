import { NextResponse } from 'next/server';
import { hierarchyUnits } from '@/lib/data';

export async function GET() {
  return NextResponse.json(hierarchyUnits);
}
