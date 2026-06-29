-- ============================================================================
-- Migration v3 — Brief de mission, référentiel bailleurs, chaînage demandes
-- ============================================================================

-- 1. Colonnes supplémentaires sur associations (contexte + scraping)
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS site_web_url text,
  ADD COLUMN IF NOT EXISTS resume_scrape text,
  ADD COLUMN IF NOT EXISTS resume_scrape_le timestamp with time zone,
  ADD COLUMN IF NOT EXISTS resume_edite text,
  ADD COLUMN IF NOT EXISTS resume_edite_par text,
  ADD COLUMN IF NOT EXISTS resume_edite_le timestamp with time zone,
  ADD COLUMN IF NOT EXISTS secteur_activite text,
  ADD COLUMN IF NOT EXISTS annee_creation integer;

COMMENT ON COLUMN public.associations.resume_scrape IS
  'Résumé généré automatiquement via scraping + modèle Hugging Face. Régénéré à chaque scraping — volatile.';
COMMENT ON COLUMN public.associations.resume_edite IS
  'Version corrigée/validée par le consultant. Prend toujours le dessus sur resume_scrape si non-null. Ne jamais écraser automatiquement.';

-- 2. Historique de scraping
CREATE TABLE IF NOT EXISTS public.scraping_historique (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  association_id uuid NOT NULL,
  url_scrapee text NOT NULL,
  contenu_brut text,
  resume_genere text,
  modele_utilise text,
  statut text DEFAULT 'succes',
  erreur_detail text,
  CONSTRAINT scraping_historique_pkey PRIMARY KEY (id),
  CONSTRAINT scraping_historique_association_id_fkey
    FOREIGN KEY (association_id) REFERENCES public.associations(id) ON DELETE CASCADE,
  CONSTRAINT scraping_historique_statut_check
    CHECK (statut IN ('succes', 'echec', 'partiel'))
);

CREATE INDEX IF NOT EXISTS idx_scraping_historique_association_id
  ON public.scraping_historique(association_id);

-- 3. Référentiel des bailleurs
CREATE TABLE IF NOT EXISTS public.bailleurs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  nom text NOT NULL,
  type_bailleur text,
  plateforme_nom text,
  plateforme_url text,
  plateforme_type text DEFAULT 'autre',
  contact_referent_nom text,
  contact_referent_email text,
  contact_referent_telephone text,
  notes text,
  CONSTRAINT bailleurs_pkey PRIMARY KEY (id)
);

-- 4. Colonnes supplémentaires sur demandes
ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS bailleur_id uuid REFERENCES public.bailleurs(id),
  ADD COLUMN IF NOT EXISTS plateforme_url_specifique text,
  ADD COLUMN IF NOT EXISTS plateforme_identifiant_dossier text,
  ADD COLUMN IF NOT EXISTS demande_precedente_id uuid REFERENCES public.demandes(id),
  ADD COLUMN IF NOT EXISTS ce_qui_change_cette_annee text,
  ADD COLUMN IF NOT EXISTS annee_millesime integer;

COMMENT ON COLUMN public.demandes.demande_precedente_id IS
  'Lien explicite vers la demande N-1 chez le même bailleur (renouvellement). Choisi manuellement par le consultant.';
COMMENT ON COLUMN public.demandes.ce_qui_change_cette_annee IS
  'Narratif libre du consultant : ce qui change vs la demande précédente. Complète le diff automatique des chiffres.';

CREATE INDEX IF NOT EXISTS idx_demandes_bailleur_id ON public.demandes(bailleur_id);
CREATE INDEX IF NOT EXISTS idx_demandes_demande_precedente_id ON public.demandes(demande_precedente_id);

-- 5. Fonction de suggestion de demande précédente
CREATE OR REPLACE FUNCTION public.suggerer_demande_precedente(p_demande_id uuid)
RETURNS TABLE (
  demande_candidate_id uuid,
  titre_projet text,
  annee_millesime integer,
  montant_demande numeric,
  montant_obtenu numeric,
  statut text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d2.id,
    d2.titre_projet,
    d2.annee_millesime,
    d2.montant_demande,
    d2.montant_obtenu,
    d2.statut
  FROM public.demandes d1
  JOIN public.demandes d2
    ON d2.association_id = d1.association_id
    AND (d2.bailleur_id = d1.bailleur_id OR d2.bailleur_nom = d1.bailleur_nom)
    AND d2.id != d1.id
    AND (d2.annee_millesime IS NULL OR d1.annee_millesime IS NULL OR d2.annee_millesime < d1.annee_millesime)
  WHERE d1.id = p_demande_id
  ORDER BY d2.annee_millesime DESC NULLS LAST, d2.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- 6. Vue brief de mission
CREATE OR REPLACE VIEW public.v_brief_mission AS
SELECT
  d_actuelle.id AS demande_id,
  d_actuelle.titre_projet,
  d_actuelle.annee_millesime AS annee_actuelle,

  a.nom AS association_nom,
  a.site_web_url,
  COALESCE(a.resume_edite, a.resume_scrape) AS resume_association,
  a.secteur_activite,

  CASE WHEN d_actuelle.demande_precedente_id IS NOT NULL THEN 'renouvellement' ELSE 'premiere' END AS type_renouvellement,

  COALESCE(d_actuelle.plateforme_url_specifique, b.plateforme_url) AS plateforme_url_effective,
  b.plateforme_nom,
  b.plateforme_type,
  d_actuelle.plateforme_identifiant_dossier,

  d_precedente.annee_millesime AS annee_precedente,
  d_precedente.montant_demande AS montant_demande_precedent,
  d_precedente.montant_obtenu AS montant_obtenu_precedent,
  d_precedente.nb_beneficiaires_estime AS beneficiaires_precedent,
  d_precedente.statut AS statut_demande_precedente,

  d_actuelle.montant_demande AS montant_demande_actuel,
  d_actuelle.nb_beneficiaires_estime AS beneficiaires_actuel,

  (d_actuelle.montant_demande - d_precedente.montant_demande) AS ecart_montant_demande,
  CASE
    WHEN d_precedente.montant_demande IS NOT NULL AND d_precedente.montant_demande != 0
    THEN ROUND(
      ((d_actuelle.montant_demande - d_precedente.montant_demande) / d_precedente.montant_demande) * 100,
      1
    )
    ELSE NULL
  END AS ecart_montant_demande_pct,

  (d_actuelle.nb_beneficiaires_estime - d_precedente.bilan_nb_beneficiaires_reel) AS ecart_beneficiaires,

  d_actuelle.ce_qui_change_cette_annee,

  b.contact_referent_nom,
  b.contact_referent_email,
  b.contact_referent_telephone

FROM public.demandes d_actuelle
LEFT JOIN public.demandes d_precedente ON d_precedente.id = d_actuelle.demande_precedente_id
LEFT JOIN public.associations a ON a.id = d_actuelle.association_id
LEFT JOIN public.bailleurs b ON b.id = d_actuelle.bailleur_id;

COMMENT ON VIEW public.v_brief_mission IS
  'Écran brief de mission : contexte association, statut renouvellement, plateforme, diff chiffrés vs demande N-1.';
