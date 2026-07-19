"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Bailleur, BudgetLigneDB, BudgetEquilibre } from "@/lib/supabase";

type LignePlan = {
  id?: string;            // id de budget_lignes si déjà sauvegardée
  bailleur_id?: string;
  bailleur_nom_libre: string;
  montant: string;
  statut_financement: 'obtenu' | 'demande' | 'envisage' | '';
  demande_liee_id?: string | null;   // référence pure — ne modifie jamais montant/statut
};

type DemandeLiable = {
  id: string;
  titre_projet?: string | null;
  bailleur_nom?: string | null;
  statut: string;
};

const STATUT_LABEL: Record<string, { l: string; cls: string }> = {
  obtenu:  { l: 'Obtenu',   cls: 'bg-green-100 text-green-700' },
  demande: { l: 'Demandé',  cls: 'bg-blue-100 text-blue-700' },
  envisage:{ l: 'Envisagé', cls: 'bg-gray-100 text-gray-500' },
};

function emptyLigne(): LignePlan {
  return { bailleur_nom_libre: '', montant: '', statut_financement: '', demande_liee_id: null };
}

function lignesFromBudget(lignes: BudgetLigneDB[]): LignePlan[] {
  const l74 = lignes.filter(l => l.compte === '74' && l.sens === 'produit' && l.cle_generation === null);
  if (l74.length === 0) return [emptyLigne()];
  return l74.map(l => ({
    id: l.id,
    bailleur_id: undefined,
    bailleur_nom_libre: l.bailleur_detail ?? l.sous_categorie ?? '',
    montant: l.montant.toString(),
    statut_financement: (l.statut_financement as LignePlan['statut_financement']) || '',
    demande_liee_id: l.demande_liee_id ?? null,
  }));
}

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

