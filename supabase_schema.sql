-- =====================================================================
-- SCHEMA SUPABASE — SubventionPro
-- À exécuter dans Supabase: Project > SQL Editor > New query > Run
-- =====================================================================

-- 1. ASSOCIATIONS (profil collecté une seule fois, réutilisé sur toutes les demandes)
create table associations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  -- Identité (auto-complétée via API Recherche d'entreprises)
  nom text not null,
  siret text,
  siren text,
  rna text,                          -- numéro RNA (W123456789)
  adresse text,
  code_postal text,
  ville text,
  forme_juridique text,

  -- Contact principal
  contact_nom text not null,
  contact_role text,                  -- ex: "Présidente", "Trésorier"
  contact_email text not null,
  contact_telephone text,

  -- Gouvernance & docs administratifs (réutilisables sur chaque demande)
  nb_membres integer,
  date_creation date,

  -- Fichiers (URLs Supabase Storage)
  fichier_statuts_url text,
  fichier_recepisse_rna_url text,
  fichier_liste_dirigeants_url text,
  fichier_rib_url text,
  fichier_rapport_activite_url text,
  fichier_comptes_approuves_url text,
  fichier_pv_ag_url text,

  statut_profil text default 'incomplet' -- incomplet | complet
);

-- 2. DEMANDES (une par dossier de subvention)
create table demandes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  association_id uuid references associations(id) on delete cascade,

  -- Cible
  bailleur_type text,                 -- 'ville' | 'departement' | 'autre'
  bailleur_nom text,
  montant_demande numeric,

  -- Projet (en langage concret, pas administratif)
  titre_projet text,
  objectif_projet text,               -- ce que ça change concrètement pour les membres
  public_beneficiaire text,
  nb_beneficiaires_estime integer,
  periode_debut date,
  periode_fin date,
  budget_previsionnel_json jsonb,     -- lignes de budget {poste, montant}

  -- Première demande vs renouvellement
  type_demande text default 'premiere',   -- 'premiere' | 'renouvellement'
  bilan_subvention_anterieure numeric,    -- montant obtenu l'année précédente (renouvellement)
  bilan_activites text,                   -- description des actions réalisées (renouvellement)
  bilan_nb_beneficiaires_reel integer,    -- bénéficiaires réels exercice précédent (renouvellement)

  -- Workflow
  statut text default 'collecte',
  -- collecte -> rédaction -> contrôle_compta -> déposé -> décision_attente -> accepté/refusé

  presta_redacteur text,
  date_depot date,
  date_decision date,
  montant_obtenu numeric,
  notes text
);

-- 3. DOCUMENTS PAR DEMANDE (justificatifs spécifiques à un projet, pas le profil global)
create table documents_demande (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  demande_id uuid references demandes(id) on delete cascade,
  type_document text,                 -- 'devis' | 'budget_action' | 'autre'
  nom_fichier text,
  url text
);

-- 4. JOURNAL D'ÉVÉNEMENTS (traçabilité simple, pour le tableau de bord)
create table journal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  demande_id uuid references demandes(id) on delete cascade,
  evenement text,                     -- 'profil_complete' | 'demande_creee' | 'statut_change' | ...
  detail text
);

-- Index utiles
create index idx_demandes_association on demandes(association_id);
create index idx_demandes_statut on demandes(statut);
create index idx_documents_demande on documents_demande(demande_id);
create index idx_journal_demande on journal(demande_id);

-- Storage bucket pour les fichiers (à créer aussi via l'interface Supabase > Storage)
-- Nom suggéré du bucket : "documents-asso" (privé, accès via URL signée)
