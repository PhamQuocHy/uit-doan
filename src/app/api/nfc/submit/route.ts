import { NextResponse } from 'next/server';
import { db } from '@/lib/data';

// Simplified type for NFC session result
type NfcSession = {
  sessionId: string;
  code: string;
  createdAt: number;
  status: 'waiting' | 'connected' | 'completed';
  result?: {
    found: boolean;
    citizen?: Record<string, string>;
    prefill?: Record<string, string>;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var nfcSessions: Map<string, NfcSession> | undefined;
}
global.nfcSessions = global.nfcSessions ?? new Map();

// POST /api/nfc/submit – Mobile submits NFC data
export async function POST(req: Request) {
  const { code, nfcData } = await req.json() as {
    code: string;
    nfcData: {
      cccd?: string;
      fullName?: string;
      dateOfBirth?: string;
      gender?: string;
      address?: string;
    };
  };

  const sessions = global.nfcSessions!;
  const session = sessions.get((code as string).toUpperCase());
  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  // Look up citizen by CCCD
  const cccd = nfcData?.cccd ?? '';
  const allResult = db.citizens.findAll({});
  // findAll returns { data: Citizen[], total, page, limit } or Citizen[]
  const rawList = Array.isArray(allResult) ? allResult : (allResult as { data: unknown[] }).data ?? [];
  const existing = rawList.find(
    (c) => (c as { cccd: string }).cccd === cccd
  ) as Record<string, string> | undefined;

  if (existing) {
    session.status = 'completed';
    session.result = {
      found: true,
      citizen: {
        id: String(existing.id ?? ''),
        fullName: String(existing.fullName ?? ''),
        cccd: String(existing.cccd ?? ''),
        dateOfBirth: String(existing.dateOfBirth ?? ''),
        address: String(existing.address ?? ''),
        militaryStatus: String(existing.militaryStatus ?? ''),
      },
    };
  } else {
    // Pre-fill data from NFC chip
    session.status = 'completed';
    session.result = {
      found: false,
      prefill: {
        fullName: nfcData.fullName ?? '',
        cccd,
        dateOfBirth: nfcData.dateOfBirth ?? '',
        gender: nfcData.gender ?? 'male',
        address: nfcData.address ?? '',
      },
    };
  }

  return NextResponse.json({ ok: true, found: !!existing });
}