export function PlanFinancement({
  demandeId,
  associationId,
  budgetLignes,
  equilibre,
  onSaved,
}: {
  demandeId: string;
  associationId?: string;
  budgetLignes: BudgetLigneDB[];
  equilibre: BudgetEquilibre | null;
  onSaved: () => void;
}) {
  const [lignes, setLignes] = useState<LignePlan[]>(() => lignesFromBudget(budgetLignes));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState<Record<number, string>>({});
  const [suggestions, setSuggestions] = useState<Record<number, Bailleur[]>>({});
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [linkIdx, setLinkIdx] = useState<number | null>(null);
  const [demandesAsso, setDemandesAsso] = useState<DemandeLiable[]>([]);
  const debounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Reload lignes when budgetLignes prop changes from outside
  useEffect(() => {
    setLignes(lignesFromBudget(budgetLignes));
  }, [budgetLignes]);

  // Demandes de la même association, liables comme référence (hors demande courante)
  useEffect(() => {
    if (!associationId) return;
    fetch(`/api/demandes?association_id=${associationId}`)
      .then(r => r.ok ? r.json() : { demandes: [] })
      .then(({ demandes }) => {
        setDemandesAsso(((demandes ?? []) as DemandeLiable[]).filter(d => d.id !== demandeId));
      })
      .catch(() => { /* liste indisponible — le lien reste optionnel */ });
  }, [associationId, demandeId]);

  const searchBailleurs = useCallback((idx: number, q: string) => {
    clearTimeout(debounceRef.current[idx]);
    if (!q.trim()) { setSuggestions(s => ({ ...s, [idx]: [] })); return; }
    debounceRef.current[idx] = setTimeout(async () => {
      const r = await fetch(`/api/bailleurs?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const { bailleurs } = await r.json();
        setSuggestions(s => ({ ...s, [idx]: bailleurs ?? [] }));
      }
    }, 250);
  }, []);

  const setLigne = (i: number, patch: Partial<LignePlan>) =>
    setLignes(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));

  const addLigne = () => setLignes(prev => [...prev, emptyLigne()]);
  const removeLigne = (i: number) =>
    setLignes(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : [emptyLigne()]);

  const savePlan = async () => {
    setSaving(true);

    // Load existing manual 74 lines to know which to delete
    const { data: existing } = await fetch(`/api/demandes/${demandeId}/budget-lignes`).then(r => r.json()).then(d => ({ data: (d.lignes as BudgetLigneDB[]).filter(l => l.compte === '74' && l.sens === 'produit' && l.cle_generation === null) }));

    // Delete all existing manual 74 lines not in current plan
    const currentIds = lignes.filter(l => l.id).map(l => l.id!);
    for (const e of existing ?? []) {
      if (!currentIds.includes(e.id)) {
        await fetch(`/api/budget-lignes/${e.id}`, { method: 'DELETE' });
      }
    }

    // Upsert each line
    for (const l of lignes) {
      if (!l.bailleur_nom_libre.trim() && !l.montant) continue;
      const body = {
        sens: 'produit',
        compte: '74',
        sous_categorie: l.bailleur_nom_libre || 'Subvention',
        bailleur_detail: l.bailleur_nom_libre || null,
        montant: parseFloat(l.montant.replace(',', '.')) || 0,
        statut_financement: l.statut_financement || null,
        est_charge_commune: false,
        est_valorisation_benevolat: false,
        precisions: null,
        demande_liee_id: l.demande_liee_id ?? null,
      };
      if (l.id) {
        await fetch(`/api/budget-lignes/${l.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`/api/demandes/${demandeId}/budget-lignes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  };

  const totalPlan = lignes.reduce((s, l) => s + (parseFloat(l.montant.replace(',', '.')) || 0), 0);
  const totalCharges = equilibre?.total_charges ?? 0;
  const gap = totalCharges > 0 ? totalPlan - totalCharges : null;

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 font-medium">Subventions sollicitées — compte 74 (une ligne par bailleur)</p>
        <div className="flex gap-2 items-center">
          {saved && <span className="text-xs text-green-600">✓ Sauvegardé</span>}
          <button
            onClick={savePlan}
            disabled={saving}
            className="text-xs font-medium bg-blue-600 text-white rounded px-2.5 py-1.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '…' : '💾 Sauvegarder le plan'}
          </button>
        </div>
      </div>

      {/* Lignes */}
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_100px_120px_28px] gap-2 mb-1">
          <span className="text-xs text-gray-400">Bailleur</span>
          <span className="text-xs text-gray-400">Montant (€)</span>
          <span className="text-xs text-gray-400">Statut</span>
          <span />
        </div>

        {lignes.map((l, i) => {
          const suggs = suggestions[i] ?? [];
          return (
            <div key={i} className="relative">
              <div className="grid grid-cols-[1fr_100px_120px_28px] gap-2 items-center">
                {/* Bailleur avec autocomplétion */}
                <div className="relative">
                  <input
                    className="field-input w-full text-sm"
                    value={query[i] ?? l.bailleur_nom_libre}
                    onChange={e => {
                      const v = e.target.value;
                      setQuery(q => ({ ...q, [i]: v }));
                      setLigne(i, { bailleur_nom_libre: v, bailleur_id: undefined });
                      setOpenIdx(i);
                      searchBailleurs(i, v);
                    }}
                    onBlur={() => setTimeout(() => setOpenIdx(null), 150)}
                    placeholder="Ex : Mairie de Paris, ANCT…"
                  />
                  {openIdx === i && suggs.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggs.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2"
                          onMouseDown={() => {
                            setLigne(i, { bailleur_id: b.id, bailleur_nom_libre: b.nom });
                            setQuery(q => ({ ...q, [i]: b.nom }));
                            setSuggestions(s => ({ ...s, [i]: [] }));
                            setOpenIdx(null);
                          }}
                        >
                          <span>{b.nom}</span>
                          {b.type_bailleur && <span className="text-xs text-gray-400 shrink-0">{b.type_bailleur}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Montant */}
                <input
                  type="number"
                  className="field-input text-sm text-right"
                  value={l.montant}
                  onChange={e => setLigne(i, { montant: e.target.value })}
                  placeholder="0"
                  min={0}
                />

                {/* Statut */}
                <select
                  className="field-input text-sm"
                  value={l.statut_financement}
                  onChange={e => setLigne(i, { statut_financement: e.target.value as LignePlan['statut_financement'] })}
                >
                  <option value="">— statut —</option>
                  <option value="demande">Demandé</option>
                  <option value="obtenu">Obtenu</option>
                  <option value="envisage">Envisagé</option>
                </select>

                {/* Supprimer */}
                <button
                  type="button"
                  onClick={() => removeLigne(i)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none"
                >×</button>
              </div>

              {/* Badges sous la ligne : statut + lien de référence */}
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {l.statut_financement && STATUT_LABEL[l.statut_financement] && (
                  <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full ${STATUT_LABEL[l.statut_financement].cls}`}>
                    {STATUT_LABEL[l.statut_financement].l}
                  </span>
                )}
                {demandesAsso.length > 0 && !l.demande_liee_id && (
                  <button
                    type="button"
                    onClick={() => setLinkIdx(linkIdx === i ? null : i)}
                    className="text-xs text-gray-400 hover:text-blue-600"
                    title="Lier cette ligne à une autre demande de l'association (référence uniquement — ne modifie ni montant ni statut)"
                  >
                    🔗 Lier à une demande
                  </button>
                )}
                {l.demande_liee_id && (() => {
                  const dl = demandesAsso.find(d => d.id === l.demande_liee_id);
                  return (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                      <a href={`/demandes/${l.demande_liee_id}`} className="hover:underline">
                        🔗 {dl ? (dl.titre_projet || dl.bailleur_nom || 'Demande liée') : 'Demande liée'}
                      </a>
                      <button
                        type="button"
                        onClick={() => setLigne(i, { demande_liee_id: null })}
                        className="text-blue-400 hover:text-blue-700"
                        title="Délier (ne modifie rien d'autre)"
                      >✕</button>
                    </span>
                  );
                })()}
              </div>

              {/* Menu de liaison */}
              {linkIdx === i && (
                <select
                  className="field-input text-xs mt-1 w-full"
                  value=""
                  onChange={e => {
                    if (e.target.value) setLigne(i, { demande_liee_id: e.target.value });
                    setLinkIdx(null);
                  }}
                >
                  <option value="">— choisir une demande à lier —</option>
                  {demandesAsso.map(d => (
                    <option key={d.id} value={d.id}>
                      {(d.bailleur_nom || '—')} — {(d.titre_projet || '(sans titre)')} [{d.statut}]
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addLigne}
        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        + Ajouter un bailleur
      </button>

      {/* Totaux */}
      <div className="border-t border-gray-100 pt-2 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total subventions sollicitées</span>
          <span className="font-semibold tabular-nums">{fmt(totalPlan)} €</span>
        </div>
        {totalCharges > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total charges</span>
            <span className="tabular-nums text-gray-700">{fmt(totalCharges)} €</span>
          </div>
        )}
        {gap !== null && (
          <div className={`flex justify-between text-sm font-medium px-2.5 py-1.5 rounded-lg ${Math.abs(gap) < 1 ? 'bg-green-50 text-green-700' : gap < 0 ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
            <span>{Math.abs(gap) < 1 ? '✓ Plan équilibré' : gap < 0 ? `Financement manquant` : `Financement excédentaire`}</span>
            {Math.abs(gap) >= 1 && <span className="tabular-nums">{gap > 0 ? '+' : ''}{fmt(gap)} €</span>}
          </div>
        )}
      </div>
    </div>
  );
}
