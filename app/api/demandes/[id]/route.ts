import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { genererLignesAuto } from '@/lib/budgetAuto';
import { z } from 'zod';

const patchSchema = z.object({
  statut: z.enum(['collecte', 'redaction', 'controle_compta', 'depose', 'decision_attente', 'accepte', 'refuse']).optional(),
  presta_redacteur: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  date_depot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_decision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  montant_obtenu: z.number().min(0).max(10_000_000).optional().nullable(),
  // Champs projet
  titre_projet: z.string().max(500).optional().nullable(),
  bailleur_nom: z.string().max(300).optional().nullable(),
  bailleur_type: z.enum(['ville', 'departement']).optional().nullable(),
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const supabase = getSupabaseServer();
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
    });
  }

  // Sync auto-generated budget lines when details_json or montant_demande is saved
  if (parsed.data.details_json !== undefined || parsed.data.montant_demande !== undefined) {
    const lignesAuto = genererLignesAuto(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((data as any).details_json ?? {}) as Parameters<typeof genererLignesAuto>[0],
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        montant_demande: (data as any).montant_demande ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bailleur_nom: (data as any).bailleur_nom ?? null,
      }
    );

    const { data: existingLines } = await supabase
      .from('budget_lignes')
      .select('id, cle_generation')
      .eq('demande_id', id)
      .not('cle_generation', 'is', null);

    const existingByCle = new Map(
      (existingLines ?? []).map(l => [l.cle_generation as string, l.id as string])
    );
    const clesCourantes = new Set(lignesAuto.map(l => l.cle_generation));

    // Delete auto lines that are no longer generated
    const idsToDelete = (existingLines ?? [])
      .filter(l => !clesCourantes.has(l.cle_generation as string))
      .map(l => l.id as string);
    if (idsToDelete.length > 0) {
      await supabase.from('budget_lignes').delete().in('id', idsToDelete);
    }

    // Insert or update each generated line
    for (const l of lignesAuto) {
      const existingId = existingByCle.get(l.cle_generation);
      const row = {
        demande_id: id,
        sens: l.sens,
        compte: l.compte,
        sous_categorie: l.sous_categorie,
        bailleur_detail: l.bailleur_detail ?? null,
        quantite: l.quantite ?? null,
        prix_unitaire: l.prix_unitaire ?? null,
        montant: l.montant,
        precisions: l.precisions,
        est_valorisation_benevolat: l.est_valorisation_benevolat,
        est_charge_commune: false,
        cle_generation: l.cle_generation,
        statut_financement: l.statut_financement ?? null,
      };
      if (existingId) {
        await supabase.from('budget_lignes').update(row).eq('id', existingId);
      } else {
        await supabase.from('budget_lignes').insert(row);
      }
    }
  }

  return NextResponse.json({ demande: data });
}
