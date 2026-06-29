-- ============================================================================
-- Migration — Demandes pluriannuelles
-- Principe : N lignes demandes distinctes (une par année), liées par un UUID
-- de groupe commun. Le chaînage demande_precedente_id est réutilisé tel quel.
-- ============================================================================

ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS groupe_pluriannuel_id uuid,
  ADD COLUMN IF NOT EXISTS numero_annee_dans_groupe integer,
  ADD COLUMN IF NOT EXISTS nombre_annees_total_groupe integer;

CREATE INDEX IF NOT EXISTS idx_demandes_groupe_pluriannuel
  ON public.demandes(groupe_pluriannuel_id)
  WHERE groupe_pluriannuel_id IS NOT NULL;

COMMENT ON COLUMN public.demandes.groupe_pluriannuel_id IS
  'UUID commun à toutes les années d''un même engagement pluriannuel déposé en une fois. NULL si demande annuelle classique ou renouvellement décidé année par année.';
COMMENT ON COLUMN public.demandes.numero_annee_dans_groupe IS
  'Position de cette demande dans son groupe pluriannuel (1, 2, 3…). NULL si pas de groupe.';
COMMENT ON COLUMN public.demandes.nombre_annees_total_groupe IS
  'Nombre total d''années dans ce groupe pluriannuel (2, 3 ou 4). NULL si pas de groupe.';

-- ============================================================================
-- Vue — Aides publiques cumulées sur 3 exercices (seuil 500 000 € Cerfa)
-- Utilisée côté API pour l'alerte réglementaire, pas en direct depuis le front.
-- ============================================================================
CREATE OR REPLACE VIEW public.v_aides_publiques_3ans AS
SELECT
  association_id,
  SUM(montant_obtenu) AS total_aides_3ans,
  COUNT(*) AS nb_subventions,
  array_agg(annee_millesime ORDER BY annee_millesime) FILTER (WHERE annee_millesime IS NOT NULL) AS annees_couvertes
FROM public.demandes
WHERE
  montant_obtenu IS NOT NULL
  AND statut = 'accepte'
  AND annee_millesime >= (EXTRACT(YEAR FROM now())::int - 2)
GROUP BY association_id;

COMMENT ON VIEW public.v_aides_publiques_3ans IS
  'Somme des subventions acceptées (montant_obtenu) par association sur les 3 derniers exercices. Utilisée pour l''alerte seuil 500 000 € du Cerfa (réglementation aides d''État européenne).';
