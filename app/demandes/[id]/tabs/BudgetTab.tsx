'use client';
import { useState } from 'react';
import { usePageCtx } from '../context';
import { SectionCard, BudgetView, BudgetLignesView, BudgetEquilibreBlock, BudgetEditor } from '../components';
import { PlanFinancement } from '@/components/PlanFinancement';
import { parseBudget, sumRows, fmt } from '../types';
import type { DetailsJson } from '@/lib/supabase';
import { detecterPatternsInactifs, calculerEcartAEquilibrer } from '@/lib/budgetAuto';

export function BudgetTab() {
  const ctx = usePageCtx();
  const {
    demande, budgetLignes, budgetEquilibre, budgetTaux,
    loadBudgetLignes, draft, editMode, setField,
    activerPatternEtScroller,
  } = ctx;

  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const { depenses: viewDep, recettes: viewRec } = parseBudget(demande.budget_previsionnel_json);
  const totalDep = sumRows(viewDep.filter(r => r.label));
  const totalRec = sumRows(viewRec.filter(r => r.label));

  return (
    <>

      {/* Budget */}
      <SectionCard title="Budget prévisionnel">
        {editMode ? (
          <>
            {/* Read-only summary of saved values to compare while editing */}
            {budgetLignes.length > 0 && (
              <details className="mb-4">
                <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                  Valeurs enregistrées (référence)
                </summary>
                <div className="mt-2 bg-gray-50 rounded-lg p-3">
                  <BudgetLignesView lignes={budgetLignes} demandeId={demande.id} />
                </div>
              </details>
            )}
            {budgetLignes.length === 0 && (viewDep.some(r => r.label) || viewRec.some(r => r.label)) && (
              <details className="mb-4">
                <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                  Valeurs enregistrées (référence)
                </summary>
                <div className="mt-2 bg-gray-50 rounded-lg p-3">
                  <BudgetView depenses={viewDep} recettes={viewRec} totalDep={totalDep} totalRec={totalRec} />
                </div>
              </details>
            )}
            <BudgetEditor
              depenses={draft.depenses}
              recettes={draft.recettes}
              onChange={(dep, rec) => { setField('depenses', dep); setField('recettes', rec); }}
            />
          </>
        ) : budgetLignes.length > 0 ? (
          <>
            <BudgetLignesView lignes={budgetLignes} demandeId={demande.id} />
            {/* Équilibre global depuis v_budget_equilibre */}
            {budgetEquilibre && (
              <BudgetEquilibreBlock equilibre={budgetEquilibre} taux={budgetTaux} />
            )}
            {/* Pistes à vérifier */}
            {budgetEquilibre && Math.abs(budgetEquilibre.ecart) > 0.01 && (() => {
              const det = (demande.details_json || {}) as DetailsJson;
              const patterns = detecterPatternsInactifs(det);
              const ecartVal = calculerEcartAEquilibrer(budgetEquilibre.total_produits, budgetEquilibre.total_charges);
              if (patterns.length === 0) {
                return (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 mt-1">
                    <p className="text-sm text-amber-800">
                      {ecartVal > 0
                        ? `Il manque ${fmt(ecartVal)} € de charges documentées pour équilibrer ce budget.`
                        : `Les charges dépassent les produits de ${fmt(Math.abs(ecartVal))} €.`}
                      {' '}Aucun poste habituel n&apos;est détecté comme manquant — vérifiez le montant demandé ou saisissez une ligne manuellement.
                    </p>
                  </div>
                );
              }
              return (
                <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 mt-1 space-y-2">
                  <button
                    onClick={() => setSuggestionsOpen(o => !o)}
                    className="w-full flex items-center justify-between text-sm font-medium text-amber-800"
                  >
                    <span>
                      💡 Pistes à vérifier —{' '}
                      {ecartVal > 0
                        ? `il manque ${fmt(ecartVal)} € de charges`
                        : `les charges dépassent de ${fmt(Math.abs(ecartVal))} €`}
                    </span>
                    <span className="text-amber-500 text-xs">{suggestionsOpen ? '▲ Masquer' : '▼ Voir'}</span>
                  </button>
                  {suggestionsOpen && (
                    <ul className="space-y-1.5 pt-1 border-t border-amber-200">
                      {patterns.map(p => (
                        <li key={p.cle} className="flex items-start gap-2">
                          <button
                            onClick={() => activerPatternEtScroller(p.cle, p.section_cible)}
                            className="text-left group flex-1"
                          >
                            <span className="text-xs font-medium text-amber-700 group-hover:underline">{p.label}</span>
                            <span className="block text-xs text-amber-600">{p.description}</span>
                          </button>
                          <button
                            onClick={() => activerPatternEtScroller(p.cle, p.section_cible)}
                            className="shrink-0 text-xs text-amber-600 border border-amber-300 rounded px-1.5 py-0.5 hover:bg-amber-100"
                          >
                            Ouvrir →
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <BudgetView depenses={viewDep} recettes={viewRec} totalDep={totalDep} totalRec={totalRec} />
            {budgetEquilibre ? (
              <BudgetEquilibreBlock equilibre={budgetEquilibre} taux={budgetTaux} />
            ) : demande.montant_demande != null && (() => {
              const ecart = demande.montant_demande - totalDep;
              const ecartColor = Math.abs(ecart) < 0.01
                ? 'bg-green-50 text-green-700'
                : ecart > 0
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-gray-50 text-gray-600';
              return (
                <div className="border-t border-gray-100 pt-3 mt-1 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Montant demandé</span>
                    <span className="font-medium tabular-nums">{fmt(demande.montant_demande)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total dépenses prévisionnelles</span>
                    <span className="font-medium tabular-nums">{fmt(totalDep)} €</span>
                  </div>
                  <div className={`flex justify-between text-sm font-semibold px-2.5 py-1.5 rounded-lg ${ecartColor}`}>
                    <span>Écart (demandé − budget)</span>
                    <span className="tabular-nums">{ecart > 0 ? '+' : ''}{fmt(ecart)} €</span>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </SectionCard>

      {/* Plan de financement multi-bailleurs (B1) */}
      <SectionCard title="Plan de financement — subventions sollicitées">
        <PlanFinancement
          demandeId={demande.id}
          budgetLignes={budgetLignes}
          equilibre={budgetEquilibre}
          onSaved={loadBudgetLignes}
        />
      </SectionCard>

    </>
  );
}
