import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-route-handler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Configuration serveur manquante (variables Supabase).' }, { status: 503 });
    }

    const response = NextResponse.json({ ok: true });
    const supabase = createRouteHandlerClient(request, response);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: error?.message ?? 'Session nulle.' }, { status: 401 });
    }

    return response;
  } catch (err) {
    console.error('[login] Erreur inattendue:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
