"use client";
import { useEffect, useState, useMemo, use, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { StatutBadge } from "@/components/StatutBadge";
import { DocumentList } from "@/components/DocumentList";
import { STATUTS, ALL_STATUTS } from "@/lib/statuts";
import type { Demande, Association, Statut, BudgetLigne, BudgetV2, DetailsJson, Bailleur, BriefMission, BudgetLigneDB, BudgetEquilibre, TauxFinancement } from "@/lib/supabase";
import { genererLignesAuto, SMIC_HORAIRE_BRUT_DEFAUT, type LigneAutoGeneree, detecterPatternsInactifs, calculerEcartAEquilibrer } from "@/lib/budgetAuto";
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
type PrestataireDraft = { nom_type: string; nb_seances_ou_ateliers: string; tarif_unitaire: string };
type AchatDraft = { nom_type: string; quantite_annuelle: string; cout_unitaire: string };
type AutreBailleurDraft = { nom_bailleur: string; montant: string; statut: 'obtenu' | 'demande' | 'envisage' | '' };

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
  bailleur_id: string;
  demande_precedente_id: string;
  ce_qui_change_cette_annee: string;
  annee_millesime: string;
  plateforme_url_specifique: string;
  plateforme_identifiant_dossier: string;
  // Budget auto
  heures_benevolat_semaine: string;
  taux_horaire_valorisation: string;
  cout_salarial_annuel_estime: string;
  a_des_prestataires: boolean;
  prestataires: PrestataireDraft[];
  locaux_mis_a_disposition: boolean;
  locaux_bailleur: string;
  locaux_valeur_estimee: string;
  // Charges & recettes additionnelles
  achats_recurrents: AchatDraft[];
  location_salle_payante: boolean;
  location_salle_cout_annuel: string;
  location_salle_precisions: string;
  assurance_dediee: boolean;
  assurance_cout_annuel: string;
  deplacements_estimes: boolean;
  deplacements_frequence_mensuelle: string;
  deplacements_cout_moyen: string;
  cotisations_actives: boolean;
  nb_adherents_payants: string;
  tarif_moyen_annuel: string;
  // Autres bailleurs
  autres_bailleurs_sollicites: AutreBailleurDraft[];
  // Cerfa déclaratifs
  forme_subvention: 'numeraire' | 'nature' | '';
  objet_demande: 'fonctionnement_global' | 'projet_action' | '';
  recrutement_envisage: boolean;
  recrutement_etpt: string;
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
    bailleur_id: d.bailleur_id || '',
    demande_precedente_id: d.demande_precedente_id || '',
    ce_qui_change_cette_annee: d.ce_qui_change_cette_annee || '',
    annee_millesime: d.annee_millesime?.toString() || '',
    plateforme_url_specifique: d.plateforme_url_specifique || '',
    plateforme_identifiant_dossier: d.plateforme_identifiant_dossier || '',
    heures_benevolat_semaine: det.heures_benevolat_semaine || '',
    taux_horaire_valorisation: det.taux_horaire_valorisation || '',
    cout_salarial_annuel_estime: det.cout_salarial_annuel_estime || '',
    a_des_prestataires: det.a_des_prestataires ?? false,
    prestataires: det.prestataires ?? [],
    locaux_mis_a_disposition: det.locaux_mis_a_disposition ?? false,
    locaux_bailleur: det.locaux_bailleur || '',
    locaux_valeur_estimee: det.locaux_valeur_estimee || '',
    achats_recurrents: det.achats_recurrents ?? [],
    location_salle_payante: det.location_salle_payante ?? false,
    location_salle_cout_annuel: det.location_salle_cout_annuel || '',
    location_salle_precisions: det.location_salle_precisions || '',
    assurance_dediee: det.assurance_dediee ?? false,
    assurance_cout_annuel: det.assurance_cout_annuel || '',
    deplacements_estimes: det.deplacements_estimes ?? false,
    deplacements_frequence_mensuelle: det.deplacements_frequence_mensuelle || '',
    deplacements_cout_moyen: det.deplacements_cout_moyen || '',
    cotisations_actives: det.cotisations_actives ?? false,
    nb_adherents_payants: det.nb_adherents_payants || '',
    tarif_moyen_annuel: det.tarif_moyen_annuel || '',
    autres_bailleurs_sollicites: det.autres_bailleurs_sollicites?.map(b => ({ ...b })) ?? [],
    forme_subvention: (det.forme_subvention as FullDraft['forme_subvention']) || '',
    objet_demande: (det.objet_demande as FullDraft['objet_demande']) || '',
    recrutement_envisage: det.recrutement_envisage ?? false,
    recrutement_etpt: det.recrutement_etpt || '',
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
  const [budgetLignes, setBudgetLignes] = useState<BudgetLigneDB[]>([]);
  const [budgetEquilibre, setBudgetEquilibre] = useState<BudgetEquilibre | null>(null);
  const [budgetTaux, setBudgetTaux] = useState<TauxFinancement[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [integrationEnCours, setIntegrationEnCours] = useState(false);

  const chargesCardRef = useRef<HTMLDivElement>(null);
  const prestataireCardRef = useRef<HTMLDivElement>(null);

  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [lettreLoading, setLettreLoading] = useState(false);
  const [lettre, setLettre] = useState('');
  const [lettreStyle, setLettreStyle] = useState<'formel' | 'accessible'>('formel');
  const [activeTab, setActiveTab] = useState<'dossier' | 'ia' | 'lettre'>('dossier');

  const [brief, setBrief] = useState<BriefMission | null>(null);
  const [briefOpen, setBriefOpen] = useState(true);
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ demande_candidate_id: string; titre_projet: string; annee_millesime: number | null; montant_demande: number | null; montant_obtenu: number | null; statut: string }>>([]);
  const [savingCeQuiChange, setSavingCeQuiChange] = useState(false);
  const [groupeMembers, setGroupeMembers] = useState<Array<{ id: string; titre_projet: string | null; annee_millesime: number | null; statut: string; montant_demande: number | null; montant_obtenu: number | null; numero_annee_dans_groupe: number | null; nombre_annees_total_groupe: number | null }> | null>(null);
  const [aidesSeuil, setAidesSeuil] = useState<{ total: number; depasse_seuil: boolean } | null>(null);

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

  const loadBrief = () =>
    fetch(`/api/demandes/${id}/brief`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setBrief(data.brief));

  const loadBailleurs = () =>
    fetch('/api/bailleurs')
      .then(r => r.json())
      .then(({ bailleurs: b }) => setBailleurs(b || []));

  const loadSuggestions = () =>
    fetch(`/api/demandes/${id}/suggestions-precedente`)
      .then(r => r.json())
      .then(({ suggestions: s }) => setSuggestions(s || []));

  const loadBudgetLignes = () =>
    fetch(`/api/demandes/${id}/budget-lignes`)
      .then(r => r.ok ? r.json() : { lignes: [], equilibre: null, taux: [] })
      .then(({ lignes, equilibre, taux }) => {
        setBudgetLignes(lignes || []);
        setBudgetEquilibre(equilibre ?? null);
        setBudgetTaux(taux ?? []);
      });

  const loadGroupe = () =>
    fetch(`/api/demandes/${id}/groupe-pluriannuel`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setGroupeMembers(data.membres || null);
          setAidesSeuil(data.aides_publiques_3ans || null);
        }
      });

  useEffect(() => {
    loadDemande();
    loadBrief();
    loadBailleurs();
    loadSuggestions();
    loadBudgetLignes();
    loadGroupe();
  }, [id]);

  const setField = <K extends keyof FullDraft>(key: K, val: FullDraft[K]) =>
    setDraft(prev => prev ? { ...prev, [key]: val } : prev);

  const cancelEdit = () => {
    if (demande) setDraft(draftFromDemande(demande));
    setEditMode(false);
  };

  const setPrestataire = (i: number, patch: Partial<PrestataireDraft>) =>
    setDraft(prev => prev ? { ...prev, prestataires: prev.prestataires.map((p, j) => j === i ? { ...p, ...patch } : p) } : prev);
  const removePrestataire = (i: number) =>
    setDraft(prev => prev ? { ...prev, prestataires: prev.prestataires.filter((_, j) => j !== i) } : prev);
  const addPrestataire = () =>
    setDraft(prev => prev ? { ...prev, prestataires: [...prev.prestataires, { nom_type: '', nb_seances_ou_ateliers: '', tarif_unitaire: '' }] } : prev);

  const setAchat = (i: number, patch: Partial<AchatDraft>) =>
    setDraft(prev => prev ? { ...prev, achats_recurrents: prev.achats_recurrents.map((a, j) => j === i ? { ...a, ...patch } : a) } : prev);
  const removeAchat = (i: number) =>
    setDraft(prev => prev ? { ...prev, achats_recurrents: prev.achats_recurrents.filter((_, j) => j !== i) } : prev);
  const addAchat = () =>
    setDraft(prev => prev ? { ...prev, achats_recurrents: [...prev.achats_recurrents, { nom_type: '', quantite_annuelle: '', cout_unitaire: '' }] } : prev);

  const setAutreBailleur = (i: number, patch: Partial<AutreBailleurDraft>) =>
    setDraft(prev => prev ? { ...prev, autres_bailleurs_sollicites: prev.autres_bailleurs_sollicites.map((b, j) => j === i ? { ...b, ...patch } : b) } : prev);
  const removeAutreBailleur = (i: number) =>
    setDraft(prev => prev ? { ...prev, autres_bailleurs_sollicites: prev.autres_bailleurs_sollicites.filter((_, j) => j !== i) } : prev);
  const addAutreBailleur = () =>
    setDraft(prev => prev ? { ...prev, autres_bailleurs_sollicites: [...prev.autres_bailleurs_sollicites, { nom_bailleur: '', montant: '', statut: '' }] } : prev);

  const activerPatternEtScroller = (cle: string, sectionCible: string) => {
    setEditMode(true);
    if (cle === 'location_salle_payante') setField('location_salle_payante', true);
    else if (cle === 'assurance_dediee') setField('assurance_dediee', true);
    else if (cle === 'deplacements_estimes') setField('deplacements_estimes', true);
    else if (cle === 'cotisations_actives') setField('cotisations_actives', true);
    else if (cle === 'a_des_prestataires') {
      setField('a_des_prestataires', true);
      setDraft(prev => {
        if (!prev || prev.prestataires.length > 0) return prev;
        return { ...prev, prestataires: [{ nom_type: '', nb_seances_ou_ateliers: '', tarif_unitaire: '' }] };
      });
    } else if (cle === 'achats_recurrents') {
      setDraft(prev => {
        if (!prev || prev.achats_recurrents.length > 0) return prev;
        return { ...prev, achats_recurrents: [{ nom_type: '', quantite_annuelle: '', cout_unitaire: '' }] };
      });
    }
    setTimeout(() => {
      const ref = sectionCible === 'Prestataires et moyens matériels' ? prestataireCardRef : chargesCardRef;
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const integrerMontantDemande = async () => {
    if (!demande) return;
    setIntegrationEnCours(true);
    await fetch(`/api/demandes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        montant_demande: demande.montant_demande ?? null,
        details_json: demande.details_json ?? {},
      }),
    });
    await loadBudgetLignes();
    setIntegrationEnCours(false);
  };

  const lignesAutoPreview = useMemo(() => {
    if (!draft || !editMode) return [] as LigneAutoGeneree[];
    return genererLignesAuto(
      {
        nb_benevoles: draft.nb_benevoles || undefined,
        heures_benevolat_semaine: draft.heures_benevolat_semaine || undefined,
        taux_horaire_valorisation: draft.taux_horaire_valorisation || undefined,
        a_des_prestataires: draft.a_des_prestataires,
        prestataires: draft.prestataires,
        nb_salaries: draft.nb_salaries || undefined,
        cout_salarial_annuel_estime: draft.cout_salarial_annuel_estime || undefined,
        locaux_mis_a_disposition: draft.locaux_mis_a_disposition,
        locaux_bailleur: draft.locaux_bailleur || undefined,
        locaux_valeur_estimee: draft.locaux_valeur_estimee || undefined,
        achats_recurrents: draft.achats_recurrents,
        location_salle_payante: draft.location_salle_payante,
        location_salle_cout_annuel: draft.location_salle_cout_annuel || undefined,
        location_salle_precisions: draft.location_salle_precisions || undefined,
        assurance_dediee: draft.assurance_dediee,
        assurance_cout_annuel: draft.assurance_cout_annuel || undefined,
        deplacements_estimes: draft.deplacements_estimes,
        deplacements_frequence_mensuelle: draft.deplacements_frequence_mensuelle || undefined,
        deplacements_cout_moyen: draft.deplacements_cout_moyen || undefined,
        cotisations_actives: draft.cotisations_actives,
        nb_adherents_payants: draft.nb_adherents_payants || undefined,
        tarif_moyen_annuel: draft.tarif_moyen_annuel || undefined,
        autres_bailleurs_sollicites: draft.autres_bailleurs_sollicites.filter(b => b.nom_bailleur && b.statut) as DetailsJson['autres_bailleurs_sollicites'],
      },
      {
        montant_demande: draft.montant_demande ? Number(draft.montant_demande) : null,
        bailleur_nom: draft.bailleur_nom || null,
      }
    );
  }, [draft, editMode]);

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
      heures_benevolat_semaine: draft.heures_benevolat_semaine || undefined,
      taux_horaire_valorisation: draft.taux_horaire_valorisation || undefined,
      nb_salaries: draft.nb_salaries || undefined,
      cout_salarial_annuel_estime: draft.cout_salarial_annuel_estime || undefined,
      moyens_description: draft.moyens_description || undefined,
      a_des_prestataires: draft.a_des_prestataires || undefined,
      prestataires: draft.a_des_prestataires && draft.prestataires.some(p => p.nom_type)
        ? draft.prestataires.filter(p => p.nom_type)
        : undefined,
      locaux_mis_a_disposition: draft.locaux_mis_a_disposition || undefined,
      locaux_bailleur: draft.locaux_bailleur || undefined,
      locaux_valeur_estimee: draft.locaux_valeur_estimee || undefined,
      indicateurs_evaluation: draft.indicateurs_evaluation || undefined,
      achats_recurrents: draft.achats_recurrents.length > 0 ? draft.achats_recurrents.filter(a => a.nom_type) : undefined,
      location_salle_payante: draft.location_salle_payante || undefined,
      location_salle_cout_annuel: draft.location_salle_cout_annuel || undefined,
      location_salle_precisions: draft.location_salle_precisions || undefined,
      assurance_dediee: draft.assurance_dediee || undefined,
      assurance_cout_annuel: draft.assurance_cout_annuel || undefined,
      deplacements_estimes: draft.deplacements_estimes || undefined,
      deplacements_frequence_mensuelle: draft.deplacements_frequence_mensuelle || undefined,
      deplacements_cout_moyen: draft.deplacements_cout_moyen || undefined,
      cotisations_actives: draft.cotisations_actives || undefined,
      nb_adherents_payants: draft.nb_adherents_payants || undefined,
      tarif_moyen_annuel: draft.tarif_moyen_annuel || undefined,
      autres_bailleurs_sollicites: draft.autres_bailleurs_sollicites.filter(b => b.nom_bailleur && b.statut) as DetailsJson['autres_bailleurs_sollicites'],
      forme_subvention: (draft.forme_subvention || undefined) as DetailsJson['forme_subvention'],
      objet_demande: (draft.objet_demande || undefined) as DetailsJson['objet_demande'],
      recrutement_envisage: draft.recrutement_envisage || undefined,
      recrutement_etpt: draft.recrutement_etpt || undefined,
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
        bailleur_id: draft.bailleur_id || null,
        demande_precedente_id: draft.demande_precedente_id || null,
        annee_millesime: draft.annee_millesime ? Number(draft.annee_millesime) : null,
        plateforme_url_specifique: draft.plateforme_url_specifique || null,
        plateforme_identifiant_dossier: draft.plateforme_identifiant_dossier || null,
        budget_previsionnel_json: budgetV2,
        details_json: detailsJson,
      }),
    });
    await loadDemande();
    await loadBrief();
    await loadBudgetLignes();
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
          <div className="space-y-6">

          {/* Brief de mission */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60">
            <button
              onClick={() => setBriefOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-3 text-left"
            >
              <span className="text-sm font-semibold text-blue-800">
                Brief de mission
                {brief?.type_renouvellement === 'renouvellement' && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Renouvellement</span>
                )}
              </span>
              <span className="text-blue-400 text-xs">{briefOpen ? '▲ Réduire' : '▼ Afficher'}</span>
            </button>
            {briefOpen && (
              <div className="px-5 pb-5 space-y-4">
                {/* Bandeau pluriannuel */}
                {groupeMembers && groupeMembers.length > 0 && (() => {
                  const current = groupeMembers.find(m => m.id === id);
                  const nbTotal = current?.nombre_annees_total_groupe ?? groupeMembers.length;
                  const STATUT_COLOR: Record<string, string> = {
                    accepte: 'bg-green-500', refuse: 'bg-red-400', depose: 'bg-blue-500',
                    decision_attente: 'bg-blue-400', redaction: 'bg-amber-400',
                    controle_compta: 'bg-amber-500', collecte: 'bg-gray-300',
                  };
                  return (
                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
                      <p className="text-xs font-semibold text-indigo-700 mb-2">
                        📅 Engagement pluriannuel — Année {current?.numero_annee_dans_groupe ?? '?'} sur {nbTotal}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {groupeMembers.map((m, i) => {
                          const isCurrentYear = m.id === id;
                          const dot = STATUT_COLOR[m.statut] || 'bg-gray-300';
                          return (
                            <div key={m.id} className="flex items-center gap-1">
                              {i > 0 && <span className="text-indigo-200 text-xs">→</span>}
                              <Link
                                href={`/demandes/${m.id}`}
                                className={['flex flex-col items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors', isCurrentYear ? 'bg-indigo-100 text-indigo-800 font-semibold' : 'text-indigo-600 hover:bg-indigo-100/50'].join(' ')}
                              >
                                <span className="flex items-center gap-1">
                                  <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                                  {m.annee_millesime ?? `Année ${i + 1}`}
                                </span>
                                {m.montant_obtenu != null
                                  ? <span className="text-green-600 font-normal">{m.montant_obtenu.toLocaleString('fr-FR')} €</span>
                                  : m.montant_demande != null
                                    ? <span className="text-gray-500 font-normal">{m.montant_demande.toLocaleString('fr-FR')} € dem.</span>
                                    : <span className="text-gray-400 font-normal">— €</span>
                                }
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Alerte 500k€ aides publiques */}
                {aidesSeuil && aidesSeuil.depasse_seuil && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-800">
                      ⚠️ Seuil aides publiques européen dépassé
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Total des subventions acceptées sur les 3 derniers exercices : <strong>{aidesSeuil.total.toLocaleString('fr-FR')} €</strong> — dépasse 500 000 €.
                      La section <strong>7bis</strong> du Cerfa (réglementation européenne des aides d'État) est probablement obligatoire pour ce dossier.
                    </p>
                  </div>
                )}
                {aidesSeuil && !aidesSeuil.depasse_seuil && aidesSeuil.total > 0 && (
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <p className="text-xs text-gray-500">
                      Aides publiques cumulées (3 exercices) : <strong>{aidesSeuil.total.toLocaleString('fr-FR')} €</strong> — sous le seuil de 500 000 €. Section 7bis du Cerfa non requise.
                    </p>
                  </div>
                )}

                {/* Qui est l'association */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Association</p>
                    {brief?.resume_association ? (
                      <p className="text-sm text-gray-700 leading-relaxed">{brief.resume_association}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        Aucun résumé —{' '}
                        <Link href={`/associations/${asso?.id}`} className="text-blue-600 hover:underline">
                          compléter la fiche association →
                        </Link>
                      </p>
                    )}
                    {brief?.secteur_activite && (
                      <span className="mt-1.5 inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{brief.secteur_activite}</span>
                    )}
                  </div>

                  {/* Plateforme de dépôt */}
                  <div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Où déposer</p>
                    {brief?.plateforme_url_effective || brief?.plateforme_nom ? (
                      <div className="text-sm space-y-0.5">
                        {brief.plateforme_nom && <p className="font-medium text-gray-800">{brief.plateforme_nom}</p>}
                        {brief.plateforme_url_effective && (
                          <a href={brief.plateforme_url_effective} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all text-xs">{brief.plateforme_url_effective}</a>
                        )}
                        {brief.plateforme_identifiant_dossier && (
                          <p className="text-gray-500 text-xs">Réf. dossier : {brief.plateforme_identifiant_dossier}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        Non renseigné —{' '}
                        <Link href="/bailleurs" className="text-blue-600 hover:underline">référentiel bailleurs →</Link>
                      </p>
                    )}

                    {/* Contact bailleur */}
                    {(brief?.contact_referent_nom || brief?.contact_referent_email) && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Contact bailleur</p>
                        <div className="text-xs text-gray-700 space-y-0.5">
                          {brief.contact_referent_nom && <p className="font-medium">{brief.contact_referent_nom}</p>}
                          {brief.contact_referent_email && <p>{brief.contact_referent_email}</p>}
                          {brief.contact_referent_telephone && <p>{brief.contact_referent_telephone}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ce qui change — uniquement si renouvellement avec demande précédente liée */}
                {brief?.type_renouvellement === 'renouvellement' && (brief?.montant_demande_precedent != null || brief?.beneficiaires_precedent != null) && (
                  <div className="border-t border-blue-100 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Évolution vs demande précédente</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {brief.montant_demande_precedent != null && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-gray-500">Montant N-1</p>
                          <p className="text-sm font-semibold text-gray-900">{brief.montant_demande_precedent.toLocaleString('fr-FR')} €</p>
                          {brief.montant_obtenu_precedent != null && (
                            <p className="text-xs text-green-600">{brief.montant_obtenu_precedent.toLocaleString('fr-FR')} € obtenus</p>
                          )}
                        </div>
                      )}
                      {brief.montant_demande_actuel != null && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-gray-500">Montant demandé</p>
                          <p className="text-sm font-semibold text-gray-900">{brief.montant_demande_actuel.toLocaleString('fr-FR')} €</p>
                          {brief.ecart_montant_demande_pct != null && (
                            <p className={`text-xs ${brief.ecart_montant_demande_pct >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                              {brief.ecart_montant_demande_pct > 0 ? '+' : ''}{brief.ecart_montant_demande_pct} %
                            </p>
                          )}
                        </div>
                      )}
                      {brief.beneficiaires_precedent != null && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-xs text-gray-500">Bénéficiaires</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {brief.beneficiaires_actuel ?? '?'} prévus
                            {brief.ecart_beneficiaires != null && (
                              <span className={`ml-1 text-xs ${brief.ecart_beneficiaires >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                ({brief.ecart_beneficiaires > 0 ? '+' : ''}{brief.ecart_beneficiaires} vs réel N-1)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{brief.beneficiaires_precedent} réels N-1</p>
                        </div>
                      )}
                    </div>

                    {/* Ce qui change — narratif, éditable inline */}
                    <div>
                      <p className="text-xs font-semibold text-blue-700 mb-1.5">Ce qui change cette année <span className="text-gray-400 font-normal">(narratif consultant)</span></p>
                      <CeQuiChangeEditor
                        demandeId={id}
                        value={brief.ce_qui_change_cette_annee || ''}
                        onSaved={async (v) => {
                          setSavingCeQuiChange(true);
                          await fetch(`/api/demandes/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ce_qui_change_cette_annee: v || null }),
                          });
                          await loadBrief();
                          setSavingCeQuiChange(false);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
                    {/* Bailleur : référentiel ou texte libre */}
                    <div className="space-y-2">
                      <Field label="Bailleur (référentiel)">
                        <select
                          className="field-input"
                          value={draft.bailleur_id}
                          onChange={e => {
                            const sel = bailleurs.find(b => b.id === e.target.value);
                            setField('bailleur_id', e.target.value);
                            if (sel && !draft.bailleur_nom) setField('bailleur_nom', sel.nom);
                          }}
                        >
                          <option value="">— Saisie libre ou choisir dans le référentiel —</option>
                          {bailleurs.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                        </select>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Nom du bailleur (texte libre)">
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
                    </div>
                    {/* Demande précédente — masqué si lien déjà établi par groupe pluriannuel */}
                    {suggestions.length > 0 && !demande.groupe_pluriannuel_id && (
                      <Field label="Demande précédente (renouvellement)">
                        <select
                          className="field-input"
                          value={draft.demande_precedente_id}
                          onChange={e => setField('demande_precedente_id', e.target.value)}
                        >
                          <option value="">— Pas de lien ou première demande —</option>
                          {suggestions.map(s => (
                            <option key={s.demande_candidate_id} value={s.demande_candidate_id}>
                              {s.titre_projet || '(sans titre)'}{s.annee_millesime ? ` — ${s.annee_millesime}` : ''}{s.montant_demande ? ` — ${s.montant_demande.toLocaleString('fr-FR')} €` : ''} [{s.statut}]
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Millésime (année)">
                        <input type="number" className="field-input" value={draft.annee_millesime} onChange={e => setField('annee_millesime', e.target.value)} placeholder={new Date().getFullYear().toString()} min={1990} max={2100} />
                      </Field>
                      <Field label="Réf. dossier plateforme">
                        <input className="field-input" value={draft.plateforme_identifiant_dossier} onChange={e => setField('plateforme_identifiant_dossier', e.target.value)} placeholder="N° dossier sur Dauphin, etc." />
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
                    {/* Autres financements sollicités */}
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Autres financements sollicités pour ce projet</p>
                      {draft.autres_bailleurs_sollicites.length > 0 && (
                        <div className="space-y-2 mb-2">
                          <div className="grid grid-cols-[1fr_110px_120px_24px] gap-2 mb-1">
                            <span className="text-xs text-gray-400">Bailleur</span>
                            <span className="text-xs text-gray-400">Montant (€)</span>
                            <span className="text-xs text-gray-400">Statut</span>
                            <span />
                          </div>
                          {draft.autres_bailleurs_sollicites.map((b, i) => (
                            <div key={i} className="grid grid-cols-[1fr_110px_120px_24px] gap-2 items-center">
                              <input className="field-input text-sm" value={b.nom_bailleur} onChange={e => setAutreBailleur(i, { nom_bailleur: e.target.value })} placeholder="Ex : Département 75, CAF…" />
                              <input type="number" className="field-input text-sm" value={b.montant} onChange={e => setAutreBailleur(i, { montant: e.target.value })} placeholder="0" min={0} />
                              <select className="field-input text-sm" value={b.statut} onChange={e => setAutreBailleur(i, { statut: e.target.value as AutreBailleurDraft['statut'] })}>
                                <option value="">— statut —</option>
                                <option value="envisage">Envisagé</option>
                                <option value="demande">Demandé</option>
                                <option value="obtenu">Obtenu</option>
                              </select>
                              <button type="button" onClick={() => removeAutreBailleur(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={addAutreBailleur} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Ajouter un financement</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <RowF label="Titre" value={demande.titre_projet} />
                    <RowF label="Bailleur" value={demande.bailleur_nom ? `${demande.bailleur_nom}${demande.bailleur_type ? ` (${demande.bailleur_type === 'ville' ? 'Ville' : 'Département'})` : ''}` : null} />
                    <RowF label="Millésime" value={demande.annee_millesime?.toString() ?? null} />
                    <RowF label="Réf. plateforme" value={demande.plateforme_identifiant_dossier ?? null} />
                    <RowF label="Période" value={`${demande.periode_debut || '—'} → ${demande.periode_fin || '—'}`} />
                    <RowF label="Montant demandé" value={demande.montant_demande ? `${fmt(demande.montant_demande)} €` : null} />
                    <RowF label="Thématique" value={det.thematique ?? null} />
                    {demande.objectif_projet
                      ? <TextBlock label="Objectif" text={demande.objectif_projet} />
                      : <div><p className="text-xs text-gray-500 mb-1">Objectif</p><p className="text-sm text-gray-300 italic">—</p></div>}
                    <RowF label="Public" value={demande.public_beneficiaire ? `${demande.public_beneficiaire}${demande.nb_beneficiaires_estime ? ` (${demande.nb_beneficiaires_estime} pers.)` : ''}` : null} />
                    <RowF label="Nb bénéficiaires estimés" value={!demande.public_beneficiaire && demande.nb_beneficiaires_estime ? `${demande.nb_beneficiaires_estime} personnes` : null} />
                    {/* Autres financements */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Autres financements sollicités</p>
                      {det.autres_bailleurs_sollicites?.filter(b => b.nom_bailleur).length ? (
                        <div className="space-y-1">
                          {det.autres_bailleurs_sollicites.filter(b => b.nom_bailleur).map((b, i) => {
                            const statutColor = b.statut === 'obtenu' ? 'bg-green-100 text-green-700' : b.statut === 'demande' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500';
                            const statutLabel = b.statut === 'obtenu' ? 'Obtenu' : b.statut === 'demande' ? 'Demandé' : 'Envisagé';
                            return (
                              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-gray-700 flex-1">{b.nom_bailleur}</span>
                                {b.statut && <span className={`text-xs px-1.5 py-0.5 rounded-full ${statutColor}`}>{statutLabel}</span>}
                                <span className="font-medium tabular-nums text-gray-900">{b.montant ? `${parseFloat(b.montant).toLocaleString('fr-FR')} €` : '—'}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300 italic">—</p>
                      )}
                    </div>
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
                    <TextBlockF label="Besoins identifiés" text={det.description_besoins} />
                    <TextBlockF label="Déroulement" text={det.description_actions} />
                    <TextBlockF label="Partenariats" text={det.partenariats} />
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
                    <TextBlockF label="Profil" text={det.beneficiaires_profil} />
                    <RowF label="Tranches d'âge" value={det.beneficiaires_age} />
                    <RowF label="Répartition sexe" value={det.beneficiaires_sexe} />
                    <RowF label="QPV / ZUS" value={det.localisation_qpv} />
                    <RowF label="Nombre estimé" value={demande.nb_beneficiaires_estime ? `${demande.nb_beneficiaires_estime} personnes` : null} />
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
                    {/* Valorisation bénévolat — déclenche ligne auto 86/87 */}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Heures de bénévolat / semaine">
                        <input type="number" className="field-input" value={draft.heures_benevolat_semaine} onChange={e => setField('heures_benevolat_semaine', e.target.value)} placeholder="Ex : 4" min={0} step={0.5} />
                      </Field>
                      <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Taux horaire valorisation (€/h)</label>
                        <input type="number" className="field-input" value={draft.taux_horaire_valorisation} onChange={e => setField('taux_horaire_valorisation', e.target.value)} placeholder={String(SMIC_HORAIRE_BRUT_DEFAUT)} min={0} step={0.01} />
                        <p className="text-xs text-amber-600 mt-0.5">Défaut SMIC brut ({SMIC_HORAIRE_BRUT_DEFAUT} €/h) — à vérifier chaque janv./nov.</p>
                      </div>
                    </div>
                    {/* Coût salarial — déclenche ligne auto 64 */}
                    {Number(draft.nb_salaries) > 0 && (
                      <Field label="Coût salarial annuel estimé (€) — charges patronales incluses">
                        <input type="number" className="field-input" value={draft.cout_salarial_annuel_estime} onChange={e => setField('cout_salarial_annuel_estime', e.target.value)} placeholder="Ex : 24 000" min={0} />
                      </Field>
                    )}
                    <Field label="Description des moyens mobilisés">
                      <textarea rows={3} className="field-textarea" value={draft.moyens_description} onChange={e => setField('moyens_description', e.target.value)} placeholder={"Ex : 1 coordinatrice salariée à 0,6 ETP + 1 formatrice salariée à 0,8 ETP + 12 bénévoles dont 4 mentors actifs chaque semaine. Locaux mis à disposition gratuitement par la MJC."} />
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex gap-6 text-sm flex-wrap">
                      <span>
                        <span className="text-gray-400 mr-1">Bénévoles</span>
                        <strong className={det.nb_benevoles ? 'text-gray-900' : 'text-gray-300 font-normal italic'}>{det.nb_benevoles || '—'}</strong>
                      </span>
                      <span>
                        <span className="text-gray-400 mr-1">ETPT</span>
                        <strong className={det.etpt_benevoles ? 'text-gray-900' : 'text-gray-300 font-normal italic'}>{det.etpt_benevoles || '—'}</strong>
                      </span>
                      <span>
                        <span className="text-gray-400 mr-1">Salariés</span>
                        <strong className={det.nb_salaries ? 'text-gray-900' : 'text-gray-300 font-normal italic'}>{det.nb_salaries || '—'}</strong>
                      </span>
                    </div>
                    {(det.heures_benevolat_semaine || det.taux_horaire_valorisation) && (
                      <p className="text-xs text-gray-500">
                        Valorisation : {det.heures_benevolat_semaine || '?'} h/sem × {det.taux_horaire_valorisation || SMIC_HORAIRE_BRUT_DEFAUT} €/h
                      </p>
                    )}
                    <RowF label="Coût salarial estimé" value={det.cout_salarial_annuel_estime ? `${parseFloat(det.cout_salarial_annuel_estime).toLocaleString('fr-FR')} €/an` : null} />
                    <TextBlockF label="Description" text={det.moyens_description} />
                  </div>
                )}
              </SectionCard>

              {/* Prestataires et moyens matériels */}
              <div ref={prestataireCardRef}>
              <SectionCard title="Prestataires et moyens matériels">
                {editMode ? (
                  <div className="space-y-5">
                    {/* Prestataires */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={draft.a_des_prestataires}
                          onChange={e => {
                            setField('a_des_prestataires', e.target.checked);
                            if (e.target.checked && draft.prestataires.length === 0) addPrestataire();
                          }}
                        />
                        <span className="text-sm font-medium text-gray-700">Avez-vous des prestataires / intervenants rémunérés ?</span>
                      </label>
                      {draft.a_des_prestataires && (
                        <div className="mt-3 space-y-2">
                          <div className="grid grid-cols-[1fr_100px_100px_24px] gap-2 mb-1">
                            <span className="text-xs text-gray-400">Type / nom</span>
                            <span className="text-xs text-gray-400">Nb séances</span>
                            <span className="text-xs text-gray-400">Tarif (€)</span>
                            <span />
                          </div>
                          {draft.prestataires.map((p, i) => (
                            <div key={i} className="grid grid-cols-[1fr_100px_100px_24px] gap-2 items-center">
                              <input className="field-input text-sm" value={p.nom_type} onChange={e => setPrestataire(i, { nom_type: e.target.value })} placeholder="Ex : Diététicien·ne, Coach APA…" />
                              <input type="number" className="field-input text-sm" value={p.nb_seances_ou_ateliers} onChange={e => setPrestataire(i, { nb_seances_ou_ateliers: e.target.value })} placeholder="12" min={0} />
                              <input type="number" className="field-input text-sm" value={p.tarif_unitaire} onChange={e => setPrestataire(i, { tarif_unitaire: e.target.value })} placeholder="80" min={0} step={0.01} />
                              <button type="button" onClick={() => removePrestataire(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                            </div>
                          ))}
                          <button type="button" onClick={addPrestataire} className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1">+ Ajouter un prestataire</button>
                        </div>
                      )}
                    </div>
                    {/* Locaux — deux situations mutuellement exclusives regroupées */}
                    <div className="space-y-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Locaux utilisés par le projet</p>
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={draft.locaux_mis_a_disposition}
                            onChange={e => setField('locaux_mis_a_disposition', e.target.checked)}
                          />
                          <span className="text-sm font-medium text-gray-700">Locaux mis à disposition <strong>GRATUITEMENT</strong> par un tiers (mairie, partenaire…)</span>
                        </label>
                        {draft.locaux_mis_a_disposition && (
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <Field label="Qui met à disposition ?">
                              <input className="field-input" value={draft.locaux_bailleur} onChange={e => setField('locaux_bailleur', e.target.value)} placeholder="Ex : Mairie du 13e, MJC…" />
                            </Field>
                            <Field label="Valeur estimée (€/an)">
                              <input type="number" className="field-input" value={draft.locaux_valeur_estimee} onChange={e => setField('locaux_valeur_estimee', e.target.value)} placeholder="Ex : 2 400" min={0} />
                            </Field>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 italic">Un même local ne doit être déclaré que dans l&apos;une des deux situations ci-dessous, jamais les deux.</p>
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={draft.location_salle_payante} onChange={e => setField('location_salle_payante', e.target.checked)} />
                          <span className="text-sm font-medium text-gray-700">Location de salle que <strong>VOUS payez</strong> (compte 61)</span>
                        </label>
                        {draft.location_salle_payante && (
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <Field label="Coût annuel total (€)">
                              <input type="number" className="field-input" value={draft.location_salle_cout_annuel} onChange={e => setField('location_salle_cout_annuel', e.target.value)} placeholder="Ex : 3 600" min={0} />
                            </Field>
                            <Field label="Précisions">
                              <input className="field-input" value={draft.location_salle_precisions} onChange={e => setField('location_salle_precisions', e.target.value)} placeholder="Ex : salle polyvalente 3h × 48 sem." />
                            </Field>
                          </div>
                        )}
                      </div>
                      {draft.locaux_mis_a_disposition && draft.location_salle_payante && (
                        <div className="flex gap-2 items-start text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-2">
                          <span className="shrink-0 mt-0.5">⚠️</span>
                          <span>Vous avez coché à la fois &laquo;&nbsp;mis à disposition gratuitement&nbsp;&raquo; et &laquo;&nbsp;location payante&nbsp;&raquo; — vérifiez que ce ne sont pas le même local.</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Prestataires rémunérés</p>
                      {det.a_des_prestataires && det.prestataires?.some(p => p.nom_type) ? (
                        <div className="space-y-1.5">
                          {det.prestataires.filter(p => p.nom_type).map((p, i) => {
                            const montant = (parseFloat(p.nb_seances_ou_ateliers) || 0) * (parseFloat(p.tarif_unitaire) || 0);
                            return (
                              <div key={i} className="flex justify-between text-sm gap-3">
                                <span className="text-gray-700 flex-1">{p.nom_type}</span>
                                <span className="text-gray-400 text-xs">{p.nb_seances_ou_ateliers}× {p.tarif_unitaire} €</span>
                                <span className="font-medium tabular-nums">{montant.toLocaleString('fr-FR')} €</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300 italic">—</p>
                      )}
                    </div>
                    <RowF
                      label="Locaux mis à disposition GRATUITEMENT"
                      value={det.locaux_mis_a_disposition
                        ? `${det.locaux_bailleur || 'Oui'}${det.locaux_valeur_estimee ? ` — ${parseFloat(det.locaux_valeur_estimee).toLocaleString('fr-FR')} €/an` : ''}`
                        : null}
                    />
                    <RowF
                      label="Location de salle (payante)"
                      value={det.location_salle_payante ? `${det.location_salle_cout_annuel ? `${parseFloat(det.location_salle_cout_annuel).toLocaleString('fr-FR')} €/an` : 'Oui'}${det.location_salle_precisions ? ` — ${det.location_salle_precisions}` : ''}` : null}
                    />
                  </div>
                )}
              </SectionCard>
              </div>

              {/* Charges et recettes additionnelles */}
              <div ref={chargesCardRef}>
              <SectionCard title="Charges et recettes additionnelles">
                {editMode ? (
                  <div className="space-y-5">
                    {/* Achats / fournitures récurrents */}
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Achats et fournitures récurrents (compte 60)</p>
                      {draft.achats_recurrents.length > 0 && (
                        <div className="space-y-2 mb-2">
                          <div className="grid grid-cols-[1fr_100px_100px_24px] gap-2 mb-1">
                            <span className="text-xs text-gray-400">Type / description</span>
                            <span className="text-xs text-gray-400">Qté/an</span>
                            <span className="text-xs text-gray-400">Coût unit. (€)</span>
                            <span />
                          </div>
                          {draft.achats_recurrents.map((a, i) => (
                            <div key={i} className="grid grid-cols-[1fr_100px_100px_24px] gap-2 items-center">
                              <input className="field-input text-sm" value={a.nom_type} onChange={e => setAchat(i, { nom_type: e.target.value })} placeholder="Ex : Fournitures pédagogiques, Alimentation…" />
                              <input type="number" className="field-input text-sm" value={a.quantite_annuelle} onChange={e => setAchat(i, { quantite_annuelle: e.target.value })} placeholder="12" min={0} />
                              <input type="number" className="field-input text-sm" value={a.cout_unitaire} onChange={e => setAchat(i, { cout_unitaire: e.target.value })} placeholder="50" min={0} step={0.01} />
                              <button type="button" onClick={() => removeAchat(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={addAchat} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Ajouter un achat</button>
                    </div>
                    {/* Assurance */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={draft.assurance_dediee} onChange={e => setField('assurance_dediee', e.target.checked)} />
                        <span className="text-sm font-medium text-gray-700">Assurance dédiée au projet (compte 61)</span>
                      </label>
                      {draft.assurance_dediee && (
                        <div className="mt-3">
                          <Field label="Coût annuel estimé (€)">
                            <input type="number" className="field-input" value={draft.assurance_cout_annuel} onChange={e => setField('assurance_cout_annuel', e.target.value)} placeholder="Ex : 800" min={0} />
                          </Field>
                        </div>
                      )}
                    </div>
                    {/* Déplacements */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={draft.deplacements_estimes} onChange={e => setField('deplacements_estimes', e.target.checked)} />
                        <span className="text-sm font-medium text-gray-700">Déplacements / missions estimés (compte 62)</span>
                      </label>
                      {draft.deplacements_estimes && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <Field label="Fréquence mensuelle (trajets/mois)">
                            <input type="number" className="field-input" value={draft.deplacements_frequence_mensuelle} onChange={e => setField('deplacements_frequence_mensuelle', e.target.value)} placeholder="Ex : 4" min={0} />
                          </Field>
                          <Field label="Coût moyen par trajet (€)">
                            <input type="number" className="field-input" value={draft.deplacements_cout_moyen} onChange={e => setField('deplacements_cout_moyen', e.target.value)} placeholder="Ex : 15" min={0} step={0.01} />
                          </Field>
                        </div>
                      )}
                    </div>
                    {/* Cotisations */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={draft.cotisations_actives} onChange={e => setField('cotisations_actives', e.target.checked)} />
                        <span className="text-sm font-medium text-gray-700">Cotisations / prestations des bénéficiaires (compte 70)</span>
                      </label>
                      {draft.cotisations_actives && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <Field label="Nb adhérents payants">
                            <input type="number" className="field-input" value={draft.nb_adherents_payants} onChange={e => setField('nb_adherents_payants', e.target.value)} placeholder="Ex : 80" min={0} />
                          </Field>
                          <Field label="Tarif moyen annuel (€/pers.)">
                            <input type="number" className="field-input" value={draft.tarif_moyen_annuel} onChange={e => setField('tarif_moyen_annuel', e.target.value)} placeholder="Ex : 50" min={0} step={0.01} />
                          </Field>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Achats */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Achats et fournitures récurrents</p>
                      {det.achats_recurrents?.filter(a => a.nom_type).length ? (
                        <div className="space-y-1">
                          {det.achats_recurrents.filter(a => a.nom_type).map((a, i) => {
                            const montant = (parseFloat(a.quantite_annuelle) || 0) * (parseFloat(a.cout_unitaire) || 0);
                            return (
                              <div key={i} className="flex justify-between text-sm gap-3">
                                <span className="text-gray-700 flex-1">{a.nom_type}</span>
                                <span className="text-gray-400 text-xs">{a.quantite_annuelle}× {a.cout_unitaire} €</span>
                                <span className="font-medium tabular-nums">{montant.toLocaleString('fr-FR')} €</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : <p className="text-sm text-gray-300 italic">—</p>}
                    </div>
                    <RowF label="Assurance dédiée" value={det.assurance_dediee && det.assurance_cout_annuel ? `${parseFloat(det.assurance_cout_annuel).toLocaleString('fr-FR')} €/an` : det.assurance_dediee ? 'Oui' : null} />
                    <RowF label="Déplacements estimés" value={det.deplacements_estimes && det.deplacements_frequence_mensuelle && det.deplacements_cout_moyen ? `${det.deplacements_frequence_mensuelle} trajet(s)/mois × ${det.deplacements_cout_moyen} €` : det.deplacements_estimes ? 'Oui' : null} />
                    <RowF label="Cotisations bénéficiaires" value={det.cotisations_actives && det.nb_adherents_payants ? `${det.nb_adherents_payants} adhérents × ${det.tarif_moyen_annuel || '?'} €/an` : det.cotisations_actives ? 'Oui' : null} />
                  </div>
                )}
              </SectionCard>
              </div>

              {/* Aperçu des lignes budgétaires auto-générées (visible en mode édition) */}
              {editMode && lignesAutoPreview.length > 0 && (
                <AutoBudgetPreview lignes={lignesAutoPreview} demandeId={id} />
              )}

              {/* Budget */}
              <SectionCard title="Budget prévisionnel">
                {editMode ? (
                  <BudgetEditor
                    depenses={draft.depenses}
                    recettes={draft.recettes}
                    onChange={(dep, rec) => setDraft(prev => prev ? { ...prev, depenses: dep, recettes: rec } : prev)}
                  />
                ) : budgetLignes.length > 0 ? (
                  <>
                    <BudgetLignesView lignes={budgetLignes} demandeId={id} />
                    {/* Bouton d'intégration du montant demandé si ligne absente */}
                    {demande.montant_demande != null && demande.montant_demande > 0 &&
                     !budgetLignes.some(l => l.cle_generation === 'auto_montant_demande_bailleur') && (
                      <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3 mt-1">
                        <p className="text-sm text-amber-800">
                          Le montant demandé ({fmt(demande.montant_demande)} €) n&apos;est pas encore intégré au budget comme ligne de recette.
                        </p>
                        <button
                          onClick={integrerMontantDemande}
                          disabled={integrationEnCours}
                          className="shrink-0 text-xs font-medium bg-amber-600 text-white rounded px-2.5 py-1.5 hover:bg-amber-700 disabled:opacity-50"
                        >
                          {integrationEnCours ? '…' : 'Ajouter'}
                        </button>
                      </div>
                    )}
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

              {/* Indicateurs */}
              <SectionCard title="Indicateurs d'évaluation">
                {editMode ? (
                  <Field label="Indicateurs quantitatifs et qualitatifs (SMART)">
                    <textarea rows={4} className="field-textarea" value={draft.indicateurs_evaluation} onChange={e => setField('indicateurs_evaluation', e.target.value)} placeholder={"Quantitatifs :\n• Nb d'ateliers réalisés (cible : 80 sur l'année)\n• Nb de participants distincts (cible : 120)\n• Nb de sorties positives emploi/formation (cible : 40, soit 33%)\n\nQualitatifs :\n• Enquête de satisfaction (cible : 80% de satisfaits)\n• Évolution de l'estime de soi (grille auto-évaluation début/fin)"} />
                  </Field>
                ) : det.indicateurs_evaluation ? (
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{det.indicateurs_evaluation}</p>
                ) : <p className="text-sm text-gray-300 italic">—</p>}
              </SectionCard>

              {/* Champs déclaratifs Cerfa */}
              <SectionCard title="Champs déclaratifs Cerfa">
                {editMode ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Forme de la subvention (Cerfa p.1)">
                        <select className="field-input" value={draft.forme_subvention} onChange={e => setField('forme_subvention', e.target.value as FullDraft['forme_subvention'])}>
                          <option value="">—</option>
                          <option value="numeraire">En numéraire (argent)</option>
                          <option value="nature">En nature</option>
                        </select>
                      </Field>
                      <Field label="Objet de la demande (Cerfa p.1)">
                        <select className="field-input" value={draft.objet_demande} onChange={e => setField('objet_demande', e.target.value as FullDraft['objet_demande'])}>
                          <option value="">—</option>
                          <option value="fonctionnement_global">Fonctionnement global</option>
                          <option value="projet_action">Projet / action spécifique</option>
                        </select>
                      </Field>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={draft.recrutement_envisage}
                          onChange={e => setField('recrutement_envisage', e.target.checked)}
                        />
                        <span className="text-sm font-medium text-gray-700">Recrutement envisagé dans le cadre de ce projet ?</span>
                      </label>
                      {draft.recrutement_envisage && (
                        <div className="mt-2 ml-6">
                          <Field label="Nombre d'ETPT recrutés">
                            <input className="field-input" value={draft.recrutement_etpt} onChange={e => setField('recrutement_etpt', e.target.value)} placeholder="Ex : 0,5 ETP" />
                          </Field>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <RowF label="Forme" value={det.forme_subvention === 'numeraire' ? 'En numéraire' : det.forme_subvention === 'nature' ? 'En nature' : null} />
                    <RowF label="Objet" value={det.objet_demande === 'fonctionnement_global' ? 'Fonctionnement global' : det.objet_demande === 'projet_action' ? 'Projet / action spécifique' : null} />
                    <RowF label="Recrutement envisagé" value={det.recrutement_envisage ? `Oui${det.recrutement_etpt ? ` — ${det.recrutement_etpt} ETPT` : ''}` : det.recrutement_envisage === false ? 'Non' : null} />
                  </div>
                )}
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
                      <RowF label="Subvention reçue" value={demande.bilan_subvention_anterieure ? `${fmt(demande.bilan_subvention_anterieure)} €` : null} />
                      <RowF label="Bénéficiaires réels" value={demande.bilan_nb_beneficiaires_reel?.toString() ?? null} />
                      <TextBlockF label="Bilan des actions" text={demande.bilan_activites} />
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
                      <RowF label="Nom" value={contactNom} />
                      <RowF label="Rôle" value={contactRole} />
                      <RowF label="Email" value={contactEmail} />
                      <RowF label="Téléphone" value={contactTel} />
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

function RowF({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={value ? 'text-gray-900 text-right' : 'text-gray-300 text-right italic'}>
        {value || '—'}
      </span>
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

function TextBlockF({ label, text }: { label: string; text?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {text
        ? <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{text}</p>
        : <p className="text-sm text-gray-300 italic">—</p>}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 italic">{text}</p>;
}

function AutoBudgetPreview({ lignes, demandeId }: { lignes: LigneAutoGeneree[]; demandeId: string }) {
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

function CeQuiChangeEditor({ demandeId: _demandeId, value, onSaved }: {
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

/* ── Budget lignes view (live from budget_lignes table) ──────────── */
function BudgetLignesView({ lignes, demandeId }: { lignes: BudgetLigneDB[]; demandeId: string }) {
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

/* ── Budget équilibre block ──────────────────────────────────────── */
function BudgetEquilibreBlock({ equilibre, taux }: { equilibre: BudgetEquilibre; taux: TauxFinancement[] }) {
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
