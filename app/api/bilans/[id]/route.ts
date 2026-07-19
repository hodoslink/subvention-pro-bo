import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';
import { PIECES_BILAN } from '@/lib/piecesBilan';

const patchSchema = z.object({
  statut: z.enum(['brouillon', 'valide', 'transmis']).optional(),
  statut_action: z.enum(['realise', 'partiellement_realise', 'non_realise']).optional().nullable(),
  rapport_activite: z.string().max(10000).optional().nullable(),
  commentaires_activite: z.string().max(5000).optional().nullable(),
  bilan_qualitatif: z.string().max(5000).optional().nullable(),
  commentaire_financier: z.string().max(3000).optional().nullable(),
  signe_par: z.string().max(200).optional().nullable(),
  signe_le: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // CERFA 15059 — feuillet 1 structuré
  beneficiaires_par_type: z.array(z.object({
    type: z.string().max(300),
    nombre: z.number().int().min(0).nullable(),
  })).optional().nullable(),
  dates_lieux_realisation: z.array(z.object({
    date_debut: z.string().max(20),
    date_fin: z.string().max(20),
    lieu: z.string().max(300),
  })).optional().nullable(),
  // CERFA 15059 — feuillet 3 (annexe)
  regles_repartition_charges_indirectes: z.string().max(3000).optional().nullable(),
  methode_valorisation_cvn: z.string().max(3000).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const [{ data: bilan }, { data: lignes }, { data: indicateurs }] = await Promise.all([
    supabase.from('bilans').select('*').eq('id', id).single(),
    supabase.from('bilan_lignes').select('*').eq('bilan_id', id).order('sens').order('compte'),
    supabase.from('bilan_indicateurs').select('*').eq('bilan_id', id).order('created_at'),
  ]);

  if (!bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });

  return NextResponse.json({ bilan, lignes: lignes ?? [], indicateurs: indicateurs ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Passage en "valide" (ou au-delà) : exiger les pièces obligatoires du bilan
  if (parsed.data.statut === 'valide' || parsed.data.statut === 'transmis') {
    const { data: current } = await supabase
      .from('bilans')
      .select('statut')
      .eq('id', id)
      .single();
    if (current?.statut === 'brouillon') {
      const { data: toutes } = await supabase
        .from('pieces_requises')
        .select('libelle, obligatoire, statut')
        .eq('bilan_id', id);
      // Checklist jamais initialisée = aucune pièce fournie
      const manquantes = (toutes && toutes.length > 0)
        ? toutes.filter(p => p.obligatoire && p.statut !== 'fourni').map(p => p.libelle)
        : PIECES_BILAN.filter(p => p.obligatoire).map(p => p.libelle);
      if (manquantes.length > 0) {
        return NextResponse.json(
          {
            error: `Pièces obligatoires manquantes : ${manquantes.join(' ; ')}`,
            pieces_manquantes: manquantes,
          },
          { status: 422 }
        );
      }
    }
  }

  const { data, error } = await supabase
    .from('bilans')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bilan: data });
}
