import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || secret === 'ymsa-secret-key-2024-very-secure' || secret.startsWith('REPLACE_')) {
    throw new Error('JWT_SECRET must be a unique random secret of at least 32 bytes');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  name: string;
  hierarchyLevel: string;
  unitCode: string;
  functionalRole: string;
  expiresAt: Date;
}

export async function encrypt(payload: Omit<SessionPayload, 'expiresAt'> & { expiresAt: string | Date }) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('nvqs').setAudience('nvqs-web').setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(signingKey());
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, signingKey(), {
      issuer: 'nvqs', audience: 'nvqs-web', requiredClaims: ['exp', 'iat', 'jti'],
      algorithms: ['HS256'],
    });
    if (typeof payload.userId !== 'string' || typeof payload.username !== 'string' ||
        !['admin', 'user'].includes(String(payload.role)) || typeof payload.unitCode !== 'string' ||
        typeof payload.hierarchyLevel !== 'string') return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(user: { id: string; username: string; role: 'admin' | 'user'; name: string; hierarchyLevel: string; unitCode: string; functionalRole?: string }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await encrypt({
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    hierarchyLevel: user.hierarchyLevel,
    unitCode: user.unitCode,
    functionalRole: user.functionalRole || 'tuyen_quan',
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
  const session = await decrypt(cookie);
  if (!session) return null;
  // Resolve current status and permissions on every server-side request.
  const { findUserByIdFromDb } = await import('@/lib/auth-users');
  const user = await findUserByIdFromDb(session.userId);
  if (!user) return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_AUTH === 'true' ? session : null;
  if (user.status !== 'active') return null;
  return { ...session, role: user.role, hierarchyLevel: user.hierarchyLevel, unitCode: user.unitCode,
    functionalRole: user.role === 'admin' ? session.functionalRole : user.functionalRole };
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
