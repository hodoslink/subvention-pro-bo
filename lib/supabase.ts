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
  budget_previsionnel_json?: BudgetLigne[];
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
