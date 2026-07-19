// Utilitaires partagés de ventilation CVN (contributions volontaires en
// nature — comptes 86 en charges / 87 en produits), utilisés par le budget
// prévisionnel et le module bilan pour garantir une logique unique.

export const isCVN = (compte: string) => compte.startsWith('86') || compte.startsWith('87');

type LigneMontant = { sens: 'charge' | 'produit'; compte: string };

/**
 * Ventile un ensemble de lignes budgétaires en totaux hors CVN / dont CVN.
 * `montantDe` permet d'utiliser la même fonction sur budget_lignes (montant)
 * et bilan_lignes (montant_prevu ou montant_reel).
 */
export function ventilerCVN<L extends LigneMontant>(
  lignes: L[],
  montantDe: (l: L) => number,
) {
  const somme = (rows: L[]) => rows.reduce((s, l) => s + (montantDe(l) || 0), 0);
  const charges = lignes.filter(l => l.sens === 'charge');
  const produits = lignes.filter(l => l.sens === 'produit');
  return {
    chargesHorsCVN: somme(charges.filter(l => !isCVN(l.compte))),
    chargesCVN: somme(charges.filter(l => isCVN(l.compte))),
    produitsHorsCVN: somme(produits.filter(l => !isCVN(l.compte))),
    produitsCVN: somme(produits.filter(l => isCVN(l.compte))),
    totalCharges: somme(charges),
    totalProduits: somme(produits),
  };
}
