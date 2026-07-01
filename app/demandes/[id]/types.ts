import type { Demande, Association, BudgetLigne, BudgetV2, DetailsJson, BailleurType, AutoritesDestinataires } from "@/lib/supabase";

export type FullDemande = Demande & { associations: Association };
export type BudgetRow = { label: string; montant: string };
export type PrestataireDraft = { nom_type: string; nb_seances_ou_ateliers: string; tarif_unitaire: string };
export type AchatDraft = { nom_type: string; quantite_annuelle: string; cout_unitaire: string };
export type AutreBailleurDraft = { nom_bailleur: string; montant: string; statut: 'obtenu' | 'demande' | 'envisage' | '' };

export type FullDraft = {
  titre_projet: string;
  bailleur_nom: string;
  bailleur_type: BailleurType | '';
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
  heures_benevolat_semaine: string;
  taux_horaire_valorisation: string;
  cout_salarial_annuel_estime: string;
  a_des_prestataires: boolean;
  prestataires: PrestataireDraft[];
  locaux_mis_a_disposition: boolean;
  locaux_bailleur: string;
  locaux_valeur_estimee: string;
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
  autres_bailleurs_sollicites: AutreBailleurDraft[];
  forme_subvention: 'numeraire' | 'nature' | '';
  objet_demande: 'fonctionnement_global' | 'projet_action' | '';
  recrutement_envisage: boolean;
  recrutement_etpt: string;
  autorites_destinataires: AutoritesDestinataires[];
  contrat_de_ville_concerne: boolean;
  contrat_de_ville_nom: string;
  qpv_codes: string[];
  type_cerfa_cible: string;
  date_limite_depot: string;
  agrements: Array<{ type: string; autorite: string; date_obtention: string }>;
  reconnue_utilite_publique: boolean;
  date_publication_jo_utilite_publique: string;
  assujettie_impots_commerciaux: boolean;
  reseaux_affiliation: string;
  adherents_personnes_morales: string;
};

export const DEP_CATS = [
  'Salaires et charges sociales',
  'Honoraires / intervenants',
  'Achats et fournitures',
  'Loyer / locaux',
  'Déplacements et transport',
  'Communication / impression',
  'Contributions bénévoles',
];

export const REC_CATS = [
  'Subvention (ce bailleur)',
  'Autofinancement',
  'Subventions État / région',
  'Cotisations membres',
  'Dons et mécénat',
  'Contributions bénévoles',
];

export function parseBudget(raw: unknown): { depenses: BudgetRow[]; recettes: BudgetRow[] } {
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

export function sumRows(rows: BudgetRow[]) {
  return rows.reduce((s, r) => s + (parseFloat(r.montant.replace(',', '.')) || 0), 0);
}

export const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function draftFromDemande(d: FullDemande): FullDraft {
  const { depenses, recettes } = parseBudget(d.budget_previsionnel_json);
  const det = (d.details_json || {}) as DetailsJson;
  return {
    titre_projet: d.titre_projet || '',
    bailleur_nom: d.bailleur_nom || '',
    bailleur_type: (d.bailleur_type as BailleurType) || '',
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
    autorites_destinataires: (det.autorites_destinataires ?? []) as AutoritesDestinataires[],
    contrat_de_ville_concerne: det.contrat_de_ville?.concerne ?? false,
    contrat_de_ville_nom: det.contrat_de_ville?.nom_contrat || '',
    qpv_codes: det.qpv_codes ?? [],
    type_cerfa_cible: d.type_cerfa_cible || '',
    date_limite_depot: d.date_limite_depot || '',
    agrements: det.agrements?.map(a => ({ type: a.type || '', autorite: a.autorite || '', date_obtention: a.date_obtention || '' })) ?? [],
    reconnue_utilite_publique: det.reconnue_utilite_publique ?? false,
    date_publication_jo_utilite_publique: det.date_publication_jo_utilite_publique || '',
    assujettie_impots_commerciaux: det.assujettie_impots_commerciaux ?? false,
    reseaux_affiliation: (det.reseaux_affiliation ?? []).join(', '),
    adherents_personnes_morales: (det.adherents_personnes_morales ?? []).map(a => a.nom).join(', '),
  };
}
