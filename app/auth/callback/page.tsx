'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get('next') ?? '/';
    const hash = window.location.hash;

    if (hash) {
      const hp = new URLSearchParams(hash.slice(1));
      const accessToken = hp.get('access_token');
      const refreshToken = hp.get('refresh_token');
      const errorCode = hp.get('error_code');

      if (errorCode) {
        router.replace(`/login?error=${errorCode}`);
        return;
      }

      if (accessToken && refreshToken) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            router.replace(error ? '/login?error=lien_invalide' : next);
          });
        return;
      }
    }

    // PKCE fallback : code dans la query string
    const code = searchParams.get('code');
    if (code) {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          router.replace(error ? '/login?error=lien_invalide' : next);
        });
      return;
    }

    router.replace('/login?error=lien_invalide');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm animate-pulse">Connexion en cours…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Connexion…</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
