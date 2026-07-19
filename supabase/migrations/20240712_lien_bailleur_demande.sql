-- ============================================================================
-- Migration — Lien de référence budget_lignes → demande + propagation du réel
-- ADD ONLY — aucune colonne existante supprimée ou renommée
-- ============================================================================

-- 1. budget_lignes : référence pure vers une autre demande de la même association
ALTER TABLE public.budget_lignes
  ADD COLUMN IF NOT EXISTS demande_liee_id uuid REFERENCES public.demandes(id) ON DELETE SET NULL;

ALTER TABLE public.budget_lignes
  DROP CONSTRAINT IF EXISTS budget_lignes_demande_liee_not_self;
ALTER TABLE public.budget_lignes
  ADD CONSTRAINT budget_lignes_demande_liee_not_self
  CHECK (demande_liee_id IS NULL OR demande_liee_id <> demande_id);

CREATE INDEX IF NOT EXISTS idx_budget_lignes_demande_liee_id
  ON public.budget_lignes(demande_liee_id);

COMMENT ON COLUMN public.budget_lignes.demande_liee_id IS
  'Référence pure vers une autre demande de la même association (ex: même bailleur
   suivi comme dossier séparé). N''affecte jamais montant/statut_financement de
   cette ligne, qui restent 100% manuels. Sert uniquement à la propagation du
   montant réel entre bilans (voir bilan_lignes.demande_liee_id).';

-- 2. bilan_lignes : copié au snapshot, support de la propagation du montant réel
ALTER TABLE public.bilan_lignes
  ADD COLUMN IF NOT EXISTS demande_liee_id uuid REFERENCES public.demandes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bilan_lignes_demande_liee_id
  ON public.bilan_lignes(demande_liee_id);

COMMENT ON COLUMN public.bilan_lignes.demande_liee_id IS
  'Copié depuis budget_lignes.demande_liee_id au moment du snapshot. Permet de
   propager montant_reel entre tous les bilan_lignes qui partagent la même
   demande liée (voir PATCH /api/bilan-lignes/[id]).';
