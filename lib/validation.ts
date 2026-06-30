import { z } from "zod";
import { sanitizeText } from "./sanitize";

// Schéma de base pour un champ texte court (noms, titres, villes…)
function shortText(max: number, opts: { optional?: boolean } = {}) {
  if (opts.optional) {
    return z
      .string()
      .max(max, `Ce champ doit faire moins de ${max} caractères.`)
      .transform(sanitizeText)
      .optional()
      .or(z.literal(""));
  }
  return z
    .string()
    .min(1, "Ce champ est requis.")
    .max(max, `Ce champ doit faire moins de ${max} caractères.`)
    .transform(sanitizeText);
}

// Schéma pour un champ texte long (description de projet…)
function longText(max: number, opts: { optional?: boolean } = {}) {
  if (opts.optional) {
    return z
      .string()
      .max(max, `Ce champ doit faire moins de ${max} caractères.`)
      .transform(sanitizeText)
      .optional()
      .or(z.literal(""));
  }
  return z
    .string()
    .min(1, "Ce champ est requis.")
    .max(max, `Ce champ doit faire moins de ${max} caractères.`)
    .transform(sanitizeText);
}

// =====================================================================
// SIRET / SIREN / RNA — formats officiels stricts
// =====================================================================
const siretSchema = z
  .string()
  .regex(/^\d{14}$/, "Le SIRET doit comporter 14 chiffres.")
  .optional()
  .or(z.literal(""));

const sirenSchema = z
  .string()
  .regex(/^\d{9}$/, "Le SIREN doit comporter 9 chiffres.")
  .optional()
  .or(z.literal(""));

const rnaSchema = z
  .string()
  .regex(/^W\d{9}$/i, "Le numéro RNA doit être au format Wxxxxxxxxx.")
  .optional()
  .or(z.literal(""));

const codePostalSchema = z
  .string()
  .regex(/^\d{5}$/, "Le code postal doit comporter 5 chiffres.")
  .optional()
  .or(z.literal(""));

const telephoneSchema = z
  .string()
  .regex(/^[\d\s+().-]{0,20}$/, "Numéro de téléphone invalide.")
  .optional()
  .or(z.literal(""));

// =====================================================================
// ASSOCIATIONS
// =====================================================================
export const associationSchema = z.object({
  nom: shortText(200),
  siret: siretSchema,
  siren: sirenSchema,
  rna: rnaSchema,
  adresse: shortText(300, { optional: true }),
  code_postal: codePostalSchema,
  ville: shortText(100, { optional: true }),
  forme_juridique: shortText(150, { optional: true }),
  contact_nom: shortText(150),
  contact_role: shortText(100, { optional: true }),
  contact_email: z
    .string()
    .max(255)
    .email("Adresse email invalide."),
  contact_telephone: telephoneSchema,
  nb_membres: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  date_creation: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable()
    .transform((val) => {
      if (!val) return val;
      // Tronque un éventuel timestamp ISO complet à la date seule.
      const match = val.match(/^\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : val;
    })
    .refine(
      (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
      "Date invalide."
    ),
});

export type AssociationInput = z.infer<typeof associationSchema>;

// =====================================================================
// DEMANDES
// =====================================================================
const MONTANT_MAX = 1_000_000; // garde-fou large mais raisonnable pour ce segment

const BAILLEUR_TYPE_VALUES = ["etat", "commune", "epci", "departement", "region", "etablissement_public", "prive", "autre"] as const;

export const demandeSchema = z.object({
  association_id: z.string().uuid("Identifiant d'association invalide."),
  type_demande: z.enum(["premiere", "renouvellement"], {
    message: "Type de demande invalide.",
  }).default("premiere"),
  bilan_subvention_anterieure: z
    .number()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  bilan_activites: longText(3000, { optional: true }),
  bilan_nb_beneficiaires_reel: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  bailleur_type: z.enum(BAILLEUR_TYPE_VALUES, {
    message: "Type de bailleur invalide.",
  }).optional().nullable(),
  bailleur_id: z.string().uuid("Identifiant de bailleur invalide.").optional().nullable(),
  bailleur_nom: shortText(200, { optional: true }),
  montant_demande: z
    .number()
    .min(0, "Le montant doit être positif.")
    .max(MONTANT_MAX, "Montant trop élevé pour ce formulaire.")
    .nullable()
    .optional(),
  titre_projet: shortText(200, { optional: true }),
  objectif_projet: longText(3000, { optional: true }),
  public_beneficiaire: shortText(300, { optional: true }),
  nb_beneficiaires_estime: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  periode_debut: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
    .nullable()
    .optional()
    .or(z.literal("")),
  periode_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
    .nullable()
    .optional()
    .or(z.literal("")),
  budget_previsionnel_json: z
    .array(
      z.object({
        poste: z.string().max(200).transform(sanitizeText),
        montant: z.union([z.string().max(20), z.number()]).optional(),
      })
    )
    .max(50, "Trop de lignes de budget (50 maximum).")
    .optional(),
  annee_millesime: z.number().int().min(1900).max(2100).nullable().optional(),
  pluriannuel_nb_annees: z.number().int().min(2).max(4).nullable().optional(),
});

export type DemandeInput = z.infer<typeof demandeSchema>;
