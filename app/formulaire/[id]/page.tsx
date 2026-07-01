import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getSupabaseServer } from '@/lib/supabase';
import FormulairePublicClient from './FormulairePublicClient';

export default async function FormulairePublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <PageErreur message="Lien expiré ou invalide. Demandez à votre conseiller de générer un nouveau lien." />;
  }

  const supabaseAdmin = getSupabaseServer();

  const { data: demande, error: demandeErr } = await supabaseAdmin
    .from('demandes')
    .select('id, formulaire_public_ouvert_le, details_json, montant_demande, bailleur_nom, date_limite_depot, titre_projet, periode_debut, periode_fin, objectif_projet, consultant_id, associations(nom)')
    .eq('id', id)
    .single();

  if (demandeErr || !demande) {
    return <PageErreur message="Ce formulaire est introuvable. Contactez votre conseiller." />;
  }

  // Mark first open (fire and forget)
  if (!demande.formulaire_public_ouvert_le) {
    supabaseAdmin
      .from('demandes')
      .update({ formulaire_public_ouvert_le: new Date().toISOString() })
      .eq('id', id)
      .then(() => {});
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const association = (demande.associations as any);
  const associationNom: string = association?.nom ?? '';

  // Fetch consultant name separately to avoid FK join issues
  let consultantNom = '';
  if (demande.consultant_id) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('nom_complet')
      .eq('id', demande.consultant_id)
      .single();
    consultantNom = profile?.nom_complet ?? '';
  }

  return (
    <FormulairePublicClient
      demandeId={id}
      associationNom={associationNom}
      consultantNom={consultantNom}
      dateLimiteDepot={demande.date_limite_depot ?? null}
      titreProjet={demande.titre_projet ?? null}
      bailleurNom={demande.bailleur_nom ?? null}
      montantDemande={demande.montant_demande ?? null}
      periodeDebut={demande.periode_debut ?? null}
      periodeFin={demande.periode_fin ?? null}
      objectifProjet={demande.objectif_projet ?? null}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialDetails={(demande.details_json ?? {}) as Record<string, any>}
    />
  );
}

function PageErreur({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-semibold text-gray-800">Accès impossible</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
