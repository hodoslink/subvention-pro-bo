import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asso = searchParams.get('association_id');
  const statut = searchParams.get('statut');
  const annee = searchParams.get('annee');
  const presta = searchParams.get('presta');
  const q = searchParams.get('q');

  const supabase = getSupabaseServer();
  let query = supabase
    .from('demandes')
    .select('*, associations(id, nom, ville, contact_email)')
    .order('created_at', { ascending: false });

  if (asso) query = query.eq('association_id', asso);
  if (statut) query = query.eq('statut', statut);
  if (presta) query = query.eq('presta_redacteur', presta);
  if (annee) {
    query = query
      .gte('created_at', `${annee}-01-01`)
      .lte('created_at', `${annee}-12-31`);
  }
  if (q) {
    query = query.or(
      `titre_projet.ilike.%${q}%,bailleur_nom.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demandes: data });
}
