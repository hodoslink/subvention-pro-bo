-- ============================================================================
-- Migration — statut_financement sur budget_lignes
-- Colonne nullable pertinente pour les lignes produit (compte 74, 70…)
-- Permet de filtrer/agréger les financements par statut (obtenu/demandé/envisagé)
-- ============================================================================

ALTER TABLE public.budget_lignes
  ADD COLUMN IF NOT EXISTS statut_financement text
  CHECK (statut_financement IN ('obtenu', 'demande', 'envisage'));

COMMENT ON COLUMN public.budget_lignes.statut_financement IS
  'Statut du financement pour les lignes produit uniquement (74, 70…).
   NULL pour les lignes charge. Valeurs : obtenu | demande | envisage.';
