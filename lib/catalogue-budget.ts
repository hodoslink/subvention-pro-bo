// lib/catalogue-budget.ts

export type SecteurActivite =
  | 'sante'
  | 'sport'
  | 'culture'
  | 'insertion'
  | 'education'
  | 'environnement'
  | 'autre';

// Mapping des valeurs de associations.secteur_activite vers les secteurs du catalogue.
export function detecterSecteur(valeur: string | null | undefined): SecteurActivite {
  if (!valeur) return 'autre';
  const v = valeur.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (v.includes('sant') || v.includes('soin') || v.includes('medic') ||
      v.includes('obesit') || v.includes('nutrition') || v.includes('patient') ||
      v.includes('therapeu'))
    return 'sante';
  if (v.includes('sport') || v.includes('gym') || v.includes('foot') ||
      v.includes('basket') || v.includes('natation') || v.includes('athleti') ||
      v.includes('fitness'))
    return 'sport';
  if (v.includes('cultur') || v.includes('art') || v.includes('music') ||
      v.includes('theatre') || v.includes('danse') || v.includes('cinema') ||
      v.includes('patrimoi'))
    return 'culture';
  if (v.includes('insert') || v.includes('emploi') || v.includes('formation') ||
      v.includes('iad') || v.includes('chomag') || v.includes('travail'))
    return 'insertion';
  if (v.includes('educ') || v.includes('ecol') || v.includes('jeunes') ||
      v.includes('enfan') || v.includes('periscolai') || v.includes('youth'))
    return 'education';
  if (v.includes('enviro') || v.includes('ecolog') || v.includes('nature') ||
      v.includes('climat') || v.includes('biodiv') || v.includes('dechets'))
    return 'environnement';
  return 'autre';
}

export type ModeCalcul =
  | 'quantite_prix'
  | 'montant_forfaitaire'
  | 'calculateur_706';

export type CatalogueLigne = {
  id: string;
  compte: string;
  sous_categorie: string;
  description_aide: string;
  mode_calcul: ModeCalcul;
  quantite_label?: string;
  prix_label?: string;
  quantite_placeholder?: string;
  prix_placeholder?: string;
  montant_placeholder?: string;
  ancre_reference?: string;
  est_produit: boolean;
  calc_label_seances?: string;
  calc_label_tarif?: string;
  calc_hint_tarif?: string;
};

export type CatalogueCategorie = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  lignes: CatalogueLigne[];
};

// ─── INTERVENANTS PAR SECTEUR ───────────────────────────────────────────────

const AUTRE_INTERVENANT: CatalogueLigne = {
  id: 'autre_intervenant',
  compte: '622',
  sous_categorie: '',
  description_aide: 'Autre professionnel non listé ci-dessus',
  mode_calcul: 'quantite_prix',
  quantite_label: 'Nombre de séances sur l\'année',
  prix_label: 'Tarif par séance (€)',
  quantite_placeholder: 'ex: 10',
  prix_placeholder: 'ex: 80',
  est_produit: false,
};

