import { NextResponse } from 'next/server';

// In-memory store for NFC sessions (in production, use Redis or DB)
// Map: code -> { sessionId, code, createdAt, result?, status }
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

// Singleton in-memory store (works for single-server dev)
declare global {
  // eslint-disable-next-line no-var
  var nfcSessions: Map<string, NfcSession> | undefined;
}
global.nfcSessions = global.nfcSessions ?? new Map();
const sessions = global.nfcSessions;

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/nfc/session – Create a new session
export async function POST() {
  // Clean up expired sessions (>5 min)
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (now - s.createdAt > 5 * 60 * 1000) sessions.delete(key);
  }

  let code = generateCode();
  while (sessions.has(code)) code = generateCode();

  const session: NfcSession = {
    sessionId: crypto.randomUUID(),
    code,
    createdAt: now,
    status: 'waiting',
  };
  sessions.set(code, session);

  return NextResponse.json({ code, sessionId: session.sessionId });
}

// GET /api/nfc/session?code=XXXXXX – Poll session status
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

  const session = sessions.get(code.toUpperCase());
  if (!session) return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });

  return NextResponse.json({
    code: session.code,
    status: session.status,
    result: session.result ?? null,
  });
}

// PATCH /api/nfc/session – Mobile connects to session (marks as connected)
export async function PATCH(req: Request) {
  const { code } = await req.json();
  const session = sessions.get((code as string).toUpperCase());
  if (!session) return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  session.status = 'connected';
  return NextResponse.json({ ok: true });
}
