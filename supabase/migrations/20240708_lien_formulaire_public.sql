-- ============================================================================
-- Migration — Lien formulaire public pour l'association
-- Ajoute les colonnes nécessaires au mécanisme de token d'accès au formulaire
-- public ainsi que la date limite de dépôt fixée par le bailleur.
-- ============================================================================

ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS token_formulaire_public    text,
  ADD COLUMN IF NOT EXISTS token_formulaire_genere_le timestamptz,
  ADD COLUMN IF NOT EXISTS formulaire_public_ouvert_le timestamptz,
  ADD COLUMN IF NOT EXISTS formulaire_public_rempli_le timestamptz,
  ADD COLUMN IF NOT EXISTS date_limite_depot          date;

COMMENT ON COLUMN public.demandes.token_formulaire_public IS
  'Secret opaque inclus dans l''URL envoyée à l''association (/formulaire/{id}?t={token}).
   Régénérer invalide l''ancien lien. NULL = lien jamais généré.';

COMMENT ON COLUMN public.demandes.token_formulaire_genere_le IS
  'Horodatage de la dernière génération (ou régénération) du token.';

COMMENT ON COLUMN public.demandes.formulaire_public_ouvert_le IS
  'Première ouverture du lien par l''association (pour alerter le consultant).
   NULL = pas encore ouvert.';

COMMENT ON COLUMN public.demandes.formulaire_public_rempli_le IS
  'Horodatage de la dernière sauvegarde reçue depuis le formulaire public.
   NULL = aucune réponse enregistrée.';

COMMENT ON COLUMN public.demandes.date_limite_depot IS
  'Date limite de dépôt du dossier fixée par le bailleur. Affichée en priorité
   dans le formulaire public pour que l''association connaisse son échéance.';

-- Index unique PARTIEL : un token unique par demande, recherche rapide par token.
-- Les demandes sans token (IS NULL) ne participent pas à la contrainte UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS idx_demandes_token_formulaire_public
  ON public.demandes(token_formulaire_public)
  WHERE token_formulaire_public IS NOT NULL;

-- ⚠️  RAPPEL : cette migration doit être poussée sur l'instance Supabase distante
-- via `supabase db push` (ou équivalent dans le dashboard Supabase → SQL Editor)
-- AVANT de tester les routes /api/demandes/[id]/lien-formulaire et
-- /api/public/formulaire/[id] — sans ça, Supabase retourne une erreur PGRST204
-- (colonne inconnue) sur le premier PATCH qui touche ces colonnes.
