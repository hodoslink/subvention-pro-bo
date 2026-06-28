"use client";
import { useEffect, useState, use } from "react";
import { AppShell } from "@/components/AppShell";
import { StatutBadge } from "@/components/StatutBadge";
import { STATUTS, ALL_STATUTS } from "@/lib/statuts";
import type { Demande, Association, Statut, BudgetLigne } from "@/lib/supabase";
import Link from "next/link";

type FullDemande = Demande & { associations: Association };

type EnrichResult = {
  points_forts: string[];
  points_attention: string[];
  suggestion_objectif: string;
  suggestion_public: string;
  contexte_territorial: string;
  elements_manquants: string[];
  conseil_montant: string;
};

type ProjetDraft = {
  titre_projet: string;
  bailleur_nom: string;
  bailleur_type: 'ville' | 'departement' | '';
  montant_demande: string;
  periode_debut: string;
  periode_fin: string;
  objectif_projet: string;
  public_beneficiaire: string;
  nb_beneficiaires_estime: string;
  bilan_subvention_anterieure: string;
  bilan_nb_beneficiaires_reel: string;
  bilan_activites: string;
};

function draftFromDemande(d: FullDemande): ProjetDraft {
  return {
    titre_projet: d.titre_projet || '',
    bailleur_nom: d.bailleur_nom || '',
    bailleur_type: (d.bailleur_type as 'ville' | 'departement') || '',
    montant_demande: d.montant_demande?.toString() || '',
    periode_debut: d.periode_debut || '',
    periode_fin: d.periode_fin || '',
    objectif_projet: d.objectif_projet || '',
    public_beneficiaire: d.public_beneficiaire || '',
    nb_beneficiaires_estime: d.nb_beneficiaires_estime?.toString() || '',
    bilan_subvention_anterieure: d.bilan_subvention_anterieure?.toString() || '',
    bilan_nb_beneficiaires_reel: d.bilan_nb_beneficiaires_reel?.toString() || '',
    bilan_activites: d.bilan_activites || '',
  };
}

