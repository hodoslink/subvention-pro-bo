import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { downloadFile, isAnalysable, isExcel } from '@/lib/storage';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';

const client = new Anthropic();

const PROMPT = `Tu analyses un document relatif à une demande de subvention associative française.

Retourne UNIQUEMENT un JSON valide (pas de markdown, pas de texte autour).
Omet les clés pour lesquelles tu n'as aucune information dans le document.

{
  "titre_projet": "intitulé exact du projet tel qu'écrit dans le document",
  "objectif_projet": "objectif général du projet (3-5 phrases)",
  "public_beneficiaire": "description du public cible",
  "nb_beneficiaires_estime": 150,
  "montant_demande": 6500,
  "bailleur_nom": "nom du financeur sollicité (ex: ARS Île-de-France, Ville de Paris)",
  "bailleur_type": "un parmi : etat | commune | epci | departement | region | etablissement_public | prive | autre",
  "periode_debut": "YYYY-MM-DD",
  "periode_fin": "YYYY-MM-DD",
  "date_depot": "YYYY-MM-DD — date de dépôt du dossier si mentionnée",
  "type_demande": "premiere ou renouvellement selon le document",
  "plateforme_identifiant_dossier": "numéro de dossier ou de convention (ex: 202510026, 00023934)",
  "bilan_subvention_anterieure": 6500,
  "bilan_nb_beneficiaires_reel": 130,
  "bilan_activites": "résumé du bilan N-1 si mentionné (3-5 phrases)",
  "details_json": {
    "thematique": "thématique principale",
    "description_besoins": "contexte et besoins identifiés sur le territoire (3-5 phrases)",
    "description_actions": "description complète des actions mises en œuvre (4-6 phrases)",
    "partenariats": "partenaires mentionnés et nature des partenariats",
    "beneficiaires_profil": "profil sociologique détaillé du public",
    "beneficiaires_age": "tranches d'âge si mentionnées",
    "beneficiaires_sexe": "répartition par genre si mentionnée",
    "localisation_qpv": "quartiers prioritaires ou zones géographiques ciblés",
    "nb_benevoles": "nombre de bénévoles mobilisés",
    "nb_salaries": "nombre de salariés affectés au projet",
    "moyens_description": "description des moyens humains, matériels et numériques",
    "indicateurs_evaluation": "liste des indicateurs de résultat ou d'impact définis dans le document"
  },
  "budget_lignes": [
    {
      "sens": "charge",
      "compte": "622",
      "sous_categorie": "Psychologue — groupes de parole",
      "montant": 4800,
      "precisions": "40 séances × 120€"
    },
    {
      "sens": "produit",
      "compte": "74",
      "sous_categorie": "Subvention ARS",
      "bailleur_detail": "ARS Île-de-France",
      "montant": 6500,
      "statut_financement": "demande"
    }
  ]
}

Règles d'affectation comptable :
- Honoraires intervenants externes (psychologue, diét, APA, sophrologue...) → 622
- "Rémunérations intermédiaires et honoraires" → 622
- Communication, impression, flyers, kakémonos, "Publicité, publication" → 623
- Déplacements, missions, transport → 625
- Abonnements logiciels, frais bancaires, "Services bancaires, autres" → 627
- Denrées alimentaires pour ateliers, "Achats matières et fournitures" → 602
- Fournitures bureau, matériel pédagogique, "Autres fournitures" → 606
- "Prestation de services" (en charge) → 601
- Location de salle, "Locations" → 613
- Assurance → 616
- "Documentation" → 618
- Salaires chargés, "Rémunération des personnels" → 641
- "Autres charges de gestion courante" → 65
- Bénévolat valorisé charge : "Personnel bénévole" → 864 si le document
  utilise 864, sinon 863  [toujours symétrique avec 870 en produit]
- "Mise à disposition gratuite de biens et services" (charge) → 861
- Participations adhérents, "Vente de produits finis, prestations de services" → 706
- Cotisations annuelles des membres → 756
- "Dons manuels - Mécénat" → 758
- Subventions publiques → 74 (une ligne PAR financeur nommé, avec bailleur_detail)
- Bénévolat valorisé produit : "Bénévolat" → 870
- "Prestations en nature" (produit) → 871
- "Dons en nature" / locaux mis à disposition (produit) → 875

Règles spécifiques aux formats de documents :

1. CONFIRMATION DE DÉPÔT DE PLATEFORME MUNICIPALE (structure en blocs
   label/valeur : "Demande n°", "Date de la demande", "Montant demandé"...) :
   - "Demande n°" ou numéro en titre → plateforme_identifiant_dossier
   - "Date de la demande" → date_depot
   - "Votre demande : Renouvellement demande" → type_demande = "renouvellement"
   - Le bailleur est la COMMUNE qui gère la plateforme (souvent identifiable
     par la ligne "Commune(s) :" dans le budget, ex "Ville de Noisy-le-Grand")
     → bailleur_type = "commune"
   - Le montant demandé à CE bailleur est dans le champ "Montant demandé"
     (pas le total du budget)
   - Le "Compte rendu des activités de l'association sur l'année écoulée"
     alimente bilan_activites (résumé) et details_json.description_actions
   - "Décrire les projets à moyen terme" → objectif_projet
   - Les tableaux "BP (>1000 ou projet)" = budget PRÉVISIONNEL à extraire
     dans budget_lignes. Le tableau "CE (>1000 ou projet)" = compte
     d'exploitation N-1, à résumer dans bilan_activites, PAS dans budget_lignes.
   - Dans ces tableaux, chaque sous-ligne nommée (ex "Achats matières et
     fournitures 850,00 €") devient une budget_ligne distincte avec le compte
     déduit du libellé. IGNORE les lignes de total de section (ex "60 – Achats
     et variations de stocks 2370,00" est un sous-total : n'extrais que ses
     sous-lignes détaillées).

2. CERFA 12156 (FORMULAIRE UNIQUE, sections numérotées 1-7) :
   - "Ce formulaire a été produit suite à la saisie... sous le n° XX-XXXXXX"
     → plateforme_identifiant_dossier
   - Section "Cocher la ou les cases" : "première demande" cochée →
     type_demande = "premiere" ; "renouvellement (ou poursuite)" cochée →
     type_demande = "renouvellement"
   - "À envoyer à l'une ou plusieurs des autorités administratives suivantes"
     → bailleur_nom (ex: "Service départemental - Seine-Saint-Denis (SDJES)")
     avec le "Nom du dispositif" en complément (ex: "FDVA 2")
     → bailleur_type = "etat" pour État-Ministère/SDJES/DDVA, sinon adapter
   - Section 6 "Projet – Objet de la demande" : "Intitulé" → titre_projet,
     "Objectifs" → objectif_projet, "Description" → details_json.description_actions
   - "Date ou période de réalisation : du (le) X au Y" → periode_debut, periode_fin
   - Section 6 "Budget du projet" : tableau normalisé comptes 60-87. Chaque
     sous-ligne nommée avec un montant > 0 devient une budget_ligne. Les
     lignes de niveau compte (60, 61, 62...) sont des sous-totaux : n'extrais
     que leurs sous-lignes détaillées, SAUF si le compte n'a pas de sous-ligne
     détaillée (dans ce cas prends la ligne de compte elle-même).
   - Les subventions listées par financeur dans la colonne PRODUITS deviennent
     chacune une ligne 74 avec bailleur_detail (ex: "ANCT Contrats de ville",
     "ARS IDF", "Villes de Clichy-sous-Bois, Noisy-le-Grand...")
   - Le financeur destinataire du Cerfa a statut_financement = "demande" ;
     les autres financeurs listés = "demande" aussi sauf mention "obtenu"/"accordé"
   - Tableau "indicateurs proposés au regard des objectifs" : chaque ligne
     (rang, indicateur, prévu min/max) alimente details_json.indicateurs_evaluation
     au format "Indicateur (cible : min–max)" — une ligne par indicateur
   - Section 7 "Attestations" : "Fait, le X à Y" → date_depot si absente ailleurs,
     et "demander une subvention de : X €" → montant_demande (c'est LE montant
     demandé à ce bailleur précis, pas le total du budget)

3. RÈGLE GÉNÉRALE MULTI-FINANCEURS :
   Le même projet est souvent déposé auprès de plusieurs bailleurs avec des
   budgets de périmètre différent. montant_demande = le montant demandé au
   bailleur destinataire DU DOCUMENT ANALYSÉ, jamais le total du budget ni la
   somme des subventions.

Pour statut_financement des lignes produit : "obtenu" si déjà accordé,
"demande" si en cours de demande, "envisage" si seulement envisagé.`;

