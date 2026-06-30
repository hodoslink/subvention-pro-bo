"use client";
import { useEffect, useState, use, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import type { BudgetLigneDB, BudgetEquilibre, TauxFinancement } from "@/lib/supabase";

// Plan comptable associatif
const COMPTES_CHARGE = [
  { code: '60', label: 'Achats (fournitures, petit matériel)' },
  { code: '61', label: 'Services extérieurs (location salle, assurance)' },
  { code: '62', label: 'Autres services ext. (honoraires, déplacements)' },
  { code: '63', label: 'Impôts et taxes' },
  { code: '64', label: 'Charges de personnel (salaires et charges)' },
  { code: '65', label: 'Autres charges de gestion courante' },
  { code: '66', label: 'Charges financières' },
  { code: '67', label: 'Charges exceptionnelles' },
  { code: '68', label: 'Dotations aux amortissements' },
  { code: '86', label: 'Valorisation bénévolat (contributions en nature)' },
];

const COMPTES_PRODUIT = [
  { code: '70', label: 'Ventes de produits / prestations' },
  { code: '73', label: 'Dotations et produits de tarification' },
  { code: '74', label: 'Subventions d\'exploitation (par bailleur)' },
  { code: '75', label: 'Autres produits (cotisations, dons)' },
  { code: '76', label: 'Produits financiers' },
  { code: '77', label: 'Produits exceptionnels' },
  { code: '78', label: 'Reprises sur amortissements' },
  { code: '79', label: 'Transfert de charges' },
  { code: '87', label: 'Valorisation bénévolat (produits en nature)' },
];

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
    compte: defaultCompte ?? (sens === 'charge' ? '62' : '74'),
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

export default function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lignes, setLignes] = useState<BudgetLigneDB[]>([]);
  const [equilibre, setEquilibre] = useState<BudgetEquilibre | null>(null);
  const [taux, setTaux] = useState<TauxFinancement[]>([]);
  const [loading, setLoading] = useState(true);
  const [bailleurNom, setBailleurNom] = useState('');
  const [precedenteInfo, setPrecedenteInfo] = useState<{ id: string; annee: number | null; lignesCount: number } | null>(null);
  const [reprisEnCours, setReprisEnCours] = useState(false);

  // New lines form
  const [newCharge, setNewCharge] = useState<NewLine>(emptyLine('charge'));
  const [newProduit, setNewProduit] = useState<NewLine>(emptyLine('produit'));
  const [addingCharge, setAddingCharge] = useState(false);
  const [addingProduit, setAddingProduit] = useState(false);

  // Edit state per existing line
  const [edits, setEdits] = useState<EditState>({});

  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rBudget, rDemande] = await Promise.all([
      fetch(`/api/demandes/${id}/budget-lignes`),
      fetch(`/api/demandes/${id}`),
    ]);
    const { lignes: l, equilibre: eq, taux: t } = await rBudget.json();
    const { demande } = await rDemande.json();
    setLignes(l ?? []);
    setEquilibre(eq ?? null);
    setTaux(t ?? []);
    setBailleurNom(demande?.bailleur_nom ?? '');

    // D5 — check for demande précédente with budget lines
    const prevId = demande?.demande_precedente_id;
    if (prevId) {
      const rPrev = await fetch(`/api/demandes/${prevId}/budget-lignes`);
      if (rPrev.ok) {
        const { lignes: prevLignes } = await rPrev.json();
        const prevDemande = await fetch(`/api/demandes/${prevId}`).then(r => r.json()).then(d => d.demande);
        const filteredLines = (prevLignes ?? []).filter((l: BudgetLigneDB) => !['74', '87'].includes(l.compte));
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

  async function addLine(sens: 'charge' | 'produit') {
    const nl = sens === 'charge' ? newCharge : newProduit;
    const montantCalc = calcMontant(nl);
    const body: Record<string, unknown> = {
      sens,
      compte: nl.compte,
      sous_categorie: nl.sous_categorie || null,
      bailleur_detail: nl.bailleur_detail || null,
      montant: montantCalc,
      precisions: nl.precisions || null,
      est_charge_commune: nl.est_charge_commune,
      cle_repartition: nl.cle_repartition || null,
      est_valorisation_benevolat: ['86', '87'].includes(nl.compte),
    };
    if (nl.quantite) body.quantite = parseFloat(nl.quantite.replace(',', '.'));
    if (nl.prix_unitaire) body.prix_unitaire = parseFloat(nl.prix_unitaire.replace(',', '.'));

    setSaving('new-' + sens);
    const r = await fetch(`/api/demandes/${id}/budget-lignes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      if (sens === 'charge') { setNewCharge(emptyLine('charge')); setAddingCharge(false); }
      else { setNewProduit(emptyLine('produit')); setAddingProduit(false); }
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
    // Recalculate montant locally for the optimistic feel — trigger will confirm
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

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;

  const totalCharges = charges.reduce((s, l) => s + l.montant, 0);
  const totalProduits = produits.reduce((s, l) => s + l.montant, 0);
  const ecart = totalCharges - totalProduits;
  const equilibreOk = Math.abs(ecart) < 0.01;

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href={`/demandes/${id}`} className="text-xs text-gray-400 hover:text-gray-600">← Retour au dossier</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Budget prévisionnel par ligne de compte</h1>
          <p className="text-xs text-gray-500 mt-0.5">Plan comptable associatif — chaque ligne est enregistrée séparément en base</p>
        </div>

        {/* Equilibre indicator */}
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
          {/* Taux financement */}
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
            <h2 className="font-semibold text-gray-800">Charges <span className="text-gray-400 font-normal text-sm">({charges.length} ligne{charges.length !== 1 ? 's' : ''} · {fmt(totalCharges)} €)</span></h2>
            <button onClick={() => setAddingCharge(true)} className="btn btn-secondary text-xs">+ Ajouter une charge</button>
          </div>

          {charges.length === 0 && !addingCharge && (
            <p className="text-sm text-gray-400 text-center py-4">Aucune charge. Cliquez sur « Ajouter une charge » pour commencer.</p>
          )}

          {charges.map(l => {
            const edit = edits[l.id];
            const isEditing = !!edit?._editing;
            if (isEditing && edit) {
              return <LigneEditRow key={l.id} ligne={l} edit={edit} onChange={patch => setEdits(prev => ({ ...prev, [l.id]: { ...prev[l.id], ...patch } }))} onSave={() => saveLine(l.id)} onCancel={() => cancelEdit(l.id)} saving={saving === l.id} comptes={COMPTES_CHARGE} bailleurNom={bailleurNom} />;
            }
            return <LigneRow key={l.id} ligne={l} onEdit={() => startEdit(l)} onDelete={() => deleteLine(l.id)} deleting={saving === l.id} />;
          })}

          {addingCharge && (
            <NewLigneForm
              line={newCharge}
              onChange={setNewCharge}
              onAdd={() => addLine('charge')}
              onCancel={() => { setAddingCharge(false); setNewCharge(emptyLine('charge')); }}
              saving={saving === 'new-charge'}
              comptes={COMPTES_CHARGE}
              bailleurNom={bailleurNom}
            />
          )}
        </div>

        {/* Produits */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Produits <span className="text-gray-400 font-normal text-sm">({produits.length} ligne{produits.length !== 1 ? 's' : ''} · {fmt(totalProduits)} €)</span></h2>
            <button onClick={() => setAddingProduit(true)} className="btn btn-secondary text-xs">+ Ajouter un produit</button>
          </div>

          {produits.length === 0 && !addingProduit && (
            <p className="text-sm text-gray-400 text-center py-4">Aucun produit. Cliquez sur « Ajouter un produit » pour commencer.</p>
          )}

          {produits.map(l => {
            const edit = edits[l.id];
            const isEditing = !!edit?._editing;
            if (isEditing && edit) {
              return <LigneEditRow key={l.id} ligne={l} edit={edit} onChange={patch => setEdits(prev => ({ ...prev, [l.id]: { ...prev[l.id], ...patch } }))} onSave={() => saveLine(l.id)} onCancel={() => cancelEdit(l.id)} saving={saving === l.id} comptes={COMPTES_PRODUIT} bailleurNom={bailleurNom} />;
            }
            return <LigneRow key={l.id} ligne={l} onEdit={() => startEdit(l)} onDelete={() => deleteLine(l.id)} deleting={saving === l.id} />;
          })}

          {addingProduit && (
            <NewLigneForm
              line={newProduit}
              onChange={setNewProduit}
              onAdd={() => addLine('produit')}
              onCancel={() => { setAddingProduit(false); setNewProduit(emptyLine('produit')); }}
              saving={saving === 'new-produit'}
              comptes={COMPTES_PRODUIT}
              bailleurNom={bailleurNom}
            />
          )}
        </div>

        <div className="text-xs text-gray-400 text-center">
          Le montant est calculé automatiquement par la base de données (quantité × prix unitaire) quand les deux sont renseignés.
        </div>
      </div>
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
              title="Calculée automatiquement depuis la fiche demande. Modifier via Moyens humains / Prestataires. Si vous éditez le montant ici, il sera recalculé à la prochaine sauvegarde de la fiche."
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

function LigneEditRow({ ligne, edit, onChange, onSave, onCancel, saving, comptes, bailleurNom }: {
  ligne: BudgetLigneDB;
  edit: Partial<BudgetLigneDB>;
  onChange: (patch: Partial<BudgetLigneDB>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  comptes: { code: string; label: string }[];
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

// ── Nouveau formulaire ───────────────────────────────────────────────────────

function NewLigneForm({ line, onChange, onAdd, onCancel, saving, comptes, bailleurNom }: {
  line: NewLine;
  onChange: (l: NewLine) => void;
  onAdd: () => void;
  onCancel: () => void;
  saving: boolean;
  comptes: { code: string; label: string }[];
  bailleurNom: string;
}) {
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
