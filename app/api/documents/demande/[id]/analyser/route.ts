import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { downloadFile, isAnalysable } from '@/lib/storage';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const PROMPT = `Tu analyses un document relatif à une demande de subvention associative française (dossier N-1, formulaire bailleur, budget, devis, rapport d'activité, etc.).

Extrais tous les champs que tu peux identifier avec certitude et renvoie UNIQUEMENT un JSON valide avec les champs suivants (omet ceux pour lesquels tu n'as pas d'information) :

{
  "titre_projet": "intitulé exact du projet ou de l'action subventionnée",
  "objectif_projet": "objectif général du projet (2-4 phrases)",
  "public_beneficiaire": "description du public cible",
  "nb_beneficiaires_estime": 150,
  "montant_demande": 8000,
  "bailleur_nom": "nom exact du financeur sollicité",
  "bailleur_type": "ville ou departement",
  "periode_debut": "YYYY-MM",
  "periode_fin": "YYYY-MM",
  "bilan_subvention_anterieure": 7500,
  "bilan_nb_beneficiaires_reel": 142,
  "bilan_activites": "résumé du bilan des activités de l'année précédente (3-5 phrases)",
  "details_json": {
    "thematique": "ex: Insertion, Culture, Sport, Éducation",
    "description_besoins": "diagnostic des besoins identifiés sur le territoire (2-4 phrases)",
    "description_actions": "description des actions mises en œuvre (3-5 phrases)",
    "partenariats": "partenaires mobilisés et nature des partenariats",
    "beneficiaires_profil": "profil sociologique du public",
    "beneficiaires_age": "tranches d'âge du public",
    "beneficiaires_sexe": "répartition par genre si mentionnée",
    "localisation_qpv": "quartiers prioritaires ou zones géographiques ciblés",
    "nb_benevoles": "nombre de bénévoles impliqués",
    "nb_salaries": "nombre de salariés mobilisés",
    "moyens_description": "description des moyens humains et matériels",
    "indicateurs_evaluation": "indicateurs de résultat ou d'impact définis"
  },
  "budget_lignes": [
    { "sens": "charge", "compte": "64", "sous_categorie": "Salaires et charges sociales", "montant": 5000, "precisions": "détail si mentionné" },
    { "sens": "produit", "compte": "74", "sous_categorie": "Subvention Commune", "bailleur_detail": "Commune de X", "montant": 3000 }
  ]
}

Pour les comptes : charges → 60 (achats), 61 (services ext.), 62 (honoraires/déplacements), 63 (impôts), 64 (personnel), 65 (autres charges), 86 (bénévolat valorisé) ; produits → 70 (ventes), 73 (dotations), 74 (subventions), 75 (cotisations/dons), 87 (bénévolat produit).

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaire.`;

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
    return NextResponse.json({ error: 'Format non pris en charge (PDF, JPEG, PNG, WebP uniquement)' }, { status: 422 });
  }
  if (!doc.storage_path) return NextResponse.json({ error: 'Fichier manquant' }, { status: 404 });

  let buffer: Buffer;
  let mimeType: string;
  try {
    ({ buffer, mimeType } = await downloadFile(doc.storage_path));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Téléchargement impossible' }, { status: 500 });
  }

  const base64 = buffer.toString('base64');
  const isPdf = mimeType === 'application/pdf' || doc.mime_type === 'application/pdf';

  const contentBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: (doc.mime_type || mimeType) as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } };

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
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
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur IA' }, { status: 500 });
  }
}
