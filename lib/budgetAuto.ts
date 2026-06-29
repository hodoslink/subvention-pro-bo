import type { DetailsJson } from './supabase';

// SMIC brut horaire — À VÉRIFIER chaque 1er janvier et 1er novembre
// Valeur au 1er novembre 2024 : 11,88 €/h
export const SMIC_HORAIRE_BRUT_DEFAUT = 11.88;

export type LigneAutoGeneree = {
  cle_generation: string;
  sens: 'charge' | 'produit';
  compte: string;
  sous_categorie: string;
  quantite?: number;
  prix_unitaire?: number;
  montant: number;
  precisions: string;
  est_valorisation_benevolat: boolean;
};

function parseNum(s: string | number | undefined): number {
  if (s == null || s === '') return NaN;
  return typeof s === 'number' ? s : parseFloat(String(s).replace(',', '.'));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function genererLignesAuto(details: DetailsJson): LigneAutoGeneree[] {
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

  return lignes;
}
