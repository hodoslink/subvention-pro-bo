import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const createSchema = z.object({
  indicateur: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = createSchema.safeParse(body);
  const indicateur = parsed.success ? (parsed.data.indicateur ?? 'Nouvel indicateur') : 'Nouvel indicateur';

  const { data, error } = await supabase
    .from('bilan_indicateurs')
    .insert({ bilan_id: id, indicateur })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ indicateur: data }, { status: 201 });
}
