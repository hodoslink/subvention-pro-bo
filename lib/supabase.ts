import { createClient } from '@supabase/supabase-js';

// Types matching supabase_schema.sql
export type Statut =
  | 'collecte'
  | 'redaction'
  | 'controle_compta'
  | 'depose'
  | 'decision_attente'
  | 'accepte'
  | 'convention_signee'
  | 'en_execution'
  | 'bilan_final_soumis'
  | 'clos'
  | 'refuse';

export type TypeDemande = 'premiere' | 'renouvellement';

export type BailleurType = 'etat' | 'commune' | 'epci' | 'departement' | 'region' | 'etablissement_public' | 'prive' | 'autre';

export const BAILLEUR_TYPES: { v: BailleurType; l: string }[] = [
  { v: 'etat', l: 'État' },
  { v: 'commune', l: 'Commune' },
  { v: 'epci', l: 'EPCI / intercommunalité' },
  { v: 'departement', l: 'Département' },
  { v: 'region', l: 'Région' },
  { v: 'etablissement_public', l: 'Établissement public' },
  { v: 'prive', l: 'Privé / fondation' },
  { v: 'autre', l: 'Autre' },
];

export type Bailleur = {
  id: string;
  created_at: string;
  nom: string;
  type_bailleur?: string;
  plateforme_nom?: string;
  plateforme_url?: string;
  plateforme_type?: string;
  contact_referent_nom?: string;
  contact_referent_email?: string;
  contact_referent_telephone?: string;
  notes?: string;
};

export type BriefMission = {
  demande_id: string;
  titre_projet?: string;
  annee_actuelle?: number;
  association_nom: string;
  site_web_url?: string;
  resume_association?: string;
  secteur_activite?: string;
  type_renouvellement: 'premiere' | 'renouvellement';
  plateforme_url_effective?: string;
  plateforme_nom?: string;
  plateforme_type?: string;
  plateforme_identifiant_dossier?: string;
  annee_precedente?: number;
  montant_demande_precedent?: number;
  montant_obtenu_precedent?: number;
  beneficiaires_precedent?: number;
  statut_demande_precedente?: string;
  montant_demande_actuel?: number;
  beneficiaires_actuel?: number;
  ecart_montant_demande?: number;
  ecart_montant_demande_pct?: number;
  ecart_beneficiaires?: number;
  ce_qui_change_cette_annee?: string;
  contact_referent_nom?: string;
  contact_referent_email?: string;
  contact_referent_telephone?: string;
};

export type BudgetLigne = { poste: string; montant?: string | number };

export type BudgetV2 = {
  _v: 2;
  depenses: { label: string; montant: string }[];
  recettes: { label: string; montant: string }[];
};

export type AutoritesDestinataires = 'etat' | 'region' | 'departement' | 'commune_epci' | 'etablissement_public' | 'autre';

export type DetailsJson = {
  // Champs déclaratifs Cerfa (sans génération budgétaire)
  forme_subvention?: 'numeraire' | 'nature';
  objet_demande?: 'fonctionnement_global' | 'projet_action';
  recrutement_envisage?: boolean;
  recrutement_etpt?: string;
  thematique?: string;
  description_besoins?: string;
  description_actions?: string;
  partenariats?: string;
  beneficiaires_profil?: string;
  beneficiaires_age?: string;
  beneficiaires_sexe?: string;
  localisation_qpv?: string;
  qpv_codes?: string[];
  // Autorités destinataires (page de garde Cerfa — cumulables)
  autorites_destinataires?: AutoritesDestinataires[];
  contrat_de_ville?: { concerne: boolean; nom_contrat?: string };
  // Moyens humains
  nb_benevoles?: string;
  etpt_benevoles?: string;
  heures_benevolat_semaine?: string;
  taux_horaire_valorisation?: string;   // défaut SMIC horaire brut — voir lib/budgetAuto.ts
  nb_salaries?: string;
  nb_volontaires?: string;
  nb_emplois_aides?: string;
  personnel_mis_a_disposition_autorite_publique?: string;
  cout_salarial_annuel_estime?: string;
  moyens_description?: string;
  // Prestataires
  a_des_prestataires?: boolean;
  prestataires?: Array<{ nom_type: string; nb_seances_ou_ateliers: string; tarif_unitaire: string }>;
  // Locaux
  locaux_mis_a_disposition?: boolean;
  locaux_bailleur?: string;
  locaux_valeur_estimee?: string;
  // Évaluation
  indicateurs_evaluation?: string;
  // Achats / fournitures récurrents
  achats_recurrents?: Array<{ nom_type: string; quantite_annuelle: string; cout_unitaire: string }>;
  // Location de salle payante (≠ locaux mis à dispo gratuits)
  location_salle_payante?: boolean;
  location_salle_cout_annuel?: string;
  location_salle_precisions?: string;
  // Assurance dédiée au projet
  assurance_dediee?: boolean;
  assurance_cout_annuel?: string;
  // Déplacements / missions
  deplacements_estimes?: boolean;
  deplacements_frequence_mensuelle?: string;
  deplacements_cout_moyen?: string;
  // Cotisations actives des bénéficiaires
  cotisations_actives?: boolean;
  nb_adherents_payants?: string;
  tarif_moyen_annuel?: string;          // rétrocompatibilité — remplacé par tarif_cotisation_annuelle + 706
  tarif_cotisation_annuelle?: string;   // tarif annuel d'adhésion → compte 756
  nb_seances_mensuelles_moyen?: string; // nb séances/mois → compte 706
  nb_participants_moyen_seance?: string; // nb participants par séance → compte 706
  tarif_moyen_participation?: string;   // tarif par participant par séance → compte 706
  nb_mois_activite?: string;            // mois d'activité sur l'année (défaut 10) → compte 706
  // Autres bailleurs sollicités sur ce projet
  autres_bailleurs_sollicites?: Array<{ nom_bailleur: string; montant: string; statut: 'obtenu' | 'demande' | 'envisage' }>;
  // Relations administratives (Partie C)
  agrements?: Array<{ type: string; autorite: string; date_obtention?: string }>;
  reconnue_utilite_publique?: boolean;
  date_publication_jo_utilite_publique?: string;
  assujettie_impots_commerciaux?: boolean;
  reseaux_affiliation?: string[];
  adherents_personnes_morales?: Array<{ nom: string }>;
};