export default function FicheDemande({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [demande, setDemande] = useState<FullDemande | null>(null);
  const [loading, setLoading] = useState(true);

  // Gestion dossier (colonne droite)
  const [editStatut, setEditStatut] = useState('');
  const [editPresta, setEditPresta] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMontantObtenu, setEditMontantObtenu] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Edition projet (colonne gauche)
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ProjetDraft | null>(null);
  const [savingProjet, setSavingProjet] = useState(false);
  const [savedProjet, setSavedProjet] = useState(false);

  // IA
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [lettreLoading, setLettreLoading] = useState(false);
  const [lettre, setLettre] = useState('');
  const [lettreStyle, setLettreStyle] = useState<'formel' | 'accessible'>('formel');
  const [activeTab, setActiveTab] = useState<'dossier' | 'ia' | 'lettre'>('dossier');

  const loadDemande = async () => {
    const r = await fetch(`/api/demandes/${id}`);
    const { demande: d } = await r.json();
    setDemande(d);
    setEditStatut(d?.statut || '');
    setEditPresta(d?.presta_redacteur || '');
    setEditNotes(d?.notes || '');
    setEditMontantObtenu(d?.montant_obtenu?.toString() || '');
    setDraft(draftFromDemande(d));
    setLoading(false);
  };

  useEffect(() => { loadDemande(); }, [id]);

  const setField = (key: keyof ProjetDraft, val: string) =>
    setDraft((prev) => prev ? { ...prev, [key]: val } : prev);

  const cancelEdit = () => {
    if (demande) setDraft(draftFromDemande(demande));
    setEditMode(false);
  };

  const saveProjet = async () => {
    if (!draft) return;
    setSavingProjet(true);
    await fetch(`/api/demandes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titre_projet: draft.titre_projet || null,
        bailleur_nom: draft.bailleur_nom || null,
        bailleur_type: draft.bailleur_type || null,
        montant_demande: draft.montant_demande ? Number(draft.montant_demande) : null,
        periode_debut: draft.periode_debut || null,
        periode_fin: draft.periode_fin || null,
        objectif_projet: draft.objectif_projet || null,
        public_beneficiaire: draft.public_beneficiaire || null,
        nb_beneficiaires_estime: draft.nb_beneficiaires_estime ? Number(draft.nb_beneficiaires_estime) : null,
        bilan_subvention_anterieure: draft.bilan_subvention_anterieure ? Number(draft.bilan_subvention_anterieure) : null,
        bilan_nb_beneficiaires_reel: draft.bilan_nb_beneficiaires_reel ? Number(draft.bilan_nb_beneficiaires_reel) : null,
        bilan_activites: draft.bilan_activites || null,
      }),
    });
    await loadDemande();
    setSavingProjet(false);
    setSavedProjet(true);
    setEditMode(false);
    setTimeout(() => setSavedProjet(false), 2500);
  };

  const saveGestion = async () => {
    setSaving(true);
    await fetch(`/api/demandes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statut: editStatut as Statut,
        presta_redacteur: editPresta || null,
        notes: editNotes || null,
        montant_obtenu: editMontantObtenu ? Number(editMontantObtenu) : null,
      }),
    });
    await loadDemande();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const enrich = async () => {
    setEnrichLoading(true);
    setActiveTab('ia');
    const r = await fetch('/api/ai/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demande_id: id }),
    });
    const json = await r.json();
    setEnrichResult(json.analyse || null);
    setEnrichLoading(false);
  };

  const genLettre = async () => {
    setLettreLoading(true);
    setActiveTab('lettre');
    const r = await fetch('/api/ai/redige', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demande_id: id, style: lettreStyle }),
    });
    const json = await r.json();
    setLettre(json.texte || '');
    setLettreLoading(false);
  };

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;
  if (!demande || !draft) return <AppShell><div className="p-8 text-red-500">Demande introuvable</div></AppShell>;

  const asso = demande.associations;
  const budget = (demande.budget_previsionnel_json as BudgetLigne[] | null) || [];
  const totalBudget = budget.reduce((s, l) => s + (Number(l.montant) || 0), 0);

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/demandes" className="text-xs text-gray-400 hover:text-gray-600">← Toutes les demandes</Link>
            <h1 className="text-xl font-bold text-gray-900 mt-1">
              {demande.titre_projet || '(sans titre)'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              <Link href={`/associations/${asso.id}`} className="text-blue-600 hover:underline">{asso.nom}</Link>
              {asso.ville && <span className="ml-1">— {asso.ville}</span>}
              <span className="ml-2 text-gray-300">|</span>
              <span className="ml-2">{demande.bailleur_nom}</span>
              {demande.type_demande === 'renouvellement' && (
                <span className="ml-2 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Renouvellement</span>
              )}
            </p>
          </div>
          <div className="shrink-0">
            <StatutBadge statut={demande.statut} />
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-gray-200">
          {([
            ['dossier', '📋 Dossier'],
            ['ia', '🤖 Analyse IA'],
            ['lettre', '✉️ Lettre'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Onglet Dossier ─────────────────────────────────────── */}
        {activeTab === 'dossier' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne gauche — informations projet */}
            <div className="lg:col-span-2 space-y-5">

              {/* Section Projet */}
              <div className="card space-y-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <h2 className="text-sm font-semibold text-gray-700">Projet</h2>
                  {savedProjet && !editMode && (
                    <span className="text-xs text-green-600 font-medium">✓ Enregistré</span>
                  )}
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="btn btn-ghost text-xs py-1 px-2"
                    >
                      ✏️ Modifier
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={cancelEdit} className="btn btn-ghost text-xs py-1 px-2">
                        Annuler
                      </button>
                      <button
                        onClick={saveProjet}
                        disabled={savingProjet}
                        className="btn btn-primary text-xs py-1 px-3"
                      >
                        {savingProjet ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                    </div>
                  )}
                </div>

                {editMode ? (
                  <div className="space-y-4">
                    <Field label="Titre du projet">
                      <input
                        className="field-input"
                        value={draft.titre_projet}
                        onChange={(e) => setField('titre_projet', e.target.value)}
                        placeholder="Titre du projet"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bailleur">
                        <input
                          className="field-input"
                          value={draft.bailleur_nom}
                          onChange={(e) => setField('bailleur_nom', e.target.value)}
                          placeholder="Nom du bailleur"
                        />
                      </Field>
                      <Field label="Type de bailleur">
                        <select
                          className="field-input"
                          value={draft.bailleur_type}
                          onChange={(e) => setField('bailleur_type', e.target.value)}
                        >
                          <option value="">—</option>
                          <option value="ville">Ville</option>
                          <option value="departement">Département</option>
                        </select>
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Montant demandé (€)">
                        <input
                          type="number"
                          className="field-input"
                          value={draft.montant_demande}
                          onChange={(e) => setField('montant_demande', e.target.value)}
                          placeholder="0"
                          min={0}
                        />
                      </Field>
                      <Field label="Période début">
                        <input
                          className="field-input"
                          value={draft.periode_debut}
                          onChange={(e) => setField('periode_debut', e.target.value)}
                          placeholder="janv. 2025"
                        />
                      </Field>
                      <Field label="Période fin">
                        <input
                          className="field-input"
                          value={draft.periode_fin}
                          onChange={(e) => setField('periode_fin', e.target.value)}
                          placeholder="déc. 2025"
                        />
                      </Field>
                    </div>
                    <Field label="Objectif du projet">
                      <textarea
                        rows={4}
                        className="field-textarea"
                        value={draft.objectif_projet}
                        onChange={(e) => setField('objectif_projet', e.target.value)}
                        placeholder="Décrivez l'objectif principal du projet…"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Public bénéficiaire">
                        <input
                          className="field-input"
                          value={draft.public_beneficiaire}
                          onChange={(e) => setField('public_beneficiaire', e.target.value)}
                          placeholder="Ex : jeunes de 12 à 18 ans"
                        />
                      </Field>
                      <Field label="Nb bénéficiaires estimés">
                        <input
                          type="number"
                          className="field-input"
                          value={draft.nb_beneficiaires_estime}
                          onChange={(e) => setField('nb_beneficiaires_estime', e.target.value)}
                          placeholder="0"
                          min={0}
                        />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Row label="Titre" value={demande.titre_projet} />
                    <Row
                      label="Bailleur"
                      value={
                        demande.bailleur_nom
                          ? `${demande.bailleur_nom}${demande.bailleur_type ? ` (${demande.bailleur_type === 'ville' ? 'Ville' : 'Département'})` : ''}`
                          : undefined
                      }
                    />
                    <Row label="Période" value={`${demande.periode_debut || '?'} → ${demande.periode_fin || '?'}`} />
                    <Row
                      label="Montant demandé"
                      value={demande.montant_demande ? `${demande.montant_demande.toLocaleString('fr-FR')} €` : undefined}
                    />
                    {demande.objectif_projet && (
                      <div className="pt-1">
                        <p className="text-xs text-gray-500 mb-1">Objectif du projet</p>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{demande.objectif_projet}</p>
                      </div>
                    )}
                    {demande.public_beneficiaire && (
                      <Row
                        label="Public"
                        value={`${demande.public_beneficiaire}${demande.nb_beneficiaires_estime ? ` (${demande.nb_beneficiaires_estime} personnes)` : ''}`}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Budget — lecture seule */}
              {budget.length > 0 && (
                <div className="card space-y-3">
                  <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-50 pb-2">Budget prévisionnel</h2>
                  <div className="space-y-1.5">
                    {budget.map((l, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700">{l.poste}</span>
                        <span className="text-gray-900 font-medium">
                          {Number(l.montant) ? Number(l.montant).toLocaleString('fr-FR') + ' €' : '—'}
                        </span>
                      </div>
                    ))}
                    {totalBudget > 0 && (
                      <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-2 mt-2">
                        <span>Total</span>
                        <span>{totalBudget.toLocaleString('fr-FR')} €</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bilan renouvellement */}
              {demande.type_demande === 'renouvellement' && (
                <div className="card space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                    <h2 className="text-sm font-semibold text-gray-700">Bilan année précédente</h2>
                    {!editMode && (
                      <button onClick={() => setEditMode(true)} className="btn btn-ghost text-xs py-1 px-2">
                        ✏️ Modifier
                      </button>
                    )}
                  </div>
                  {editMode ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Subvention reçue (€)">
                          <input
                            type="number"
                            className="field-input"
                            value={draft.bilan_subvention_anterieure}
                            onChange={(e) => setField('bilan_subvention_anterieure', e.target.value)}
                            placeholder="0"
                            min={0}
                          />
                        </Field>
                        <Field label="Bénéficiaires réels">
                          <input
                            type="number"
                            className="field-input"
                            value={draft.bilan_nb_beneficiaires_reel}
                            onChange={(e) => setField('bilan_nb_beneficiaires_reel', e.target.value)}
                            placeholder="0"
                            min={0}
                          />
                        </Field>
                      </div>
                      <Field label="Bilan des actions">
                        <textarea
                          rows={4}
                          className="field-textarea"
                          value={draft.bilan_activites}
                          onChange={(e) => setField('bilan_activites', e.target.value)}
                          placeholder="Décrivez les actions réalisées et les résultats obtenus…"
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Row label="Subvention reçue" value={demande.bilan_subvention_anterieure ? `${demande.bilan_subvention_anterieure.toLocaleString('fr-FR')} €` : undefined} />
                      <Row label="Bénéficiaires réels" value={demande.bilan_nb_beneficiaires_reel?.toString()} />
                      {demande.bilan_activites && (
                        <div className="pt-1">
                          <p className="text-xs text-gray-500 mb-1">Bilan des actions</p>
                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{demande.bilan_activites}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Association — lecture seule */}
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-50 pb-2">Association</h2>
                <Row label="Nom" value={asso.nom} />
                <Row label="Adresse" value={[asso.adresse, asso.code_postal, asso.ville].filter(Boolean).join(', ')} />
                <Row label="RNA" value={asso.rna} />
                <Row label="Contact" value={`${asso.contact_nom}${asso.contact_role ? ` (${asso.contact_role})` : ''}`} />
                <Row label="Email" value={asso.contact_email} />
                <Row label="Membres" value={asso.nb_membres?.toString()} />
              </div>
            </div>

            {/* Colonne droite — gestion */}
            <div className="space-y-5">
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-50 pb-2">Suivi du dossier</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Statut</label>
                    <select className="field-input" value={editStatut} onChange={(e) => setEditStatut(e.target.value)}>
                      {ALL_STATUTS.map((s) => (
                        <option key={s} value={s}>{STATUTS[s].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Prestataire assigné</label>
                    <input
                      className="field-input"
                      placeholder="Nom du rédacteur"
                      value={editPresta}
                      onChange={(e) => setEditPresta(e.target.value)}
                    />
                  </div>
                  {(editStatut === 'accepte' || editStatut === 'refuse') && (
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Montant obtenu (€)</label>
                      <input
                        type="number"
                        className="field-input"
                        placeholder="0"
                        value={editMontantObtenu}
                        onChange={(e) => setEditMontantObtenu(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Notes internes</label>
                    <textarea
                      rows={4}
                      className="field-textarea"
                      placeholder="Observations, contacts, historique…"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                  <button onClick={saveGestion} disabled={saving} className="btn btn-primary w-full justify-center">
                    {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
                  </button>
                </div>
              </div>

              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-50 pb-2">Assistance IA</h2>
                <p className="text-xs text-gray-500">
                  Analyse des points forts / faibles, suggestions de rédaction.
                </p>
                <button onClick={enrich} disabled={enrichLoading} className="btn btn-secondary w-full justify-center">
                  {enrichLoading ? '⏳ Analyse en cours…' : '🔍 Analyser le dossier'}
                </button>
                <div className="flex gap-2">
                  <select
                    className="field-input text-xs"
                    value={lettreStyle}
                    onChange={(e) => setLettreStyle(e.target.value as 'formel' | 'accessible')}
                  >
                    <option value="formel">Style formel</option>
                    <option value="accessible">Style accessible</option>
                  </select>
                  <button onClick={genLettre} disabled={lettreLoading} className="btn btn-secondary shrink-0">
                    {lettreLoading ? '⏳' : '✉️ Lettre'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Onglet IA ──────────────────────────────────────────── */}
        {activeTab === 'ia' && (
          <div className="space-y-5">
            {enrichLoading && (
              <div className="card text-center py-12 text-gray-400">
                ⏳ Analyse en cours… (scraping + historique + Claude)
              </div>
            )}
            {!enrichLoading && !enrichResult && (
              <div className="card text-center py-12 text-gray-400">
                <p className="mb-3">Aucune analyse pour l'instant.</p>
                <button onClick={enrich} className="btn btn-primary">🔍 Lancer l'analyse</button>
              </div>
            )}
            {enrichResult && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Section title="✅ Points forts">
                    <ul className="space-y-1.5">
                      {enrichResult.points_forts.map((p, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-green-500 shrink-0">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </Section>
                  <Section title="⚠️ Points d'attention">
                    <ul className="space-y-1.5">
                      {enrichResult.points_attention.map((p, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-amber-500 shrink-0">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </Section>
                </div>
                <Section title="📝 Suggestion d'objectif">
                  <p className="text-sm text-gray-800 leading-relaxed">{enrichResult.suggestion_objectif}</p>
                </Section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Section title="👥 Public bénéficiaire affiné">
                    <p className="text-sm text-gray-800">{enrichResult.suggestion_public}</p>
                  </Section>
                  <Section title="🗺 Contexte territorial">
                    <p className="text-sm text-gray-800">{enrichResult.contexte_territorial}</p>
                  </Section>
                </div>
                <Section title="📋 Éléments manquants à collecter">
                  <ul className="space-y-1">
                    {enrichResult.elements_manquants.map((e, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-red-400 shrink-0">□</span>{e}
                      </li>
                    ))}
                  </ul>
                </Section>
                <Section title="💶 Conseil sur le montant">
                  <p className="text-sm text-gray-800">{enrichResult.conseil_montant}</p>
                </Section>
                <div className="flex justify-end">
                  <button onClick={enrich} className="btn btn-ghost text-xs">↺ Relancer l'analyse</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Onglet Lettre ──────────────────────────────────────── */}
        {activeTab === 'lettre' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select
                className="field-input w-auto"
                value={lettreStyle}
                onChange={(e) => setLettreStyle(e.target.value as 'formel' | 'accessible')}
              >
                <option value="formel">Style formel</option>
                <option value="accessible">Style accessible</option>
              </select>
              <button onClick={genLettre} disabled={lettreLoading} className="btn btn-primary">
                {lettreLoading ? '⏳ Génération…' : '✉️ Générer la lettre'}
              </button>
              {lettre && (
                <button onClick={() => navigator.clipboard.writeText(lettre)} className="btn btn-secondary">
                  📋 Copier
                </button>
              )}
            </div>
            {lettreLoading && (
              <div className="card text-center py-12 text-gray-400">⏳ Rédaction en cours…</div>
            )}
            {!lettreLoading && !lettre && (
              <div className="card text-center py-12 text-gray-400">
                Cliquez sur « Générer la lettre » pour créer un brouillon.
              </div>
            )}
            {lettre && (
              <div className="card">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">{lettre}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-50 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  );
}
