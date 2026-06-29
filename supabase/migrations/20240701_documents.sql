-- ============================================================================
-- Migration — stockage de documents (association + demande)
-- ============================================================================
-- Prérequis Supabase Storage : créer un bucket PRIVÉ nommé "subvention-docs"
-- dans le dashboard Supabase → Storage → New bucket.
-- Arborescence : associations/{association_id}/{nom} | demandes/{demande_id}/{nom}
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. documents_association (table 100% nouvelle)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents_association (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  association_id uuid NOT NULL,
  nom_fichier text NOT NULL,
  type_doc text,               -- 'statuts' | 'comptes_annuels' | 'pv_ag' | 'rib' | 'autre'
  storage_path text NOT NULL,  -- chemin dans le bucket, ex: associations/xxx/statuts.pdf
  taille_octets bigint,
  mime_type text,

  CONSTRAINT documents_association_pkey PRIMARY KEY (id),
  CONSTRAINT documents_association_asso_fkey FOREIGN KEY (association_id)
    REFERENCES public.associations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_association_asso_id
  ON public.documents_association(association_id);


-- ----------------------------------------------------------------------------
-- 2. documents_demande — créer si inexistante ou compléter si existante
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents_demande (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  demande_id uuid,
  nom_fichier text,
  storage_path text,
  taille_octets bigint,
  mime_type text
);

-- Ajouter les colonnes manquantes si la table existait déjà avec un schéma partiel
ALTER TABLE public.documents_demande ADD COLUMN IF NOT EXISTS nom_fichier text;
ALTER TABLE public.documents_demande ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.documents_demande ADD COLUMN IF NOT EXISTS taille_octets bigint;
ALTER TABLE public.documents_demande ADD COLUMN IF NOT EXISTS mime_type text;
