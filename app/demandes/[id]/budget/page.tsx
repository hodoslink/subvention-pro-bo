"use client";
import { useEffect, useState, use, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import type { BudgetLigneDB, BudgetEquilibre, TauxFinancement } from "@/lib/supabase";
import {
  detecterSecteur,
  getCatalogueCharges,
  CATALOGUE_PRODUITS,
  GROUPES_CHARGES,
  GROUPES_PRODUITS,
  type SecteurActivite,
  type CatalogueCategorie,
  type CatalogueLigne,
} from "@/lib/catalogue-budget";

const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type NewLine = {
  sens: 'charge' | 'produit';
  compte: string;
  sous_categorie: string;
  bailleur_detail: string;
  quantite: string;
  prix_unitaire: string;
  montant: string;
  precisions: string;
  est_charge_commune: boolean;
  cle_repartition: string;
  est_valorisation_benevolat: boolean;
};

function emptyLine(sens: 'charge' | 'produit', defaultCompte?: string): NewLine {
  return {
    sens,
    compte: defaultCompte ?? (sens === 'charge' ? '622' : '74'),
    sous_categorie: '',
    bailleur_detail: '',
    quantite: '',
    prix_unitaire: '',
    montant: '',
    precisions: '',
    est_charge_commune: false,
    cle_repartition: '',
    est_valorisation_benevolat: false,
  };
}

function calcMontant(line: NewLine): number {
  const q = parseFloat(line.quantite.replace(',', '.'));
  const p = parseFloat(line.prix_unitaire.replace(',', '.'));
  if (!isNaN(q) && !isNaN(p)) return q * p;
  const m = parseFloat(line.montant.replace(',', '.'));
  return isNaN(m) ? 0 : m;
}

type EditState = { [id: string]: Partial<BudgetLigneDB> & { _editing?: boolean } };

// ── Alertes déterministes ─────────────────────────────────────────────────────

type AlertType = 'warning' | 'info' | 'error';

type Alerte = {
  id: string;
  type: AlertType;
  message: string;
  detail?: string;
};

function calculerAlertes(
  lignes: BudgetLigneDB[],
  totalCharges: number,
  totalProduits: number,
  taux: TauxFinancement[],
): Alerte[] {
  const alertes: Alerte[] = [];

  const charges = lignes.filter(l => l.sens === 'charge');
  const produits = lignes.filter(l => l.sens === 'produit');

  // Valorisation bénévolat : 86x et 87x doivent être équilibrés
  const total86 = charges.filter(l => l.compte.startsWith('86')).reduce((s, l) => s + l.montant, 0);
  const total87 = produits.filter(l => l.compte.startsWith('87')).reduce((s, l) => s + l.montant, 0);
  if (total86 > 0 && Math.abs(total86 - total87) > 0.01) {
    alertes.push({
      id: 'desequilibre_86_87',
      type: 'error',
      message: 'Déséquilibre bénévolat 86/87',
      detail: `Compte 86 : ${fmt(total86)} € — Compte 87 : ${fmt(total87)} €. Ces deux montants doivent être identiques.`,
    });
  }
  if (total87 > 0 && total86 === 0) {
    alertes.push({
      id: 'manque_86',
      type: 'error',
      message: 'Compte 87 sans compte 86 correspondant',
      detail: 'La valorisation bénévolat doit apparaître en charge (86) ET en produit (87).',
    });
  }

  // 706 manquant si l'association a des participations (indice : aucun 706 dans les produits)
  const a706 = produits.some(l => l.compte === '706');
  const a756 = produits.some(l => l.compte === '756');
  if (a756 && !a706) {
    alertes.push({
      id: 'manque_706',
      type: 'info',
      message: 'Cotisations (756) sans participations (706)',
      detail: 'Si l\'association perçoit aussi des participations aux séances (en dehors de la cotisation annuelle), ajoutez une ligne 706 — souvent la principale ressource propre.',
    });
  }

  // Taux de subvention > 80 %
  taux.forEach(t => {
    if (t.depasse_plafond_80) {
      alertes.push({
        id: `taux_80_${t.bailleur_detail}`,
        type: 'warning',
        message: `Taux ${t.bailleur_detail} > 80 %`,
        detail: `Ce bailleur finance ${t.pourcentage_du_projet} % du budget. Certains financeurs exigent un taux max de 80 %. Pensez à diversifier les ressources.`,
      });
    }
  });

  // Budget déséquilibré
  const ecart = Math.abs(totalCharges - totalProduits);
  if (lignes.length > 0 && ecart > 0.01) {
    const surplus = totalProduits > totalCharges;
    alertes.push({
      id: 'desequilibre_budget',
      type: 'warning',
      message: surplus ? `Excédent de ${fmt(ecart)} €` : `Déficit de ${fmt(ecart)} €`,
      detail: surplus
        ? 'Les produits dépassent les charges. Vérifiez que toutes les charges sont saisies.'
        : 'Les charges dépassent les produits. Ajoutez des recettes ou réduisez les charges.',
    });
  }

  return alertes;
}

// ── Groupement des lignes par compte ─────────────────────────────────────────

function grouper<T extends { compte: string; id: string }>(
  lignes: T[],
  groupes: { prefix: string; label: string; comptes: string[] }[],
): { label: string; lignes: T[] }[] {
  const result: { label: string; lignes: T[] }[] = [];
  const placed = new Set<string>();

  groupes.forEach(g => {
    const inGroup = lignes.filter(l => g.comptes.includes(l.compte));
    if (inGroup.length > 0) {
      result.push({ label: g.label, lignes: inGroup });
      inGroup.forEach(l => placed.add(l.id));
    }
  });

  const autres = lignes.filter(l => !placed.has(l.id));
  if (autres.length > 0) {
    result.push({ label: 'Autres', lignes: autres });
  }

  return result;
}

export default function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lignes, setLignes] = useState<BudgetLigneDB[]>([]);
  const [equilibre, setEquilibre] = useState<BudgetEquilibre | null>(null);
  const [taux, setTaux] = useState<TauxFinancement[]>([]);
  const [loading, setLoading] = useState(true);
  const [bailleurNom, setBailleurNom] = useState('');
  const [demande, setDemande] = useState<Record<string, unknown> | null>(null);
  const [secteur, setSecteur] = useState<SecteurActivite>('autre');
  const [precedenteInfo, setPrecedenteInfo] = useState<{ id: string; annee: number | null; lignesCount: number } | null>(null);
  const [reprisEnCours, setReprisEnCours] = useState(false);

  // Catalogue modal
  const [catalogueOuvert, setCatalogueOuvert] = useState(false);
  const [catalogueSens, setCatalogueSens] = useState<'charge' | 'produit'>('charge');
  const [catSelectionnee, setCatSelectionnee] = useState<CatalogueCategorie | null>(null);
  const [ligneSelectionnee, setLigneSelectionnee] = useState<CatalogueLigne | null>(null);
  const [catalogueDraft, setCatalogueDraft] = useState<NewLine>(emptyLine('charge'));

  // Calculateur 706 interne au catalogue
  const [calc706Seances, setCalc706Seances] = useState('');
  const [calc706Mois, setCalc706Mois] = useState('10');
  const [calc706Participants, setCalc706Participants] = useState('');
  const [calc706Tarif, setCalc706Tarif] = useState('');

  // New lines form (formulaire manuel direct)
  const [newCharge, setNewCharge] = useState<NewLine>(emptyLine('charge'));
  const [newProduit, setNewProduit] = useState<NewLine>(emptyLine('produit'));
  const [addingCharge, setAddingCharge] = useState(false);
  const [addingProduit, setAddingProduit] = useState(false);

  const [edits, setEdits] = useState<EditState>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rBudget, rDemande] = await Promise.all([
      fetch(`/api/demandes/${id}/budget-lignes`),
      fetch(`/api/demandes/${id}`),
    ]);
    const { lignes: l, equilibre: eq, taux: t } = await rBudget.json();
    const { demande: d } = await rDemande.json();
    setLignes(l ?? []);
    setEquilibre(eq ?? null);
    setTaux(t ?? []);
    setBailleurNom(d?.bailleur_nom ?? '');
    setDemande(d ?? null);

    const secteurBrut = d?.associations?.secteur_activite ?? null;
    setSecteur(detecterSecteur(secteurBrut));

    const prevId = d?.demande_precedente_id;
    if (prevId) {
      const rPrev = await fetch(`/api/demandes/${prevId}/budget-lignes`);
      if (rPrev.ok) {
        const { lignes: prevLignes } = await rPrev.json();
        const prevDemande = await fetch(`/api/demandes/${prevId}`).then(r => r.json()).then(pd => pd.demande);
        const filteredLines = (prevLignes ?? []).filter((ln: BudgetLigneDB) => !['74', '87'].includes(ln.compte));
        if (filteredLines.length > 0) {
          setPrecedenteInfo({ id: prevId, annee: prevDemande?.annee_millesime ?? null, lignesCount: filteredLines.length });
        }
      }
    } else {
      setPrecedenteInfo(null);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const charges = lignes.filter(l => l.sens === 'charge');
  const produits = lignes.filter(l => l.sens === 'produit');
  const totalCharges = charges.reduce((s, l) => s + l.montant, 0);
  const totalProduits = produits.reduce((s, l) => s + l.montant, 0);
  const ecart = totalCharges - totalProduits;
  const equilibreOk = Math.abs(ecart) < 0.01;

  const alertes = calculerAlertes(lignes, totalCharges, totalProduits, taux);
  const groupesCharges = grouper(charges, GROUPES_CHARGES);
  const groupesProduits = grouper(produits, GROUPES_PRODUITS);

  async function addLine(sens: 'charge' | 'produit', nl?: NewLine) {
    const line = nl ?? (sens === 'charge' ? newCharge : newProduit);
    const montantCalc = calcMontant(line);
    const body: Record<string, unknown> = {
      sens,
      compte: line.compte,
      sous_categorie: line.sous_categorie || null,
      bailleur_detail: line.bailleur_detail || null,
      montant: montantCalc,
      precisions: line.precisions || null,
      est_charge_commune: line.est_charge_commune,
      cle_repartition: line.cle_repartition || null,
      est_valorisation_benevolat: ['86', '87'].includes(line.compte),
    };
    if (line.quantite) body.quantite = parseFloat(line.quantite.replace(',', '.'));
    if (line.prix_unitaire) body.prix_unitaire = parseFloat(line.prix_unitaire.replace(',', '.'));

    setSaving('new-' + sens);
    const r = await fetch(`/api/demandes/${id}/budget-lignes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      if (!nl) {
        if (sens === 'charge') { setNewCharge(emptyLine('charge')); setAddingCharge(false); }
        else { setNewProduit(emptyLine('produit')); setAddingProduit(false); }
      }
      await load();
    }
    setSaving(null);
  }

  async function deleteLine(ligneId: string) {
    setSaving(ligneId);
    await fetch(`/api/budget-lignes/${ligneId}`, { method: 'DELETE' });
    await load();
    setSaving(null);
  }

  async function saveLine(ligneId: string) {
    const edit = edits[ligneId];
    if (!edit) return;
    const body = { ...edit };
    if (edit.quantite != null && edit.prix_unitaire != null) {
      body.montant = (edit.quantite as number) * (edit.prix_unitaire as number);
    }
    setSaving(ligneId);
    await fetch(`/api/budget-lignes/${ligneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setEdits(prev => { const n = { ...prev }; delete n[ligneId]; return n; });
    await load();
    setSaving(null);
  }

  async function reprendreStructureBudget() {
    if (!precedenteInfo) return;
    setReprisEnCours(true);
    try {
      const rPrev = await fetch(`/api/demandes/${precedenteInfo.id}/budget-lignes`);
      if (!rPrev.ok) return;
      const { lignes: prevLignes } = await rPrev.json();
      const toReprise = (prevLignes as BudgetLigneDB[]).filter(l => !['74', '87'].includes(l.compte));
      for (const l of toReprise) {
        await fetch(`/api/demandes/${id}/budget-lignes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sens: l.sens,
            compte: l.compte,
            sous_categorie: l.sous_categorie || null,
            bailleur_detail: l.bailleur_detail || null,
            montant: l.montant,
            precisions: l.precisions || null,
            est_charge_commune: l.est_charge_commune,
            est_valorisation_benevolat: l.est_valorisation_benevolat,
          }),
        });
      }
      setPrecedenteInfo(null);
      await load();
    } finally {
      setReprisEnCours(false);
    }
  }

  function startEdit(l: BudgetLigneDB) {
    setEdits(prev => ({ ...prev, [l.id]: { ...l, _editing: true } }));
  }

  function cancelEdit(ligneId: string) {
    setEdits(prev => { const n = { ...prev }; delete n[ligneId]; return n; });
  }

  // ── Catalogue modal handlers ─────────────────────────────────────────────

  function ouvrirCatalogue(sens: 'charge' | 'produit') {
    setCatalogueSens(sens);
    setCatSelectionnee(null);
    setLigneSelectionnee(null);
    setCatalogueDraft(emptyLine(sens));
    setCalc706Seances('');
    setCalc706Mois('10');
    setCalc706Participants('');
    setCalc706Tarif('');
    setCatalogueOuvert(true);
  }

  function selectionnerLigneCatalogue(ligne: CatalogueLigne) {
    setLigneSelectionnee(ligne);
    setCatalogueDraft({
      ...emptyLine(catalogueSens, ligne.compte),
      sous_categorie: ligne.sous_categorie,
      est_valorisation_benevolat: ['86', '87'].includes(ligne.compte),
    });
    setCalc706Seances('');
    setCalc706Mois('10');
    setCalc706Participants('');
    setCalc706Tarif('');
  }

  function montant706(): number {
    const s = parseFloat(calc706Seances.replace(',', '.'));
    const m = parseFloat(calc706Mois.replace(',', '.')) || 10;
    const p = parseFloat(calc706Participants.replace(',', '.'));
    const t = parseFloat(calc706Tarif.replace(',', '.'));
    if (isNaN(s) || isNaN(p) || isNaN(t)) return 0;
    return Math.round(s * m * p * t * 100) / 100;
  }

  async function validerCatalogue() {
    if (!ligneSelectionnee) return;

    let draft = { ...catalogueDraft };

    if (ligneSelectionnee.mode_calcul === 'calculateur_706') {
      const s = calc706Seances.replace(',', '.');
      const m = calc706Mois.replace(',', '.');
      const p = calc706Participants.replace(',', '.');
      const t = calc706Tarif.replace(',', '.');
      const totalSeances = (parseFloat(s) * parseFloat(m)).toString();
      draft = {
        ...draft,
        quantite: totalSeances,
        prix_unitaire: (parseFloat(p) * parseFloat(t)).toFixed(2),
        montant: montant706().toString(),
        precisions: `${s} séance(s)/mois × ${m} mois × ${p} participant(s) × ${t} €`,
      };
    }

    await addLine(catalogueSens, draft);
    setCatalogueOuvert(false);
  }

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;

  const catalogueCharges = getCatalogueCharges(secteur);
  const catalogueProduits = CATALOGUE_PRODUITS;
  const categoriesCatalogue = catalogueSens === 'charge' ? catalogueCharges : catalogueProduits;

  const alerteIcone: Record<AlertType, string> = {
    error: '🔴',
    warning: '🟡',
    info: 'ℹ️',
  };

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href={`/demandes/${id}`} className="text-xs text-gray-400 hover:text-gray-600">← Retour au dossier</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Budget prévisionnel par ligne de compte</h1>
          <p className="text-xs text-gray-500 mt-0.5">Plan comptable associatif — chaque ligne est enregistrée séparément en base</p>
        </div>

        {/* Panneau santé — équilibre + taux */}
        <div className={['card flex flex-wrap items-center gap-6', equilibreOk ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'].join(' ')}>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total charges</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(totalCharges)} €</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total produits</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(totalProduits)} €</p>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Équilibre</p>
            {equilibreOk
              ? <p className="text-lg font-bold text-green-700">✓ Budget équilibré</p>
              : <p className="text-lg font-bold text-red-600">Écart : {ecart > 0 ? '+' : ''}{fmt(ecart)} €</p>
            }
          </div>
          {taux.map(t => (
            <div key={t.bailleur_detail}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Taux {t.bailleur_detail}</p>
              <p className={['text-lg font-bold', t.depasse_plafond_80 ? 'text-amber-600' : 'text-gray-900'].join(' ')}>
                {t.pourcentage_du_projet} %
                {t.depasse_plafond_80 && <span className="text-xs ml-1">⚠ &gt; 80 %</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Alertes déterministes */}
        {alertes.length > 0 && (
          <div className="space-y-2">
            {alertes.map(a => (
              <div
                key={a.id}
                className={[
                  'flex items-start gap-3 rounded-lg px-4 py-3 text-sm',
                  a.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
                  a.type === 'warning' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
                  'bg-blue-50 border border-blue-100 text-blue-800',
                ].join(' ')}
              >
                <span className="shrink-0">{alerteIcone[a.type]}</span>
                <div>
                  <p className="font-medium">{a.message}</p>
                  {a.detail && <p className="text-xs mt-0.5 opacity-80">{a.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bandeau secteur manquant */}
        {secteur === 'autre' && !(demande as Record<string, unknown> & { associations?: { secteur_activite?: string } } | null)?.associations?.secteur_activite && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
            <span>ℹ️</span>
            <p className="flex-1">
              Renseignez le <strong>secteur d'activité</strong> de l'association pour obtenir
              des suggestions d'intervenants adaptées.
            </p>
            <a
              href={`/associations/${(demande as Record<string, unknown> | null)?.association_id as string | undefined}`}
              className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
            >
              Compléter la fiche →
            </a>
          </div>
        )}

        {/* D5 — Bandeau reprendre structure N-1 */}
        {precedenteInfo && lignes.filter(l => l.cle_generation === null).length === 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                Reprendre la structure budgétaire{precedenteInfo.annee ? ` de ${precedenteInfo.annee}` : ' N-1'}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {precedenteInfo.lignesCount} ligne{precedenteInfo.lignesCount > 1 ? 's' : ''} de charges disponible{precedenteInfo.lignesCount > 1 ? 's' : ''} (hors compte 74 et 87)
              </p>
            </div>
            <button
              onClick={reprendreStructureBudget}
              disabled={reprisEnCours}
              className="shrink-0 text-xs font-medium bg-amber-600 text-white rounded px-3 py-1.5 hover:bg-amber-700 disabled:opacity-50"
            >
              {reprisEnCours ? '…' : '↩ Reprendre'}
            </button>
          </div>
        )}

        {/* Charges */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Charges <span className="text-gray-400 font-normal text-sm">({charges.length} ligne{charges.length !== 1 ? 's' : ''} · {fmt(totalCharges)} €)</span>
            </h2>
            <div className="flex gap-2">
              <button onClick={() => ouvrirCatalogue('charge')} className="btn btn-primary text-xs">📚 Catalogue</button>
              <button onClick={() => setAddingCharge(true)} className="btn btn-secondary text-xs">+ Manuel</button>
            </div>
          </div>

          {charges.length === 0 && !addingCharge && (
            <p className="text-sm text-gray-400 text-center py-4">
              Aucune charge. Utilisez le <strong>Catalogue</strong> pour ajouter rapidement des lignes.
            </p>
          )}

          {groupesCharges.map(g => (
            <div key={g.label}>
              {groupesCharges.length > 1 && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-2 pb-1 border-t border-gray-100">{g.label}</p>
              )}
              {g.lignes.map(l => {
                const edit = edits[l.id];
                if (edit?._editing) {
                  return (
                    <LigneEditRow
                      key={l.id}
                      ligne={l}
                      edit={edit}
                      onChange={patch => setEdits(prev => ({ ...prev, [l.id]: { ...prev[l.id], ...patch } }))}
                      onSave={() => saveLine(l.id)}
                      onCancel={() => cancelEdit(l.id)}
                      saving={saving === l.id}
                      bailleurNom={bailleurNom}
                    />
                  );
                }
                return <LigneRow key={l.id} ligne={l} onEdit={() => startEdit(l)} onDelete={() => deleteLine(l.id)} deleting={saving === l.id} />;
              })}
            </div>
          ))}

          {addingCharge && (
            <NewLigneForm
              line={newCharge}
              onChange={setNewCharge}
              onAdd={() => addLine('charge')}
              onCancel={() => { setAddingCharge(false); setNewCharge(emptyLine('charge')); }}
              saving={saving === 'new-charge'}
              bailleurNom={bailleurNom}
            />
          )}
        </div>

        {/* Produits */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Produits <span className="text-gray-400 font-normal text-sm">({produits.length} ligne{produits.length !== 1 ? 's' : ''} · {fmt(totalProduits)} €)</span>
            </h2>
            <div className="flex gap-2">
              <button onClick={() => ouvrirCatalogue('produit')} className="btn btn-primary text-xs">📚 Catalogue</button>
              <button onClick={() => setAddingProduit(true)} className="btn btn-secondary text-xs">+ Manuel</button>
            </div>
          </div>

          {produits.length === 0 && !addingProduit && (
            <p className="text-sm text-gray-400 text-center py-4">
              Aucun produit. Utilisez le <strong>Catalogue</strong> pour ajouter rapidement des lignes.
            </p>
          )}

          {groupesProduits.map(g => (
            <div key={g.label}>
              {groupesProduits.length > 1 && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-2 pb-1 border-t border-gray-100">{g.label}</p>
              )}
              {g.lignes.map(l => {
                const edit = edits[l.id];
                if (edit?._editing) {
                  return (
                    <LigneEditRow
                      key={l.id}
                      ligne={l}
                      edit={edit}
                      onChange={patch => setEdits(prev => ({ ...prev, [l.id]: { ...prev[l.id], ...patch } }))}
                      onSave={() => saveLine(l.id)}
                      onCancel={() => cancelEdit(l.id)}
                      saving={saving === l.id}
                      bailleurNom={bailleurNom}
                    />
                  );
                }
                return <LigneRow key={l.id} ligne={l} onEdit={() => startEdit(l)} onDelete={() => deleteLine(l.id)} deleting={saving === l.id} />;
              })}
            </div>
          ))}

          {addingProduit && (
            <NewLigneForm
              line={newProduit}
              onChange={setNewProduit}
              onAdd={() => addLine('produit')}
              onCancel={() => { setAddingProduit(false); setNewProduit(emptyLine('produit')); }}
              saving={saving === 'new-produit'}
              bailleurNom={bailleurNom}
            />
          )}
        </div>

        <div className="text-xs text-gray-400 text-center">
          Le montant est calculé automatiquement par la base de données (quantité × prix unitaire) quand les deux sont renseignés.
        </div>
      </div>

      {/* Modal Catalogue */}
      {catalogueOuvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">
                Catalogue — {catalogueSens === 'charge' ? 'Charges' : 'Produits'}
                {catalogueSens === 'charge' && secteur !== 'autre' && (
                  <span className="ml-2 text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    Secteur {secteur}
                  </span>
                )}
              </h2>
              <button onClick={() => setCatalogueOuvert(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Étape 1 — Choisir une catégorie */}
              {!catSelectionnee && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Choisissez une catégorie :</p>
                  <div className="grid grid-cols-1 gap-2">
                    {categoriesCatalogue.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => { setCatSelectionnee(cat); setLigneSelectionnee(null); }}
                        className="flex items-start gap-3 text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                      >
                        <span className="text-xl shrink-0">{cat.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{cat.label}</p>
                          <p className="text-xs text-gray-500">{cat.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Étape 2 — Choisir une ligne */}
              {catSelectionnee && !ligneSelectionnee && (
                <div>
                  <button
                    onClick={() => setCatSelectionnee(null)}
                    className="text-xs text-indigo-600 hover:underline mb-3 block"
                  >
                    ← {catSelectionnee.emoji} {catSelectionnee.label}
                  </button>
                  <p className="text-sm font-medium text-gray-700 mb-3">Choisissez une ligne :</p>
                  <div className="space-y-2">
                    {catSelectionnee.lignes.map(ligne => (
                      <button
                        key={ligne.id}
                        onClick={() => selectionnerLigneCatalogue(ligne)}
                        className="w-full flex items-start gap-3 text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                      >
                        <span className="shrink-0 text-xs font-mono font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mt-0.5">
                          {ligne.compte}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {ligne.sous_categorie || <em className="text-gray-400">Libellé à saisir</em>}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{ligne.description_aide}</p>
                          {ligne.ancre_reference && (
                            <p className="text-xs text-amber-600 mt-1">💡 {ligne.ancre_reference}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Étape 3 — Remplir les champs */}
              {catSelectionnee && ligneSelectionnee && (
                <div>
                  <button
                    onClick={() => setLigneSelectionnee(null)}
                    className="text-xs text-indigo-600 hover:underline mb-3 block"
                  >
                    ← {ligneSelectionnee.sous_categorie || 'Retour'}
                  </button>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
                        {ligneSelectionnee.compte}
                      </span>
                      <p className="text-sm font-medium text-gray-800">
                        {ligneSelectionnee.sous_categorie || catalogueDraft.sous_categorie || '—'}
                      </p>
                    </div>
                    {ligneSelectionnee.description_aide && (
                      <p className="text-xs text-gray-500 mt-1">{ligneSelectionnee.description_aide}</p>
                    )}
                    {ligneSelectionnee.ancre_reference && (
                      <p className="text-xs text-amber-600 mt-1">💡 {ligneSelectionnee.ancre_reference}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Libellé — si sous_categorie vide dans le catalogue */}
                    {!ligneSelectionnee.sous_categorie && (
                      <div>
                        <label className="text-xs font-medium text-gray-600">Libellé *</label>
                        <input
                          className="field-input mt-1 text-xs"
                          value={catalogueDraft.sous_categorie}
                          onChange={e => setCatalogueDraft(d => ({ ...d, sous_categorie: e.target.value }))}
                          placeholder="Ex : Psychologue — groupe de parole"
                          autoFocus
                        />
                      </div>
                    )}

                    {/* Calculateur 706 */}
                    {ligneSelectionnee.mode_calcul === 'calculateur_706' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600">
                              {ligneSelectionnee.calc_label_seances ?? 'Nombre de séances / ateliers par mois'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="field-input mt-1 text-xs"
                              value={calc706Seances}
                              onChange={e => setCalc706Seances(e.target.value)}
                              placeholder="ex: 4"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Nombre de mois d'activité</label>
                            <input
                              type="number"
                              min="1"
                              max="12"
                              step="1"
                              className="field-input mt-1 text-xs"
                              value={calc706Mois}
                              onChange={e => setCalc706Mois(e.target.value)}
                              placeholder="ex: 10"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600">Nombre de participants par séance</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="field-input mt-1 text-xs"
                              value={calc706Participants}
                              onChange={e => setCalc706Participants(e.target.value)}
                              placeholder="ex: 12"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">
                              {ligneSelectionnee.calc_label_tarif ?? 'Tarif par participant par séance (€)'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="field-input mt-1 text-xs"
                              value={calc706Tarif}
                              onChange={e => setCalc706Tarif(e.target.value)}
                              placeholder="ex: 5"
                            />
                            {ligneSelectionnee.calc_hint_tarif && (
                              <p className="text-xs text-gray-400 mt-1">💡 {ligneSelectionnee.calc_hint_tarif}</p>
                            )}
                          </div>
                        </div>
                        {montant706() > 0 && (
                          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                            <p className="text-xs text-indigo-600 font-medium">Montant calculé</p>
                            <p className="text-lg font-bold text-indigo-800">{fmt(montant706())} €</p>
                            <p className="text-xs text-indigo-500 mt-0.5">
                              {calc706Seances} séance(s)/mois × {calc706Mois} mois × {calc706Participants} participant(s) × {calc706Tarif} €
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mode quantité × prix */}
                    {ligneSelectionnee.mode_calcul === 'quantite_prix' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">
                            {ligneSelectionnee.quantite_label ?? 'Quantité'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="field-input mt-1 text-xs"
                            value={catalogueDraft.quantite}
                            onChange={e => setCatalogueDraft(d => ({ ...d, quantite: e.target.value }))}
                            placeholder={ligneSelectionnee.quantite_placeholder}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">
                            {ligneSelectionnee.prix_label ?? 'Prix unitaire (€)'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="field-input mt-1 text-xs"
                            value={catalogueDraft.prix_unitaire}
                            onChange={e => setCatalogueDraft(d => ({ ...d, prix_unitaire: e.target.value }))}
                            placeholder={ligneSelectionnee.prix_placeholder}
                          />
                        </div>
                        {catalogueDraft.quantite && catalogueDraft.prix_unitaire && (
                          <div className="col-span-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                            <p className="text-xs text-indigo-600">
                              = {fmt(parseFloat(catalogueDraft.quantite) * parseFloat(catalogueDraft.prix_unitaire) || 0)} €
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mode montant forfaitaire */}
                    {ligneSelectionnee.mode_calcul === 'montant_forfaitaire' && (
                      <div>
                        <label className="text-xs font-medium text-gray-600">Montant (€)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="field-input mt-1 text-xs"
                          value={catalogueDraft.montant}
                          onChange={e => setCatalogueDraft(d => ({ ...d, montant: e.target.value }))}
                          placeholder={ligneSelectionnee.montant_placeholder ?? 'ex: 500'}
                          autoFocus
                        />
                      </div>
                    )}

                    {/* Bailleur si compte 74 */}
                    {ligneSelectionnee.compte === '74' && (
                      <div>
                        <label className="text-xs font-medium text-gray-600">Nom du bailleur</label>
                        <input
                          className="field-input mt-1 text-xs"
                          value={catalogueDraft.bailleur_detail}
                          onChange={e => setCatalogueDraft(d => ({ ...d, bailleur_detail: e.target.value }))}
                          placeholder={bailleurNom || 'Ex : Commune de Paris'}
                        />
                      </div>
                    )}

                    {/* Précisions optionnelles */}
                    <div>
                      <label className="text-xs font-medium text-gray-600">Précisions (optionnel)</label>
                      <input
                        className="field-input mt-1 text-xs"
                        value={catalogueDraft.precisions}
                        onChange={e => setCatalogueDraft(d => ({ ...d, precisions: e.target.value }))}
                        placeholder="Ex : devis N°123 joint"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end mt-4">
                    <button onClick={() => setCatalogueOuvert(false)} className="btn btn-ghost text-xs">Annuler</button>
                    <button
                      onClick={validerCatalogue}
                      disabled={saving !== null || (
                        ligneSelectionnee.mode_calcul === 'calculateur_706'
                          ? montant706() <= 0
                          : calcMontant(catalogueDraft) <= 0
                      )}
                      className="btn btn-primary text-xs"
                    >
                      {saving ? 'Enregistrement…' : '+ Ajouter la ligne'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ── Ligne (lecture) ──────────────────────────────────────────────────────────

function LigneRow({ ligne, onEdit, onDelete, deleting }: {
  ligne: BudgetLigneDB;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="shrink-0 text-xs font-mono font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mt-0.5">{ligne.compte}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800 truncate">{ligne.sous_categorie || ligne.libelle_compte || '—'}</p>
          {ligne.cle_generation && (
            <span
              title="Calculée automatiquement depuis la fiche demande. Modifier via Moyens humains / Prestataires."
              className="shrink-0 text-xs bg-indigo-50 text-indigo-500 border border-indigo-100 px-1.5 py-0 rounded font-mono cursor-help"
            >⚙ auto</span>
          )}
          {ligne.statut_financement && ligne.sens === 'produit' && (() => {
            const cfg: Record<string, { label: string; cls: string }> = {
              obtenu: { label: 'Obtenu', cls: 'bg-green-100 text-green-700 border-green-200' },
              demande: { label: 'Demandé', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
              envisage: { label: 'Envisagé', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
            };
            const s = cfg[ligne.statut_financement];
            return s ? <span className={`shrink-0 text-xs border px-1.5 py-0 rounded ${s.cls}`}>{s.label}</span> : null;
          })()}
        </div>
        {ligne.bailleur_detail && <p className="text-xs text-gray-500">{ligne.bailleur_detail}</p>}
        {ligne.precisions && <p className="text-xs text-gray-400 italic">{ligne.precisions}</p>}
        {ligne.quantite != null && ligne.prix_unitaire != null && (
          <p className="text-xs text-gray-400">{ligne.quantite} × {fmt(ligne.prix_unitaire)} €</p>
        )}
        {ligne.est_charge_commune && (
          <p className="text-xs text-amber-600">⚠ Charge commune{ligne.cle_repartition ? ` — ${ligne.cle_repartition}` : ' — clé de répartition manquante'}</p>
        )}
        {ligne.est_valorisation_benevolat && (
          <p className="text-xs text-purple-600">Valorisation bénévolat</p>
        )}
      </div>
      <p className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">{fmt(ligne.montant)} €</p>
      <div className="shrink-0 flex gap-1">
        <button onClick={onEdit} className="btn btn-ghost text-xs py-0.5 px-1.5">Éditer</button>
        <button onClick={onDelete} disabled={deleting} className="btn btn-ghost text-xs py-0.5 px-1.5 text-red-400 hover:text-red-600 hover:bg-red-50">
          {deleting ? '…' : '🗑'}
        </button>
      </div>
    </div>
  );
}

// ── Ligne (édition) ──────────────────────────────────────────────────────────

const COMPTES_CHARGE_EDIT = [
  { code: '602', label: 'Achats denrées alimentaires' },
  { code: '606', label: 'Achats fournitures / matériel' },
  { code: '613', label: 'Location de salle' },
  { code: '616', label: 'Assurance' },
  { code: '622', label: 'Honoraires / intervenants' },
  { code: '623', label: 'Communication / impression' },
  { code: '625', label: 'Déplacements et missions' },
  { code: '627', label: 'Abonnements numériques / frais bancaires' },
  { code: '641', label: 'Charges de personnel (salaires)' },
  { code: '86', label: 'Valorisation bénévolat (contributions en nature)' },
];

const COMPTES_PRODUIT_EDIT = [
  { code: '706', label: 'Participations financières aux activités' },
  { code: '74', label: 'Subventions d\'exploitation (par bailleur)' },
  { code: '756', label: 'Cotisations annuelles des adhérents' },
  { code: '758', label: 'Dons, mécénat, recettes événementielles' },
  { code: '87', label: 'Valorisation bénévolat (produits en nature)' },
];

function LigneEditRow({ ligne, edit, onChange, onSave, onCancel, saving, bailleurNom }: {
  ligne: BudgetLigneDB;
  edit: Partial<BudgetLigneDB>;
  onChange: (patch: Partial<BudgetLigneDB>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  bailleurNom: string;
}) {
  const compte = (edit.compte ?? ligne.compte);
  const needsBailleur = compte === '74' || compte === '87';
  const qStr = edit.quantite?.toString() ?? ligne.quantite?.toString() ?? '';
  const pStr = edit.prix_unitaire?.toString() ?? ligne.prix_unitaire?.toString() ?? '';
  const mStr = edit.montant?.toString() ?? ligne.montant?.toString() ?? '';
  const qNum = parseFloat(qStr);
  const pNum = parseFloat(pStr);
  const montantCalc = !isNaN(qNum) && !isNaN(pNum) ? qNum * pNum : null;
  const comptes = ligne.sens === 'charge' ? COMPTES_CHARGE_EDIT : COMPTES_PRODUIT_EDIT;

  return (
    <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Compte</label>
          <select className="field-input mt-1 text-xs" value={compte} onChange={e => onChange({ compte: e.target.value })}>
            {comptes.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Libellé / sous-catégorie</label>
          <input className="field-input mt-1 text-xs" value={edit.sous_categorie ?? ligne.sous_categorie ?? ''} onChange={e => onChange({ sous_categorie: e.target.value })} placeholder="Ex : Honoraires animateur BAFA" />
        </div>
      </div>

      {needsBailleur && (
        <div>
          <label className="text-xs font-medium text-gray-600">Bailleur (compte 74/87)</label>
          <input className="field-input mt-1 text-xs" value={edit.bailleur_detail ?? ligne.bailleur_detail ?? ''} onChange={e => onChange({ bailleur_detail: e.target.value })} placeholder={bailleurNom || 'Ex : Commune de Paris'} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Quantité</label>
          <input type="number" min="0" step="any" className="field-input mt-1 text-xs" value={qStr} onChange={e => onChange({ quantite: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Ex : 12" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Prix unitaire (€)</label>
          <input type="number" min="0" step="0.01" className="field-input mt-1 text-xs" value={pStr} onChange={e => onChange({ prix_unitaire: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Ex : 45.00" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">
            Montant (€){montantCalc !== null && <span className="text-blue-500 ml-1">= {fmt(montantCalc)}</span>}
          </label>
          <input type="number" min="0" step="0.01" className="field-input mt-1 text-xs" disabled={montantCalc !== null} value={montantCalc !== null ? montantCalc.toFixed(2) : mStr} onChange={e => onChange({ montant: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Précisions</label>
        <input className="field-input mt-1 text-xs" value={edit.precisions ?? ligne.precisions ?? ''} onChange={e => onChange({ precisions: e.target.value })} placeholder="Ex : 12 séances × tarif prestataire habituel (devis joint)" />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={edit.est_charge_commune ?? ligne.est_charge_commune ?? false} onChange={e => onChange({ est_charge_commune: e.target.checked })} />
          Charge commune
        </label>
        {(edit.est_charge_commune ?? ligne.est_charge_commune) && (
          <input className="field-input flex-1 text-xs" value={edit.cle_repartition ?? ligne.cle_repartition ?? ''} onChange={e => onChange({ cle_repartition: e.target.value })} placeholder="Ex : 50/50 entre les deux antennes" />
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn btn-ghost text-xs">Annuler</button>
        <button onClick={onSave} disabled={saving} className="btn btn-primary text-xs">{saving ? 'Enregistrement…' : '💾 Enregistrer'}</button>
      </div>
    </div>
  );
}

// ── Nouveau formulaire manuel ─────────────────────────────────────────────────

function NewLigneForm({ line, onChange, onAdd, onCancel, saving, bailleurNom }: {
  line: NewLine;
  onChange: (l: NewLine) => void;
  onAdd: () => void;
  onCancel: () => void;
  saving: boolean;
  bailleurNom: string;
}) {
  const comptes = line.sens === 'charge' ? COMPTES_CHARGE_EDIT : COMPTES_PRODUIT_EDIT;
  const needsBailleur = line.compte === '74' || line.compte === '87';
  const qNum = parseFloat(line.quantite.replace(',', '.'));
  const pNum = parseFloat(line.prix_unitaire.replace(',', '.'));
  const montantCalc = !isNaN(qNum) && !isNaN(pNum) ? qNum * pNum : null;
  const canAdd = montantCalc !== null || (parseFloat(line.montant.replace(',', '.')) > 0);

  return (
    <div className="border border-dashed border-blue-300 rounded-lg p-3 bg-white space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Compte</label>
          <select className="field-input mt-1 text-xs" value={line.compte} onChange={e => onChange({ ...line, compte: e.target.value, est_valorisation_benevolat: ['86','87'].includes(e.target.value) })}>
            {comptes.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Libellé / sous-catégorie</label>
          <input className="field-input mt-1 text-xs" value={line.sous_categorie} onChange={e => onChange({ ...line, sous_categorie: e.target.value })} placeholder="Ex : Honoraires animateur BAFA" />
        </div>
      </div>

      {needsBailleur && (
        <div>
          <label className="text-xs font-medium text-gray-600">Bailleur (compte 74/87)</label>
          <input className="field-input mt-1 text-xs" value={line.bailleur_detail} onChange={e => onChange({ ...line, bailleur_detail: e.target.value })} placeholder={bailleurNom || 'Ex : Commune de Paris'} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Quantité</label>
          <input type="number" min="0" step="any" className="field-input mt-1 text-xs" value={line.quantite} onChange={e => onChange({ ...line, quantite: e.target.value })} placeholder="Ex : 12" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Prix unitaire (€)</label>
          <input type="number" min="0" step="0.01" className="field-input mt-1 text-xs" value={line.prix_unitaire} onChange={e => onChange({ ...line, prix_unitaire: e.target.value })} placeholder="Ex : 45.00" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">
            Montant (€){montantCalc !== null && <span className="text-blue-500 ml-1">= {fmt(montantCalc)}</span>}
          </label>
          <input type="number" min="0" step="0.01" className="field-input mt-1 text-xs" disabled={montantCalc !== null} value={montantCalc !== null ? montantCalc.toFixed(2) : line.montant} onChange={e => onChange({ ...line, montant: e.target.value })} placeholder="0.00" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Précisions</label>
        <input className="field-input mt-1 text-xs" value={line.precisions} onChange={e => onChange({ ...line, precisions: e.target.value })} placeholder="Ex : 12 séances × tarif prestataire habituel (devis joint)" />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={line.est_charge_commune} onChange={e => onChange({ ...line, est_charge_commune: e.target.checked })} />
          Charge commune
        </label>
        {line.est_charge_commune && (
          <input className="field-input flex-1 text-xs" value={line.cle_repartition} onChange={e => onChange({ ...line, cle_repartition: e.target.value })} placeholder="Ex : 50/50 entre les deux antennes" />
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn btn-ghost text-xs">Annuler</button>
        <button onClick={onAdd} disabled={saving || !canAdd} className="btn btn-primary text-xs">
          {saving ? 'Enregistrement…' : '+ Ajouter la ligne'}
        </button>
      </div>
    </div>
  );
}
