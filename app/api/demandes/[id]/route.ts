import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getProfileFromRequest } from '@/lib/supabase-route-handler';
import { syncBudgetAutoLignes } from '@/lib/budgetSync';
import { z } from 'zod';

const patchSchema = z.object({
  statut: z.enum([
    'collecte', 'redaction', 'controle_compta', 'depose', 'decision_attente',
    'accepte', 'convention_signee', 'en_execution', 'bilan_final_soumis', 'clos', 'refuse',
  ]).optional(),
  presta_redacteur: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  date_depot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_decision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  montant_obtenu: z.number().min(0).max(10_000_000).optional().nullable(),
  // Champs projet
  titre_projet: z.string().max(500).optional().nullable(),
  bailleur_nom: z.string().max(300).optional().nullable(),
  bailleur_type: z.enum(['etat', 'commune', 'epci', 'departement', 'region', 'etablissement_public', 'prive', 'autre']).optional().nullable(),
  montant_demande: z.number().min(0).max(10_000_000).optional().nullable(),
  periode_debut: z.string().max(50).optional().nullable(),
  periode_fin: z.string().max(50).optional().nullable(),
  objectif_projet: z.string().max(5000).optional().nullable(),
  public_beneficiaire: z.string().max(500).optional().nullable(),
  nb_beneficiaires_estime: z.number().int().min(0).max(1_000_000).optional().nullable(),
  bilan_subvention_anterieure: z.number().min(0).max(10_000_000).optional().nullable(),
  bilan_nb_beneficiaires_reel: z.number().int().min(0).max(1_000_000).optional().nullable(),
  bilan_activites: z.string().max(5000).optional().nullable(),
  budget_previsionnel_json: z.any().optional(),
  details_json: z.any().optional(),
  taux_horaire_valorisation_benevolat: z.number().min(0).max(1000).optional().nullable(),
  qpv_codes: z.array(z.string()).optional().nullable(),
  bailleur_id: z.string().uuid().optional().nullable(),
  plateforme_url_specifique: z.string().max(500).optional().nullable(),
  plateforme_identifiant_dossier: z.string().max(200).optional().nullable(),
  demande_precedente_id: z.string().uuid().optional().nullable(),
  ce_qui_change_cette_annee: z.string().max(3000).optional().nullable(),
  annee_millesime: z.number().int().min(1900).max(2100).optional().nullable(),
  contact_nom: z.string().max(200).optional().nullable(),
  contact_role: z.string().max(200).optional().nullable(),
  contact_email: z.string().email().max(300).optional().nullable(),
  contact_telephone: z.string().max(30).optional().nullable(),
  // Pluriannuel
  groupe_pluriannuel_id: z.string().uuid().optional().nullable(),
  numero_annee_dans_groupe: z.number().int().min(1).max(4).optional().nullable(),
  nombre_annees_total_groupe: z.number().int().min(2).max(4).optional().nullable(),
  // Type de dossier cible (E3)
  type_cerfa_cible: z.string().max(100).optional().nullable(),
  // Formulaire public
  date_limite_depot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('demandes')
    .select('*, associations(*)')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ demande: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: existing, error: fetchError } = await supabase
    .from('demandes')
    .select('id')
    .eq('id', id)
    .single();
  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  }

  // Fichiers du storage + lignes documents (pas de FK cascade sur documents_demande)
  const { data: docs } = await supabase
    .from('documents_demande')
    .select('storage_path')
    .eq('demande_id', id);
  const paths = (docs ?? []).map(d => d.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from('subvention-docs').remove(paths);
  }
  await supabase.from('documents_demande').delete().eq('demande_id', id);

  // Journal (cascade non garantie sur les anciennes bases)
  await supabase.from('journal').delete().eq('demande_id', id);

  // Détacher les demandes qui référencent celle-ci comme précédente (FK sans cascade)
  await supabase.from('demandes').update({ demande_precedente_id: null }).eq('demande_precedente_id', id);

  // budget_lignes, controles_qualite, pieces_requises, bilans → ON DELETE CASCADE
  const { error } = await supabase.from('demandes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.join('.') || '';
    const msg = issue?.message || 'Données invalides';
    return NextResponse.json({ error: field ? `${field} : ${msg}` : msg }, { status: 422 });
  }

  const [supabase, profile] = [getSupabaseServer(), await getProfileFromRequest(req)];
  const { data, error } = await supabase
    .from('demandes')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Journal entry
  if (parsed.data.statut) {
    await supabase.from('journal').insert({
      demande_id: id,
      evenement: 'statut_change',
      detail: `Statut → ${parsed.data.statut}`,
      ...(profile ? { user_id: profile.id } : {}),
    });
  }

  // Sync auto-generated budget lines when details_json or montant_demande is saved
  if (parsed.data.details_json !== undefined || parsed.data.montant_demande !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const { warnings: syncWarnings } = await syncBudgetAutoLignes(
      supabase,
      id,
      d.details_json ?? {},
      { montant_demande: d.montant_demande ?? null, bailleur_nom: d.bailleur_nom ?? null }
    );
    if (syncWarnings.length > 0) {
      return NextResponse.json({ demande: data, sync_warnings: syncWarnings }, { status: 207 });
    }
  }

  return NextResponse.json({ demande: data });
}
