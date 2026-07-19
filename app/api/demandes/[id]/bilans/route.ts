import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const createSchema = z.object({
  type: z.enum(['intermediaire', 'final']),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('bilans')
    .select('*')
    .eq('demande_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bilans: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { type, date_debut, date_fin } = parsed.data;

  if (type === 'final') {
    const { data: existing } = await supabase
      .from('bilans')
      .select('id')
      .eq('demande_id', id)
      .eq('type', 'final')
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: 'Un bilan final existe déjà pour cette demande.' },
        { status: 409 }
      );
    }
  }

  let numero_ordre = 1;
  if (type === 'intermediaire') {
    const { count } = await supabase
      .from('bilans')
      .select('id', { count: 'exact', head: true })
      .eq('demande_id', id)
      .eq('type', 'intermediaire');
    numero_ordre = (count ?? 0) + 1;
  }

  const { data: bilan, error: bilanErr } = await supabase
    .from('bilans')
    .insert({ demande_id: id, type, numero_ordre, date_debut, date_fin })
    .select()
    .single();

  if (bilanErr || !bilan) {
    return NextResponse.json({ error: bilanErr?.message ?? 'Erreur création' }, { status: 500 });
  }

  const { data: lignes } = await supabase
    .from('budget_lignes')
    .select('id, sens, compte, sous_categorie, bailleur_detail, montant, est_charge_commune, cle_repartition, est_valorisation_benevolat, piece_justificative_url')
    .eq('demande_id', id);

  if (lignes && lignes.length > 0) {
    const snapshot = lignes.map(l => ({
      bilan_id: bilan.id,
      budget_ligne_id: l.id,
      sens: l.sens,
      compte: l.compte,
      sous_categorie: l.sous_categorie ?? null,
      bailleur_detail: l.bailleur_detail ?? null,
      montant_prevu: l.montant,
      montant_reel: null,
      commentaire_ecart: null,
      est_charge_commune: l.est_charge_commune ?? false,
      cle_repartition: l.cle_repartition ?? null,
      est_valorisation_benevolat: l.est_valorisation_benevolat ?? false,
      piece_justificative_url: l.piece_justificative_url ?? null,
    }));
    await supabase.from('bilan_lignes').insert(snapshot);
  }

  const { data: demande } = await supabase
    .from('demandes')
    .select('details_json')
    .eq('id', id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicateursTexte = (demande?.details_json as any)?.indicateurs_evaluation as string | undefined;
  if (indicateursTexte?.trim()) {
    const lignesIndicateurs = indicateursTexte
      .split('\n')
      .map((l: string) => l.replace(/^[•\-*]\s*/, '').trim())
      .filter((l: string) => l.length > 2);

    if (lignesIndicateurs.length > 0) {
      await supabase.from('bilan_indicateurs').insert(
        lignesIndicateurs.map((ind: string) => ({
          bilan_id: bilan.id,
          indicateur: ind,
        }))
      );
    }
  }

  await supabase.from('journal').insert({
    demande_id: id,
    evenement: 'bilan_cree',
    detail: `Bilan ${type === 'final' ? 'final' : `intermédiaire n°${numero_ordre}`} créé (${date_debut} → ${date_fin})`,
  });

  return NextResponse.json({ bilan }, { status: 201 });
}
