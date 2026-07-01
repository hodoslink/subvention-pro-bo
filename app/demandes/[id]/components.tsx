"use client";
import { useState, useRef, useContext } from "react";
import Link from "next/link";
import { PageEditCtx } from './context';
import type { BudgetRow, FullDraft } from './types';
import { sumRows, fmt, DEP_CATS, REC_CATS } from './types';
import type { BudgetLigneDB, BudgetEquilibre, TauxFinancement } from '@/lib/supabase';
import type { LigneAutoGeneree } from '@/lib/budgetAuto';

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const ctx = useContext(PageEditCtx);
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {ctx && !ctx.editMode && (
          <button onClick={ctx.startEdit} className="text-xs text-gray-400 hover:text-blue-600 transition-colors">✏️ Modifier</button>
        )}
        {ctx && ctx.editMode && (
          <div className="flex items-center gap-2">
            <button onClick={ctx.cancelEdit} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Annuler</button>
            <button onClick={ctx.saveAll} disabled={ctx.savingDraft} className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
              {ctx.savingDraft ? 'Enregistrement…' : '💾 Enregistrer'}
            </button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}

export function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  );
}

export function RowF({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={value ? 'text-gray-900 text-right' : 'text-gray-300 text-right italic'}>
        {value || '—'}
      </span>
    </div>
  );
}

export function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}

export function TextBlockF({ label, text }: { label: string; text?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {text
        ? <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{text}</p>
        : <p className="text-sm text-gray-300 italic">—</p>}
    </div>
  );
}

export function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 italic">{text}</p>;
}