const INTERVENANTS_PAR_SECTEUR: Record<SecteurActivite, CatalogueLigne[]> = {

  sante: [
    {
      id: 'psychologue',
      compte: '622',
      sous_categorie: 'Psychologue — groupe de parole',
      description_aide: 'Séances collectives animées par un psychologue clinicien',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 40',
      prix_placeholder: 'ex: 120',
      ancre_reference: '90–150 €/séance pour un psychologue clinicien',
      est_produit: false,
    },
    {
      id: 'dieteticienne',
      compte: '622',
      sous_categorie: 'Diététicien·ne — ateliers nutrition',
      description_aide: 'Ateliers collectifs animés par une diététicienne diplômée',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 30',
      prix_placeholder: 'ex: 60',
      ancre_reference: '45–80 €/séance pour une diététicienne',
      est_produit: false,
    },
    {
      id: 'apa',
      compte: '622',
      sous_categorie: 'Enseignant·e en Activité Physique Adaptée (APA)',
      description_aide: 'Séances encadrées par un professionnel diplômé en APA',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 50',
      prix_placeholder: 'ex: 150',
      ancre_reference: '80–180 €/séance pour un enseignant APA',
      est_produit: false,
    },
    {
      id: 'sophrologue',
      compte: '622',
      sous_categorie: 'Sophrologue',
      description_aide: 'Séances de relaxation et gestion émotionnelle',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 20',
      prix_placeholder: 'ex: 90',
      ancre_reference: '60–120 €/séance pour un sophrologue',
      est_produit: false,
    },
    {
      id: 'coach_image',
      compte: '622',
      sous_categorie: 'Coach en image / estime de soi',
      description_aide: 'Ateliers confiance en soi et image personnelle',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 10',
      prix_placeholder: 'ex: 50',
      est_produit: false,
    },
    {
      id: 'bien_etre',
      compte: '622',
      sous_categorie: 'Intervenant·e bien-être (yoga, danse-thérapie, kinésiologie…)',
      description_aide: 'Activités de bien-être collectif avec un professionnel',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 15',
      prix_placeholder: 'ex: 75',
      est_produit: false,
    },
    {
      id: 'aquagym',
      compte: '622',
      sous_categorie: 'Animateur·trice aquagym / activité en piscine',
      description_aide: 'Séances en milieu aquatique avec un animateur professionnel',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 30',
      prix_placeholder: 'ex: 150',
      ancre_reference: 'Inclure le coût de location de bassin si applicable',
      est_produit: false,
    },
    {
      id: 'etp',
      compte: '622',
      sous_categorie: 'Intervenant·e en éducation thérapeutique du patient (ETP)',
      description_aide: 'Animations de séances ETP en établissement de santé',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 36',
      prix_placeholder: 'ex: 80',
      est_produit: false,
    },
    AUTRE_INTERVENANT,
  ],

  sport: [
    {
      id: 'educateur_sportif',
      compte: '622',
      sous_categorie: 'Éducateur·trice sportif·ve (BPJEPS)',
      description_aide: 'Entraînements collectifs encadrés par un éducateur diplômé',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 80',
      prix_placeholder: 'ex: 60',
      ancre_reference: '40–80 €/séance pour un éducateur BPJEPS',
      est_produit: false,
    },
    {
      id: 'coach_sportif',
      compte: '622',
      sous_categorie: 'Coach sportif',
      description_aide: 'Entraîneur ou coach pour activités physiques et sportives',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 50',
      prix_placeholder: 'ex: 80',
      est_produit: false,
    },
    {
      id: 'arbitre',
      compte: '622',
      sous_categorie: 'Arbitre / officiel de match',
      description_aide: 'Arbitrage des rencontres sportives',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de matches / rencontres',
      prix_label: 'Tarif par rencontre (€)',
      quantite_placeholder: 'ex: 20',
      prix_placeholder: 'ex: 40',
      est_produit: false,
    },
    {
      id: 'moniteur_natation',
      compte: '622',
      sous_categorie: 'Moniteur·trice natation / maître-nageur',
      description_aide: 'Encadrement des séances aquatiques',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 40',
      prix_placeholder: 'ex: 50',
      est_produit: false,
    },
    {
      id: 'intervenant_bien_etre_sport',
      compte: '622',
      sous_categorie: 'Intervenant·e bien-être / yoga / récupération',
      description_aide: 'Séances de récupération, stretching, yoga sportif',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 20',
      prix_placeholder: 'ex: 60',
      est_produit: false,
    },
    AUTRE_INTERVENANT,
  ],

  culture: [
    {
      id: 'artiste_intervenant',
      compte: '622',
      sous_categorie: 'Artiste intervenant·e',
      description_aide: 'Artiste professionnel animant des ateliers de pratique artistique',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'ateliers / séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 30',
      prix_placeholder: 'ex: 120',
      ancre_reference: '80–200 €/séance selon la discipline et la notoriété',
      est_produit: false,
    },
    {
      id: 'animateur_culturel',
      compte: '622',
      sous_categorie: 'Animateur·trice culturel·le',
      description_aide: 'Animation d\'ateliers culturels (lecture, écriture, cinéma, patrimoine…)',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'ateliers sur l\'année',
      prix_label: 'Tarif par atelier (€)',
      quantite_placeholder: 'ex: 20',
      prix_placeholder: 'ex: 80',
      est_produit: false,
    },
    {
      id: 'technicien_scene',
      compte: '622',
      sous_categorie: 'Technicien·ne son / lumière / scène',
      description_aide: 'Prestation technique pour spectacles et événements',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'événements',
      prix_label: 'Tarif par événement (€)',
      quantite_placeholder: 'ex: 5',
      prix_placeholder: 'ex: 300',
      est_produit: false,
    },
    {
      id: 'musicien_intervenant',
      compte: '622',
      sous_categorie: 'Musicien·ne intervenant·e / accompagnateur·trice musical',
      description_aide: 'Accompagnement musical ou cours collectifs',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 25',
      prix_placeholder: 'ex: 100',
      est_produit: false,
    },
    {
      id: 'conferencier',
      compte: '622',
      sous_categorie: 'Conférencier·ère / médiateur·trice culturel',
      description_aide: 'Interventions de médiation, conférences et visites guidées',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'interventions',
      prix_label: 'Tarif par intervention (€)',
      quantite_placeholder: 'ex: 8',
      prix_placeholder: 'ex: 150',
      est_produit: false,
    },
    AUTRE_INTERVENANT,
  ],

  insertion: [
    {
      id: 'referent_emploi',
      compte: '622',
      sous_categorie: 'Référent·e emploi / conseiller·ère en insertion',
      description_aide: 'Accompagnement individuel ou collectif vers l\'emploi',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'ateliers / séances collectives',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 40',
      prix_placeholder: 'ex: 80',
      est_produit: false,
    },
    {
      id: 'formateur',
      compte: '622',
      sous_categorie: 'Formateur·trice (compétences professionnelles)',
      description_aide: 'Formations aux compétences clés, numérique, langues, métiers',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'heures de formation sur l\'année',
      prix_label: 'Tarif horaire (€)',
      quantite_placeholder: 'ex: 120',
      prix_placeholder: 'ex: 50',
      ancre_reference: '40–80 €/h pour un formateur professionnel',
      est_produit: false,
    },
    {
      id: 'conseiller_bilan',
      compte: '622',
      sous_categorie: 'Conseiller·ère bilan de compétences / VAE',
      description_aide: 'Accompagnement bilan de compétences ou validation des acquis',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de bénéficiaires',
      prix_label: 'Coût par bénéficiaire (€)',
      quantite_placeholder: 'ex: 15',
      prix_placeholder: 'ex: 200',
      est_produit: false,
    },
    {
      id: 'psychologue_insertion',
      compte: '622',
      sous_categorie: 'Psychologue / accompagnement psychosocial',
      description_aide: 'Soutien psychologique pour lever les freins à l\'emploi',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 30',
      prix_placeholder: 'ex: 100',
      est_produit: false,
    },
    AUTRE_INTERVENANT,
  ],

  education: [
    {
      id: 'animateur_periscolaire',
      compte: '622',
      sous_categorie: 'Animateur·trice périscolaire / BAFA',
      description_aide: 'Animation périscolaire ou de centre de loisirs',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de jours d\'animation sur l\'année',
      prix_label: 'Tarif journalier (€)',
      quantite_placeholder: 'ex: 100',
      prix_placeholder: 'ex: 80',
      ancre_reference: '60–100 €/jour pour un animateur BAFA',
      est_produit: false,
    },
    {
      id: 'intervenant_pedagogique',
      compte: '622',
      sous_categorie: 'Intervenant·e pédagogique spécialisé·e',
      description_aide: 'Ateliers pédagogiques dans une discipline spécifique (science, art, sport…)',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'ateliers sur l\'année',
      prix_label: 'Tarif par atelier (€)',
      quantite_placeholder: 'ex: 40',
      prix_placeholder: 'ex: 90',
      est_produit: false,
    },
    {
      id: 'soutien_scolaire',
      compte: '622',
      sous_categorie: 'Tuteur·rice / soutien scolaire',
      description_aide: 'Accompagnement scolaire individuel ou en petit groupe',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'heures sur l\'année',
      prix_label: 'Tarif horaire (€)',
      quantite_placeholder: 'ex: 200',
      prix_placeholder: 'ex: 20',
      est_produit: false,
    },
    {
      id: 'directeur_sejour',
      compte: '622',
      sous_categorie: 'Directeur·trice de séjour / BAFD',
      description_aide: 'Direction de séjours ou d\'accueils collectifs de mineurs',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de jours',
      prix_label: 'Tarif journalier (€)',
      quantite_placeholder: 'ex: 10',
      prix_placeholder: 'ex: 100',
      est_produit: false,
    },
    AUTRE_INTERVENANT,
  ],

  environnement: [
    {
      id: 'guide_nature',
      compte: '622',
      sous_categorie: 'Guide nature / animateur·trice environnemental·e',
      description_aide: 'Sorties nature, randonnées commentées, sensibilisation à la biodiversité',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de sorties / animations sur l\'année',
      prix_label: 'Tarif par sortie (€)',
      quantite_placeholder: 'ex: 20',
      prix_placeholder: 'ex: 150',
      est_produit: false,
    },
    {
      id: 'eco_animateur',
      compte: '622',
      sous_categorie: 'Éco-animateur·trice / médiateur·trice environnemental',
      description_aide: 'Ateliers sensibilisation écologie, tri, compostage, éco-gestes',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'ateliers sur l\'année',
      prix_label: 'Tarif par atelier (€)',
      quantite_placeholder: 'ex: 15',
      prix_placeholder: 'ex: 100',
      est_produit: false,
    },
    {
      id: 'formateur_env',
      compte: '622',
      sous_categorie: 'Formateur·trice transition écologique',
      description_aide: 'Formations aux enjeux climatiques, pratiques durables, rénovation…',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre d\'heures de formation',
      prix_label: 'Tarif horaire (€)',
      quantite_placeholder: 'ex: 60',
      prix_placeholder: 'ex: 60',
      est_produit: false,
    },
    {
      id: 'expert_technique_env',
      compte: '622',
      sous_categorie: 'Expert·e technique (diagnostic énergie, audit…)',
      description_aide: 'Prestations d\'expertise technique liées à l\'environnement',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de prestations',
      prix_label: 'Tarif par prestation (€)',
      quantite_placeholder: 'ex: 3',
      prix_placeholder: 'ex: 500',
      est_produit: false,
    },
    AUTRE_INTERVENANT,
  ],

  autre: [
    {
      id: 'intervenant_generique',
      compte: '622',
      sous_categorie: 'Intervenant·e extérieur·e',
      description_aide: 'Professionnel rémunéré intervenant dans le cadre du projet',
      mode_calcul: 'quantite_prix',
      quantite_label: 'Nombre de séances / ateliers sur l\'année',
      prix_label: 'Tarif par séance (€)',
      quantite_placeholder: 'ex: 20',
      prix_placeholder: 'ex: 80',
      est_produit: false,
    },
    AUTRE_INTERVENANT,
  ],
};

