import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const patchSchema = z.object({
  sens: z.enum(['charge', 'produit']).optional(),
  compte: z.string().min(2).max(4).optional(),
  libelle_compte: z.string().max(200).optional().nullable(),
  sous_categorie: z.string().max(500).optional().nullable(),
  bailleur_detail: z.string().max(300).optional().nullable(),
  quantite: z.number().positive().optional().nullable(),
  prix_unitaire: z.number().positive().optional().nullable(),
  montant: z.number().min(0).optional(),
  est_charge_commune: z.boolean().optional(),
  cle_repartition: z.string().max(500).optional().nullable(),
  est_valorisation_benevolat: z.boolean().optional(),
  precisions: z.string().max(2000).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('budget_lignes')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ligne: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('budget_lignes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
