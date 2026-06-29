"use client";
import { useEffect, useState, useMemo, use } from "react";
import { AppShell } from "@/components/AppShell";
import { StatutBadge } from "@/components/StatutBadge";
import { DocumentList } from "@/components/DocumentList";
import { STATUTS, ALL_STATUTS } from "@/lib/statuts";
import type { Demande, Association, Statut, BudgetLigne, BudgetV2, DetailsJson } from "@/lib/supabase";
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

type BudgetRow = { label: string; montant: string };

type FullDraft = {
  titre_projet: string;
  bailleur_nom: string;
  bailleur_type: 'ville' | 'departement' | '';
  montant_demande: string;
  periode_debut: string;
  periode_fin: string;
  thematique: string;
  objectif_projet: string;
  public_beneficiaire: string;
  nb_beneficiaires_estime: string;
  description_besoins: string;
  description_actions: string;
  partenariats: string;
  beneficiaires_profil: string;
  beneficiaires_age: string;
  beneficiaires_sexe: string;
  localisation_qpv: string;
  nb_benevoles: string;
  etpt_benevoles: string;
  nb_salaries: string;
  moyens_description: string;
  depenses: BudgetRow[];
  recettes: BudgetRow[];
  indicateurs_evaluation: string;
  bilan_subvention_anterieure: string;
  bilan_nb_beneficiaires_reel: string;
  bilan_activites: string;
  contact_nom: string;
  contact_role: string;
  contact_email: string;
  contact_telephone: string;
};

const DEP_CATS = [
  'Salaires et charges sociales',
  'Honoraires / intervenants',
  'Achats et fournitures',
  'Loyer / locaux',
  'Déplacements et transport',
  'Communication / impression',
  'Contributions bénévoles',
];

const REC_CATS = [
  'Subvention (ce bailleur)',
  'Autofinancement',
  'Subventions État / région',
  'Cotisations membres',
  'Dons et mécénat',
  'Contributions bénévoles',
];

function parseBudget(raw: unknown): { depenses: BudgetRow[]; recettes: BudgetRow[] } {
  if (!raw) return { depenses: [{ label: '', montant: '' }], recettes: [{ label: '', montant: '' }] };
  if (typeof raw === 'object' && raw !== null && '_v' in raw && (raw as BudgetV2)._v === 2) {
    const v2 = raw as BudgetV2;
    return {
      depenses: v2.depenses?.length ? v2.depenses : [{ label: '', montant: '' }],
      recettes: v2.recettes?.length ? v2.recettes : [{ label: '', montant: '' }],
    };
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const migrated = (raw as BudgetLigne[]).map(l => ({ label: l.poste, montant: String(l.montant ?? '') }));
    return { depenses: migrated, recettes: [{ label: '', montant: '' }] };
  }
  return { depenses: [{ label: '', montant: '' }], recettes: [{ label: '', montant: '' }] };
}

function sumRows(rows: BudgetRow[]) {
  return rows.reduce((s, r) => s + (parseFloat(r.montant.replace(',', '.')) || 0), 0);
}

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

function draftFromDemande(d: FullDemande): FullDraft {
  const { depenses, recettes } = parseBudget(d.budget_previsionnel_json);
  const det = (d.details_json || {}) as DetailsJson;
  return {
    titre_projet: d.titre_projet || '',
    bailleur_nom: d.bailleur_nom || '',
    bailleur_type: (d.bailleur_type as 'ville' | 'departement') || '',
    montant_demande: d.montant_demande?.toString() || '',
    periode_debut: d.periode_debut || '',
    periode_fin: d.periode_fin || '',
    thematique: det.thematique || '',
    objectif_projet: d.objectif_projet || '',
    public_beneficiaire: d.public_beneficiaire || '',
    nb_beneficiaires_estime: d.nb_beneficiaires_estime?.toString() || '',
    description_besoins: det.description_besoins || '',
    description_actions: det.description_actions || '',
    partenariats: det.partenariats || '',
    beneficiaires_profil: det.beneficiaires_profil || '',
    beneficiaires_age: det.beneficiaires_age || '',
    beneficiaires_sexe: det.beneficiaires_sexe || '',
    localisation_qpv: det.localisation_qpv || '',
    nb_benevoles: det.nb_benevoles || '',
    etpt_benevoles: det.etpt_benevoles || '',
    nb_salaries: det.nb_salaries || '',
    moyens_description: det.moyens_description || '',
    depenses,
    recettes,
    indicateurs_evaluation: det.indicateurs_evaluation || '',
    bilan_subvention_anterieure: d.bilan_subvention_anterieure?.toString() || '',
    bilan_nb_beneficiaires_reel: d.bilan_nb_beneficiaires_reel?.toString() || '',
    bilan_activites: d.bilan_activites || '',
    contact_nom: d.contact_nom || '',
    contact_role: d.contact_role || '',
    contact_email: d.contact_email || '',
    contact_telephone: d.contact_telephone || '',
  };
}

