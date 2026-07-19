// Pièces à joindre au compte-rendu financier d'une subvention (CERFA 15059) :
// le compte-rendu doit être accompagné du dernier rapport annuel d'activité
// et des comptes approuvés du dernier exercice clos.
export const PIECES_BILAN = [
  { type_piece: 'rapport_activite_exercice', libelle: "Rapport d'activité de l'exercice concerné par le bilan", obligatoire: true },
  { type_piece: 'comptes_approuves_exercice', libelle: "Comptes approuvés de l'exercice clos (bilan + compte de résultat)", obligatoire: true },
  { type_piece: 'justificatifs_depenses', libelle: "Justificatifs de dépenses significatives (factures, etc.)", obligatoire: false },
];
