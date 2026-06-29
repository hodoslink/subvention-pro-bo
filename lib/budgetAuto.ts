import type { DetailsJson } from './supabase';

// SMIC brut horaire — À VÉRIFIER chaque 1er janvier et 1er novembre
// Valeur au 1er novembre 2024 : 11,88 €/h
export const SMIC_HORAIRE_BRUT_DEFAUT = 11.88;

export type PatternSuggestion = {
  cle: string;
  label: string;
  description: string;
  section_cible: string;
};

export type LigneAutoGeneree = {
  cle_generation: string;
  sens: 'charge' | 'produit';
  compte: string;
  sous_categorie: string;
  bailleur_detail?: string;
  quantite?: number;
  prix_unitaire?: number;
  montant: number;
  precisions: string;
  est_valorisation_benevolat: boolean;
  statut_financement?: string | null;
};

function parseNum(s: string | number | undefined): number {
  if (s == null || s === '') return NaN;
  return typeof s === 'number' ? s : parseFloat(String(s).replace(',', '.'));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function genererLignesAuto(
  details: DetailsJson,
  context?: { montant_demande?: number | null; bailleur_nom?: string | null }
): LigneAutoGeneree[] {
  const lignes: LigneAutoGeneree[] = [];

  // ── 1. Bénévolat ───────────────────────────────────────────────────────────
  const nbBenevoles = parseNum(details.nb_benevoles);
  const heuresSemaine = parseNum(details.heures_benevolat_semaine);
  const tauxHoraire = parseNum(details.taux_horaire_valorisation) || SMIC_HORAIRE_BRUT_DEFAUT;

  if (nbBenevoles > 0 && heuresSemaine > 0 && tauxHoraire > 0) {
    const totalHeures = nbBenevoles * heuresSemaine * 52;
    const montant = round2(totalHeures * tauxHoraire);
    const precisions = `${nbBenevoles} bénévole(s) × ${heuresSemaine} h/sem × 52 sem × ${tauxHoraire} €/h`;
    lignes.push({
      cle_generation: 'auto_benevolat_charge',
      sens: 'charge',
      compte: '86',
      sous_categorie: 'Contributions bénévoles',
      quantite: totalHeures,
      prix_unitaire: tauxHoraire,
      montant,
      precisions,
      est_valorisation_benevolat: true,
    });
    lignes.push({
      cle_generation: 'auto_benevolat_produit',
      sens: 'produit',
      compte: '87',
      sous_categorie: 'Valorisation bénévolat',
      quantite: totalHeures,
      prix_unitaire: tauxHoraire,
      montant,
      precisions,
      est_valorisation_benevolat: true,
    });
  }

  // ── 2. Prestataires / intervenants ─────────────────────────────────────────
  if (details.a_des_prestataires && Array.isArray(details.prestataires)) {
    details.prestataires.forEach((p, i) => {
      if (!p.nom_type) return;
      const nb = parseNum(p.nb_seances_ou_ateliers);
      const tarif = parseNum(p.tarif_unitaire);
      if (isNaN(nb) || isNaN(tarif) || nb <= 0 || tarif <= 0) return;
      lignes.push({
        cle_generation: `auto_prestataire_${i}`,
        sens: 'charge',
        compte: '62',
        sous_categorie: p.nom_type,
        quantite: nb,
        prix_unitaire: tarif,
        montant: round2(nb * tarif),
        precisions: `${nb} séance(s)/atelier(s) × ${tarif} €`,
        est_valorisation_benevolat: false,
      });
    });
  }

  // ── 3. Salariés impliqués ──────────────────────────────────────────────────
  const nbSalaries = parseNum(details.nb_salaries);
  const coutSalarial = parseNum(details.cout_salarial_annuel_estime);
  if (nbSalaries > 0 && coutSalarial > 0) {
    lignes.push({
      cle_generation: 'auto_salaries',
      sens: 'charge',
      compte: '64',
      sous_categorie: 'Charges de personnel',
      montant: coutSalarial,
      precisions: `${nbSalaries} salarié(s) impliqué(s) — coût annuel estimé charges incluses`,
      est_valorisation_benevolat: false,
    });
  }

  // ── 4. Locaux mis à disposition ────────────────────────────────────────────
  if (details.locaux_mis_a_disposition) {
    const valeur = parseNum(details.locaux_valeur_estimee);
    if (valeur > 0) {
      const bailleurPart = details.locaux_bailleur ? ` par ${details.locaux_bailleur}` : '';
      const precisions = `Mise à disposition gratuite de locaux${bailleurPart}`;
      lignes.push({
        cle_generation: 'auto_locaux_charge',
        sens: 'charge',
        compte: '86',
        sous_categorie: 'Mise à disposition de locaux',
        montant: valeur,
        precisions,
        est_valorisation_benevolat: true,
      });
      lignes.push({
        cle_generation: 'auto_locaux_produit',
        sens: 'produit',
        compte: '87',
        sous_categorie: 'Mise à disposition de locaux',
        montant: valeur,
        precisions,
        est_valorisation_benevolat: true,
      });
    }
  }

  // ── 5. Achats / fournitures récurrents ────────────────────────────────────
  if (Array.isArray(details.achats_recurrents)) {
    details.achats_recurrents.forEach((a, i) => {
      if (!a.nom_type) return;
      const qte = parseNum(a.quantite_annuelle);
      const cout = parseNum(a.cout_unitaire);
      if (isNaN(qte) || isNaN(cout) || qte <= 0 || cout <= 0) return;
      lignes.push({
        cle_generation: `auto_achat_${i}`,
        sens: 'charge',
        compte: '60',
        sous_categorie: a.nom_type,
        quantite: qte,
        prix_unitaire: cout,
        montant: round2(qte * cout),
        precisions: `${qte} × ${cout} €`,
        est_valorisation_benevolat: false,
      });
    });
  }

  // ── 6. Location de salle payante ──────────────────────────────────────────
  if (details.location_salle_payante) {
    const montant = parseNum(details.location_salle_cout_annuel);
    if (montant > 0) {
      lignes.push({
        cle_generation: 'auto_location_salle',
        sens: 'charge',
        compte: '61',
        sous_categorie: 'Location de salle',
        montant,
        precisions: details.location_salle_precisions || 'Location de salle — coût annuel',
        est_valorisation_benevolat: false,
      });
    }
  }

  // ── 7. Assurance dédiée ───────────────────────────────────────────────────
  if (details.assurance_dediee) {
    const montant = parseNum(details.assurance_cout_annuel);
    if (montant > 0) {
      lignes.push({
        cle_generation: 'auto_assurance',
        sens: 'charge',
        compte: '61',
        sous_categorie: 'Assurance dédiée au projet',
        montant,
        precisions: 'Assurance dédiée — coût annuel estimé',
        est_valorisation_benevolat: false,
      });
    }
  }

  // ── 8. Déplacements / missions ────────────────────────────────────────────
  if (details.deplacements_estimes) {
    const freqMois = parseNum(details.deplacements_frequence_mensuelle);
    const coutMoyen = parseNum(details.deplacements_cout_moyen);
    if (freqMois > 0 && coutMoyen > 0) {
      const totalTrajets = freqMois * 12;
      lignes.push({
        cle_generation: 'auto_deplacements',
        sens: 'charge',
        compte: '62',
        sous_categorie: 'Déplacements et missions',
        quantite: totalTrajets,
        prix_unitaire: coutMoyen,
        montant: round2(totalTrajets * coutMoyen),
        precisions: `${freqMois} trajet(s)/mois × 12 mois × ${coutMoyen} €`,
        est_valorisation_benevolat: false,
      });
    }
  }

  // ── 9. Cotisations / prestations des bénéficiaires ────────────────────────
  if (details.cotisations_actives) {
    const nbAdherents = parseNum(details.nb_adherents_payants);
    const tarifMoyen = parseNum(details.tarif_moyen_annuel);
    if (nbAdherents > 0 && tarifMoyen > 0) {
      lignes.push({
        cle_generation: 'auto_cotisations',
        sens: 'produit',
        compte: '70',
        sous_categorie: 'Vente de prestations / cotisations',
        quantite: nbAdherents,
        prix_unitaire: tarifMoyen,
        montant: round2(nbAdherents * tarifMoyen),
        precisions: `${nbAdherents} adhérent(s) × ${tarifMoyen} €/an`,
        est_valorisation_benevolat: false,
      });
    }
  }

  // ── 10. Autres bailleurs sollicités ───────────────────────────────────────
  if (Array.isArray(details.autres_bailleurs_sollicites)) {
    details.autres_bailleurs_sollicites.forEach((b, i) => {
      if (!b.nom_bailleur) return;
      const montant = parseNum(b.montant);
      if (isNaN(montant) || montant <= 0) return;
      const statutLabel = b.statut === 'obtenu' ? 'Obtenu' : b.statut === 'demande' ? 'Demandé' : 'Envisagé';
      lignes.push({
        cle_generation: `auto_autre_bailleur_${i}`,
        sens: 'produit',
        compte: '74',
        sous_categorie: `Subvention — ${b.nom_bailleur}`,
        bailleur_detail: b.nom_bailleur,
        montant,
        precisions: `Statut : ${statutLabel}`,
        est_valorisation_benevolat: false,
        statut_financement: b.statut || null,
      });
    });
  }

  // ── 11. Montant demandé à ce bailleur ────────────────────────────────────
  if (context?.montant_demande && context.montant_demande > 0) {
    const nomBailleur = context.bailleur_nom ?? null;
    lignes.push({
      cle_generation: 'auto_montant_demande_bailleur',
      sens: 'produit',
      compte: '74',
      sous_categorie: 'Subvention sollicitée (ce dossier)',
      bailleur_detail: nomBailleur ?? undefined,
      montant: context.montant_demande,
      precisions: nomBailleur ? `Demande en cours — ${nomBailleur}` : 'Demande en cours',
      est_valorisation_benevolat: false,
      statut_financement: 'demande',
    });
  }

  return lignes;
}

export function detecterPatternsInactifs(details: DetailsJson): PatternSuggestion[] {
  const suggestions: PatternSuggestion[] = [];

  if (!details.a_des_prestataires || !details.prestataires?.some(p => p.nom_type)) {
    suggestions.push({
      cle: 'a_des_prestataires',
      label: 'Prestataires / intervenants rémunérés',
      description: 'Avez-vous des prestataires ou intervenants rémunérés liés à ce projet ?',
      section_cible: 'Prestataires et moyens matériels',
    });
  }

  if (!details.achats_recurrents?.some(a => a.nom_type)) {
    suggestions.push({
      cle: 'achats_recurrents',
      label: 'Achats et fournitures récurrents',
      description: 'Y a-t-il des achats ou fournitures récurrents liés à ce projet ?',
      section_cible: 'Charges et recettes additionnelles',
    });
  }

  if (!details.location_salle_payante) {
    suggestions.push({
      cle: 'location_salle_payante',
      label: 'Location de salle que vous payez',
      description: 'Avez-vous un loyer pour un local ou une salle lié à ce projet ?',
      section_cible: 'Prestataires et moyens matériels',
    });
  }

  if (!details.assurance_dediee) {
    suggestions.push({
      cle: 'assurance_dediee',
      label: 'Assurance dédiée',
      description: "Le projet dispose-t-il d'une assurance spécifique ?",
      section_cible: 'Charges et recettes additionnelles',
    });
  }

  if (!details.deplacements_estimes) {
    suggestions.push({
      cle: 'deplacements_estimes',
      label: 'Déplacements et missions',
      description: 'Y a-t-il des frais de déplacement liés à ce projet ?',
      section_cible: 'Charges et recettes additionnelles',
    });
  }

  if (!details.cotisations_actives) {
    suggestions.push({
      cle: 'cotisations_actives',
      label: 'Cotisations / prestations des bénéficiaires',
      description: 'Les bénéficiaires paient-ils des cotisations ou participations ?',
      section_cible: 'Charges et recettes additionnelles',
    });
  }

  return suggestions;
}

export function calculerEcartAEquilibrer(totalProduits: number, totalCharges: number): number {
  return Math.round((totalProduits - totalCharges) * 100) / 100;
}
