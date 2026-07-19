'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Bilan, BilanLigne, BilanIndicateur, PieceRequise, BeneficiaireParType, DateLieuRealisation } from '@/lib/supabase';

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

// CVN = contributions volontaires en nature (comptes 86 charges / 87 produits)
const isCVN = (compte: string) => compte.startsWith('86') || compte.startsWith('87');

type DemandeMin = {
  id: string;
  titre_projet?: string;
  montant_demande?: number;
  montant_obtenu?: number;
  plateforme_identifiant_dossier?: string;
  associations?: { nom: string; siret?: string; rna?: string };
};

export default function BilanDetailPage() {
  const { id, bilanId } = useParams<{ id: string; bilanId: string }>();
  const [tab, setTab] = useState<Tab>('activite');
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [lignes, setLignes] = useState<BilanLigne[]>([]);
  const [indicateurs, setIndicateurs] = useState<BilanIndicateur[]>([]);
  const [pieces, setPieces] = useState<PieceRequise[]>([]);
  const [demande, setDemande] = useState<DemandeMin | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmTransmis, setConfirmTransmis] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statutError, setStatutError] = useState<string | null>(null);

  // Local edits for narrative fields
  const [rapportActivite, setRapportActivite] = useState('');
  const [commentairesActivite, setCommentairesActivite] = useState('');
  const [bilanQualitatif, setBilanQualitatif] = useState('');
  const [commentaireFinancier, setCommentaireFinancier] = useState('');
  const [signePar, setSignePar] = useState('');
  const [signeLe, setSigneLe] = useState('');
  // CERFA feuillet 1 — listes structurées
  const [beneficiairesParType, setBeneficiairesParType] = useState<BeneficiaireParType[]>([]);
  const [datesLieux, setDatesLieux] = useState<DateLieuRealisation[]>([]);
  // CERFA feuillet 3 — annexe
  const [reglesRepartition, setReglesRepartition] = useState('');
  const [methodeCvn, setMethodeCvn] = useState('');
  const [observations, setObservations] = useState('');

  useEffect(() => {
    async function load() {
      const [bilanRes, demandeRes, piecesRes] = await Promise.all([
        fetch(`/api/bilans/${bilanId}`),
        fetch(`/api/demandes/${id}`),
        fetch(`/api/bilans/${bilanId}/pieces-requises`),
      ]);
      const bilanData = await bilanRes.json();
      const demandeData = await demandeRes.json();
      const piecesData = piecesRes.ok ? await piecesRes.json() : { pieces: [] };
      if (bilanData.bilan) {
        const b = bilanData.bilan as Bilan;
        setBilan(b);
        setRapportActivite(b.rapport_activite ?? '');
        setCommentairesActivite(b.commentaires_activite ?? '');
        setBilanQualitatif(b.bilan_qualitatif ?? '');
        setCommentaireFinancier(b.commentaire_financier ?? '');
        setSignePar(b.signe_par ?? '');
        setSigneLe(b.signe_le ?? '');
        setBeneficiairesParType(b.beneficiaires_par_type ?? []);
        setDatesLieux(b.dates_lieux_realisation ?? []);
        setReglesRepartition(b.regles_repartition_charges_indirectes ?? '');
        setMethodeCvn(b.methode_valorisation_cvn ?? '');
        setObservations(b.observations ?? '');
      }
      setLignes(bilanData.lignes ?? []);
      setIndicateurs(bilanData.indicateurs ?? []);
      setPieces(piecesData.pieces ?? []);
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
    if (res.ok && data.bilan) {
      setBilan(data.bilan);
      setStatutError(null);
    } else if (!res.ok && patch.statut) {
      setStatutError(data.error || 'Changement de statut refusé');
    }
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

  // ── Feuillet 1 : listes structurées (bénéficiaires / dates-lieux) ─────────
  function saveBeneficiaires(next: BeneficiaireParType[]) {
    setBeneficiairesParType(next);
    patchBilan({ beneficiaires_par_type: next });
  }
  function saveDatesLieux(next: DateLieuRealisation[]) {
    setDatesLieux(next);
    patchBilan({ dates_lieux_realisation: next });
  }

  async function patchPiece(pieceId: string, statut: PieceRequise['statut']) {
    const res = await fetch(`/api/pieces-requises/${pieceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    });
    const data = await res.json();
    if (res.ok && data.piece) {
      setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, ...data.piece } : p));
    }
  }

  async function marquerTransmis() {
    setSaving(true);
    const ok = await patchBilan({ statut: 'transmis' });
    setSaving(false);
    setConfirmTransmis(false);
    if (!ok) setTab('attestation');
  }

  if (loading || !bilan) return <div className="p-8 text-gray-500">Chargement…</div>;

  // ── Feuillet 2 : séparation hors CVN / CVN et directes / indirectes ───────
  const chargesHorsCVN = lignes.filter(l => l.sens === 'charge' && !isCVN(l.compte));
  const produitsHorsCVN = lignes.filter(l => l.sens === 'produit' && !isCVN(l.compte));
  const chargesCVN = lignes.filter(l => l.sens === 'charge' && isCVN(l.compte));   // compte 86
  const produitsCVN = lignes.filter(l => l.sens === 'produit' && isCVN(l.compte)); // compte 87

  const chargesDirectes = chargesHorsCVN.filter(l => !l.est_charge_commune);
  const chargesIndirectes = chargesHorsCVN.filter(l => l.est_charge_commune);

  const sum = (rows: BilanLigne[], champ: 'montant_prevu' | 'montant_reel') =>
    rows.reduce((s, l) => s + (champ === 'montant_prevu' ? l.montant_prevu : (l.montant_reel ?? 0)), 0);

  const totalChargesPrevu = sum(chargesHorsCVN, 'montant_prevu') + sum(chargesCVN, 'montant_prevu');
  const totalChargesReel = sum(chargesHorsCVN, 'montant_reel') + sum(chargesCVN, 'montant_reel');
  const totalProduitsPrevu = sum(produitsHorsCVN, 'montant_prevu') + sum(produitsCVN, 'montant_prevu');
  const totalProduitsReel = sum(produitsHorsCVN, 'montant_reel') + sum(produitsCVN, 'montant_reel');

  // Case obligatoire CERFA : « La subvention de X € représente Y % du total des produits »
  const montantSubvention = demande?.montant_obtenu ?? demande?.montant_demande ?? 0;
  const pctSubvention = totalProduitsReel > 0 ? (montantSubvention / totalProduitsReel) * 100 : null;

  const titreBilan = bilan.type === 'final'
    ? 'Bilan final'
    : `Bilan intermédiaire n°${bilan.numero_ordre}`;

  const renderLigne = (ligne: BilanLigne) => {
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
            {ligne.est_charge_commune && ligne.cle_repartition && (
              <span className="ml-2 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">
                Clé : {ligne.cle_repartition}
              </span>
            )}
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
  };

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
            <Link
              href={`/demandes/${id}/bilans/${bilanId}/export`}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 text-gray-700 hover:bg-gray-50"
            >
              📤 Export CERFA
            </Link>
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
        {statutError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-start gap-2">
            <span>⚠️</span>
            <span className="flex-1">{statutError}</span>
            <button onClick={() => setStatutError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
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

      {/* Tab: Activité (feuillet 1 CERFA) */}
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

          {/* CERFA feuillet 1 : bénéficiaires par type de public */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bénéficiaires par type de public</label>
            <div className="space-y-2">
              {beneficiairesParType.map((b, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={b.type}
                    onChange={e => setBeneficiairesParType(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                    onBlur={() => saveBeneficiaires(beneficiairesParType)}
                    placeholder="Type de public (ex : Personnes en situation d'obésité)"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    value={b.nombre ?? ''}
                    onChange={e => setBeneficiairesParType(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value === '' ? null : parseInt(e.target.value, 10) } : x))}
                    onBlur={() => saveBeneficiaires(beneficiairesParType)}
                    placeholder="Nombre"
                    className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm text-right"
                  />
                  <button
                    onClick={() => saveBeneficiaires(beneficiairesParType.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 text-sm px-1"
                    title="Retirer"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setBeneficiairesParType(prev => [...prev, { type: '', nombre: null }])}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                + Ajouter un type de public
              </button>
            </div>
          </div>

          {/* CERFA feuillet 1 : dates et lieux de réalisation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dates et lieux de réalisation</label>
            <div className="space-y-2">
              {datesLieux.map((d, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <input
                    type="date"
                    value={d.date_debut}
                    onChange={e => setDatesLieux(prev => prev.map((x, j) => j === i ? { ...x, date_debut: e.target.value } : x))}
                    onBlur={() => saveDatesLieux(datesLieux)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <span className="text-gray-400 text-sm">→</span>
                  <input
                    type="date"
                    value={d.date_fin}
                    onChange={e => setDatesLieux(prev => prev.map((x, j) => j === i ? { ...x, date_fin: e.target.value } : x))}
                    onBlur={() => saveDatesLieux(datesLieux)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    value={d.lieu}
                    onChange={e => setDatesLieux(prev => prev.map((x, j) => j === i ? { ...x, lieu: e.target.value } : x))}
                    onBlur={() => saveDatesLieux(datesLieux)}
                    placeholder="Lieu (ex : Clichy-sous-Bois)"
                    className="flex-1 min-w-40 border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => saveDatesLieux(datesLieux.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 text-sm px-1"
                    title="Retirer"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDatesLieux(prev => [...prev, { date_debut: bilan.date_debut, date_fin: bilan.date_fin, lieu: '' }])}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                + Ajouter une période / un lieu
              </button>
            </div>
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

      {/* Tab: Financier (feuillet 2 CERFA) */}
      {tab === 'financier' && (
        <div className="space-y-8">
          {[
            { label: 'Charges directes affectées à l\'action', rows: chargesDirectes, vide: 'Aucune charge directe' },
            { label: 'Charges indirectes réparties affectées à l\'action', rows: chargesIndirectes, vide: null },
            { label: 'Contributions volontaires en nature — emploi (86)', rows: chargesCVN, vide: null },
            { label: 'Produits affectés à l\'action', rows: produitsHorsCVN, vide: 'Aucune ligne de produit' },
            { label: 'Contributions volontaires en nature — ressources (87)', rows: produitsCVN, vide: null },
          ].map(({ label, rows, vide }) => (
            (rows.length > 0 || vide) && (
              <div key={label}>
                <h3 className="text-base font-semibold text-gray-800 mb-3">{label}</h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-400">{vide}</p>
                ) : (
                  <div className="space-y-2">{rows.map(renderLigne)}</div>
                )}
              </div>
            )
          ))}

          {/* Synthèse CERFA : totaux hors CVN / dont CVN */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-2 font-medium text-gray-600 text-xs uppercase tracking-wide mb-2">
              <span></span><span>Prévu</span><span>Réel</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Total des charges HORS CVN</span>
              <span>{fmt(sum(chargesHorsCVN, 'montant_prevu'))}</span>
              <span>{fmt(sum(chargesHorsCVN, 'montant_reel'))}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-500 pl-3">dont charges directes</span>
              <span className="text-gray-500">{fmt(sum(chargesDirectes, 'montant_prevu'))}</span>
              <span className="text-gray-500">{fmt(sum(chargesDirectes, 'montant_reel'))}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-500 pl-3">dont charges indirectes réparties</span>
              <span className="text-gray-500">{fmt(sum(chargesIndirectes, 'montant_prevu'))}</span>
              <span className="text-gray-500">{fmt(sum(chargesIndirectes, 'montant_reel'))}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Total DONT CVN (86)</span>
              <span>{fmt(sum(chargesCVN, 'montant_prevu'))}</span>
              <span>{fmt(sum(chargesCVN, 'montant_reel'))}</span>
            </div>
            <hr className="my-1 border-gray-200" />
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Total des produits HORS CVN</span>
              <span>{fmt(sum(produitsHorsCVN, 'montant_prevu'))}</span>
              <span>{fmt(sum(produitsHorsCVN, 'montant_reel'))}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-gray-700 font-medium">Total DONT CVN (87)</span>
              <span>{fmt(sum(produitsCVN, 'montant_prevu'))}</span>
              <span>{fmt(sum(produitsCVN, 'montant_reel'))}</span>
            </div>
            <hr className="my-1 border-gray-200" />
            <div className="grid grid-cols-3 gap-2 font-semibold">
              <span className="text-gray-800">TOTAL GÉNÉRAL CHARGES</span>
              <span>{fmt(totalChargesPrevu)}</span>
              <span>{fmt(totalChargesReel)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-semibold">
              <span className="text-gray-800">TOTAL GÉNÉRAL PRODUITS</span>
              <span>{fmt(totalProduitsPrevu)}</span>
              <span>{fmt(totalProduitsReel)}</span>
            </div>
          </div>

          {/* Case obligatoire CERFA : ratio subvention / produits */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            La subvention de <strong>{fmt(montantSubvention)}</strong>
            {pctSubvention != null
              ? <> représente <strong>{pctSubvention.toFixed(1)} %</strong> du total des produits réalisés.</>
              : <> — le pourcentage du total des produits sera calculé quand des montants réels seront saisis.</>}
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

          {/* Annexe CERFA (feuillet 3) */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Annexe (feuillet 3 du CERFA)</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Règles de répartition des charges indirectes</label>
              {!reglesRepartition && chargesIndirectes.some(l => l.cle_repartition) && (
                <p className="text-xs text-gray-400 mb-1">
                  Clés saisies sur les lignes : {[...new Set(chargesIndirectes.map(l => l.cle_repartition).filter(Boolean))].join(' ; ')}
                </p>
              )}
              <textarea
                value={reglesRepartition}
                onChange={e => setReglesRepartition(e.target.value)}
                onBlur={() => patchBilan({ regles_repartition_charges_indirectes: reglesRepartition || undefined })}
                rows={3}
                placeholder="Ex : quote-part du loyer et des salaires administratifs affectée à l'action au prorata du temps passé (20 % ETP)."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de valorisation des contributions volontaires en nature</label>
              <textarea
                value={methodeCvn}
                onChange={e => setMethodeCvn(e.target.value)}
                onBlur={() => patchBilan({ methode_valorisation_cvn: methodeCvn || undefined })}
                rows={3}
                placeholder="Ex : bénévolat valorisé au SMIC horaire brut × nombre d'heures effectuées ; locaux valorisés à la valeur locative communiquée par la mairie."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observations sur le compte rendu financier</label>
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                onBlur={() => patchBilan({ observations: observations || undefined })}
                rows={3}
                placeholder="Observations à formuler sur le compte rendu financier de l'opération subventionnée."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
              />
            </div>
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
          {/* Pièces à joindre au compte-rendu (CERFA 15059) */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-2">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Pièces à joindre au compte-rendu</h3>
            <p className="text-xs text-gray-400 mb-2">
              Les pièces obligatoires doivent être fournies avant de valider le bilan.
            </p>
            {pieces.map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.statut === 'fourni'}
                  onChange={e => patchPiece(p.id, e.target.checked ? 'fourni' : 'manquant')}
                />
                <span className={p.statut === 'fourni' ? 'text-gray-700' : 'text-gray-500'}>
                  {p.libelle}
                  {p.obligatoire && <span className="text-red-400 ml-1">*</span>}
                </span>
              </label>
            ))}
            {pieces.length === 0 && <p className="text-sm text-gray-400">Chargement de la checklist…</p>}
          </div>

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
                <span className="font-medium">{fmt(montantSubvention)}</span>
              </div>
              <div className="flex justify-between">
                <span>Crédits consommés (ce bilan) :</span>
                <span className="font-medium">{fmt(totalChargesReel)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-1 font-bold">
                <span>Total crédits consommés :</span>
                <span>{fmt(totalChargesReel)}</span>
              </div>
              <div className="flex justify-between">
                <span>Crédits non consommés :</span>
                <span className="font-medium">{fmt(montantSubvention - totalChargesReel)}</span>
              </div>
              <div className="flex justify-between">
                <span>Autofinancement :</span>
                <span className="font-medium">{fmt(Math.max(0, totalProduitsReel - totalChargesReel))}</span>
              </div>
              {pctSubvention != null && (
                <div className="flex justify-between border-t border-gray-300 pt-1">
                  <span>Part de la subvention dans les produits :</span>
                  <span className="font-medium">{pctSubvention.toFixed(1)} %</span>
                </div>
              )}
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
