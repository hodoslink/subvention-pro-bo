-- ============================================================================
-- Migration — Authentification Supabase Auth + Multi-consultants + RLS
-- Introduit la table profiles (liée à auth.users), le trigger de création
-- automatique de profil, les colonnes consultant_id / user_id sur les tables
-- existantes, et active le Row Level Security avec des politiques par rôle.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 — Table profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,            -- même id que auth.users.id
  created_at timestamptz DEFAULT now(),
  role text NOT NULL DEFAULT 'consultant'
    CHECK (role IN ('admin', 'consultant')),
  nom_complet text NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.profiles IS
  'Profils des consultants et admins. Créé automatiquement via trigger sur auth.users.';
COMMENT ON COLUMN public.profiles.role IS
  'admin : accès total. consultant : accès limité à son portefeuille.';

-- ----------------------------------------------------------------------------
-- 1.2 — Trigger de création automatique du profil
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, nom_complet, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'consultant')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 1.3 — Colonnes consultant_id / user_id sur les tables existantes
-- ----------------------------------------------------------------------------
ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS consultant_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demandes_consultant_id
  ON public.demandes(consultant_id);

COMMENT ON COLUMN public.demandes.consultant_id IS
  'Consultant assigné à cette demande. Remplace progressivement presta_redacteur (text).';

ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS consultant_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_associations_consultant_id
  ON public.associations(consultant_id);

COMMENT ON COLUMN public.associations.consultant_id IS
  'Consultant référent pour cette association.';

ALTER TABLE public.journal
  ADD COLUMN IF NOT EXISTS user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.journal.user_id IS
  'Consultant ou système ayant généré cet événement. Null = action système ou migration.';

-- ----------------------------------------------------------------------------
-- 1.4 — Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controles_qualite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents_demande ENABLE ROW LEVEL SECURITY;

-- Helper : est-ce que l'utilisateur courant est admin ?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Politiques profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- Politiques demandes
DROP POLICY IF EXISTS "demandes_admin_all" ON public.demandes;
CREATE POLICY "demandes_admin_all"
  ON public.demandes FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "demandes_consultant_own" ON public.demandes;
CREATE POLICY "demandes_consultant_own"
  ON public.demandes FOR ALL
  USING (consultant_id = auth.uid());

-- Politiques associations
DROP POLICY IF EXISTS "associations_admin_all" ON public.associations;
CREATE POLICY "associations_admin_all"
  ON public.associations FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "associations_consultant_own" ON public.associations;
CREATE POLICY "associations_consultant_own"
  ON public.associations FOR ALL
  USING (consultant_id = auth.uid());

-- Politiques journal (lecture seule pour les consultants sur leurs demandes)
DROP POLICY IF EXISTS "journal_admin_all" ON public.journal;
CREATE POLICY "journal_admin_all"
  ON public.journal FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "journal_consultant_own" ON public.journal;
CREATE POLICY "journal_consultant_own"
  ON public.journal FOR ALL
  USING (user_id = auth.uid());

-- budget_lignes, controles_qualite, documents_demande : héritent des droits
-- via la demande parente (l'admin ou consultant qui peut lire la demande
-- peut lire ses sous-tables)
DROP POLICY IF EXISTS "budget_lignes_via_demande" ON public.budget_lignes;
CREATE POLICY "budget_lignes_via_demande"
  ON public.budget_lignes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.demandes d
      WHERE d.id = demande_id
        AND (d.consultant_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "controles_qualite_via_demande" ON public.controles_qualite;
CREATE POLICY "controles_qualite_via_demande"
  ON public.controles_qualite FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.demandes d
      WHERE d.id = demande_id
        AND (d.consultant_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "documents_demande_via_demande" ON public.documents_demande;
CREATE POLICY "documents_demande_via_demande"
  ON public.documents_demande FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.demandes d
      WHERE d.id = demande_id
        AND (d.consultant_id = auth.uid() OR public.is_admin())
    )
  );

-- ⚠️  RAPPEL : pousser cette migration sur l'instance Supabase distante AVANT
-- toute autre étape : `supabase db push` ou via le dashboard Supabase >
-- SQL Editor. Ne pas juste committer — c'est l'incident PGRST204 qu'on a déjà eu.
-- Après push, activer Supabase Auth dans le dashboard : Authentication >
-- Providers > Email (activer "Enable Email Confirmations" = false pour
-- l'environnement de dev, true en prod).
