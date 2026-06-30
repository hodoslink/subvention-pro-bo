import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { randomBytes } from 'crypto';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('demandes')
    .select('token_formulaire_public, token_formulaire_genere_le, formulaire_public_ouvert_le, formulaire_public_rempli_le, date_limite_depot')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const url = data.token_formulaire_public
    ? `${base}/formulaire/${id}?t=${data.token_formulaire_public}`
    : null;

  return NextResponse.json({
    url,
    token_genere_le: data.token_formulaire_genere_le ?? null,
    ouvert_le: data.formulaire_public_ouvert_le ?? null,
    rempli_le: data.formulaire_public_rempli_le ?? null,
    date_limite_depot: data.date_limite_depot ?? null,
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const token = randomBytes(24).toString('hex');
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('demandes')
    .update({
      token_formulaire_public: token,
      token_formulaire_genere_le: now,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const url = `${base}/formulaire/${id}?t=${token}`;

  await supabase.from('journal').insert({
    demande_id: id,
    evenement: 'lien_formulaire_genere',
    detail: 'Lien formulaire public généré / régénéré',
  });

  return NextResponse.json({ url, token_genere_le: now });
}