export default function FicheDemande({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [demande, setDemande] = useState<FullDemande | null>(null);
  const [loading, setLoading] = useState(true);

  const [editStatut, setEditStatut] = useState('');
  const [editPresta, setEditPresta] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMontantObtenu, setEditMontantObtenu] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<FullDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);

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

  const setField = <K extends keyof FullDraft>(key: K, val: FullDraft[K]) =>
    setDraft(prev => prev ? { ...prev, [key]: val } : prev);

  const cancelEdit = () => {
    if (demande) setDraft(draftFromDemande(demande));
    setEditMode(false);
  };

  const saveDossier = async () => {
    if (!draft) return;
    setSavingDraft(true);
    const budgetV2: BudgetV2 = {
      _v: 2,
      depenses: draft.depenses.filter(r => r.label || r.montant),
      recettes: draft.recettes.filter(r => r.label || r.montant),
    };
    const detailsJson: DetailsJson = {
      thematique: draft.thematique || undefined,
      description_besoins: draft.description_besoins || undefined,
      description_actions: draft.description_actions || undefined,
      partenariats: draft.partenariats || undefined,
      beneficiaires_profil: draft.beneficiaires_profil || undefined,
      beneficiaires_age: draft.beneficiaires_age || undefined,
      beneficiaires_sexe: draft.beneficiaires_sexe || undefined,
      localisation_qpv: draft.localisation_qpv || undefined,
      nb_benevoles: draft.nb_benevoles || undefined,
      etpt_benevoles: draft.etpt_benevoles || undefined,
      nb_salaries: draft.nb_salaries || undefined,
      moyens_description: draft.moyens_description || undefined,
      indicateurs_evaluation: draft.indicateurs_evaluation || undefined,
    };
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
        contact_nom: draft.contact_nom || null,
        contact_role: draft.contact_role || null,
        contact_email: draft.contact_email || null,
        contact_telephone: draft.contact_telephone || null,
        budget_previsionnel_json: budgetV2,
        details_json: detailsJson,
      }),
    });
    await loadDemande();
    setSavingDraft(false);
    setSavedDraft(true);
    setEditMode(false);
    setTimeout(() => setSavedDraft(false), 2500);
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
    const r = await fetch('/api/ai/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demande_id: id }) });
    setEnrichResult((await r.json()).analyse || null);
    setEnrichLoading(false);
  };

  const genLettre = async () => {
    setLettreLoading(true);
    setActiveTab('lettre');
    const r = await fetch('/api/ai/redige', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demande_id: id, style: lettreStyle }) });
    setLettre((await r.json()).texte || '');
    setLettreLoading(false);
  };

  // Score de complétude (basé sur les données sauvegardées)
  const score = useMemo(() => {
    if (!demande) return { filled: 0, total: 9, checks: [] as { label: string; ok: boolean }[] };
    const det = (demande.details_json || {}) as DetailsJson;
    const { depenses, recettes } = parseBudget(demande.budget_previsionnel_json);
    const checks = [
      { label: 'Titre et bailleur', ok: !!(demande.titre_projet && demande.bailleur_nom) },
      { label: 'Objectif du projet', ok: !!demande.objectif_projet },
      { label: 'Besoins identifiés', ok: !!det.description_besoins },
      { label: 'Actions décrites', ok: !!det.description_actions },
      { label: 'Public bénéficiaire', ok: !!(demande.public_beneficiaire || det.beneficiaires_profil) },
      { label: 'Équipe mobilisée', ok: !!(det.nb_benevoles || det.nb_salaries || det.moyens_description) },
      { label: 'Budget renseigné', ok: depenses.some(r => r.label) },
      { label: 'Budget équilibré', ok: depenses.some(r => r.label) && recettes.some(r => r.label) && Math.abs(sumRows(depenses) - sumRows(recettes)) < 0.01 },
      { label: 'Indicateurs définis', ok: !!det.indicateurs_evaluation },
    ];
    return { filled: checks.filter(c => c.ok).length, total: 9, checks };
  }, [demande]);

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;
  if (!demande || !draft) return <AppShell><div className="p-8 text-red-500">Demande introuvable</div></AppShell>;

  const asso = demande.associations;
  const det = (demande.details_json || {}) as DetailsJson;
  const { depenses: viewDep, recettes: viewRec } = parseBudget(demande.budget_previsionnel_json);
  const totalDep = sumRows(viewDep.filter(r => r.label));
  const totalRec = sumRows(viewRec.filter(r => r.label));

  const scoreColor = score.filled >= 8 ? 'text-green-600' : score.filled >= 5 ? 'text-amber-600' : 'text-red-500';
  const barColor = score.filled >= 8 ? 'bg-green-500' : score.filled >= 5 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/demandes" className="text-xs text-gray-400 hover:text-gray-600">← Toutes les demandes</Link>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{demande.titre_projet || '(sans titre)'}</h1>
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
          <StatutBadge statut={demande.statut} />
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-gray-200">
          {([['dossier', '📋 Dossier'], ['ia', '🤖 Analyse IA'], ['lettre', '✉️ Lettre']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={['px-4 py-2 text-sm font-medium border-b-2 transition-colors', activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'].join(' ')}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Dossier ─────────────────────────────────────────────── */}
        {activeTab === 'dossier' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Colonne gauche */}
            <div className="lg:col-span-2 space-y-5">

              {/* Barre d'action */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {editMode ? 'Mode édition — cliquez sur Enregistrer pour sauvegarder' : savedDraft ? '✓ Dossier enregistré' : ''}
                </p>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} className="btn btn-secondary text-sm">✏️ Modifier le dossier</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={cancelEdit} className="btn btn-ghost text-sm">Annuler</button>
                    <button onClick={saveDossier} disabled={savingDraft} className="btn btn-primary text-sm">
                      {savingDraft ? 'Enregistrement…' : '💾 Enregistrer tout'}
                    </button>
                  </div>
                )}
              </div>

              {/* Identification */}
              <SectionCard title="Identification du projet">
                {editMode ? (
                  <div className="space-y-4">
                    <Field label="Titre du projet">
                      <input className="field-input" value={draft.titre_projet} onChange={e => setField('titre_projet', e.target.value)} placeholder="Ex : Ateliers d'insertion numérique pour les jeunes décrocheurs du 13e" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bailleur">
                        <input className="field-input" value={draft.bailleur_nom} onChange={e => setField('bailleur_nom', e.target.value)} placeholder="Ex : Ville de Paris — DASES" />
                      </Field>
                      <Field label="Type de bailleur">
                        <select className="field-input" value={draft.bailleur_type} onChange={e => setField('bailleur_type', e.target.value as FullDraft['bailleur_type'])}>
                          <option value="">—</option>
                          <option value="ville">Ville / Commune</option>
                          <option value="departement">Département</option>
                        </select>
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Montant demandé (€)">
                        <input type="number" className="field-input" value={draft.montant_demande} onChange={e => setField('montant_demande', e.target.value)} placeholder="0" min={0} />
                      </Field>
                      <Field label="Période début">
                        <input className="field-input" value={draft.periode_debut} onChange={e => setField('periode_debut', e.target.value)} placeholder="janv. 2025" />
                      </Field>
                      <Field label="Période fin">
                        <input className="field-input" value={draft.periode_fin} onChange={e => setField('periode_fin', e.target.value)} placeholder="déc. 2025" />
                      </Field>
                    </div>
                    <Field label="Thématique">
                      <input className="field-input" value={draft.thematique} onChange={e => setField('thematique', e.target.value)} placeholder="Ex : Insertion professionnelle, Éducation, Cohésion sociale, Santé…" />
                    </Field>
                    <Field label="Objectif général du projet">
                      <textarea rows={3} className="field-textarea" value={draft.objectif_projet} onChange={e => setField('objectif_projet', e.target.value)} placeholder="En 2-3 phrases : ce que le projet vise à accomplir, pour qui et avec quel résultat attendu." />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Public visé">
                        <input className="field-input" value={draft.public_beneficiaire} onChange={e => setField('public_beneficiaire', e.target.value)} placeholder="Ex : jeunes NEETs de 16 à 25 ans, résidents QPV" />
                      </Field>
                      <Field label="Nb bénéficiaires estimés">
                        <input type="number" className="field-input" value={draft.nb_beneficiaires_estime} onChange={e => setField('nb_beneficiaires_estime', e.target.value)} placeholder="0" min={0} />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Row label="Titre" value={demande.titre_projet} />
                    <Row label="Bailleur" value={demande.bailleur_nom ? `${demande.bailleur_nom}${demande.bailleur_type ? ` (${demande.bailleur_type === 'ville' ? 'Ville' : 'Département'})` : ''}` : undefined} />
                    <Row label="Période" value={`${demande.periode_debut || '?'} → ${demande.periode_fin || '?'}`} />
                    <Row label="Montant demandé" value={demande.montant_demande ? `${fmt(demande.montant_demande)} €` : undefined} />
                    <Row label="Thématique" value={det.thematique} />
                    {demande.objectif_projet && <TextBlock label="Objectif" text={demande.objectif_projet} />}
                    {demande.public_beneficiaire && <Row label="Public" value={`${demande.public_beneficiaire}${demande.nb_beneficiaires_estime ? ` (${demande.nb_beneficiaires_estime} pers.)` : ''}`} />}
                  </div>
                )}
              </SectionCard>

              {/* Description */}
              <SectionCard title="Description du projet">
                {editMode ? (
                  <div className="space-y-4">
                    <Field label="À quels besoins répond le projet ? Pour qui ?">
                      <textarea rows={5} className="field-textarea" value={draft.description_besoins} onChange={e => setField('description_besoins', e.target.value)} placeholder={"Décrivez le problème constaté sur le territoire et les personnes concernées.\n\nEx : Dans notre quartier, 38% des jeunes de 16-25 ans sont sans emploi et sans formation. Les dispositifs existants ne touchent pas les profils les plus éloignés. Depuis 2022, notre association constate une augmentation de 20% des demandes d'accompagnement sans pouvoir y répondre faute de moyens."} />
                    </Field>
                    <Field label="Où, quand, comment se déroule le projet ?">
                      <textarea rows={5} className="field-textarea" value={draft.description_actions} onChange={e => setField('description_actions', e.target.value)} placeholder={"Détaillez les actions, le lieu, le rythme et les modalités concrètes.\n\nEx : Du 1er janvier au 31 décembre 2025, à la MJC du quartier (10 rue des Lilas) :\n• 2 ateliers collectifs de 3h par semaine (mardi et jeudi)\n• 1 suivi individuel mensuel par bénéficiaire\n• 3 immersions en entreprise partenaire sur l'année"} />
                    </Field>
                    <Field label="Partenariats et coopérations">
                      <textarea rows={3} className="field-textarea" value={draft.partenariats} onChange={e => setField('partenariats', e.target.value)} placeholder={"Ex :\n• Mairie du 13e : mise à disposition gratuite des locaux\n• Mission locale Paris Sud : orientation des bénéficiaires\n• Entreprises partenaires (Accenture, SNCF) : accueil en stage et mentorat"} />
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {det.description_besoins ? <TextBlock label="Besoins identifiés" text={det.description_besoins} /> : <EmptyHint text="Besoins non renseignés" />}
                    {det.description_actions && <TextBlock label="Déroulement" text={det.description_actions} />}
                    {det.partenariats && <TextBlock label="Partenariats" text={det.partenariats} />}
                  </div>
                )}
              </SectionCard>

              {/* Bénéficiaires */}
              <SectionCard title="Bénéficiaires">
                {editMode ? (
                  <div className="space-y-4">
                    <Field label="Profil détaillé des bénéficiaires">
                      <textarea rows={2} className="field-textarea" value={draft.beneficiaires_profil} onChange={e => setField('beneficiaires_profil', e.target.value)} placeholder="Ex : Jeunes hommes et femmes de 16 à 25 ans, résidents du QPV Croix-de-Chavaux, sans diplôme ni emploi depuis plus de 6 mois." />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tranches d'âge">
                        <input className="field-input" value={draft.beneficiaires_age} onChange={e => setField('beneficiaires_age', e.target.value)} placeholder="Ex : 16-18 ans (30%), 19-25 ans (70%)" />
                      </Field>
                      <Field label="Répartition hommes / femmes">
                        <input className="field-input" value={draft.beneficiaires_sexe} onChange={e => setField('beneficiaires_sexe', e.target.value)} placeholder="Ex : 55% femmes, 45% hommes" />
                      </Field>
                    </div>
                    <Field label="Localisation QPV / ZUS">
                      <input className="field-input" value={draft.localisation_qpv} onChange={e => setField('localisation_qpv', e.target.value)} placeholder="Nom du quartier prioritaire ou N/A" />
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {det.beneficiaires_profil ? <TextBlock label="Profil" text={det.beneficiaires_profil} /> : <EmptyHint text="Profil non renseigné" />}
                    <Row label="Tranches d'âge" value={det.beneficiaires_age} />
                    <Row label="Répartition sexe" value={det.beneficiaires_sexe} />
                    <Row label="QPV / ZUS" value={det.localisation_qpv} />
                    {demande.nb_beneficiaires_estime && <Row label="Nombre estimé" value={`${demande.nb_beneficiaires_estime} personnes`} />}
                  </div>
                )}
              </SectionCard>

              {/* Moyens humains */}
              <SectionCard title="Moyens humains">
                {editMode ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Nb bénévoles">
                        <input type="number" className="field-input" value={draft.nb_benevoles} onChange={e => setField('nb_benevoles', e.target.value)} placeholder="0" min={0} />
                      </Field>
                      <Field label="ETPT bénévoles">
                        <input className="field-input" value={draft.etpt_benevoles} onChange={e => setField('etpt_benevoles', e.target.value)} placeholder="Ex : 2,5" />
                      </Field>
                      <Field label="Nb salariés impliqués">
                        <input type="number" className="field-input" value={draft.nb_salaries} onChange={e => setField('nb_salaries', e.target.value)} placeholder="0" min={0} />
                      </Field>
                    </div>
                    <Field label="Description des moyens mobilisés">
                      <textarea rows={3} className="field-textarea" value={draft.moyens_description} onChange={e => setField('moyens_description', e.target.value)} placeholder={"Ex : 1 coordinatrice salariée à 0,6 ETP + 1 formatrice salariée à 0,8 ETP + 12 bénévoles dont 4 mentors actifs chaque semaine. Locaux mis à disposition gratuitement par la MJC."} />
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex gap-6 text-sm">
                      {det.nb_benevoles && <span><span className="text-gray-400 mr-1">Bénévoles</span><strong>{det.nb_benevoles}</strong></span>}
                      {det.etpt_benevoles && <span><span className="text-gray-400 mr-1">ETPT</span><strong>{det.etpt_benevoles}</strong></span>}
                      {det.nb_salaries && <span><span className="text-gray-400 mr-1">Salariés</span><strong>{det.nb_salaries}</strong></span>}
                      {!det.nb_benevoles && !det.nb_salaries && <EmptyHint text="Moyens humains non renseignés" />}
                    </div>
                    {det.moyens_description && <TextBlock label="Description" text={det.moyens_description} />}
                  </div>
                )}
              </SectionCard>

              {/* Budget */}
              <SectionCard title="Budget prévisionnel">
                {editMode ? (
                  <BudgetEditor
                    depenses={draft.depenses}
                    recettes={draft.recettes}
                    onChange={(dep, rec) => setDraft(prev => prev ? { ...prev, depenses: dep, recettes: rec } : prev)}
                  />
                ) : (
                  <BudgetView depenses={viewDep} recettes={viewRec} totalDep={totalDep} totalRec={totalRec} />
                )}
              </SectionCard>

              {/* Indicateurs */}
              <SectionCard title="Indicateurs d'évaluation">
                {editMode ? (
                  <Field label="Indicateurs quantitatifs et qualitatifs (SMART)">
                    <textarea rows={4} className="field-textarea" value={draft.indicateurs_evaluation} onChange={e => setField('indicateurs_evaluation', e.target.value)} placeholder={"Quantitatifs :\n• Nb d'ateliers réalisés (cible : 80 sur l'année)\n• Nb de participants distincts (cible : 120)\n• Nb de sorties positives emploi/formation (cible : 40, soit 33%)\n\nQualitatifs :\n• Enquête de satisfaction (cible : 80% de satisfaits)\n• Évolution de l'estime de soi (grille auto-évaluation début/fin)"} />
                  </Field>
                ) : det.indicateurs_evaluation ? (
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{det.indicateurs_evaluation}</p>
                ) : <EmptyHint text="Aucun indicateur renseigné" />}
              </SectionCard>

              {/* Bilan renouvellement */}
              {demande.type_demande === 'renouvellement' && (
                <SectionCard title="Bilan année précédente">
                  {editMode ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Subvention reçue (€)">
                          <input type="number" className="field-input" value={draft.bilan_subvention_anterieure} onChange={e => setField('bilan_subvention_anterieure', e.target.value)} placeholder="0" min={0} />
                        </Field>
                        <Field label="Bénéficiaires réels">
                          <input type="number" className="field-input" value={draft.bilan_nb_beneficiaires_reel} onChange={e => setField('bilan_nb_beneficiaires_reel', e.target.value)} placeholder="0" min={0} />
                        </Field>
                      </div>
                      <Field label="Bilan des actions réalisées">
                        <textarea rows={4} className="field-textarea" value={draft.bilan_activites} onChange={e => setField('bilan_activites', e.target.value)} placeholder={"Résultats obtenus par rapport aux objectifs fixés, points forts, difficultés rencontrées et ajustements apportés.\n\nEx : 75 ateliers réalisés sur 80 prévus (94%). 108 participants touchés. 36 sorties positives dont 22 en emploi, 14 en formation. Difficulté principale : turnover des bénévoles au 2e trimestre — résolu par un partenariat avec l'université."} />
                      </Field>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <Row label="Subvention reçue" value={demande.bilan_subvention_anterieure ? `${fmt(demande.bilan_subvention_anterieure)} €` : undefined} />
                      <Row label="Bénéficiaires réels" value={demande.bilan_nb_beneficiaires_reel?.toString()} />
                      {demande.bilan_activites && <TextBlock label="Bilan" text={demande.bilan_activites} />}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* Contact référent de la demande */}
              <SectionCard title="Contact référent">
                {(() => {
                  const hasDemandeContact = !!(demande.contact_nom || demande.contact_email);
                  const contactNom = demande.contact_nom || asso.contact_nom;
                  const contactRole = demande.contact_role || asso.contact_role;
                  const contactEmail = demande.contact_email || asso.contact_email;
                  const contactTel = demande.contact_telephone || asso.contact_telephone;
                  return editMode ? (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400">Laissez vide pour utiliser le contact de l'association ({asso.contact_nom}).</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Nom</label>
                          <input className="field-input text-sm" value={draft.contact_nom} onChange={e => setField('contact_nom', e.target.value)} placeholder={asso.contact_nom} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Rôle / fonction</label>
                          <input className="field-input text-sm" value={draft.contact_role} onChange={e => setField('contact_role', e.target.value)} placeholder={asso.contact_role || 'Président·e…'} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                        <input type="email" className="field-input text-sm" value={draft.contact_email} onChange={e => setField('contact_email', e.target.value)} placeholder={asso.contact_email} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Téléphone</label>
                        <input type="tel" className="field-input text-sm" value={draft.contact_telephone} onChange={e => setField('contact_telephone', e.target.value)} placeholder={asso.contact_telephone || '06 XX XX XX XX'} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {!hasDemandeContact && (
                        <p className="text-xs text-gray-400 mb-2">Contact de l'association (aucun contact spécifique défini pour cette demande)</p>
                      )}
                      <Row label="Nom" value={contactNom} />
                      <Row label="Rôle" value={contactRole} />
                      <Row label="Email" value={contactEmail} />
                      <Row label="Téléphone" value={contactTel} />
                    </div>
                  );
                })()}
              </SectionCard>

              {/* Association — lecture seule */}
              <SectionCard title="Association">
                <div className="space-y-2.5">
                  <Row label="Nom" value={asso.nom} />
                  <Row label="Adresse" value={[asso.adresse, asso.code_postal, asso.ville].filter(Boolean).join(', ')} />
                  <Row label="RNA" value={asso.rna} />
                  <Row label="SIRET" value={asso.siret} />
                  <Row label="Membres" value={asso.nb_membres?.toString()} />
                  <Link href={`/associations/${asso.id}`} className="text-xs text-blue-600 hover:underline">Voir la fiche association →</Link>
                </div>
              </SectionCard>

              {/* Documents de la demande */}
              <SectionCard title="Documents de la demande">
                <p className="text-xs text-gray-400 mb-3">Dossiers N-1, devis, formulaires bailleur… Cliquez sur « 🤖 Analyser » pour auto-compléter les champs.</p>
                <DocumentList entityType="demande" entityId={id} onApplied={loadDemande} />
              </SectionCard>
            </div>

            {/* Colonne droite */}
            <div className="space-y-5">

              {/* Score de complétude */}
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Complétude du dossier</h2>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{score.filled}</span>
                  <span className="text-sm text-gray-400">/ {score.total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${(score.filled / score.total) * 100}%` }} />
                </div>
                <ul className="space-y-1.5 pt-1">
                  {score.checks.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className={c.ok ? 'text-green-500' : 'text-gray-300'}>{c.ok ? '✓' : '○'}</span>
                      <span className={c.ok ? 'text-gray-600' : 'text-gray-400'}>{c.label}</span>
                    </li>
                  ))}
                </ul>
                {score.filled < score.total && (
                  <button onClick={() => setEditMode(true)} className="btn btn-secondary w-full justify-center text-xs mt-1">
                    Compléter le dossier
                  </button>
                )}
              </div>

              {/* Outils méthodologiques */}
              <div className="card space-y-2">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Outils méthodologiques</h2>
                <Link href={`/demandes/${id}/budget`} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 py-1 hover:underline">
                  💰 Budget par ligne de compte
                </Link>
                <Link href={`/demandes/${id}/controle-qualite`} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 py-1 hover:underline">
                  ✅ Contrôle qualité pré-dépôt
                </Link>
                <Link href={`/demandes/${id}/pieces`} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 py-1 hover:underline">
                  📁 Pièces justificatives
                </Link>
              </div>

              {/* Suivi */}
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Suivi du dossier</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Statut</label>
                    <select className="field-input" value={editStatut} onChange={e => setEditStatut(e.target.value)}>
                      {ALL_STATUTS.map(s => <option key={s} value={s}>{STATUTS[s].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Prestataire assigné</label>
                    <input className="field-input" placeholder="Nom du rédacteur" value={editPresta} onChange={e => setEditPresta(e.target.value)} />
                  </div>
                  {(editStatut === 'accepte' || editStatut === 'refuse') && (
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Montant obtenu (€)</label>
                      <input type="number" className="field-input" placeholder="0" value={editMontantObtenu} onChange={e => setEditMontantObtenu(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Notes internes</label>
                    <textarea rows={4} className="field-textarea" placeholder="Observations, contacts, historique…" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                  </div>
                  <button onClick={saveGestion} disabled={saving} className="btn btn-primary w-full justify-center">
                    {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
                  </button>
                </div>
              </div>

              {/* IA */}
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Assistance IA</h2>
                <p className="text-xs text-gray-500">Analyse points forts / faibles et suggestions de rédaction.</p>
                <button onClick={enrich} disabled={enrichLoading} className="btn btn-secondary w-full justify-center">
                  {enrichLoading ? '⏳ Analyse en cours…' : '🔍 Analyser le dossier'}
                </button>
                <div className="flex gap-2">
                  <select className="field-input text-xs" value={lettreStyle} onChange={e => setLettreStyle(e.target.value as 'formel' | 'accessible')}>
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

        {/* ── IA ──────────────────────────────────────────────────── */}
        {activeTab === 'ia' && (
          <div className="space-y-5">
            {enrichLoading && <div className="card text-center py-12 text-gray-400">⏳ Analyse en cours…</div>}
            {!enrichLoading && !enrichResult && (
              <div className="card text-center py-12 text-gray-400">
                <p className="mb-3">Aucune analyse pour l'instant.</p>
                <button onClick={enrich} className="btn btn-primary">🔍 Lancer l'analyse</button>
              </div>
            )}
            {enrichResult && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SectionCard title="✅ Points forts">
                    <ul className="space-y-1.5">{enrichResult.points_forts.map((p, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-green-500 shrink-0">•</span>{p}</li>)}</ul>
                  </SectionCard>
                  <SectionCard title="⚠️ Points d'attention">
                    <ul className="space-y-1.5">{enrichResult.points_attention.map((p, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-amber-500 shrink-0">•</span>{p}</li>)}</ul>
                  </SectionCard>
                </div>
                <SectionCard title="📝 Suggestion d'objectif"><p className="text-sm text-gray-800 leading-relaxed">{enrichResult.suggestion_objectif}</p></SectionCard>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SectionCard title="👥 Public affiné"><p className="text-sm text-gray-800">{enrichResult.suggestion_public}</p></SectionCard>
                  <SectionCard title="🗺 Contexte territorial"><p className="text-sm text-gray-800">{enrichResult.contexte_territorial}</p></SectionCard>
                </div>
                <SectionCard title="📋 Éléments manquants">
                  <ul className="space-y-1">{enrichResult.elements_manquants.map((e, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-red-400 shrink-0">□</span>{e}</li>)}</ul>
                </SectionCard>
                <SectionCard title="💶 Conseil montant"><p className="text-sm text-gray-800">{enrichResult.conseil_montant}</p></SectionCard>
                <div className="flex justify-end"><button onClick={enrich} className="btn btn-ghost text-xs">↺ Relancer l'analyse</button></div>
              </>
            )}
          </div>
        )}

        {/* ── Lettre ──────────────────────────────────────────────── */}
        {activeTab === 'lettre' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select className="field-input w-auto" value={lettreStyle} onChange={e => setLettreStyle(e.target.value as 'formel' | 'accessible')}>
                <option value="formel">Style formel</option>
                <option value="accessible">Style accessible</option>
              </select>
              <button onClick={genLettre} disabled={lettreLoading} className="btn btn-primary">{lettreLoading ? '⏳ Génération…' : '✉️ Générer'}</button>
              {lettre && <button onClick={() => navigator.clipboard.writeText(lettre)} className="btn btn-secondary">📋 Copier</button>}
            </div>
            {lettreLoading && <div className="card text-center py-12 text-gray-400">⏳ Rédaction en cours…</div>}
            {!lettreLoading && !lettre && <div className="card text-center py-12 text-gray-400">Cliquez sur « Générer » pour créer un brouillon.</div>}
            {lettre && <div className="card"><pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">{lettre}</pre></div>}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ── Sous-composants ─────────────────────────────────────────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">{title}</h2>
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

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 italic">{text}</p>;
}

/* ── Budget view ─────────────────────────────────────────────────── */
function BudgetView({ depenses, recettes, totalDep, totalRec }: {
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

/* ── Budget editor ───────────────────────────────────────────────── */
function BudgetEditor({
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
    // Replace the last empty row if it exists, otherwise add
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
      {/* Dépenses */}
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

      {/* Recettes */}
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

      {/* Balance */}
      <div className={`text-xs px-3 py-2.5 rounded-lg ${balanced ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
        {balanced
          ? '✓ Budget équilibré'
          : `⚠️ Déséquilibre de ${fmt(Math.abs(totalDep - totalRec))} € — dépenses ${totalDep > totalRec ? 'supérieures' : 'inférieures'} aux recettes`}
      </div>
    </div>
  );
}
