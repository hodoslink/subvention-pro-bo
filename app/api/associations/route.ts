import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { associationSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  const supabase = getSupabaseServer();
  let query = supabase
    .from('associations')
    .select('id, nom, ville, contact_email, statut_profil, created_at')
    .order('nom');

  if (q) query = query.ilike('nom', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ associations: data });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = associationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const supabase = getSupabaseServer();
  const data = parsed.data;
  const siret = data.siret || null;

  if (siret) {
    const { data: existing, error: findErr } = await supabase
      .from('associations')
      .select('id')
      .eq('siret', siret)
      .maybeSingle();

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });

    if (existing) {
      const { data: updated, error: updErr } = await supabase
        .from('associations')
        .update(data)
        .eq('id', existing.id)
        .select()
        .single();
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ association: updated, existante: true }, { status: 200 });
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('associations')
    .insert(data)
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ association: inserted, existante: false }, { status: 201 });
}
