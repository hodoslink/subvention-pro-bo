-- ============================================================================
-- Migration — Bilans d'exécution
-- Implémente le suivi post-acceptation : bilans intermédiaires et final.
-- Chaque bilan prend un snapshot des budget_lignes à sa date de création.
-- ============================================================================

-- ── Table principale : bilans ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bilans (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at            timestamptz DEFAULT now(),
  demande_id            uuid NOT NULL,
  type                  text NOT NULL CHECK (type IN ('intermediaire', 'final')),
  numero_ordre          integer NOT NULL DEFAULT 1,
  date_debut            date NOT NULL,
  date_fin              date NOT NULL,
  statut                text NOT NULL DEFAULT 'brouillon'
                          CHECK (statut IN ('brouillon', 'valide', 'transmis')),

  -- Rapport d'activité (Section 1 du bilan ARS/GPGE)
  statut_action         text CHECK (statut_action IN (
                          'realise', 'partiellement_realise', 'non_realise')),
  rapport_activite      text,
  commentaires_activite text,
  bilan_qualitatif      text,

  -- Rapport financier (Section 2)
  commentaire_financier text,

  -- Attestation
  signe_par             text,
  signe_le              date,

  -- Méta
  user_id               uuid,

  CONSTRAINT bilans_pkey PRIMARY KEY (id),
  CONSTRAINT bilans_demande_id_fkey
    FOREIGN KEY (demande_id) REFERENCES public.demandes(id) ON DELETE CASCADE,
  CONSTRAINT bilans_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bilans_demande_final
  ON public.bilans(demande_id)
  WHERE type = 'final';

CREATE INDEX IF NOT EXISTS idx_bilans_demande_id
  ON public.bilans(demande_id);

COMMENT ON TABLE public.bilans IS
  'Bilans d''exécution (intermédiaires et final) liés à une demande acceptée.
   Un snapshot des budget_lignes est pris à la création du bilan.';

COMMENT ON COLUMN public.bilans.type IS
  'intermediaire : bilan de mi-parcours. final : bilan de clôture (1 seul par demande).';

COMMENT ON COLUMN public.bilans.numero_ordre IS
  'Ordre chronologique des bilans intermédiaires (1, 2, 3...). Toujours 1 pour le final.';

COMMENT ON COLUMN public.bilans.statut IS
  'brouillon : en cours de rédaction. valide : prêt à transmettre. transmis : envoyé au bailleur.';

-- ── Snapshot des lignes budgétaires ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bilan_lignes (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at       timestamptz DEFAULT now(),
  bilan_id         uuid NOT NULL,
  budget_ligne_id  uuid,
  sens             text NOT NULL CHECK (sens IN ('charge', 'produit')),
  compte           text NOT NULL,
  sous_categorie   text,
  bailleur_detail  text,
  montant_prevu    numeric NOT NULL DEFAULT 0,
  montant_reel     numeric,
  commentaire_ecart text,

  CONSTRAINT bilan_lignes_pkey PRIMARY KEY (id),
  CONSTRAINT bilan_lignes_bilan_id_fkey
    FOREIGN KEY (bilan_id) REFERENCES public.bilans(id) ON DELETE CASCADE,
  CONSTRAINT bilan_lignes_budget_ligne_id_fkey
    FOREIGN KEY (budget_ligne_id) REFERENCES public.budget_lignes(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bilan_lignes_bilan_id
  ON public.bilan_lignes(bilan_id);

COMMENT ON TABLE public.bilan_lignes IS
  'Snapshot des lignes budgétaires au moment de la création du bilan.
   montant_prevu = copie de budget_lignes.montant à la création.
   montant_reel = montant effectivement dépensé/perçu, saisi par le consultant.';

COMMENT ON COLUMN public.bilan_lignes.commentaire_ecart IS
  'Explication de l''écart entre prévu et réel. Recommandé si |écart| > 10 %.';

-- ── Indicateurs d'évaluation ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bilan_indicateurs (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at          timestamptz DEFAULT now(),
  bilan_id            uuid NOT NULL,
  indicateur          text NOT NULL,
  resultat_attendu    text,
  resultat_obtenu     text,
  outil_evaluation    text,
  piste_amelioration  text,

  CONSTRAINT bilan_indicateurs_pkey PRIMARY KEY (id),
  CONSTRAINT bilan_indicateurs_bilan_id_fkey
    FOREIGN KEY (bilan_id) REFERENCES public.bilans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bilan_indicateurs_bilan_id
  ON public.bilan_indicateurs(bilan_id);

COMMENT ON TABLE public.bilan_indicateurs IS
  'Indicateurs d''évaluation repris du projet (attendus) avec les résultats obtenus.';
