// Utilitaires Supabase Auth pour les Route Handlers (app/api/**).
// N'importe PAS next/headers — lit/écrit les cookies depuis NextRequest/NextResponse.
// Pour les Server Components, utiliser lib/supabase-server.ts

import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

// Client pour les routes qui ont besoin d'ÉCRIRE des cookies (login, logout, callback).
// Appelez-le AVANT de créer la réponse si la réponse est une redirection,
// ou créez la réponse en premier et passez-la pour que les cookies soient posés dessus.
export function createRouteHandlerClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}

// Client en lecture seule — pour identifier l'utilisateur sans avoir à écrire des cookies.
export async function getProfileFromRequest(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, nom_complet')
    .eq('id', user.id)
    .single();
  return profile ?? null;
}
