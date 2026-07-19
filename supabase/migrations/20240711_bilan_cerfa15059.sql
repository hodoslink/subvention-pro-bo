-- ============================================================================
-- Migration — Conformité CERFA 15059 du module bilans
-- ADD ONLY — aucune colonne existante supprimée ou renommée
-- ============================================================================

-- 1. bilan_lignes : propager les champs déjà présents sur budget_lignes
--    mais actuellement perdus lors du snapshot (est_charge_commune,
--    cle_repartition, est_valorisation_benevolat, piece_justificative_url).
ALTER TABLE public.bilan_lignes
  ADD COLUMN IF NOT EXISTS est_charge_commune boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cle_repartition text,
  ADD COLUMN IF NOT EXISTS est_valorisation_benevolat boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS piece_justificative_url text;

-- 2. bilans : feuillet 1 (qualitatif structuré) + feuillet 3 (annexe)
ALTER TABLE public.bilans
  ADD COLUMN IF NOT EXISTS beneficiaires_par_type jsonb,
    -- ex: [{"type": "Personnes en situation d'obésité", "nombre": 159}, ...]
  ADD COLUMN IF NOT EXISTS dates_lieux_realisation jsonb,
    -- ex: [{"date_debut": "2026-01-01", "date_fin": "2026-07-03", "lieu": "Clichy-sous-Bois"}, ...]
  ADD COLUMN IF NOT EXISTS regles_repartition_charges_indirectes text,
  ADD COLUMN IF NOT EXISTS methode_valorisation_cvn text,
  ADD COLUMN IF NOT EXISTS observations text;

COMMENT ON COLUMN public.bilans.beneficiaires_par_type IS
  'Ventilation des bénéficiaires par type de public, requis feuillet 1 du CERFA 15059.';
COMMENT ON COLUMN public.bilans.regles_repartition_charges_indirectes IS
  'Feuillet 3 : ex. quote-part loyer/salaires affectée à l''action.';
COMMENT ON COLUMN public.bilans.observations IS
  'Feuillet 3 : case "Observations à formuler sur le compte rendu financier".';

-- 3. pieces_requises : scoper une partie de la checklist au bilan
--    (le compte-rendu financier doit être accompagné du dernier rapport
--    annuel d'activité et des comptes approuvés du dernier exercice clos —
--    exigence CERFA distincte de la checklist de dépôt de la demande).
ALTER TABLE public.pieces_requises
  ADD COLUMN IF NOT EXISTS bilan_id uuid REFERENCES public.bilans(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pieces_requises_bilan_id
  ON public.pieces_requises(bilan_id);

COMMENT ON COLUMN public.pieces_requises.bilan_id IS
  'NULL = pièce liée à la demande initiale. Renseigné = pièce liée à un bilan spécifique
   (ex: rapport d''activité N, comptes approuvés N à joindre au compte-rendu financier).';

-- 4. associations : rna / siret existent déjà (vérifié dans supabase_schema).
--    Seule la date d'inscription au registre Alsace-Moselle manque (page de
--    garde CERFA pour les associations de droit local).
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS date_inscription_alsace_moselle date;
