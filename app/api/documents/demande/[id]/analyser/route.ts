import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { downloadFile, isAnalysable, isExcel } from '@/lib/storage';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

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
- Communication, impression, flyers, kakémonos → 623
- Déplacements, missions, transport → 625
- Abonnements logiciels, frais bancaires → 627
- Denrées alimentaires pour ateliers → 602
- Fournitures bureau, matériel pédagogique → 606
- Location de salle → 613
- Assurance → 616
- Salaires chargés → 641
- Bénévolat valorisé (charge) → 863  [toujours symétrique avec 870 en produit]
- Participations adhérents aux ateliers → 706
- Cotisations annuelles des membres → 756
- Subventions publiques → 74
- Bénévolat valorisé (produit) → 870  [montant = montant de 863]
- Locaux mis à disposition (produit) → 875

Pour statut_financement des lignes produit : "obtenu" si déjà accordé,
"demande" si en cours de demande, "envisage" si seulement envisagé.`;

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
      return NextResponse.json({ champs, document_id: id, demande_id: doc.demande_id });
    } catch (e) {
      return NextResponse.json(
        { error: `Erreur lecture Excel : ${e instanceof Error ? e.message : 'format inattendu'}` },
        { status: 422 }
      );
    }
  }

  // ── PDF ou image : envoi direct à Claude ────────────────────────────────
  const base64 = buffer.toString('base64');
  const isPdf = mimeType === 'application/pdf' || doc.mime_type === 'application/pdf';

  const contentBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: (doc.mime_type || mimeType) as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } };

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

    return NextResponse.json({ champs, document_id: id, demande_id: doc.demande_id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur IA' },
      { status: 500 }
    );
  }
}
