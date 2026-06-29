-- ============================================================================
-- Migration — Budget auto-généré depuis la fiche demande
-- Ajoute cle_generation sur budget_lignes pour identifier les lignes
-- créées automatiquement (upsert par clé, sans jamais écraser les lignes manuelles)
-- ============================================================================

ALTER TABLE public.budget_lignes
  ADD COLUMN IF NOT EXISTS cle_generation text;

COMMENT ON COLUMN public.budget_lignes.cle_generation IS
  'Identifiant stable des lignes auto-générées depuis details_json (ex: auto_benevolat_charge).
   NULL pour les lignes saisies manuellement sur l''écran /budget.
   La sync auto ne touche jamais aux lignes avec cle_generation IS NULL.';

-- Index unique PARTIEL : une seule ligne par (demande, clé) pour les lignes auto.
-- Les lignes manuelles (cle_generation IS NULL) peuvent coexister en nombre illimité.
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_lignes_demande_cle_generation
  ON public.budget_lignes(demande_id, cle_generation)
  WHERE cle_generation IS NOT NULL;
