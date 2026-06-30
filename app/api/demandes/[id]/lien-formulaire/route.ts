import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

const BASE = () => process.env.NEXT_PUBLIC_BASE_URL ?? '';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const [{ data: demande, error }, { data: journal }] = await Promise.all([
    supabase
      .from('demandes')
      .select('formulaire_public_ouvert_le, formulaire_public_rempli_le, date_limite_depot')
      .eq('id', id)
      .single(),
    supabase
      .from('journal')
      .select('detail, created_at')
      .eq('demande_id', id)
      .eq('evenement', 'lien_formulaire_envoye')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const dernierEnvoi = journal?.[0] ?? null;

  return NextResponse.json({
    ouvert_le: demande.formulaire_public_ouvert_le ?? null,
    rempli_le: demande.formulaire_public_rempli_le ?? null,
    date_limite_depot: demande.date_limite_depot ?? null,
    dernier_envoi: dernierEnvoi
      ? { email: dernierEnvoi.detail, envoye_le: dernierEnvoi.created_at }
      : null,
    historique: (journal ?? []).map((j) => ({ email: j.detail, envoye_le: j.created_at })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let email: string | undefined;
  try {
    const body = await req.json();
    email = body.email?.trim();
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email requis.' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Vérifie que la demande existe
  const { error: demandeErr } = await supabase
    .from('demandes')
    .select('id')
    .eq('id', id)
    .single();
  if (demandeErr) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });

  // Génère le magic link via l'API admin Supabase
  const redirectTo = `${BASE()}/api/auth/callback?next=/formulaire/${id}`;
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkErr?.message ?? 'Impossible de générer le lien.' },
      { status: 500 }
    );
  }

  const url = linkData.properties.action_link;

  // Journal
  await supabase.from('journal').insert({
    demande_id: id,
    evenement: 'lien_formulaire_envoye',
    detail: email,
  });

  return NextResponse.json({ url, sent_to: email, genere_le: new Date().toISOString() });
}
