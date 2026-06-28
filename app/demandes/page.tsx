"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { StatutBadge } from "@/components/StatutBadge";
import { ALL_STATUTS, STATUTS } from "@/lib/statuts";
import type { Demande, Statut } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type DemandeWithAsso = Demande & { associations: { nom: string; ville: string } };

const ANNEES = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

function DemandesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [demandes, setDemandes] = useState<DemandeWithAsso[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [statut, setStatut] = useState(searchParams.get('statut') || '');
  const [annee, setAnnee] = useState(searchParams.get('annee') || '');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statut) params.set('statut', statut);
    if (annee) params.set('annee', annee);

    const res = await fetch(`/api/demandes?${params}`);
    const json = await res.json();
    setDemandes(json.demandes || []);
    setLoading(false);
  }, [q, statut, annee]);

  useEffect(() => { load(); }, [load]);

  const updateUrl = (key: string, val: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (val) p.set(key, val); else p.delete(key);
    router.replace(`/demandes?${p}`);
  };

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Toutes les demandes</h1>

        {/* Filtres */}
        <div className="card flex flex-wrap gap-3 items-center">
          <input
            className="field-input max-w-xs"
            placeholder="Rechercher projet, bailleur…"
            value={q}
            onChange={(e) => { setQ(e.target.value); updateUrl('q', e.target.value); }}
          />
          <select
            className="field-input w-auto"
            value={statut}
            onChange={(e) => { setStatut(e.target.value); updateUrl('statut', e.target.value); }}
          >
            <option value="">Tous les statuts</option>
            {ALL_STATUTS.map((s) => (
              <option key={s} value={s}>{STATUTS[s].label}</option>
            ))}
          </select>
          <select
            className="field-input w-auto"
            value={annee}
            onChange={(e) => { setAnnee(e.target.value); updateUrl('annee', e.target.value); }}
          >
            <option value="">Toutes les années</option>
            {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {(q || statut || annee) && (
            <button
              className="btn btn-ghost text-xs"
              onClick={() => { setQ(''); setStatut(''); setAnnee(''); router.replace('/demandes'); }}
            >
              ✕ Effacer les filtres
            </button>
          )}
        </div>

        {/* Tableau */}
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Association</th>
                <th className="text-left px-4 py-3 font-medium">Projet</th>
                <th className="text-left px-4 py-3 font-medium">Bailleur</th>
                <th className="text-right px-4 py-3 font-medium">Montant</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Prestataire</th>
                <th className="text-left px-4 py-3 font-medium">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              ) : demandes.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucune demande trouvée</td></tr>
              ) : demandes.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/associations/${d.association_id}`} className="text-blue-600 hover:underline font-medium">
                      {d.associations?.nom}
                    </Link>
                    {d.associations?.ville && (
                      <span className="text-xs text-gray-400 ml-1">({d.associations.ville})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/demandes/${d.id}`} className="text-gray-900 hover:text-blue-600 font-medium">
                      {d.titre_projet || '(sans titre)'}
                    </Link>
                    {d.type_demande === 'renouvellement' && (
                      <span className="ml-1.5 text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">↻</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.bailleur_nom}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {d.montant_demande ? d.montant_demande.toLocaleString('fr-FR') + ' €' : '—'}
                  </td>
                  <td className="px-4 py-3"><StatutBadge statut={d.statut} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{d.presta_redacteur || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400">{demandes.length} résultat{demandes.length !== 1 ? 's' : ''}</p>
      </div>
    </AppShell>
  );
}

export default function DemandesPage() {
  return (
    <Suspense fallback={<AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>}>
      <DemandesContent />
    </Suspense>
  );
}
