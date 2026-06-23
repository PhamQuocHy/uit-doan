import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';

const publicRoutes = ['/login', '/api/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
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
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const cookie = request.cookies.get('session')?.value;
    const session = await decrypt(cookie);
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
