import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

// Grille standard — section 6 de METHODE-SUBVENTIONS.md
const CONTROLES_STANDARD = [
  // cohérence des données
  { categorie: 'coherence_donnees', libelle_controle: "Le nombre d'adhérents/bénéficiaires est identique partout dans le dossier, et daté" },
  { categorie: 'coherence_donnees', libelle_controle: "Le nombre de bénévoles est identique partout dans le dossier" },
  { categorie: 'coherence_donnees', libelle_controle: "Le montant demandé à ce bailleur est identique dans le formulaire, l'attestation signée et le budget détaillé" },
  { categorie: 'coherence_donnees', libelle_controle: "Total charges = Total produits dans chaque budget (structure ET projet)" },
  { categorie: 'coherence_donnees', libelle_controle: "Si plusieurs projets/budgets coexistent : somme des budgets-projets cohérente avec le budget de structure global" },
  { categorie: 'coherence_donnees', libelle_controle: "La période de réalisation correspond à l'exercice comptable demandé par le bailleur" },
  // cohérence du récit
  { categorie: 'coherence_recit', libelle_controle: "Les engagements pris l'an dernier (si renouvellement) sont repris dans le bilan, qu'ils aient été tenus ou non" },
  { categorie: 'coherence_recit', libelle_controle: "Chaque activité décrite dans le récit a une ligne budgétaire correspondante" },
  { categorie: 'coherence_recit', libelle_controle: "Le public ciblé dans le récit correspond au périmètre géographique exigé par le bailleur" },
  // conformité administrative
  { categorie: 'conformite_administrative', libelle_controle: "Toutes les pièces de la checklist documentaire sont jointes et à jour (millésime de l'année en cours)" },
  { categorie: 'conformite_administrative', libelle_controle: "La signature de l'attestation correspond à une personne habilitée selon les statuts (ou délégation jointe)" },
  { categorie: 'conformite_administrative', libelle_controle: "Le taux de subvention demandé ne dépasse pas le plafond habituel (80 % hors valorisation bénévolat)" },
  { categorie: 'conformite_administrative', libelle_controle: "Toutes les autres subventions sollicitées sur ce même projet sont déclarées" },
  { categorie: 'conformite_administrative', libelle_controle: "Le dossier final a été relu et approuvé par le consultant avant dépôt" },
] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  let { data: controles, error } = await supabase
    .from('controles_qualite')
    .select('*')
    .eq('demande_id', id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lazy init : initialise la grille standard si vide
  if (!controles || controles.length === 0) {
    const rows = CONTROLES_STANDARD.map(c => ({ ...c, demande_id: id }));
    const { data: inserted, error: insErr } = await supabase
      .from('controles_qualite')
      .insert(rows)
      .select()
      .order('created_at');
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    controles = inserted ?? [];
  }

  return NextResponse.json({ controles });
}
