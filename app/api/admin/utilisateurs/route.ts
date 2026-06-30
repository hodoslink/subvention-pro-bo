import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getProfileFromRequest } from '@/lib/supabase-route-handler';

async function requireAdmin(req: NextRequest) {
  const profile = await getProfileFromRequest(req);
  if (!profile || profile.role !== 'admin') return null;
  return profile;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom_complet, role, created_at')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ utilisateurs: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  let body: { email?: string; role?: string; nom_complet?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const { email, role = 'consultant', nom_complet = '' } = body;
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }
  if (!['admin', 'consultant'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role, nom_complet },
    redirectTo: `${base}/api/auth/callback?next=/`,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pré-remplir le profil si le trigger ne l'a pas encore créé
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      role: role as 'admin' | 'consultant',
      nom_complet,
    }, { onConflict: 'id' });
  }

  return NextResponse.json({ ok: true, email });
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  let body: { id?: string; role?: string; nom_complet?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const { id, role, nom_complet } = body;
  if (!id) return NextResponse.json({ error: 'ID requis.' }, { status: 400 });
  if (role && !['admin', 'consultant'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (role) patch.role = role;
  if (nom_complet !== undefined) patch.nom_complet = nom_complet;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
