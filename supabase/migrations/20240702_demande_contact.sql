-- Contact spécifique à la demande (différent du contact de l'association)
-- Si vide, l'interface affiche le contact de l'association par défaut.
ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS contact_nom text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_telephone text;

COMMENT ON COLUMN public.demandes.contact_nom IS
  'Contact référent pour cette demande spécifique. Si null, utiliser le contact de l''association.';
