// Client Supabase qui lit la session depuis les cookies Next.js.
// À utiliser dans : Server Components et Server Actions uniquement.
// Pour les Route Handlers, utiliser lib/supabase-route-handler.ts

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export function createSupabaseServerClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          // Dans un Server Component en lecture seule, setAll peut lever une
          // exception — on l'ignore silencieusement (le middleware s'en charge).
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function getCurrentProfile() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, nom_complet')
    .eq('id', user.id)
    .single();
  return profile ?? null;
}

