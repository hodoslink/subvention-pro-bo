import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const COMPTES_CHARGE = ['60','61','62','63','64','65','66','67','68','69','86'];
const COMPTES_PRODUIT = ['70','73','74','75','76','77','78','79','87'];

const postSchema = z.object({
  sens: z.enum(['charge', 'produit']),
  compte: z.string().min(2).max(4),
  statut_financement: z.enum(['obtenu', 'demande', 'envisage']).optional().nullable(),
  libelle_compte: z.string().max(200).optional().nullable(),
  sous_categorie: z.string().max(500).optional().nullable(),
  bailleur_detail: z.string().max(300).optional().nullable(),
  quantite: z.number().positive().optional().nullable(),
  prix_unitaire: z.number().positive().optional().nullable(),
  montant: z.number().min(0).default(0),
  est_charge_commune: z.boolean().default(false),
  cle_repartition: z.string().max(500).optional().nullable(),
  est_valorisation_benevolat: z.boolean().default(false),
  precisions: z.string().max(2000).optional().nullable(),
  demande_liee_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const [{ data: lignes, error }, { data: equilibre }, { data: taux }] = await Promise.all([
    supabase.from('budget_lignes').select('*').eq('demande_id', id).order('created_at'),
    supabase.from('v_budget_equilibre').select('*').eq('demande_id', id).maybeSingle(),
    supabase.from('v_taux_financement_bailleur').select('*').eq('demande_id', id),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lignes: lignes ?? [], equilibre, taux: taux ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }

  // Un compte détaillé (602, 622, 864…) est valide si sa classe (2 premiers
  // chiffres) appartient au plan comptable du sens demandé.
  const comptes = parsed.data.sens === 'charge' ? COMPTES_CHARGE : COMPTES_PRODUIT;
  if (!comptes.some(c => parsed.data.compte.startsWith(c))) {
    return NextResponse.json({ error: `Compte ${parsed.data.compte} invalide pour le sens ${parsed.data.sens}` }, { status: 422 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('budget_lignes')
    .insert({ ...parsed.data, demande_id: id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ligne: data }, { status: 201 });
}
