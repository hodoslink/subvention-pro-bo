import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const patchSchema = z.object({
  montant_reel: z.number().min(0).max(10_000_000).optional().nullable(),
  commentaire_ecart: z.string().max(1000).optional().nullable(),
});

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
    .from('bilan_lignes')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Propagation du montant réel : un même bailleur (demande liée) n'a qu'un
  // seul montant réel — la dernière valeur saisie fait foi dans tous les
  // bilans qui partagent cette demande liée. Ne touche jamais budget_lignes.
  if (data.demande_liee_id && parsed.data.montant_reel !== undefined) {
    await supabase
      .from('bilan_lignes')
      .update({ montant_reel: parsed.data.montant_reel })
      .eq('demande_liee_id', data.demande_liee_id)
      .neq('id', data.id);
  }

  return NextResponse.json({ ligne: data });
}
