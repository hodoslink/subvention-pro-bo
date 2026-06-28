import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const [assoRes, demandesRes] = await Promise.all([
    supabase.from('associations').select('*').eq('id', id).single(),
    supabase
      .from('demandes')
      .select('id, titre_projet, statut, bailleur_nom, montant_demande, montant_obtenu, created_at, type_demande')
      .eq('association_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (assoRes.error) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json({ association: assoRes.data, demandes: demandesRes.data || [] });
}
