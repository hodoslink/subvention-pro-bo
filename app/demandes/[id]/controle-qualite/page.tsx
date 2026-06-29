"use client";
import { useEffect, useState, use, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import type { ControleQualite } from "@/lib/supabase";

const CATEGORIES = {
  coherence_donnees: 'Cohérence des données',
  coherence_recit: 'Cohérence du récit',
  conformite_administrative: 'Conformité administrative',
} as const;

const CAT_COLORS = {
  coherence_donnees: 'bg-blue-50 border-blue-200',
  coherence_recit: 'bg-purple-50 border-purple-200',
  conformite_administrative: 'bg-amber-50 border-amber-200',
} as const;

export default function ControleQualitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [controles, setControles] = useState<ControleQualite[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultantNom, setConsultantNom] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [deposant, setDeposant] = useState(false);
  const [demandeStatut, setDemandeStatut] = useState('');
  const [depositError, setDepositError] = useState('');

  const load = useCallback(async () => {
    const [rControles, rDemande] = await Promise.all([
      fetch(`/api/demandes/${id}/controles-qualite`),
      fetch(`/api/demandes/${id}`),
    ]);
    const { controles: c } = await rControles.json();
    const { demande } = await rDemande.json();
    setControles(c ?? []);
    setDemandeStatut(demande?.statut ?? '');
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function toggleControle(controle: ControleQualite) {
    setToggling(controle.id);
    const r = await fetch(`/api/controles-qualite/${controle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        est_valide: !controle.est_valide,
        valide_par: consultantNom || null,
      }),
    });
    if (r.ok) {
      const { controle: updated } = await r.json();
      setControles(prev => prev.map(c => c.id === controle.id ? updated : c));
    }
    setToggling(null);
  }

  async function marquerDepose() {
    const blocking = controles.filter(c => !c.est_valide);
    if (blocking.length > 0) {
      setDepositError(`${blocking.length} point${blocking.length > 1 ? 's' : ''} de contrôle non validé${blocking.length > 1 ? 's' : ''}`);
      return;
    }
    setDeposant(true);
    setDepositError('');
    await fetch(`/api/demandes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'depose' }),
    });
    await load();
    setDeposant(false);
  }

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;

  const totalValid = controles.filter(c => c.est_valide).length;
  const total = controles.length;
  const allValid = totalValid === total && total > 0;
  const pct = total > 0 ? Math.round((totalValid / total) * 100) : 0;

  const grouped = Object.keys(CATEGORIES).map(cat => ({
    cat: cat as keyof typeof CATEGORIES,
    items: controles.filter(c => c.categorie === cat),
  }));

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href={`/demandes/${id}`} className="text-xs text-gray-400 hover:text-gray-600">← Retour au dossier</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Contrôle qualité pré-dépôt</h1>
          <p className="text-xs text-gray-500 mt-0.5">Grille de validation consultant — tous les points doivent être validés avant dépôt</p>
        </div>

        {/* Progression */}
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{totalValid} / {total} points validés</span>
            <span className={['text-sm font-bold', allValid ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500'].join(' ')}>{pct} %</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={['h-full rounded-full transition-all', allValid ? 'bg-green-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'].join(' ')}
              style={{ width: `${pct}%` }}
            />
          </div>
          {allValid && demandeStatut !== 'depose' && (
            <p className="text-xs text-green-700 font-medium">✓ Tous les points validés — le dossier peut être marqué comme déposé</p>
          )}
          {demandeStatut === 'depose' && (
            <p className="text-xs text-blue-700 font-medium">✓ Dossier déposé</p>
          )}
        </div>

        {/* Nom du consultant */}
        <div className="card">
          <label className="text-xs font-medium text-gray-600">Nom du consultant (optionnel, ajouté à chaque validation)</label>
          <input className="field-input mt-1 text-sm" value={consultantNom} onChange={e => setConsultantNom(e.target.value)} placeholder="Ex : Marie Dupont" />
        </div>

        {/* Grille par catégorie */}
        {grouped.map(({ cat, items }) => (
          <div key={cat} className={['card border space-y-2', CAT_COLORS[cat]].join(' ')}>
            <h2 className="font-semibold text-gray-800 text-sm">{CATEGORIES[cat]}</h2>
            {items.map(ctrl => (
              <div key={ctrl.id} className="flex items-start gap-3 py-2 border-b border-black/5 last:border-0">
                <button
                  onClick={() => toggleControle(ctrl)}
                  disabled={toggling === ctrl.id}
                  className={['shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors', ctrl.est_valide ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 hover:border-green-400'].join(' ')}
                >
                  {toggling === ctrl.id ? <span className="text-xs">…</span> : ctrl.est_valide ? '✓' : ''}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={['text-sm', ctrl.est_valide ? 'text-gray-500 line-through' : 'text-gray-800'].join(' ')}>{ctrl.libelle_controle}</p>
                  {ctrl.est_valide && ctrl.valide_par && (
                    <p className="text-xs text-gray-400">
                      Validé par {ctrl.valide_par}
                      {ctrl.valide_le && <span> · {new Date(ctrl.valide_le).toLocaleDateString('fr-FR')}</span>}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Action dépôt */}
        {demandeStatut !== 'depose' && (
          <div className="card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Marquer le dossier comme déposé</p>
                <p className="text-xs text-gray-500 mt-0.5">Passe le statut à « Déposé » et horodate l'action dans le journal.</p>
                {depositError && <p className="text-xs text-red-600 mt-1">⚠ {depositError} — cochez tous les points avant de déposer.</p>}
              </div>
              <button
                onClick={marquerDepose}
                disabled={deposant || !allValid}
                className={['btn whitespace-nowrap', allValid ? 'btn-primary' : 'btn-secondary opacity-60 cursor-not-allowed'].join(' ')}
              >
                {deposant ? 'Enregistrement…' : '📨 Marquer comme déposé'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
