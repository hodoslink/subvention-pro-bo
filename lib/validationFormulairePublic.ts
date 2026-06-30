import { z } from "zod";
import { sanitizeText } from "./sanitize";

// Valide une "string numérique" : vide OK, sinon nombre positif (accepte la
// virgule décimale française). Le format string est conservé en sortie pour
// rester compatible avec DetailsJson (qui stocke tout en string).
const numStr = z
  .string()
  .optional()
  .transform(v => (v ? v.replace(",", ".") : v))
  .refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), {
    message: "Doit être un nombre positif (ou vide).",
  })
  .transform(v => (v ? v.replace(".", ",") : v)); // restore comma for storage

// Texte libre nettoyé (XSS + contrôle)
const safeText = (max: number) =>
  z.string().max(max).transform(sanitizeText).optional();

const statut = z.enum(["obtenu", "demande", "envisage"]);

export const formulairePublicSchema = z.object({
  // 1. Équipe
  nb_benevoles:               numStr,
  heures_benevolat_semaine:   numStr,
  taux_horaire_valorisation:  numStr,
  nb_salaries:                numStr,
  cout_salarial_annuel_estime: numStr,

  // 2. Prestataires
  a_des_prestataires: z.boolean().optional(),
  prestataires: z
    .array(
      z.object({
        nom_type:               safeText(200),
        nb_seances_ou_ateliers: numStr,
        tarif_unitaire:         numStr,
      })
    )
    .max(10)
    .optional(),

  // 3. Locaux + achats
  locaux_mis_a_disposition: z.boolean().optional(),
  locaux_bailleur:           safeText(200),
  locaux_valeur_estimee:     numStr,
  achats_recurrents: z
    .array(
      z.object({
        nom_type:          safeText(200),
        quantite_annuelle: numStr,
        cout_unitaire:     numStr,
      })
    )
    .max(15)
    .optional(),
  location_salle_payante:      z.boolean().optional(),
  location_salle_cout_annuel:  numStr,
  location_salle_precisions:   safeText(500),

  // 4. Assurance + déplacements
  assurance_dediee:                z.boolean().optional(),
  assurance_cout_annuel:           numStr,
  deplacements_estimes:            z.boolean().optional(),
  deplacements_frequence_mensuelle: numStr,
  deplacements_cout_moyen:         numStr,

  // 5. Cotisations
  cotisations_actives:   z.boolean().optional(),
  nb_adherents_payants:  numStr,
  tarif_moyen_annuel:    numStr,

  // 6. Autres bailleurs
  autres_bailleurs_sollicites: z
    .array(
      z.object({
        nom_bailleur: safeText(200),
        montant:      numStr,
        statut:       statut,
      })
    )
    .max(10)
    .optional(),
});

export type FormulairePublicData = z.infer<typeof formulairePublicSchema>;

export function validerReponsesFormulairePublic(
  body: unknown
): { success: true; data: FormulairePublicData } | { success: false; error: string } {
  const result = formulairePublicSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.join(".") || "";
    const msg = issue?.message || "Données invalides";
    return { success: false, error: field ? `${field} : ${msg}` : msg };
  }
  return { success: true, data: result.data };
}
