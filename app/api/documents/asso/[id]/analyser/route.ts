import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { downloadFile, isAnalysable } from '@/lib/storage';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const PROMPT = `Tu analyses un document officiel d'une association française (statuts, comptes annuels, PV d'AG, rapport d'activité, RIB, etc.).

Extrais tous les champs que tu peux identifier avec certitude et renvoie UNIQUEMENT un JSON valide avec les champs suivants (omet ceux pour lesquels tu n'as pas d'information suffisante) :

{
  "nom": "Nom exact de l'association tel qu'il figure dans le document",
  "siret": "14 chiffres sans espace",
  "siren": "9 chiffres",
  "rna": "W suivi de chiffres",
  "adresse": "adresse postale complète",
  "code_postal": "5 chiffres",
  "ville": "nom de la ville",
  "forme_juridique": "ex: Association loi 1901",
  "nb_membres": 45,
  "date_creation": "YYYY-MM-DD ou YYYY",
  "objet_social": "objet social tel que défini dans les statuts (1-3 phrases)"
}

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaire.`;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: doc, error } = await supabase
    .from('documents_association')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
  if (!isAnalysable(doc.mime_type)) {
    return NextResponse.json({ error: 'Format non pris en charge pour l\'analyse (PDF, JPEG, PNG, WebP uniquement)' }, { status: 422 });
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
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [contentBlock, { type: 'text', text: PROMPT }],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });
    const champs = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ champs, document_id: id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur IA' }, { status: 500 });
  }
}
