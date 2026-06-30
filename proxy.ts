import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from '@/lib/supabase-middleware';

const PUBLIC_PATHS = [
  '/login',
  '/formulaire',
  '/api/auth',
  '/api/public',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[proxy] Supabase env vars manquantes — accès laissé ouvert.');
    return NextResponse.next();
  }

  try {
    const response = NextResponse.next({ request: { headers: request.headers } });
    const supabase = createSupabaseMiddlewareClient(request, response);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch (err) {
    console.error('[proxy] Erreur lors de la vérification de session :', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