// ─── CATALOGUE COMMUN — CHARGES ──────────────────────────────────────────────

const CATALOGUE_COMMUN_CHARGES: CatalogueCategorie[] = [
  {
    id: 'achats',
    label: 'Achats pour les activités',
    description: 'Fournitures, denrées et petit équipement liés aux activités',
    emoji: '🛒',
    lignes: [
      {
        id: 'denrees',
        compte: '602',
        sous_categorie: 'Denrées alimentaires — ateliers cuisine / nutrition',
        description_aide: 'Ingrédients achetés pour des ateliers incluant une préparation culinaire',
        mode_calcul: 'quantite_prix',
        quantite_label: 'Nombre d\'ateliers sur l\'année',
        prix_label: 'Budget denrées par atelier (€)',
        quantite_placeholder: 'ex: 15',
        prix_placeholder: 'ex: 60',
        ancre_reference: '40 à 80 €/atelier selon le nombre de participants',
        est_produit: false,
      },
      {
        id: 'fournitures_activite',
        compte: '606',
        sous_categorie: 'Fournitures et matériel pédagogique',
        description_aide: 'Matériel consommable utilisé lors des activités (papeterie, supports, petits équipements)',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 300',
        est_produit: false,
      },
      {
        id: 'fournitures_bureau',
        compte: '606',
        sous_categorie: 'Fournitures de bureau (papier, encre, cartouches)',
        description_aide: 'Consommables pour la gestion administrative et les impressions bénévoles',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 150',
        ancre_reference: 'Comptez les remboursements de cartouches aux bénévoles',
        est_produit: false,
      },
    ],
  },
  {
    id: 'locaux_assurance',
    label: 'Locaux et assurance',
    description: 'Location de salle et couverture assurantielle',
    emoji: '🏠',
    lignes: [
      {
        id: 'location_salle',
        compte: '613',
        sous_categorie: 'Location de salle — activités de l\'association',
        description_aide: 'Coût annuel de location de salle pour les activités et événements',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 1 200',
        ancre_reference: '10–25 €/h pour une salle municipale, 25–60 €/h en secteur privé',
        est_produit: false,
      },
      {
        id: 'assurance',
        compte: '616',
        sous_categorie: 'Assurance responsabilité civile de l\'association',
        description_aide: 'Prime annuelle d\'assurance RC et garanties liées aux activités',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 400',
        ancre_reference: '150–600 €/an selon les activités pratiquées',
        est_produit: false,
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication et numérique',
    description: 'Supports de communication, site internet, abonnements logiciels',
    emoji: '📢',
    lignes: [
      {
        id: 'impression',
        compte: '623',
        sous_categorie: 'Impression — flyers, affiches, livrets, supports événementiels',
        description_aide: 'Supports imprimés pour promouvoir les activités de l\'association',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 500',
        est_produit: false,
      },
      {
        id: 'kakemonos',
        compte: '623',
        sous_categorie: 'Supports événementiels (kakémonos, banderoles, stands)',
        description_aide: 'Matériel de présentation lors des événements et forums',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 200',
        est_produit: false,
      },
      {
        id: 'abonnements_num',
        compte: '627',
        sous_categorie: 'Abonnements numériques (outils de gestion, site internet, hébergement)',
        description_aide: 'AssoConnect, Microsoft 365, Adobe, hébergement web, etc.',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 600',
        ancre_reference: 'Listez tous les abonnements annuels de l\'association',
        est_produit: false,
      },
      {
        id: 'frais_bancaires',
        compte: '627',
        sous_categorie: 'Frais bancaires',
        description_aide: 'Frais annuels de tenue de compte bancaire associatif',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 120',
        est_produit: false,
      },
    ],
  },
  {
    id: 'deplacements',
    label: 'Déplacements',
    description: 'Transports de l\'équipe bénévole et du matériel',
    emoji: '🚗',
    lignes: [
      {
        id: 'deplacements_benevoles',
        compte: '625',
        sous_categorie: 'Déplacements de l\'équipe bénévole',
        description_aide: 'Frais de transport des bénévoles pour les activités de l\'association',
        mode_calcul: 'quantite_prix',
        quantite_label: 'Nombre de trajets estimés sur l\'année',
        prix_label: 'Coût moyen par trajet (€)',
        quantite_placeholder: 'ex: 24',
        prix_placeholder: 'ex: 15',
        ancre_reference: 'Barème kilométrique 2025 : 0,43 €/km. Transports en commun : conserver les justificatifs.',
        est_produit: false,
      },
      {
        id: 'transport_materiel',
        compte: '625',
        sous_categorie: 'Transport de matériel et logistique événementielle',
        description_aide: 'Déplacements pour transporter du matériel (événements, ateliers hors les murs)',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 200',
        est_produit: false,
      },
    ],
  },
  {
    id: 'personnel',
    label: 'Charges de personnel salarié',
    description: 'Uniquement si l\'association a des salariés affectés au projet',
    emoji: '💼',
    lignes: [
      {
        id: 'salaires',
        compte: '641',
        sous_categorie: 'Rémunération salarié·e affecté·e au projet',
        description_aide: 'Salaire brut annuel chargé charges patronales incluses (brut × 1,4 environ)',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 28 000',
        ancre_reference: 'Exemple : 1 800 € brut/mois = environ 30 240 €/an (×1,4 charges)',
        est_produit: false,
      },
    ],
  },
];

// ─── CATALOGUE COMMUN — PRODUITS ─────────────────────────────────────────────

export const CATALOGUE_PRODUITS: CatalogueCategorie[] = [
  {
    id: 'participations',
    label: 'Participations des bénéficiaires',
    description: 'Ce que les participants paient pour accéder aux activités',
    emoji: '💰',
    lignes: [
      {
        id: 'participations_activites',
        compte: '706',
        sous_categorie: 'Participations financières aux activités',
        description_aide: 'Recettes issues des participations des membres aux séances et ateliers. Souvent la principale ressource propre d\'une association.',
        mode_calcul: 'calculateur_706',
        ancre_reference: 'Ce poste représente généralement 30 à 50 % des recettes totales d\'une association active.',
        est_produit: true,
        calc_label_seances: 'Nombre de séances / ateliers par mois',
        calc_label_tarif: 'Tarif moyen par participant par séance (€)',
        calc_hint_tarif: 'Tarif solidaire, sans engagement de durée. Prévoir entre 5 et 15 € selon le type d\'activité.',
      },
    ],
  },
  {
    id: 'cotisations',
    label: 'Cotisations annuelles',
    description: 'Adhésions annuelles des membres de l\'association',
    emoji: '📋',
    lignes: [
      {
        id: 'cotisations_adherents',
        compte: '756',
        sous_categorie: 'Cotisations annuelles des adhérents',
        description_aide: 'Montant des cartes de membre payées chaque année',
        mode_calcul: 'quantite_prix',
        quantite_label: 'Nombre d\'adhérents estimés',
        prix_label: 'Tarif annuel d\'adhésion (€)',
        quantite_placeholder: 'ex: 150',
        prix_placeholder: 'ex: 20',
        est_produit: true,
      },
    ],
  },
  {
    id: 'subventions',
    label: 'Subventions',
    description: 'Financements publics et institutionnels',
    emoji: '🏛️',
    lignes: [
      {
        id: 'subvention',
        compte: '74',
        sous_categorie: '',
        description_aide: 'Subvention d\'exploitation d\'un financeur public ou institutionnel',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 6 500',
        ancre_reference: 'Entrez une ligne par bailleur. Ce bailleur : montant de la présente demande.',
        est_produit: true,
      },
    ],
  },
  {
    id: 'autres_recettes',
    label: 'Autres recettes',
    description: 'Dons, mécénat, recettes événementielles',
    emoji: '🎁',
    lignes: [
      {
        id: 'dons',
        compte: '758',
        sous_categorie: 'Dons et mécénat',
        description_aide: 'Dons de particuliers ou d\'entreprises sans contrepartie',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 500',
        est_produit: true,
      },
      {
        id: 'recettes_events',
        compte: '758',
        sous_categorie: 'Recettes événementielles',
        description_aide: 'Entrées, ventes ou recettes issues d\'événements organisés',
        mode_calcul: 'montant_forfaitaire',
        montant_placeholder: 'ex: 300',
        est_produit: true,
      },
    ],
  },
];

// ─── FONCTION PRINCIPALE : catalogue charges complet pour un secteur ─────────

export function getCatalogueCharges(secteur: SecteurActivite): CatalogueCategorie[] {
  const intervenants: CatalogueCategorie = {
    id: 'intervenants',
    label: 'Intervenants extérieurs',
    description: 'Professionnels rémunérés qui animent vos activités',
    emoji: '👥',
    lignes: INTERVENANTS_PAR_SECTEUR[secteur] ?? INTERVENANTS_PAR_SECTEUR['autre'],
  };
  return [intervenants, ...CATALOGUE_COMMUN_CHARGES];
}

// ─── GROUPES DE COMPTES pour l'affichage regroupé ────────────────────────────

export const GROUPES_CHARGES = [
  { prefix: '60', label: 'Achats et fournitures', comptes: ['60', '602', '606'] },
  { prefix: '61', label: 'Services extérieurs (locaux, assurance)', comptes: ['61', '613', '616'] },
  { prefix: '62', label: 'Autres services ext. (honoraires, communication, déplacements)', comptes: ['62', '622', '623', '625', '627'] },
  { prefix: '63', label: 'Impôts et taxes', comptes: ['63', '631', '635'] },
  { prefix: '64', label: 'Charges de personnel', comptes: ['64', '641', '645', '648'] },
  { prefix: '65', label: 'Autres charges de gestion courante', comptes: ['65'] },
  { prefix: '86', label: 'Emploi des contributions volontaires en nature', comptes: ['86', '861', '862', '863'] },
];

export const GROUPES_PRODUITS = [
  { prefix: '70', label: 'Ventes de produits et prestations de services', comptes: ['70', '706'] },
  { prefix: '74', label: 'Subventions d\'exploitation', comptes: ['74'] },
  { prefix: '75', label: 'Autres produits (cotisations, dons)', comptes: ['75', '756', '758'] },
  { prefix: '76', label: 'Produits financiers', comptes: ['76'] },
  { prefix: '87', label: 'Contributions volontaires en nature', comptes: ['87', '870', '871', '875'] },
];
