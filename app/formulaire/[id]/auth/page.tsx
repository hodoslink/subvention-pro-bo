'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

function FormulaireAuthHandler() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (!id) return;

    const hash = window.location.hash;
    if (!hash) {
      // Pas de tokens — rediriger vers la page principale pour afficher l'erreur
      router.replace(`/formulaire/${id}`);
      return;
    }

    const hp = new URLSearchParams(hash.slice(1));
    const accessToken = hp.get('access_token');
    const refreshToken = hp.get('refresh_token');
    const errorCode = hp.get('error_code');

    if (errorCode) {
      router.replace(`/formulaire/${id}?error=${errorCode}`);
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
          if (error) {
            router.replace(`/formulaire/${id}?error=lien_invalide`);
          } else {
            window.history.replaceState(null, '', window.location.pathname);
            router.replace(`/formulaire/${id}`);
          }
        });
      return;
    }

    router.replace(`/formulaire/${id}`);
  }, [id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm animate-pulse">Connexion en cours…</p>
    </div>
  );
}

export default function FormulaireAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Connexion…</p>
      </div>
    }>
      <FormulaireAuthHandler />
    </Suspense>
  );
}