export function AutoBudgetPreview({ lignes, demandeId }: { lignes: LigneAutoGeneree[]; demandeId: string }) {
  const charges = lignes.filter(l => l.sens === 'charge');
  const produits = lignes.filter(l => l.sens === 'produit');
  const fmtAuto = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">⚙ Lignes budgétaires auto-générées</p>
        <p className="text-xs text-indigo-400">Recalculé en temps réel · synchronisé à la sauvegarde</p>
      </div>
      {charges.length > 0 && (
        <div>
          <p className="text-xs text-indigo-500 mb-1.5 font-medium">Charges</p>
          <div className="space-y-1">
            {charges.map(l => (
              <div key={l.cle_generation} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-indigo-400 w-6 shrink-0">{l.compte}</span>
                <span className="flex-1 text-gray-700 truncate" title={l.precisions}>{l.sous_categorie}</span>
                <span className="font-medium tabular-nums text-gray-900">{fmtAuto(l.montant)} €</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {produits.length > 0 && (
        <div>
          <p className="text-xs text-indigo-500 mb-1.5 font-medium">Produits en nature</p>
          <div className="space-y-1">
            {produits.map(l => (
              <div key={l.cle_generation} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-indigo-400 w-6 shrink-0">{l.compte}</span>
                <span className="flex-1 text-gray-700 truncate" title={l.precisions}>{l.sous_categorie}</span>
                <span className="font-medium tabular-nums text-gray-900">{fmtAuto(l.montant)} €</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-indigo-400 border-t border-indigo-100 pt-2">
        Ces lignes seront créées / mises à jour dans{' '}
        <Link href={`/demandes/${demandeId}/budget`} className="text-indigo-600 hover:underline">
          l'écran budget complet →
        </Link>
      </p>
    </div>
  );
}

export function CeQuiChangeEditor({ demandeId: _demandeId, value, onSaved }: {
  demandeId: string;
  value: string;
  onSaved: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div className="group relative">
        {value ? (
          <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">À renseigner par le consultant…</p>
        )}
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="mt-1 text-xs text-blue-500 hover:text-blue-700"
        >
          {value ? '✏️ Modifier' : '+ Renseigner'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        className="field-input text-sm w-full"
        rows={3}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="Ex : l'association ouvre une 3e antenne cette année / le bailleur a réduit son enveloppe de 20%…"
        autoFocus
      />
      <div className="flex gap-2">
        <button onClick={() => setEditing(false)} className="btn btn-ghost text-xs">Annuler</button>
        <button
          onClick={async () => { setSaving(true); await onSaved(draft); setSaving(false); setEditing(false); }}
          disabled={saving}
          className="btn btn-primary text-xs"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

export function BudgetView({ depenses, recettes, totalDep, totalRec }: {
  depenses: BudgetRow[];
  recettes: BudgetRow[];
  totalDep: number;
  totalRec: number;
}) {
  const hasDep = depenses.some(r => r.label);
  const hasRec = recettes.some(r => r.label);
  if (!hasDep && !hasRec) return <EmptyHint text="Budget non renseigné" />;
  const balanced = Math.abs(totalDep - totalRec) < 0.01;
  return (
    <div className="space-y-4">
      {hasDep && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dépenses</p>
          <div className="space-y-1">
            {depenses.filter(r => r.label).map((r, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">{r.label}</span>
                <span className="text-gray-900 font-medium tabular-nums">{r.montant ? `${parseFloat(r.montant.replace(',', '.')).toLocaleString('fr-FR')} €` : '—'}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1.5 mt-1.5">
              <span>Total dépenses</span>
              <span className="tabular-nums">{fmt(totalDep)} €</span>
            </div>
          </div>
        </div>
      )}
      {hasRec && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recettes</p>
          <div className="space-y-1">
            {recettes.filter(r => r.label).map((r, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">{r.label}</span>
                <span className="text-gray-900 font-medium tabular-nums">{r.montant ? `${parseFloat(r.montant.replace(',', '.')).toLocaleString('fr-FR')} €` : '—'}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1.5 mt-1.5">
              <span>Total recettes</span>
              <span className="tabular-nums">{fmt(totalRec)} €</span>
            </div>
          </div>
        </div>
      )}
      {hasDep && hasRec && (
        <div className={`text-xs px-3 py-2 rounded-lg ${balanced ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {balanced ? '✓ Budget équilibré' : `⚠️ Déséquilibre : ${fmt(Math.abs(totalDep - totalRec))} € — dépenses ${totalDep > totalRec ? '>' : '<'} recettes`}
        </div>
      )}
    </div>
  );
}

export function BudgetLignesView({ lignes, demandeId }: { lignes: BudgetLigneDB[]; demandeId: string }) {
  const charges = lignes.filter(l => l.sens === 'charge');
  const produits = lignes.filter(l => l.sens === 'produit');
  const totalCharges = charges.reduce((s, l) => s + l.montant, 0);
  const totalProduits = produits.reduce((s, l) => s + l.montant, 0);
  const balanced = Math.abs(totalCharges - totalProduits) < 0.01;
  const fmtL = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const STATUT_LABEL: Record<string, { label: string; cls: string }> = {
    obtenu: { label: 'Obtenu', cls: 'bg-green-100 text-green-700' },
    demande: { label: 'Demandé', cls: 'bg-blue-100 text-blue-700' },
    envisage: { label: 'Envisagé', cls: 'bg-gray-100 text-gray-500' },
  };

  return (
    <div className="space-y-4">
      {charges.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Charges</p>
          <div className="space-y-1.5">
            {charges.map(l => (
              <div key={l.id} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 text-xs font-mono text-blue-500 bg-blue-50 px-1 rounded mt-0.5">{l.compte}</span>
                <span className="flex-1 text-gray-700">{l.sous_categorie || '—'}</span>
                {l.cle_generation && (
                  <span className="shrink-0 text-xs text-indigo-400 font-mono">⚙</span>
                )}
                <span className="shrink-0 font-medium tabular-nums text-gray-900">{fmtL(l.montant)} €</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1.5 mt-1">
              <span>Total charges</span>
              <span className="tabular-nums">{fmtL(totalCharges)} €</span>
            </div>
          </div>
        </div>
      )}
      {produits.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Produits</p>
          <div className="space-y-1.5">
            {produits.map(l => {
              const statutInfo = l.statut_financement ? STATUT_LABEL[l.statut_financement] : null;
              return (
                <div key={l.id} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 text-xs font-mono text-green-600 bg-green-50 px-1 rounded mt-0.5">{l.compte}</span>
                  <span className="flex-1 text-gray-700">{l.sous_categorie || l.bailleur_detail || '—'}</span>
                  {statutInfo && (
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${statutInfo.cls}`}>{statutInfo.label}</span>
                  )}
                  {l.cle_generation && (
                    <span className="shrink-0 text-xs text-indigo-400 font-mono">⚙</span>
                  )}
                  <span className="shrink-0 font-medium tabular-nums text-gray-900">{fmtL(l.montant)} €</span>
                </div>
              );
            })}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1.5 mt-1">
              <span>Total produits</span>
              <span className="tabular-nums">{fmtL(totalProduits)} €</span>
            </div>
          </div>
        </div>
      )}
      {charges.length > 0 && produits.length > 0 && (
        <div className={`text-xs px-3 py-2 rounded-lg ${balanced ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {balanced ? '✓ Budget équilibré' : `⚠️ Écart : ${fmtL(Math.abs(totalCharges - totalProduits))} €`}
        </div>
      )}
      <p className="text-xs text-gray-400">
        Données en temps réel depuis{' '}
        <Link href={`/demandes/${demandeId}/budget`} className="text-blue-500 hover:underline">
          le budget par ligne de compte →
        </Link>
      </p>
    </div>
  );
}

export function BudgetEquilibreBlock({ equilibre, taux }: { equilibre: BudgetEquilibre; taux: TauxFinancement[] }) {
  const ecartColor = equilibre.est_equilibre
    ? 'bg-green-50 text-green-700'
    : equilibre.ecart > 0
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';
  const fmtE = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const tauxCe = taux[0] ?? null;
  return (
    <div className="border-t border-gray-100 pt-3 mt-1 space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Total charges</span>
        <span className="font-medium tabular-nums">{fmtE(equilibre.total_charges)} €</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Total produits</span>
        <span className="font-medium tabular-nums">{fmtE(equilibre.total_produits)} €</span>
      </div>
      <div className={`flex justify-between text-sm font-semibold px-2.5 py-1.5 rounded-lg ${ecartColor}`}>
        <span>{equilibre.est_equilibre ? '✓ Budget équilibré' : 'Écart global'}</span>
        {!equilibre.est_equilibre && (
          <span className="tabular-nums">{equilibre.ecart > 0 ? '+' : ''}{fmtE(equilibre.ecart)} €</span>
        )}
      </div>
      {tauxCe && (
        <div className={`flex justify-between text-sm px-2.5 py-1 rounded-lg ${tauxCe.depasse_plafond_80 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
          <span>Part de ce bailleur dans les produits</span>
          <span className="font-semibold tabular-nums">
            {tauxCe.pourcentage_du_projet.toFixed(1)} %
            {tauxCe.depasse_plafond_80 && ' ⚠️ > 80 %'}
          </span>
        </div>
      )}
    </div>
  );
}

export function BudgetEditor({
  depenses, recettes, onChange,
}: {
  depenses: BudgetRow[];
  recettes: BudgetRow[];
  onChange: (dep: BudgetRow[], rec: BudgetRow[]) => void;
}) {
  const totalDep = sumRows(depenses);
  const totalRec = sumRows(recettes);
  const balanced = Math.abs(totalDep - totalRec) < 0.01;

  const updateRow = (side: 'dep' | 'rec', idx: number, field: 'label' | 'montant', val: string) => {
    if (side === 'dep') onChange(depenses.map((r, i) => i === idx ? { ...r, [field]: val } : r), recettes);
    else onChange(depenses, recettes.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const addRow = (side: 'dep' | 'rec', label = '') => {
    if (side === 'dep') onChange([...depenses, { label, montant: '' }], recettes);
    else onChange(depenses, [...recettes, { label, montant: '' }]);
  };

  const removeRow = (side: 'dep' | 'rec', idx: number) => {
    if (side === 'dep') { const n = depenses.filter((_, i) => i !== idx); onChange(n.length ? n : [{ label: '', montant: '' }], recettes); }
    else { const n = recettes.filter((_, i) => i !== idx); onChange(depenses, n.length ? n : [{ label: '', montant: '' }]); }
  };

  const quickAdd = (side: 'dep' | 'rec', label: string) => {
    const arr = side === 'dep' ? depenses : recettes;
    if (arr.some(r => r.label === label)) return;
    const lastEmpty = arr.findIndex(r => !r.label && !r.montant);
    if (lastEmpty >= 0) {
      if (side === 'dep') onChange(arr.map((r, i) => i === lastEmpty ? { label, montant: '' } : r), recettes);
      else onChange(depenses, arr.map((r, i) => i === lastEmpty ? { label, montant: '' } : r));
    } else {
      addRow(side, label);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dépenses</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DEP_CATS.map(cat => (
            <button key={cat} type="button" onClick={() => quickAdd('dep', cat)} className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              + {cat}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {depenses.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input className="field-input flex-1" value={row.label} onChange={e => updateRow('dep', i, 'label', e.target.value)} placeholder="Libellé du poste de dépense" />
              <div className="relative w-36">
                <input className="field-input w-full text-right pr-6" value={row.montant} onChange={e => updateRow('dep', i, 'montant', e.target.value)} placeholder="0" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">€</span>
              </div>
              <button type="button" onClick={() => removeRow('dep', i)} className="text-gray-300 hover:text-red-400 transition-colors w-6 shrink-0 text-lg leading-none">×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => addRow('dep')} className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2">+ Ajouter une ligne</button>
        <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-3 text-gray-700">
          <span>Total dépenses</span>
          <span className="tabular-nums">{fmt(totalDep)} €</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recettes</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {REC_CATS.map(cat => (
            <button key={cat} type="button" onClick={() => quickAdd('rec', cat)} className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors">
              + {cat}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {recettes.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input className="field-input flex-1" value={row.label} onChange={e => updateRow('rec', i, 'label', e.target.value)} placeholder="Source de financement" />
              <div className="relative w-36">
                <input className="field-input w-full text-right pr-6" value={row.montant} onChange={e => updateRow('rec', i, 'montant', e.target.value)} placeholder="0" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">€</span>
              </div>
              <button type="button" onClick={() => removeRow('rec', i)} className="text-gray-300 hover:text-red-400 transition-colors w-6 shrink-0 text-lg leading-none">×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => addRow('rec')} className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2">+ Ajouter une ligne</button>
        <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-3 text-gray-700">
          <span>Total recettes</span>
          <span className="tabular-nums">{fmt(totalRec)} €</span>
        </div>
      </div>

      <div className={`text-xs px-3 py-2.5 rounded-lg ${balanced ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {balanced
          ? '✓ Budget équilibré'
          : `⚠️ Déséquilibre de ${fmt(Math.abs(totalDep - totalRec))} € — dépenses ${totalDep > totalRec ? 'supérieures' : 'inférieures'} aux recettes`}
      </div>
    </div>
  );
}

export function QPVSelector({ codes, onChange }: { codes: string[]; onChange: (codes: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ code: string; nom: string; commune: string }>>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = (q: string) => {
    clearTimeout(debounce.current);
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      const r = await fetch(`/api/qpv?q=${encodeURIComponent(q)}`);
      if (r.ok) { const { qpvs } = await r.json(); setResults(qpvs ?? []); setOpen(true); }
    }, 300);
  };

  const add = (code: string) => {
    if (!codes.includes(code)) onChange([...codes, code]);
    setQuery(''); setResults([]); setOpen(false);
  };

  const remove = (code: string) => onChange(codes.filter(c => c !== code));

  return (
    <div>
      <p className="text-xs text-gray-500 font-medium mb-1">Codes QPV ciblés</p>
      {codes.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {codes.map(c => (
            <span key={c} className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
              {c}
              <button type="button" onClick={() => remove(c)} className="text-purple-400 hover:text-purple-700 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          className="field-input text-sm w-full"
          value={query}
          onChange={e => search(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Rechercher un QPV par nom ou code…"
        />
        {open && results.length > 0 && (
          <div className="absolute z-10 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {results.map(q => (
              <button
                key={q.code}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 flex items-center justify-between gap-2"
                onMouseDown={() => add(q.code)}
              >
                <span className="font-medium">{q.nom}</span>
                <span className="text-gray-400 shrink-0">{q.code} — {q.commune}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export FullDraft for tab files that need the type for casts
export type { FullDraft };
