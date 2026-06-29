import { createClient } from '@supabase/supabase-js';

// Types matching supabase_schema.sql
export type Statut =
  | 'collecte'
  | 'redaction'
  | 'controle_compta'
  | 'depose'
  | 'decision_attente'
  | 'accepte'
  | 'refuse';

export type TypeDemande = 'premiere' | 'renouvellement';

export type BaillleurType = 'ville' | 'departement';

export type BudgetLigne = { poste: string; montant?: string | number };

export type BudgetV2 = {
  _v: 2;
  depenses: { label: string; montant: string }[];
  recettes: { label: string; montant: string }[];
};

export type DetailsJson = {
  thematique?: string;
  description_besoins?: string;
  description_actions?: string;
  partenariats?: string;
  beneficiaires_profil?: string;
  beneficiaires_age?: string;
  beneficiaires_sexe?: string;
  localisation_qpv?: string;
  nb_benevoles?: string;
  etpt_benevoles?: string;
  nb_salaries?: string;
  moyens_description?: string;
  indicateurs_evaluation?: string;
};

export type Association = {
  id: string;
  created_at: string;
  nom: string;
  siret?: string;
  siren?: string;
  rna?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  forme_juridique?: string;
  contact_nom: string;
  contact_role?: string;
  contact_email: string;
  contact_telephone?: string;
  nb_membres?: number;
  date_creation?: string;
  statut_profil: string;
};

export type Demande = {
  id: string;
  created_at: string;
  association_id: string;
  bailleur_type?: string;
  bailleur_nom?: string;
  montant_demande?: number;
  titre_projet?: string;
  objectif_projet?: string;
  public_beneficiaire?: string;
  nb_beneficiaires_estime?: number;
  periode_debut?: string;
  periode_fin?: string;
  budget_previsionnel_json?: BudgetLigne[] | BudgetV2;
  details_json?: DetailsJson;
  type_demande: TypeDemande;
  bilan_subvention_anterieure?: number;
  bilan_activites?: string;
  bilan_nb_beneficiaires_reel?: number;
  statut: Statut;
  presta_redacteur?: string;
  date_depot?: string;
  date_decision?: string;
  montant_obtenu?: number;
  notes?: string;
  contact_nom?: string;
  contact_role?: string;
  contact_email?: string;
  contact_telephone?: string;
  // joined
  associations?: Association;
};

export type JournalEntry = {
  id: string;
  created_at: string;
  demande_id: string;
  evenement: string;
  detail?: string;
};

export type BudgetLigneDB = {
  id: string;
  created_at: string;
  demande_id: string;
  sens: 'charge' | 'produit';
  compte: string;
  libelle_compte?: string;
  sous_categorie?: string;
  bailleur_detail?: string;
  quantite?: number;
  prix_unitaire?: number;
  montant: number;
  est_charge_commune: boolean;
  cle_repartition?: string;
  est_valorisation_benevolat: boolean;
  precisions?: string;
  piece_justificative_url?: string;
};

export type BudgetEquilibre = {
  demande_id: string;
  total_charges: number;
  total_produits: number;
  ecart: number;
  est_equilibre: boolean;
};

export type TauxFinancement = {
  demande_id: string;
  bailleur_detail: string;
  montant_demande_ce_bailleur: number;
  total_produits_hors_nature: number;
  pourcentage_du_projet: number;
  depasse_plafond_80: boolean;
};

export type ControleQualite = {
  id: string;
  created_at: string;
  demande_id: string;
  categorie: 'coherence_donnees' | 'coherence_recit' | 'conformite_administrative';
  libelle_controle: string;
  est_valide: boolean;
  valide_par?: string;
  valide_le?: string;
  commentaire?: string;
};

export type PieceRequise = {
  id: string;
  created_at: string;
  demande_id: string;
  type_piece: string;
  libelle: string;
  obligatoire: boolean;
  statut: 'manquant' | 'fourni' | 'perime' | 'non_applicable';
  document_id?: string;
  date_limite_validite?: string;
};

// Server-side client (service role — full access, use only in API routes)
export function getSupabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Browser client (anon key — used in client components)
export function getSupabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