// Limites de l'API Anthropic pour les PDF
const MAX_PDF_BYTES = 25 * 1024 * 1024;  // marge sous les 32 Mo (le base64 gonfle de 33%)
const MAX_PDF_PAGES = 90;                // marge sous les 100 pages

/**
 * Découpe un PDF en tronçons respectant les limites de l'API.
 * Retourne un tableau de buffers (1 seul élément si le PDF passe tel quel).
 */
async function decouperPdf(buffer: Buffer): Promise<Buffer[]> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();

  // Cas simple : le PDF passe en une requête
  if (buffer.length <= MAX_PDF_BYTES && totalPages <= MAX_PDF_PAGES) {
    return [buffer];
  }

  // Découpage par tranches de pages
  const tranches: Buffer[] = [];
  // Estime le nombre de pages par tranche pour rester sous les deux limites
  const bytesParPage = buffer.length / totalPages;
  const pagesParTranche = Math.min(
    MAX_PDF_PAGES,
    Math.max(1, Math.floor(MAX_PDF_BYTES / bytesParPage))
  );

  for (let debut = 0; debut < totalPages; debut += pagesParTranche) {
    const fin = Math.min(debut + pagesParTranche, totalPages);
    const tranche = await PDFDocument.create();
    const pages = await tranche.copyPages(
      doc,
      Array.from({ length: fin - debut }, (_, i) => debut + i)
    );
    pages.forEach(p => tranche.addPage(p));
    const bytes = await tranche.save();
    tranches.push(Buffer.from(bytes));
  }
  return tranches;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fusionne les JSON extraits de plusieurs tronçons d'un même document.
 * Stratégie : premier tronçon = base ; les suivants ne remplissent que les
 * clés absentes/vides et CONCATÈNENT les budget_lignes (dédupliquées par
 * sens+compte+sous_categorie).
 */
