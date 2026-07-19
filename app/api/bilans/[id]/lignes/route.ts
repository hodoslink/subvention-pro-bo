import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

// Ajout d'une ligne réelle imprévue (non budgétée à l'origine) à un bilan.
// budget_ligne_id reste null et montant_prevu = 0 : l'écart de 100 % est
// normal et attendu pour ces lignes.
const createSchema = z.object({
  sens: z.enum(['charge', 'produit']),
  compte: z.string().min(2).max(10),
  sous_categorie: z.string().max(200).optional().nullable(),
  bailleur_detail: z.string().max(200).optional().nullable(),
  montant_reel: z.number().min(0).max(10_000_000),
  est_charge_commune: z.boolean().optional().default(false),
  cle_repartition: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: bilan, error: bilanErr } = await supabase
    .from('bilans')
    .select('id, statut')
    .eq('id', id)
    .single();
  if (bilanErr || !bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });
  if (bilan.statut === 'transmis') {
    return NextResponse.json({ error: 'Bilan transmis — plus modifiable' }, { status: 409 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const { data, error } = await supabase
    .from('bilan_lignes')
    .insert({
      bilan_id: id,
      budget_ligne_id: null,
      montant_prevu: 0,
      montant_reel: parsed.data.montant_reel,
      sens: parsed.data.sens,
      compte: parsed.data.compte,
      sous_categorie: parsed.data.sous_categorie ?? null,
      bailleur_detail: parsed.data.bailleur_detail ?? null,
      est_charge_commune: parsed.data.est_charge_commune ?? false,
      cle_repartition: parsed.data.cle_repartition ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ligne: data }, { status: 201 });
}
