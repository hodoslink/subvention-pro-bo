import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  const supabase = getSupabaseServer();
  let query = supabase
    .from('associations')
    .select('id, nom, ville, contact_email, statut_profil, created_at')
    .order('nom');

  if (q) query = query.ilike('nom', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ associations: data });
}
