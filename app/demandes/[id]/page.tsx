"use client";
import { useEffect, useState, useMemo, use, useRef, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { StatutBadge } from "@/components/StatutBadge";
import { STATUTS, ALL_STATUTS } from "@/lib/statuts";
import type { Demande, Association, Statut, BudgetV2, DetailsJson, Bailleur, BriefMission, BudgetLigneDB, BudgetEquilibre, TauxFinancement } from "@/lib/supabase";
import { genererLignesAuto, SMIC_HORAIRE_BRUT_DEFAUT, type LigneAutoGeneree } from "@/lib/budgetAuto";
import Link from "next/link";
import { PageEditCtx } from './context';
export { usePageCtx } from './context';
import { CeQuiChangeEditor } from './components';
import { parseBudget, sumRows, draftFromDemande } from './types';
import type { FullDemande, FullDraft, PrestataireDraft, AchatDraft, AutreBailleurDraft } from './types';
import { ProjetTab } from './tabs/ProjetTab';
import { MoyensTab } from './tabs/MoyensTab';
import { BudgetTab } from './tabs/BudgetTab';
import { RelationsTab } from './tabs/RelationsTab';
import { DocumentsTab } from './tabs/DocumentsTab';

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [budgetLignes, setBudgetLignes] = useState<BudgetLigneDB[]>([]);
  const [budgetEquilibre, setBudgetEquilibre] = useState<BudgetEquilibre | null>(null);
  const [budgetTaux, setBudgetTaux] = useState<TauxFinancement[]>([]);

  const chargesCardRef = useRef<HTMLDivElement>(null);
  const prestataireCardRef = useRef<HTMLDivElement>(null);

  const [subTab, setSubTab] = useState<'projet' | 'moyens' | 'budget' | 'relations' | 'documents'>('projet');
  const [reprenantN1, setReprenantN1] = useState(false);
  const [thematiqueSuggestions, setThematiqueSuggestions] = useState<string[]>([]);

  const [brief, setBrief] = useState<BriefMission | null>(null);
  const [briefOpen, setBriefOpen] = useState(true);
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ demande_candidate_id: string; titre_projet: string; annee_millesime: number | null; montant_demande: number | null; montant_obtenu: number | null; statut: string }>>([]);
  const [savingCeQuiChange, setSavingCeQuiChange] = useState(false);
  const [groupeMembers, setGroupeMembers] = useState<Array<{ id: string; titre_projet: string | null; annee_millesime: number | null; statut: string; montant_demande: number | null; montant_obtenu: number | null; numero_annee_dans_groupe: number | null; nombre_annees_total_groupe: number | null }> | null>(null);
  const [aidesSeuil, setAidesSeuil] = useState<{ total: number; depasse_seuil: boolean } | null>(null);
  const [lienFormulaire, setLienFormulaire] = useState<{
    ouvert_le: string | null;
    rempli_le: string | null;
    dernier_envoi: { email: string; envoye_le: string } | null;
    historique: Array<{ email: string; envoye_le: string }>;
  } | null>(null);
  const [lienEmail, setLienEmail] = useState('');
  const [lienUrl, setLienUrl] = useState<string | null>(null);
  const [lienGenerating, setLienGenerating] = useState(false);

  const loadDemande = async () => {
    const r = await fetch(`/api/demandes/${id}`);
    const { demande: d } = await r.json();
    setDemande(d);
    setEditStatut(d?.statut || '');
    setEditPresta(d?.presta_redacteur || '');
    setEditNotes(d?.notes || '');
    setEditMontantObtenu(d?.montant_obtenu?.toString() || '');
    setDraft(draftFromDemande(d));
    setLienEmail(prev => prev || d?.contact_email || '');
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

  const loadThematiqueSuggestions = useCallback(() =>
    fetch('/api/details-suggestions?champ=thematique')
      .then(r => r.ok ? r.json() : { suggestions: [] })
      .then(({ suggestions: s }) => setThematiqueSuggestions(s || [])), []);

  const loadLienFormulaire = () =>
    fetch(`/api/demandes/${id}/lien-formulaire`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setLienFormulaire(data));

  useEffect(() => {
    loadDemande();
    loadBrief();
    loadBailleurs();
    loadSuggestions();
    loadBudgetLignes();
    loadGroupe();
    loadThematiqueSuggestions();
    loadLienFormulaire();
  }, [id]);

  const reprendreValeursPrecedentes = async () => {
    if (!demande?.demande_precedente_id) return;
    setReprenantN1(true);
    try {
      const r = await fetch(`/api/demandes/${demande.demande_precedente_id}`);
      if (!r.ok) return;
      const { demande: prev } = await r.json();
      const prevDet = (prev.details_json || {}) as DetailsJson;
      setDraft(d => d ? {
        ...d,
        objectif_projet: prev.objectif_projet || d.objectif_projet,
        public_beneficiaire: prev.public_beneficiaire || d.public_beneficiaire,
        nb_beneficiaires_estime: prev.nb_beneficiaires_estime?.toString() || d.nb_beneficiaires_estime,
        description_besoins: prevDet.description_besoins || d.description_besoins,
        description_actions: prevDet.description_actions || d.description_actions,
        partenariats: prevDet.partenariats || d.partenariats,
        indicateurs_evaluation: prevDet.indicateurs_evaluation || d.indicateurs_evaluation,
        thematique: prevDet.thematique || d.thematique,
      } : d);
    } finally {
      setReprenantN1(false);
    }
  };

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
        tarif_cotisation_annuelle: draft.tarif_cotisation_annuelle || undefined,
        nb_seances_mensuelles_moyen: draft.nb_seances_mensuelles_moyen || undefined,
        nb_participants_moyen_seance: draft.nb_participants_moyen_seance || undefined,
        tarif_moyen_participation: draft.tarif_moyen_participation || undefined,
        nb_mois_activite: draft.nb_mois_activite || undefined,
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
    setSaveError(null);
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
      tarif_cotisation_annuelle: draft.tarif_cotisation_annuelle || undefined,
      nb_seances_mensuelles_moyen: draft.nb_seances_mensuelles_moyen || undefined,
      nb_participants_moyen_seance: draft.nb_participants_moyen_seance || undefined,
      tarif_moyen_participation: draft.tarif_moyen_participation || undefined,
      nb_mois_activite: draft.nb_mois_activite || undefined,
      autres_bailleurs_sollicites: draft.autres_bailleurs_sollicites.filter(b => b.nom_bailleur && b.statut) as DetailsJson['autres_bailleurs_sollicites'],
      forme_subvention: (draft.forme_subvention || undefined) as DetailsJson['forme_subvention'],
      objet_demande: (draft.objet_demande || undefined) as DetailsJson['objet_demande'],
      recrutement_envisage: draft.recrutement_envisage || undefined,
      recrutement_etpt: draft.recrutement_etpt || undefined,
      autorites_destinataires: draft.autorites_destinataires.length > 0 ? draft.autorites_destinataires : undefined,
      contrat_de_ville: draft.contrat_de_ville_concerne ? { concerne: true, nom_contrat: draft.contrat_de_ville_nom || undefined } : undefined,
      qpv_codes: draft.qpv_codes.length > 0 ? draft.qpv_codes : undefined,
      agrements: draft.agrements.filter(a => a.type || a.autorite).length > 0
        ? draft.agrements.filter(a => a.type || a.autorite).map(a => ({ type: a.type, autorite: a.autorite, date_obtention: a.date_obtention || undefined }))
        : undefined,
      reconnue_utilite_publique: draft.reconnue_utilite_publique || undefined,
      date_publication_jo_utilite_publique: draft.date_publication_jo_utilite_publique || undefined,
      assujettie_impots_commerciaux: draft.assujettie_impots_commerciaux || undefined,
      reseaux_affiliation: draft.reseaux_affiliation ? draft.reseaux_affiliation.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      adherents_personnes_morales: draft.adherents_personnes_morales
        ? draft.adherents_personnes_morales.split(',').map(s => ({ nom: s.trim() })).filter(a => a.nom)
        : undefined,
    };
    const isValidEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
    const VALID_BAILLEUR = new Set(['etat', 'commune', 'epci', 'departement', 'region', 'etablissement_public', 'prive', 'autre']);
    try {
      const res = await fetch(`/api/demandes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre_projet: draft.titre_projet || null,
          bailleur_nom: draft.bailleur_nom || null,
          bailleur_type: draft.bailleur_type && VALID_BAILLEUR.has(draft.bailleur_type) ? draft.bailleur_type : null,
          montant_demande: draft.montant_demande ? Number(draft.montant_demande) : null,
          periode_debut: draft.periode_debut || null,
          periode_fin: draft.periode_fin || null,
          objectif_projet: draft.objectif_projet || null,
          public_beneficiaire: draft.public_beneficiaire || null,
          nb_beneficiaires_estime: draft.nb_beneficiaires_estime ? Math.round(Number(draft.nb_beneficiaires_estime)) : null,
          bilan_subvention_anterieure: draft.bilan_subvention_anterieure ? Number(draft.bilan_subvention_anterieure) : null,
          bilan_nb_beneficiaires_reel: draft.bilan_nb_beneficiaires_reel ? Math.round(Number(draft.bilan_nb_beneficiaires_reel)) : null,
          bilan_activites: draft.bilan_activites || null,
          contact_nom: draft.contact_nom || null,
          contact_role: draft.contact_role || null,
          contact_email: draft.contact_email && isValidEmail(draft.contact_email) ? draft.contact_email : null,
          contact_telephone: draft.contact_telephone || null,
          bailleur_id: draft.bailleur_id || null,
          demande_precedente_id: draft.demande_precedente_id || null,
          annee_millesime: draft.annee_millesime ? Math.round(Number(draft.annee_millesime)) : null,
          plateforme_url_specifique: draft.plateforme_url_specifique || null,
          plateforme_identifiant_dossier: draft.plateforme_identifiant_dossier || null,
          budget_previsionnel_json: budgetV2,
          details_json: detailsJson,
          type_cerfa_cible: draft.type_cerfa_cible || null,
          date_limite_depot: draft.date_limite_depot || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSaveError(errData.error || `Erreur ${res.status}`);
        return;
      }
      await loadDemande();
      await loadBrief();
      await loadBudgetLignes();
      setSavedDraft(true);
      setEditMode(false);
      setTimeout(() => setSavedDraft(false), 2500);
    } catch {
      setSaveError('Erreur réseau — réessayez.');
    } finally {
      setSavingDraft(false);
    }
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

  const scoreColor = score.filled >= 8 ? 'text-green-600' : score.filled >= 5 ? 'text-amber-600' : 'text-red-500';
  const barColor = score.filled >= 8 ? 'bg-green-500' : score.filled >= 5 ? 'bg-amber-400' : 'bg-red-400';

  const ctxValue = {
    editMode,
    savingDraft,
    startEdit: () => setEditMode(true),
    saveAll: saveDossier,
    cancelEdit,
    savedDraft,
    saveError,
    draft,
    setField,
    setPrestataire,
    removePrestataire,
    addPrestataire,
    setAchat,
    removeAchat,
    addAchat,
    setAutreBailleur,
    removeAutreBailleur,
    addAutreBailleur,
    demande,
    budgetLignes,
    budgetEquilibre,
    budgetTaux,
    bailleurs,
    lignesAutoPreview,
    loadBudgetLignes,
    loadDemande,
    activerPatternEtScroller,
    reprendreValeursPrecedentes,
    reprenantN1,
    thematiqueSuggestions,
    suggestions,
    savingCeQuiChange,
    lienFormulaire,
    lienEmail,
    setLienEmail,
    lienUrl,
    setLienUrl,
    lienGenerating,
    setLienGenerating,
    loadLienFormulaire,
    chargesCardRef,
    prestataireCardRef,
  };

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

          {/* Sous-onglets dossier */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([
              ['projet', 'Projet'],
              ['moyens', 'Moyens'],
              ['budget', 'Budget'],
              ['relations', 'Relations admin'],
              ['documents', 'Documents'],
            ] as const).map(([t, l]) => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={['px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors border', subTab === t ? 'bg-white border-blue-300 shadow-sm text-blue-700 font-semibold' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-white hover:border-gray-200'].join(' ')}
              >
                {l}
              </button>
            ))}
          </div>

          <PageEditCtx.Provider value={ctxValue}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Colonne gauche */}
            <div className="lg:col-span-2 space-y-5">

            {savedDraft && <p className="text-xs text-green-600">✓ Dossier enregistré</p>}

            {subTab === 'projet' && <ProjetTab />}
            {subTab === 'moyens' && <MoyensTab />}
            {subTab === 'budget' && <BudgetTab />}
            {subTab === 'relations' && <RelationsTab />}
            {subTab === 'documents' && <DocumentsTab />}

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

            </div>
          </div>
          </PageEditCtx.Provider>

        {/* Sticky save bar — shown when editing */}
        {editMode && (
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2.5">
            {saveError && <span className="text-xs text-red-500 max-w-xs">{saveError}</span>}
            <span className="text-xs text-gray-500">Mode édition</span>
            <button onClick={cancelEdit} className="btn btn-ghost text-sm">Annuler</button>
            <button onClick={saveDossier} disabled={savingDraft} className="btn btn-primary text-sm">
              {savingDraft ? 'Enregistrement…' : '💾 Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
