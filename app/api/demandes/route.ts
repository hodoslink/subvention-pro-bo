import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getProfileFromRequest } from '@/lib/supabase-route-handler';
import { randomUUID } from 'crypto';
import { demandeSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asso = searchParams.get('association_id');
  const statut = searchParams.get('statut');
  const annee = searchParams.get('annee');
  const presta = searchParams.get('presta');
  const q = searchParams.get('q');

  const profile = await getProfileFromRequest(req);

  const supabase = getSupabaseServer();
  let query = supabase
    .from('demandes')
    .select('*, associations(id, nom, ville, contact_email)')
    .order('created_at', { ascending: false });

  // Consultants ne voient que leurs propres demandes
  if (profile && profile.role === 'consultant') {
    query = query.eq('consultant_id', profile.id);
  }

  if (asso) query = query.eq('association_id', asso);
  if (statut) query = query.eq('statut', statut);
  if (presta) query = query.eq('presta_redacteur', presta);
  if (annee) {
    query = query
      .gte('created_at', `${annee}-01-01`)
      .lte('created_at', `${annee}-12-31`);
  }
  if (q) {
    query = query.or(
      `titre_projet.ilike.%${q}%,bailleur_nom.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demandes: data });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = demandeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const { pluriannuel_nb_annees, ...base } = parsed.data;
  const supabase = getSupabaseServer();

  // ── Cas pluriannuel : créer N demandes chaînées ────────────────────────────
  if (pluriannuel_nb_annees && pluriannuel_nb_annees >= 2) {
    const groupeId = randomUUID();
    const premierMillesime = base.annee_millesime ?? new Date().getFullYear();

    const demandes: string[] = [];
    let precedenteId: string | null = null;

    for (let i = 0; i < pluriannuel_nb_annees; i++) {
      const row: Record<string, unknown> = {
        association_id: base.association_id,
        type_demande: i === 0 ? base.type_demande : 'renouvellement' as const,
        bailleur_type: base.bailleur_type ?? null,
        bailleur_nom: base.bailleur_nom ?? null,
        bailleur_id: base.bailleur_id ?? null,
        titre_projet: base.titre_projet ?? null,
        objectif_projet: base.objectif_projet ?? null,
        public_beneficiaire: base.public_beneficiaire ?? null,
        nb_beneficiaires_estime: base.nb_beneficiaires_estime ?? null,
        // Montant laissé null — à saisir indépendamment par année (Cerfa prévoit montants différents)
        montant_demande: null,
        budget_previsionnel_json: base.budget_previsionnel_json ?? null,
        annee_millesime: premierMillesime + i,
        statut: 'collecte' as const,
        groupe_pluriannuel_id: groupeId,
        numero_annee_dans_groupe: i + 1,
        nombre_annees_total_groupe: pluriannuel_nb_annees,
        demande_precedente_id: precedenteId,
      };

      const { data: inserted, error } = await supabase
        .from('demandes')
        .insert(row)
        .select('id')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      precedenteId = (inserted as { id: string }).id;
      demandes.push(precedenteId);
    }

    return NextResponse.json({ demande: { id: demandes[0] }, groupe_ids: demandes }, { status: 201 });
  }

  // ── Cas standard : une seule demande ──────────────────────────────────────
  const { data, error } = await supabase
    .from('demandes')
    .insert({
      ...base,
      statut: 'collecte',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demande: data }, { status: 201 });
}
