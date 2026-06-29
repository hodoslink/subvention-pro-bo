-- ============================================================================
-- Migration — système d'accompagnement aux demandes de subvention
-- Basé sur METHODE-SUBVENTIONS.md (sections 4, 5, 6)
-- AJOUTS UNIQUEMENT — aucune colonne ni table existante supprimée ou renommée
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. budget_lignes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  demande_id uuid NOT NULL,

  sens text NOT NULL,                      -- 'charge' | 'produit'
  compte text NOT NULL,                    -- '60' | '61' | ... | '74' | '86' | '87'
  libelle_compte text,                     -- libellé standard du compte (dénormalisé pour export)
  sous_categorie text,                     -- libellé libre de la ligne

  bailleur_detail text,                    -- uniquement pour compte 74 et 87

  quantite numeric,
  prix_unitaire numeric,
  montant numeric NOT NULL DEFAULT 0,      -- recalculé par trigger si quantite+prix_unitaire fournis

  est_charge_commune boolean DEFAULT false,
  cle_repartition text,                    -- obligatoire si est_charge_commune=true

  est_valorisation_benevolat boolean DEFAULT false,

  precisions text,
  piece_justificative_url text,

  CONSTRAINT budget_lignes_pkey PRIMARY KEY (id),
  CONSTRAINT budget_lignes_demande_id_fkey FOREIGN KEY (demande_id)
    REFERENCES public.demandes(id) ON DELETE CASCADE,
  CONSTRAINT budget_lignes_sens_check CHECK (sens IN ('charge', 'produit'))
);

CREATE INDEX IF NOT EXISTS idx_budget_lignes_demande_id ON public.budget_lignes(demande_id);
CREATE INDEX IF NOT EXISTS idx_budget_lignes_compte ON public.budget_lignes(compte);

-- ----------------------------------------------------------------------------
-- 2. Trigger de calcul automatique du montant
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculer_montant_budget_ligne()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantite IS NOT NULL AND NEW.prix_unitaire IS NOT NULL THEN
    NEW.montant := NEW.quantite * NEW.prix_unitaire;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculer_montant_budget_ligne ON public.budget_lignes;
CREATE TRIGGER trg_calculer_montant_budget_ligne
  BEFORE INSERT OR UPDATE ON public.budget_lignes
  FOR EACH ROW
  EXECUTE FUNCTION public.calculer_montant_budget_ligne();

-- ----------------------------------------------------------------------------
-- 3. Vue : équilibre charges/produits par demande (règle d'or section 4.6)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_budget_equilibre AS
SELECT
  demande_id,
  COALESCE(SUM(montant) FILTER (WHERE sens = 'charge'), 0) AS total_charges,
  COALESCE(SUM(montant) FILTER (WHERE sens = 'produit'), 0) AS total_produits,
  COALESCE(SUM(montant) FILTER (WHERE sens = 'charge'), 0)
    - COALESCE(SUM(montant) FILTER (WHERE sens = 'produit'), 0) AS ecart,
  (COALESCE(SUM(montant) FILTER (WHERE sens = 'charge'), 0)
    = COALESCE(SUM(montant) FILTER (WHERE sens = 'produit'), 0)) AS est_equilibre
FROM public.budget_lignes
GROUP BY demande_id;

-- ----------------------------------------------------------------------------
-- 4. Vue : taux de financement par bailleur (plafond 80% section 4.7)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_taux_financement_bailleur AS
SELECT
  bl.demande_id,
  bl.bailleur_detail,
  bl.montant AS montant_demande_ce_bailleur,
  tp.total_produits_hors_nature,
  ROUND(
    (bl.montant / NULLIF(tp.total_produits_hors_nature, 0)) * 100,
    1
  ) AS pourcentage_du_projet,
  ((bl.montant / NULLIF(tp.total_produits_hors_nature, 0)) * 100) > 80 AS depasse_plafond_80
FROM public.budget_lignes bl
JOIN (
  SELECT
    demande_id,
    SUM(montant) AS total_produits_hors_nature
  FROM public.budget_lignes
  WHERE sens = 'produit' AND compte NOT IN ('86', '87')
  GROUP BY demande_id
) tp ON tp.demande_id = bl.demande_id
WHERE bl.compte = '74' AND bl.bailleur_detail IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. controles_qualite (grille pré-dépôt section 6)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.controles_qualite (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  demande_id uuid NOT NULL,

  categorie text NOT NULL,
  libelle_controle text NOT NULL,
  est_valide boolean DEFAULT false,
  valide_par text,
  valide_le timestamp with time zone,
  commentaire text,

  CONSTRAINT controles_qualite_pkey PRIMARY KEY (id),
  CONSTRAINT controles_qualite_demande_id_fkey FOREIGN KEY (demande_id)
    REFERENCES public.demandes(id) ON DELETE CASCADE,
  CONSTRAINT controles_qualite_categorie_check CHECK (
    categorie IN ('coherence_donnees', 'coherence_recit', 'conformite_administrative')
  )
);

CREATE INDEX IF NOT EXISTS idx_controles_qualite_demande_id ON public.controles_qualite(demande_id);

-- ----------------------------------------------------------------------------
-- 6. pieces_requises (checklist documentaire section 5)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pieces_requises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  demande_id uuid NOT NULL,

  type_piece text NOT NULL,
  libelle text NOT NULL,
  obligatoire boolean DEFAULT true,
  statut text DEFAULT 'manquant',          -- 'manquant' | 'fourni' | 'perime' | 'non_applicable'
  document_id uuid,
  date_limite_validite date,

  CONSTRAINT pieces_requises_pkey PRIMARY KEY (id),
  CONSTRAINT pieces_requises_demande_id_fkey FOREIGN KEY (demande_id)
    REFERENCES public.demandes(id) ON DELETE CASCADE,
  CONSTRAINT pieces_requises_document_id_fkey FOREIGN KEY (document_id)
    REFERENCES public.documents_demande(id),
  CONSTRAINT pieces_requises_statut_check CHECK (
    statut IN ('manquant', 'fourni', 'perime', 'non_applicable')
  )
);

CREATE INDEX IF NOT EXISTS idx_pieces_requises_demande_id ON public.pieces_requises(demande_id);

-- ----------------------------------------------------------------------------
-- 7. Nouvelles colonnes sur demandes
-- ----------------------------------------------------------------------------
ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS taux_horaire_valorisation_benevolat numeric;

ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS qpv_codes text[];

COMMENT ON COLUMN public.demandes.taux_horaire_valorisation_benevolat IS
  'Taux horaire de référence pour la valorisation du bénévolat (comptes 86/87), généralement le SMIC brut horaire en vigueur à la date de la demande.';

COMMENT ON COLUMN public.demandes.qpv_codes IS
  'Codes QPV couverts par ce projet. Permet de vérifier la cohérence avec le périmètre géographique exigé par le bailleur.';