export type UserRole = 'admin' | 'consultant';

export type Profile = {
  id: string;
  created_at: string;
  role: UserRole;
  nom_complet: string;
};

export type Association = {
  id: string;
  created_at: string;
  nom: string;
  sigle?: string;
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
  site_web_url?: string;
  resume_scrape?: string;
  resume_scrape_le?: string;
  resume_edite?: string;
  resume_edite_par?: string;
  resume_edite_le?: string;
  secteur_activite?: string;
  annee_creation?: number;
  date_inscription_alsace_moselle?: string;
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
  bailleur_id?: string;
  plateforme_url_specifique?: string;
  plateforme_identifiant_dossier?: string;
  demande_precedente_id?: string;
  ce_qui_change_cette_annee?: string;
  annee_millesime?: number;
  // Pluriannuel
  groupe_pluriannuel_id?: string;
  numero_annee_dans_groupe?: number;
  nombre_annees_total_groupe?: number;
  // Type de dossier cible (E3)
  type_cerfa_cible?: string;
  // Formulaire public association
  token_formulaire_public?: string;
  token_formulaire_genere_le?: string;
  formulaire_public_ouvert_le?: string;
  formulaire_public_rempli_le?: string;
  date_limite_depot?: string;
  // Auth multi-consultants
  consultant_id?: string;
  // joined
  associations?: Association;
  bailleurs?: Bailleur;
  consultant?: Profile;
};

export type JournalEntry = {
  id: string;
  created_at: string;
  demande_id: string;
  evenement: string;
  detail?: string;
  user_id?: string;
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
  cle_generation?: string | null;       // null = ligne manuelle, valeur = ligne auto-générée
  statut_financement?: string | null;   // 'obtenu' | 'demande' | 'envisage' — lignes produit seulement
  demande_liee_id?: string | null;      // référence pure vers une autre demande (jamais de propagation de montant)
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
  bilan_id?: string | null;   // null = pièce de la demande ; renseigné = pièce d'un bilan
};

export type BilanType = 'intermediaire' | 'final';
export type BilanStatut = 'brouillon' | 'valide' | 'transmis';

export type BeneficiaireParType = { type: string; nombre: number | null };
export type DateLieuRealisation = { date_debut: string; date_fin: string; lieu: string };

export type Bilan = {
  id: string;
  created_at: string;
  demande_id: string;
  type: BilanType;
  numero_ordre: number;
  date_debut: string;
  date_fin: string;
  statut: BilanStatut;
  statut_action?: 'realise' | 'partiellement_realise' | 'non_realise' | null;
  rapport_activite?: string;
  commentaires_activite?: string;
  bilan_qualitatif?: string;
  commentaire_financier?: string;
  signe_par?: string;
  signe_le?: string;
  user_id?: string;
  // CERFA 15059 — feuillet 1 (qualitatif structuré)
  beneficiaires_par_type?: BeneficiaireParType[] | null;
  dates_lieux_realisation?: DateLieuRealisation[] | null;
  // CERFA 15059 — feuillet 3 (annexe)
  regles_repartition_charges_indirectes?: string;
  methode_valorisation_cvn?: string;
  observations?: string;
};

export type BilanLigne = {
  id: string;
  created_at: string;
  bilan_id: string;
  budget_ligne_id?: string | null;
  sens: 'charge' | 'produit';
  compte: string;
  sous_categorie?: string;
  bailleur_detail?: string;
  montant_prevu: number;
  montant_reel?: number | null;
  commentaire_ecart?: string;
  est_charge_commune?: boolean;
  cle_repartition?: string | null;
  est_valorisation_benevolat?: boolean;
  piece_justificative_url?: string | null;
  demande_liee_id?: string | null;   // copié du budget au snapshot — propagation du montant réel
};

export type BilanIndicateur = {
  id: string;
  created_at: string;
  bilan_id: string;
  indicateur: string;
  resultat_attendu?: string;
  resultat_obtenu?: string;
  outil_evaluation?: string;
  piste_amelioration?: string;
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