function fusionnerExtractions(parts: any[]): any {
  if (parts.length === 1) return parts[0];
  const result: any = {};

  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (value === null || value === undefined || value === '') continue;
      if (key === 'budget_lignes' && Array.isArray(value)) {
        const existing: any[] = result.budget_lignes ?? [];
        const cleLigne = (l: any) => `${l.sens}|${l.compte}|${l.sous_categorie ?? ''}`;
        const dejaVues = new Set(existing.map(cleLigne));
        for (const ligne of value) {
          if (!dejaVues.has(cleLigne(ligne))) {
            existing.push(ligne);
            dejaVues.add(cleLigne(ligne));
          }
        }
        result.budget_lignes = existing;
      } else if (key === 'details_json' && typeof value === 'object') {
        result.details_json = { ...(value as object), ...(result.details_json ?? {}) };
        // note : l'existant (tronçons précédents) garde la priorité
      } else if (!(key in result)) {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Validation de cohérence non bloquante : annote des avertissements
 * sans empêcher l'application des champs.
 */
function validerCoherence(champs: any): string[] {
  const avertissements: string[] = [];

  if (champs.budget_lignes?.length) {
    const lignes = champs.budget_lignes as Array<{ sens: string; compte: string; montant: number }>;
    const t86 = lignes.filter(l => l.compte?.startsWith('86')).reduce((s, l) => s + (l.montant || 0), 0);
    const t87 = lignes.filter(l => l.compte?.startsWith('87')).reduce((s, l) => s + (l.montant || 0), 0);
    if (Math.abs(t86 - t87) > 0.01 && (t86 > 0 || t87 > 0)) {
      avertissements.push(
        `Valorisations non symétriques dans le document : 86x = ${t86}€, 87x = ${t87}€. Vérifiez avant d'appliquer.`
      );
    }

    const totalCharges = lignes.filter(l => l.sens === 'charge').reduce((s, l) => s + (l.montant || 0), 0);
    const totalProduits = lignes.filter(l => l.sens === 'produit').reduce((s, l) => s + (l.montant || 0), 0);
    if (totalCharges > 0 && totalProduits > 0 && Math.abs(totalCharges - totalProduits) / totalCharges > 0.05) {
      avertissements.push(
        `Budget extrait déséquilibré : charges ${totalCharges}€ / produits ${totalProduits}€. L'extraction a peut-être manqué des lignes.`
      );
    }

    if (champs.montant_demande && totalProduits > 0 && champs.montant_demande > totalProduits) {
      avertissements.push(
        `montant_demande (${champs.montant_demande}€) supérieur au total des produits — vérifiez que ce n'est pas le budget total qui a été extrait comme montant demandé.`
      );
    }
  }

  return avertissements;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: doc, error } = await supabase
    .from('documents_demande')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
  if (!isAnalysable(doc.mime_type)) {
    return NextResponse.json(
      { error: 'Format non pris en charge (PDF, Excel, JPEG, PNG, WebP uniquement)' },
      { status: 422 }
    );
  }
  if (!doc.storage_path) return NextResponse.json({ error: 'Fichier manquant' }, { status: 404 });

  let buffer: Buffer;
  let mimeType: string;
  try {
    ({ buffer, mimeType } = await downloadFile(doc.storage_path));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Téléchargement impossible' }, { status: 500 });
  }

  // ── Fichier Excel : extraction déterministe ──────────────────────────────
  if (isExcel(mimeType) || isExcel(doc.mime_type)) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const sheetsText = workbook.SheetNames.map(name => {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        return `=== Feuille : ${name} ===\n${csv}`;
      }).join('\n\n');

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Voici le contenu d'un fichier Excel relatif à une demande de subvention.\n\n${sheetsText}\n\n${PROMPT}`,
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });
      }
      const champs = JSON.parse(jsonMatch[0]);
      const avertissements = validerCoherence(champs);
      return NextResponse.json({ champs, avertissements, document_id: id, demande_id: doc.demande_id });
    } catch (e) {
      return NextResponse.json(
        { error: `Erreur lecture Excel : ${e instanceof Error ? e.message : 'format inattendu'}` },
        { status: 422 }
      );
    }
  }

  const isPdf = mimeType === 'application/pdf' || doc.mime_type === 'application/pdf';

  // ── PDF : découpage en tronçons si nécessaire, puis fusion ───────────────
  if (isPdf) {
    try {
      const tranches = await decouperPdf(buffer);
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const extractions: any[] = [];

      for (const [i, tranche] of tranches.entries()) {
        const base64Tranche = tranche.toString('base64');
        const suffixe = tranches.length > 1
          ? `\n\nNOTE : ceci est la partie ${i + 1}/${tranches.length} d'un document découpé. Extrais tout ce qui est présent dans cette partie.`
          : '';

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Tranche } },
              { type: 'text', text: PROMPT + suffixe },
            ],
          }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { extractions.push(JSON.parse(jsonMatch[0])); } catch { /* tronçon illisible, skip */ }
        }
      }

      if (extractions.length === 0) {
        return NextResponse.json({ error: 'Aucune donnée extraite du document' }, { status: 500 });
      }

      const champs = fusionnerExtractions(extractions);
      const avertissements = validerCoherence(champs);
      return NextResponse.json({ champs, avertissements, document_id: id, demande_id: doc.demande_id });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Erreur IA' },
        { status: 500 }
      );
    }
  }

  // ── Image : envoi direct à Claude (une image ne se découpe pas) ──────────
  const base64 = buffer.toString('base64');
  const contentBlock = {
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: (doc.mime_type || mimeType) as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 },
  };

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [contentBlock, { type: 'text', text: PROMPT }],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });
    const champs = JSON.parse(jsonMatch[0]);
    const avertissements = validerCoherence(champs);

    return NextResponse.json({ champs, avertissements, document_id: id, demande_id: doc.demande_id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur IA' },
      { status: 500 }
    );
  }
}
