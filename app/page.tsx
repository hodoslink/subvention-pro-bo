import { AppShell } from "@/components/AppShell";
import { getSupabaseServer } from "@/lib/supabase";
import { StatutBadge } from "@/components/StatutBadge";
import { STATUTS, STATUTS_ACTIFS } from "@/lib/statuts";
import type { Statut, Demande } from "@/lib/supabase";
import Link from "next/link";

export const revalidate = 0;

async function getStats() {
  const supabase = getSupabaseServer();
  const { data: demandes } = await supabase
    .from('demandes')
    .select('statut, montant_demande, montant_obtenu, created_at');

  const all = (demandes || []) as Pick<Demande, 'statut' | 'montant_demande' | 'montant_obtenu' | 'created_at'>[];
  const byStatut: Partial<Record<Statut, number>> = {};
  all.forEach((d) => {
    byStatut[d.statut] = (byStatut[d.statut] || 0) + 1;
  });

  return {
    byStatut,
    enCours: all.filter((d) => STATUTS_ACTIFS.includes(d.statut as Statut)).length,
    acceptes: byStatut['accepte'] || 0,
    total: all.length,
    totalMontantObtenu: all.reduce((s, d) => s + (d.montant_obtenu || 0), 0),
  };
}

async function getRecentDemandes() {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('demandes')
    .select('id, titre_projet, statut, bailleur_nom, montant_demande, created_at, associations(nom)')
    .order('created_at', { ascending: false })
    .limit(8);
  return (data || []) as unknown as (Demande & { associations: { nom: string } })[];
}

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([getStats(), getRecentDemandes()]);

  const kpis = [
    { label: 'En cours', value: stats.enCours, color: 'text-blue-600' },
    { label: 'Total dossiers', value: stats.total, color: 'text-gray-900' },
    { label: 'Acceptés', value: stats.acceptes, color: 'text-green-600' },
    { label: 'Obtenu (total)', value: stats.totalMontantObtenu.toLocaleString('fr-FR') + ' €', color: 'text-green-600' },
  ];

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de tous les dossiers</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="card">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Pipeline par statut</h2>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(STATUTS) as Statut[]).map((s) => (
              <Link
                key={s}
                href={`/demandes?statut=${s}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <StatutBadge statut={s} />
                <span className="text-sm font-semibold text-gray-700">{stats.byStatut[s] || 0}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Derniers dossiers</h2>
            <Link href="/demandes" className="text-xs text-blue-600 hover:underline">Voir tout →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.map((d) => (
              <Link
                key={d.id}
                href={`/demandes/${d.id}`}
                className="flex items-center justify-between py-2.5 hover:bg-gray-50 px-1 rounded transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {d.titre_projet || '(sans titre)'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(d.associations as { nom: string })?.nom} — {d.bailleur_nom}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {d.montant_demande && (
                    <span className="text-xs text-gray-500">{d.montant_demande.toLocaleString('fr-FR')} €</span>
                  )}
                  <StatutBadge statut={d.statut} />
                </div>
              </Link>
            ))}
            {recent.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Aucun dossier pour l'instant</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
