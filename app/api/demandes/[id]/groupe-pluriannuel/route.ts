import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

// GET /api/demandes/[id]/groupe-pluriannuel
// Retourne toutes les demandes du même groupe pluriannuel, triées par numero_annee_dans_groupe.
// Retourne aussi le total des aides publiques 3 derniers exercices pour l'association.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  // 1. Charger la demande courante pour obtenir groupe_pluriannuel_id et association_id
  const { data: demande, error: errD } = await supabase
    .from('demandes')
    .select('groupe_pluriannuel_id, association_id')
    .eq('id', id)
    .single();

  if (errD || !demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });

  const { groupe_pluriannuel_id, association_id } = demande;

  // 2. Membres du groupe (null si non pluriannuel)
  let membres = null;
  if (groupe_pluriannuel_id) {
    const { data, error } = await supabase
      .from('demandes')
      .select('id, titre_projet, annee_millesime, statut, montant_demande, montant_obtenu, numero_annee_dans_groupe, nombre_annees_total_groupe')
      .eq('groupe_pluriannuel_id', groupe_pluriannuel_id)
      .order('numero_annee_dans_groupe', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    membres = data;
  }

  // 3. Total aides publiques 3 derniers exercices pour l'association (vue v_aides_publiques_3ans)
  const { data: aidesRow } = await supabase
    .from('v_aides_publiques_3ans')
    .select('total_aides_3ans, nb_subventions, annees_couvertes')
    .eq('association_id', association_id)
    .maybeSingle();

  return NextResponse.json({
    membres,
    aides_publiques_3ans: aidesRow
      ? {
          total: Number(aidesRow.total_aides_3ans ?? 0),
          nb_subventions: aidesRow.nb_subventions,
          annees_couvertes: aidesRow.annees_couvertes,
          depasse_seuil: Number(aidesRow.total_aides_3ans ?? 0) > 500_000,
        }
      : { total: 0, nb_subventions: 0, annees_couvertes: [], depasse_seuil: false },
  });
}
