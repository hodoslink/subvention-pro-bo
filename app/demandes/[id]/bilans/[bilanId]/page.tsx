'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Bilan, BilanLigne, BilanIndicateur } from '@/lib/supabase';

type Tab = 'activite' | 'financier' | 'evaluation' | 'attestation';

const TAB_LABELS: Record<Tab, string> = {
  activite: '📋 Rapport d\'activité',
  financier: '💰 Rapport financier',
  evaluation: '📊 Évaluation',
  attestation: '✍️ Attestation',
};

const BILAN_STATUT_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  valide: 'bg-emerald-100 text-emerald-700',
  transmis: 'bg-blue-100 text-blue-700',
};

const BILAN_STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  valide: 'Validé',
  transmis: 'Transmis',
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmt(n?: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €';
}

function ecartPct(prevu: number, reel?: number | null) {
  if (reel == null || prevu === 0) return null;
  return ((reel - prevu) / prevu) * 100;
}

type DemandeMin = {
  id: string;
  titre_projet?: string;
  montant_demande?: number;
  plateforme_identifiant_dossier?: string;
  associations?: { nom: string };
};

export default function BilanDetailPage() {
  const { id, bilanId } = useParams<{ id: string; bilanId: string }>();
  const [tab, setTab] = useState<Tab>('activite');
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [lignes, setLignes] = useState<BilanLigne[]>([]);
  const [indicateurs, setIndicateurs] = useState<BilanIndicateur[]>([]);
  const [demande, setDemande] = useState<DemandeMin | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmTransmis, setConfirmTransmis] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local edits for narrative fields
  const [rapportActivite, setRapportActivite] = useState('');
  const [commentairesActivite, setCommentairesActivite] = useState('');
  const [bilanQualitatif, setBilanQualitatif] = useState('');
  const [commentaireFinancier, setCommentaireFinancier] = useState('');
  const [signePar, setSignePar] = useState('');
  const [signeLe, setSigneLe] = useState('');

  useEffect(() => {
    async function load() {
      const [bilanRes, demandeRes] = await Promise.all([
        fetch(`/api/bilans/${bilanId}`),
        fetch(`/api/demandes/${id}`),
      ]);
      const bilanData = await bilanRes.json();
      const demandeData = await demandeRes.json();
      if (bilanData.bilan) {
        const b = bilanData.bilan as Bilan;
        setBilan(b);
        setRapportActivite(b.rapport_activite ?? '');
        setCommentairesActivite(b.commentaires_activite ?? '');
        setBilanQualitatif(b.bilan_qualitatif ?? '');
        setCommentaireFinancier(b.commentaire_financier ?? '');
        setSignePar(b.signe_par ?? '');
        setSigneLe(b.signe_le ?? '');
      }
      setLignes(bilanData.lignes ?? []);
      setIndicateurs(bilanData.indicateurs ?? []);
      setDemande(demandeData.demande ?? null);
      setLoading(false);
    }
    load();
  }, [id, bilanId]);

  const patchBilan = useCallback(async (patch: Partial<Bilan>) => {
    const res = await fetch(`/api/bilans/${bilanId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.bilan) setBilan(data.bilan);
    return res.ok;
  }, [bilanId]);

  async function patchLigne(ligneId: string, patch: { montant_reel?: number | null; commentaire_ecart?: string | null }) {
    const res = await fetch(`/api/bilan-lignes/${ligneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.ligne) {
      setLignes(prev => prev.map(l => l.id === ligneId ? { ...l, ...data.ligne } : l));
    }
  }

  async function patchIndicateur(indId: string, patch: Partial<BilanIndicateur>) {
    const res = await fetch(`/api/bilan-indicateurs/${indId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.indicateur) {
      setIndicateurs(prev => prev.map(i => i.id === indId ? { ...i, ...data.indicateur } : i));
    }
  }

  async function addIndicateur() {
    const res = await fetch(`/api/bilans/${bilanId}/indicateurs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indicateur: 'Nouvel indicateur' }),
    });
    const data = await res.json();
    if (data.indicateur) setIndicateurs(prev => [...prev, data.indicateur]);
  }

  async function marquerTransmis() {
    setSaving(true);
    await patchBilan({ statut: 'transmis' });
    setSaving(false);
    setConfirmTransmis(false);
  }

  if (loading || !bilan) return <div className="p-8 text-gray-500">Chargement…</div>;

  const charges = lignes.filter(l => l.sens === 'charge');
  const produits = lignes.filter(l => l.sens === 'produit');
  const totalChargesPrevu = charges.reduce((s, l) => s + l.montant_prevu, 0);
  const totalChargesReel = charges.reduce((s, l) => s + (l.montant_reel ?? 0), 0);
  const totalProduitsPrevu = produits.reduce((s, l) => s + l.montant_prevu, 0);
  const totalProduitsReel = produits.reduce((s, l) => s + (l.montant_reel ?? 0), 0);
  const montantARS = demande?.montant_demande ?? 0;

  const titreBilan = bilan.type === 'final'
    ? 'Bilan final'
    : `Bilan intermédiaire n°${bilan.numero_ordre}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/demandes/${id}/bilans`} className="text-sm text-blue-600 hover:underline">
          ← Retour aux bilans
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{titreBilan}</h1>
            {demande?.titre_projet && <p className="text-gray-500 mt-1">{demande.titre_projet}</p>}
            <p className="text-sm text-gray-400 mt-1">
              Période : {formatDate(bilan.date_debut)} → {formatDate(bilan.date_fin)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${BILAN_STATUT_COLORS[bilan.statut] ?? ''}`}>
              {BILAN_STATUT_LABELS[bilan.statut] ?? bilan.statut}
            </span>
            {bilan.statut !== 'transmis' && (
              <select
                value={bilan.statut}
                onChange={e => patchBilan({ statut: e.target.value as Bilan['statut'] })}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1"
              >
                <option value="brouillon">Brouillon</option>
                <option value="valide">Validé</option>
                <option value="transmis">Transmis</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab: Activité */}
      {tab === 'activite' && (
        <div className="space-y-6">
          {/* Statut de réalisation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut de réalisation</label>
            <div className="flex gap-2 flex-wrap">
              {(['realise', 'partiellement_realise', 'non_realise'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => patchBilan({ statut_action: s })}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    bilan.statut_action === s
                      ? s === 'realise' ? 'bg-green-100 border-green-300 text-green-800'
                        : s === 'partiellement_realise' ? 'bg-amber-100 border-amber-300 text-amber-800'
                        : 'bg-red-100 border-red-300 text-red-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s === 'realise' ? '✅ Réalisé' : s === 'partiellement_realise' ? '⚠️ Partiellement réalisé' : '❌ Non réalisé'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description de la mise en œuvre</label>
            <textarea
              value={rapportActivite}
              onChange={e => setRapportActivite(e.target.value)}
              onBlur={() => patchBilan({ rapport_activite: rapportActivite })}
              rows={8}
              placeholder="Décrivez les actions effectivement réalisées sur la période.&#10;Ex : 45 séances organisées (objectif : 50), 12 ateliers, 158 participants uniques..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaires et difficultés rencontrées</label>
            <textarea
              value={commentairesActivite}
              onChange={e => setCommentairesActivite(e.target.value)}
              onBlur={() => patchBilan({ commentaires_activite: commentairesActivite })}
              rows={5}
              placeholder="Difficultés, ajustements apportés, points de vigilance..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bilan qualitatif</label>
            <textarea
              value={bilanQualitatif}
              onChange={e => setBilanQualitatif(e.target.value)}
              onBlur={() => patchBilan({ bilan_qualitatif: bilanQualitatif })}
              rows={6}
              placeholder="Impact observé, témoignages, résultats qualitatifs..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
            />
          </div>
        </div>
      )}

      {/* Tab: Financier */}
      {tab === 'financier' && (
        <div className="space-y-8">
          {[
            { label: 'Charges', rows: charges },
            { label: 'Produits', rows: produits },
          ].map(({ label, rows }) => (
            <div key={label}>
              <h3 className="text-base font-semibold text-gray-800 mb-3">{label}</h3>
              {rows.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune ligne</p>
              ) : (
                <div className="space-y-2">
                  {rows.map(ligne => {
                    const pct = ecartPct(ligne.montant_prevu, ligne.montant_reel);
                    const hasEcart = pct != null && Math.abs(pct) > 10;
                    const isOver = pct != null && pct > 10;
                    const isUnder = pct != null && pct < -10;
                    return (
                      <div key={ligne.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 shrink-0">
                            {ligne.compte}
                          </span>
                          <span className="text-sm text-gray-700 flex-1 min-w-32">
                            {ligne.sous_categorie || ligne.bailleur_detail || ligne.compte}
                          </span>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm text-gray-500 whitespace-nowrap">
                              Prévu : <strong>{fmt(ligne.montant_prevu)}</strong>
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">Réel :</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                defaultValue={ligne.montant_reel ?? ''}
                                onBlur={e => {
                                  const v = e.target.value === '' ? null : parseFloat(e.target.value);
                                  patchLigne(ligne.id, { montant_reel: v });
                                }}
                                className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                                placeholder="0"
                              />
                              <span className="text-xs text-gray-400">€</span>
                            </div>
                            {pct != null && (
                              <span className={`text-xs font-medium whitespace-nowrap ${
                                isOver ? 'text-orange-600' : isUnder ? 'text-blue-600' : 'text-gray-400'
                              }`}>
                                {pct > 0 ? '+' : ''}{pct.toFixed(1)} %
                              </span>
                            )}
                          </div>
                        </div>
                        {hasEcart && ligne.montant_reel != null && (
                          <div className={`mt-2 p-2 rounded text-xs ${isOver ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}>
                            {isOver ? '⚠️' : 'ℹ️'} Expliquez cet écart :
                            <input
                              type="text"
                              defaultValue={ligne.commentaire_ecart ?? ''}
                              onBlur={e => patchLigne(ligne.id, { commentaire_ecart: e.target.value || null })}
                              placeholder="Explication de l'écart…"
                              className={`mt-1 w-full border rounded px-2 py-1 text-xs ${isOver ? 'border-orange-300 bg-orange-50' : 'border-blue-300 bg-blue-50'}`}
                            />
                          </div>
                        )}
                        {!hasEcart && ligne.commentaire_ecart && (
                          <p className="mt-1 text-xs text-gray-400 italic">{ligne.commentaire_ecart}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Synthèse */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-2 font-medium text-gray-600 text-xs uppercase tracking-wide mb-2">
              <span></span><span>Prévu</span><span>Réel</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700">Total charges</span>
              <span>{fmt(totalChargesPrevu)}</span>
              <span>{fmt(totalChargesReel)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700">Total produits</span>
              <span>{fmt(totalProduitsPrevu)}</span>
              <span>{fmt(totalProduitsReel)}</span>
            </div>
            <hr className="my-2 border-gray-200" />
            <div className="grid grid-cols-2 gap-2 text-gray-600">
              <span>Crédit notifié</span>
              <span className="font-medium">{fmt(montantARS)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-gray-600">
              <span>Crédits consommés (ce bilan)</span>
              <span className="font-medium">{fmt(totalChargesReel)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-gray-600">
              <span>Autofinancement réalisé</span>
              <span className="font-medium">{fmt(totalProduitsReel - totalChargesReel < 0 ? 0 : totalProduitsReel - totalChargesReel)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire financier global</label>
            <textarea
              value={commentaireFinancier}
              onChange={e => setCommentaireFinancier(e.target.value)}
              onBlur={() => patchBilan({ commentaire_financier: commentaireFinancier })}
              rows={4}
              placeholder="Explication globale des écarts, contexte budgétaire…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
            />
          </div>
        </div>
      )}

      {/* Tab: Évaluation */}
      {tab === 'evaluation' && (
        <div className="space-y-4">
          {indicateurs.map(ind => (
            <div key={ind.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Indicateur</label>
                <input
                  type="text"
                  defaultValue={ind.indicateur}
                  onBlur={e => patchIndicateur(ind.id, { indicateur: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Résultat attendu</label>
                  <textarea
                    defaultValue={ind.resultat_attendu ?? ''}
                    onBlur={e => patchIndicateur(ind.id, { resultat_attendu: e.target.value || undefined })}
                    rows={2}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-700 mb-1">Résultat obtenu</label>
                  <textarea
                    defaultValue={ind.resultat_obtenu ?? ''}
                    onBlur={e => patchIndicateur(ind.id, { resultat_obtenu: e.target.value || undefined })}
                    rows={2}
                    className="w-full border border-green-200 bg-green-50 rounded px-2 py-1.5 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Outil d&apos;évaluation</label>
                  <input
                    type="text"
                    defaultValue={ind.outil_evaluation ?? ''}
                    onBlur={e => patchIndicateur(ind.id, { outil_evaluation: e.target.value || undefined })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Piste d&apos;amélioration</label>
                  <textarea
                    defaultValue={ind.piste_amelioration ?? ''}
                    onBlur={e => patchIndicateur(ind.id, { piste_amelioration: e.target.value || undefined })}
                    rows={2}
                    className="w-full border border-blue-200 bg-blue-50 rounded px-2 py-1.5 text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          ))}
          {indicateurs.length === 0 && (
            <p className="text-sm text-gray-400">Aucun indicateur. Ajoutez-en un ci-dessous.</p>
          )}
          <button
            onClick={addIndicateur}
            className="mt-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            + Ajouter un indicateur
          </button>
        </div>
      )}

      {/* Tab: Attestation */}
      {tab === 'attestation' && (
        <div className="space-y-6">
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 font-mono text-sm space-y-2">
            <div className="text-center font-bold text-base mb-4">
              BILAN D&apos;EXÉCUTION : {titreBilan.toUpperCase()}
            </div>
            {demande?.plateforme_identifiant_dossier && (
              <div>Convention n° {demande.plateforme_identifiant_dossier}</div>
            )}
            {demande?.associations?.nom && (
              <div>Raison sociale : {demande.associations.nom}</div>
            )}
            <div className="mt-2">Période couverte : {formatDate(bilan.date_debut)} → {formatDate(bilan.date_fin)}</div>
            <hr className="my-3 border-gray-300" />
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Crédit notifié :</span>
                <span className="font-medium">{fmt(montantARS)}</span>
              </div>
              <div className="flex justify-between">
                <span>Crédits consommés (ce bilan) :</span>
                <span className="font-medium">{fmt(totalChargesReel)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bilans précédents (cumulé) :</span>
                <span className="font-medium">0 €</span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-1 font-bold">
                <span>Total crédits consommés :</span>
                <span>{fmt(totalChargesReel)}</span>
              </div>
              <div className="flex justify-between">
                <span>Crédits non consommés :</span>
                <span className="font-medium">{fmt(montantARS - totalChargesReel)}</span>
              </div>
              <div className="flex justify-between">
                <span>Autofinancement :</span>
                <span className="font-medium">{fmt(Math.max(0, totalProduitsReel - totalChargesReel))}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signé par</label>
              <input
                type="text"
                value={signePar}
                onChange={e => setSignePar(e.target.value)}
                onBlur={() => patchBilan({ signe_par: signePar || undefined })}
                placeholder="Nom du signataire"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Le</label>
              <input
                type="date"
                value={signeLe}
                onChange={e => setSigneLe(e.target.value)}
                onBlur={() => patchBilan({ signe_le: signeLe || undefined })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {bilan.statut !== 'transmis' && (
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setConfirmTransmis(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                📤 Marquer comme transmis
              </button>
            </div>
          )}

          {bilan.statut === 'transmis' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              ✓ Ce bilan a été transmis au bailleur.
            </div>
          )}
        </div>
      )}

      {/* Modal confirmation transmis */}
      {confirmTransmis && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Confirmer la transmission</h2>
            <p className="text-sm text-gray-600 mb-4">
              Cette action est définitive. Le bilan sera marqué comme transmis au bailleur.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmTransmis(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={marquerTransmis}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
