import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const createSchema = z.object({
  nom: z.string().min(1).max(300),
  type_bailleur: z.string().max(50).optional().nullable(),
  plateforme_nom: z.string().max(200).optional().nullable(),
  plateforme_url: z.string().url().max(500).optional().nullable(),
  plateforme_type: z.enum(['plateforme_numerique', 'pdf_papier', 'email', 'autre']).optional(),
  contact_referent_nom: z.string().max(200).optional().nullable(),
  contact_referent_email: z.string().email().max(300).optional().nullable(),
  contact_referent_telephone: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('bailleurs')
    .select('*')
    .order('nom');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bailleurs: data });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('bailleurs')
    .insert(parsed.data)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bailleur: data }, { status: 201 });
}
