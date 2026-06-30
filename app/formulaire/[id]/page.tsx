import { getSupabaseServer } from '@/lib/supabase';
import FormulairePublicClient from './FormulairePublicClient';

export default async function FormulairePublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t: token } = await searchParams;

  if (!token) {
    return <PageErreur message="Lien invalide. Veuillez utiliser le lien complet envoyé par votre conseiller." />;
  }

  const supabase = getSupabaseServer();

  const { data: demande } = await supabase
    .from('demandes')
    .select('id, token_formulaire_public, formulaire_public_ouvert_le, details_json, montant_demande, bailleur_nom, date_limite_depot, titre_projet, periode_debut, periode_fin, objectif_projet, associations(nom)')
    .eq('id', id)
    .eq('token_formulaire_public', token)
    .single();

  if (!demande) {
    return <PageErreur message="Ce lien est invalide ou a expiré. Contactez votre conseiller." />;
  }

  // Mark first open (fire and forget)
  if (!demande.formulaire_public_ouvert_le) {
    supabase
      .from('demandes')
      .update({ formulaire_public_ouvert_le: new Date().toISOString() })
      .eq('id', id)
      .then(() => {});
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const association = (demande.associations as any);
  const associationNom: string = association?.nom ?? '';

  return (
    <FormulairePublicClient
      demandeId={id}
      token={token}
      associationNom={associationNom}
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
