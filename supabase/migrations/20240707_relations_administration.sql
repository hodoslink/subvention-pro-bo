-- Migration: Relations administratives
-- Ajoute le champ sigle sur associations (appartient à l'identité, pas à details_json)
-- Les autres champs de la partie C (agrements, reseaux_affiliation, etc.) vivent dans details_json (jsonb) — pas de migration nécessaire.

ALTER TABLE associations
  ADD COLUMN IF NOT EXISTS sigle text;

-- Type de dossier cible pour l'écran fiche demande (E3)
ALTER TABLE demandes
  ADD COLUMN IF NOT EXISTS type_cerfa_cible text;

COMMENT ON COLUMN associations.sigle IS 'Sigle ou acronyme de l''association (ex: SATO, MJC13...)';
COMMENT ON COLUMN demandes.type_cerfa_cible IS 'Type de formulaire Cerfa visé — conditionne la checklist de complétion (E3)';
