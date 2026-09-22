import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';
import { consumeLimit, isSameOrigin, opaqueKey, securityEvent } from '@/lib/security/controls';

const publicRoutes = [
  '/login',
  '/api/auth/login',
  '/tra-cuu',
  '/api/public/tra-cuu',
  '/mobile',
  '/api/mobile/session/connect',
  '/api/mobile/session/disconnect',
  '/api/mobile/session/status',
  '/api/mobile/scan-id',
  '/api/mobile/scan-result',
  '/api/mobile/ocr',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (!isSameOrigin(request)) {
      securityEvent('csrf_rejected', { status: 403 });
      return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ' }, { status: 403 });
    }
    const length = Number(request.headers.get('content-length') || 0);
    if (!Number.isFinite(length) || length < 0 || length > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'Dữ liệu quá lớn' }, { status: 413 });
    }
    const limited = ['/api/auth/login', '/api/public/tra-cuu', '/api/mobile/session/connect', '/api/admin/nvqs/verify-pin'];
    if (limited.includes(pathname)) {
      const ip = process.env.TRUST_PROXY === 'true' ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'shared' : 'shared';
      const retry = consumeLimit(`${pathname}:${opaqueKey(ip)}`, pathname === '/api/auth/login' ? 60 : 30, 60000);
      if (retry) {
        securityEvent('request_rate_limited', { status: 429 });
        return NextResponse.json({ error: 'Quá nhiều yêu cầu' }, { status: 429, headers: { 'Retry-After': String(retry) } });
      }
    }
  }

  // Allow public routes
  if (publicRoutes.some((r) => pathname === r || (!r.startsWith('/api/') && pathname.startsWith(r + '/')))) {
    // If already logged in, redirect to admin
    if (pathname === '/login') {
      const cookie = request.cookies.get('session')?.value;
      const session = await decrypt(cookie);
      if (session) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    }
    return NextResponse.next();
  }

  // Redirect root to admin or login
  if (pathname === '/') {
    const cookie = request.cookies.get('session')?.value;
    const session = await decrypt(cookie);
    return NextResponse.redirect(
      new URL(session ? '/admin' : '/login', request.url)
    );
  }

  // Protect /admin/* routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin') || pathname.startsWith('/uploads/')) {
    const cookie = request.cookies.get('session')?.value;
    const session = await decrypt(cookie);
    if (!session) {
      if (pathname.startsWith('/api/') || pathname.startsWith('/uploads/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/uploads/:path*', '/', '/login'],
};
