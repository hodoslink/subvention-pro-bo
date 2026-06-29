import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const patchSchema = z.object({
  nom: z.string().min(1).max(300).optional(),
  type_bailleur: z.string().max(50).optional().nullable(),
  plateforme_nom: z.string().max(200).optional().nullable(),
  plateforme_url: z.string().url().max(500).optional().nullable(),
  plateforme_type: z.enum(['plateforme_numerique', 'pdf_papier', 'email', 'autre']).optional().nullable(),
  contact_referent_nom: z.string().max(200).optional().nullable(),
  contact_referent_email: z.string().email().max(300).optional().nullable(),
  contact_referent_telephone: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
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
    .from('bailleurs')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bailleur: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('bailleurs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
