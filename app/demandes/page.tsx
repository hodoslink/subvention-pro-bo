"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { StatutBadge } from "@/components/StatutBadge";
import { ALL_STATUTS, STATUTS } from "@/lib/statuts";
import type { Demande, Statut } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type AssoOption = { id: string; nom: string; ville: string | null };
type NewDemandeForm = { association_id: string; titre_projet: string; bailleur_nom: string; type_demande: 'premiere' | 'renouvellement' };

function NouvellDemandeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [assosLoading, setAssosLoading] = useState(true);
  const [assos, setAssos] = useState<AssoOption[]>([]);
  const [assoSearch, setAssoSearch] = useState('');
  const [form, setForm] = useState<NewDemandeForm>({ association_id: '', titre_projet: '', bailleur_nom: '', type_demande: 'premiere' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/associations')
      .then(r => r.json())
      .then(({ associations }) => { setAssos(associations || []); setAssosLoading(false); });
  }, []);

  const filteredAssos = assos.filter(a =>
    !assoSearch || a.nom.toLowerCase().includes(assoSearch.toLowerCase())
  );

  const submit = async () => {
    if (!form.association_id) { setError('Sélectionnez une association.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/demandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          association_id: form.association_id,
          type_demande: form.type_demande,
          titre_projet: form.titre_projet.trim() || undefined,
          bailleur_nom: form.bailleur_nom.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `Erreur ${res.status}`); return; }
      onCreated(data.demande.id);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Nouvelle demande</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Association *</label>
            <input
              className="field-input w-full mb-1"
              placeholder="Rechercher une association…"
              value={assoSearch}
              onChange={e => setAssoSearch(e.target.value)}
              autoFocus
            />
            {assosLoading ? (
              <p className="text-xs text-gray-400 px-1">Chargement…</p>
            ) : (
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
                {filteredAssos.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">Aucune association trouvée</p>
                ) : filteredAssos.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, association_id: a.id })); setAssoSearch(a.nom); }}
                    className={['w-full text-left px-3 py-2 text-sm transition-colors', form.association_id === a.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'].join(' ')}
                  >
                    {a.nom}{a.ville ? ` — ${a.ville}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Titre du projet</label>
            <input className="field-input w-full" value={form.titre_projet} onChange={e => setForm(f => ({ ...f, titre_projet: e.target.value }))} placeholder="ex : Ateliers numériques 2025" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Bailleur</label>
            <input className="field-input w-full" value={form.bailleur_nom} onChange={e => setForm(f => ({ ...f, bailleur_nom: e.target.value }))} placeholder="ex : Mairie de Paris" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
            <select className="field-input w-full" value={form.type_demande} onChange={e => setForm(f => ({ ...f, type_demande: e.target.value as 'premiere' | 'renouvellement' }))}>
              <option value="premiere">Première demande</option>
              <option value="renouvellement">Renouvellement</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn btn-ghost text-sm">Annuler</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary text-sm">
            {saving ? 'Création…' : 'Créer la demande'}
          </button>
        </div>
      </div>
    </div>
  );
}

type DemandeWithAsso = Demande & {
  associations: { nom: string; ville: string };
  date_limite_depot?: string | null;
};

type DeadlineStatus = 'urgent' | 'proche' | 'ok' | 'depasse' | null;

function getDeadlineStatus(dateStr: string | null | undefined): DeadlineStatus {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(dateStr);
  const diffDays = Math.floor(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0)  return 'depasse';
  if (diffDays <= 7)  return 'urgent';
  if (diffDays <= 30) return 'proche';
  return 'ok';
}

function DeadlineBadge({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-gray-300">—</span>;
  const status = getDeadlineStatus(date);
  const label = new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const styles: Record<NonNullable<DeadlineStatus>, string> = {
    urgent:  'bg-red-100 text-red-700 font-semibold',
    proche:  'bg-amber-100 text-amber-700',
    ok:      'bg-gray-100 text-gray-600',
    depasse: 'bg-gray-100 text-gray-400 line-through',
  };
  const prefix: Record<NonNullable<DeadlineStatus>, string> = {
    urgent: '🔴 ', proche: '🟡 ', ok: '', depasse: '',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status!]}`}>
      {prefix[status!]}{label}
    </span>
  );
}

const ANNEES = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

function DemandesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [demandes, setDemandes] = useState<DemandeWithAsso[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [statut, setStatut] = useState(searchParams.get('statut') || '');
  const [annee, setAnnee] = useState(searchParams.get('annee') || '');
  const [showModal, setShowModal] = useState(false);
  const [filtreUrgence, setFiltreUrgence] = useState(false);

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
        {showModal && (
          <NouvellDemandeModal
            onClose={() => setShowModal(false)}
            onCreated={(id) => { setShowModal(false); router.push(`/demandes/${id}`); }}
          />
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Toutes les demandes</h1>
          <button onClick={() => setShowModal(true)} className="btn btn-primary text-sm">+ Nouvelle demande</button>
        </div>

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
          <button
            className={`btn text-xs ${filtreUrgence ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltreUrgence(v => !v)}
          >
            🔴 Dépôt imminent
          </button>
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
                <th className="text-left px-4 py-3 font-medium">Dépôt</th>
                <th className="text-right px-4 py-3 font-medium">Montant</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Prestataire</th>
                <th className="text-left px-4 py-3 font-medium">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(() => {
                const demandesFiltrees = filtreUrgence
                  ? demandes.filter(d => {
                      const s = getDeadlineStatus(d.date_limite_depot);
                      return s === 'urgent' || s === 'proche';
                    })
                  : demandes;
                return loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              ) : demandesFiltrees.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Aucune demande trouvée</td></tr>
              ) : demandesFiltrees.map((d) => (
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
                  <td className="px-4 py-3"><DeadlineBadge date={d.date_limite_depot} /></td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {d.montant_demande ? d.montant_demande.toLocaleString('fr-FR') + ' €' : '—'}
                  </td>
                  <td className="px-4 py-3"><StatutBadge statut={d.statut} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{d.presta_redacteur || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(d.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ));
              })()}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400">
          {filtreUrgence
            ? demandes.filter(d => { const s = getDeadlineStatus(d.date_limite_depot); return s === 'urgent' || s === 'proche'; }).length
            : demandes.length
          } résultat{demandes.length !== 1 ? 's' : ''}
        </p>
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
