import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = process.env.JWT_SECRET || 'ymsa-secret-key-2024-very-secure';
const ENCODED_KEY = new TextEncoder().encode(SECRET_KEY);

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  name: string;
  hierarchyLevel: string;
  unitCode: string;
  expiresAt: Date;
}

export async function encrypt(payload: Omit<SessionPayload, 'expiresAt'> & { expiresAt: string | Date }) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(ENCODED_KEY);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, ENCODED_KEY, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(user: { id: string; username: string; role: 'admin' | 'user'; name: string; hierarchyLevel: string; unitCode: string }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await encrypt({
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    hierarchyLevel: user.hierarchyLevel,
    unitCode: user.unitCode,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('session')?.value;
  return await decrypt(cookie);
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
