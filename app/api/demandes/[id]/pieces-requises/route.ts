import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

// Checklist documentaire générique — section 5 de METHODE-SUBVENTIONS.md
const PIECES_STANDARD = [
  { type_piece: 'statuts', libelle: "Statuts à jour de l'association", obligatoire: true },
  { type_piece: 'recepisse_jo', libelle: "Récépissé de déclaration / extrait Journal Officiel", obligatoire: true },
  { type_piece: 'composition_bureau', libelle: "Composition du bureau et du conseil d'administration en cours", obligatoire: true },
  { type_piece: 'pv_ag', libelle: "Dernier procès-verbal d'Assemblée Générale", obligatoire: true },
  { type_piece: 'comptes_annuels', libelle: "Comptes annuels approuvés de l'exercice clos (bilan + compte de résultat)", obligatoire: true },
  { type_piece: 'budget_previsionnel', libelle: "Budget prévisionnel de la structure pour l'année en cours", obligatoire: true },
  { type_piece: 'rib', libelle: "RIB au nom de l'association", obligatoire: true },
  { type_piece: 'rapport_activite', libelle: "Rapport d'activité de l'exercice précédent", obligatoire: true },
  { type_piece: 'justificatif_emploi', libelle: "Justificatif d'emploi de la subvention antérieure (si applicable)", obligatoire: false },
  { type_piece: 'delegation_signature', libelle: "Délégation de signature (si le signataire n'est pas le représentant légal statutaire)", obligatoire: false },
  { type_piece: 'attestation_honneur', libelle: "Attestation/déclaration sur l'honneur signée", obligatoire: true },
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  // bilan_id null = checklist de la demande (les pièces des bilans ont leur propre route)
  let { data: pieces, error } = await supabase
    .from('pieces_requises')
    .select('*')
    .eq('demande_id', id)
    .is('bilan_id', null)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lazy init : initialise les pièces standard si vide
  if (!pieces || pieces.length === 0) {
    const rows = PIECES_STANDARD.map(p => ({ ...p, demande_id: id, statut: 'manquant' }));
    const { data: inserted, error: insErr } = await supabase
      .from('pieces_requises')
      .insert(rows)
      .select()
      .order('created_at');
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    pieces = inserted ?? [];
  }

  return NextResponse.json({ pieces });
}
