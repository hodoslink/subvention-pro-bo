import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

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

  const { data, error } = await supabase
    .from('bilans')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bilan: data });
}
