import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const patchSchema = z.object({
  nom: z.string().min(1).max(500).optional(),
  siret: z.string().max(14).optional().nullable(),
  siren: z.string().max(9).optional().nullable(),
  rna: z.string().max(20).optional().nullable(),
  adresse: z.string().max(500).optional().nullable(),
  code_postal: z.string().max(5).optional().nullable(),
  ville: z.string().max(200).optional().nullable(),
  forme_juridique: z.string().max(200).optional().nullable(),
  nb_membres: z.number().int().min(0).optional().nullable(),
  date_creation: z.string().max(50).optional().nullable(),
  contact_nom: z.string().max(200).optional(),
  contact_role: z.string().max(200).optional().nullable(),
  contact_email: z.string().email().max(300).optional(),
  contact_telephone: z.string().max(30).optional().nullable(),
  site_web_url: z.string().max(500).optional().nullable(),
  resume_edite: z.string().max(2000).optional().nullable(),
  resume_edite_par: z.string().max(200).optional().nullable(),
  secteur_activite: z.string().max(200).optional().nullable(),
});

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
    .from('associations')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ association: data });
}
