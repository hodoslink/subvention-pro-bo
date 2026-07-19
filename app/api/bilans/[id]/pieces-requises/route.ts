import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { PIECES_BILAN } from '@/lib/piecesBilan';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: bilan, error: bilanErr } = await supabase
    .from('bilans')
    .select('id, demande_id')
    .eq('id', id)
    .single();
  if (bilanErr || !bilan) return NextResponse.json({ error: 'Bilan introuvable' }, { status: 404 });

  let { data: pieces, error } = await supabase
    .from('pieces_requises')
    .select('*')
    .eq('bilan_id', id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lazy init : initialise les pièces du bilan si vide
  if (!pieces || pieces.length === 0) {
    const rows = PIECES_BILAN.map(p => ({
      ...p,
      demande_id: bilan.demande_id,
      bilan_id: id,
      statut: 'manquant',
    }));
    const { data: inserted, error: insErr } = await supabase
      .from('pieces_requises')
      .insert(rows)
      .select()
      .order('created_at');
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    pieces = inserted ?? [];
  }

  return NextResponse.json({ pieces });
}
