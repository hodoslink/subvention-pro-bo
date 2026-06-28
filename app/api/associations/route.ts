import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { associationSchema } from '@/lib/validation';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = rateLimit(`associations:${ip}`, { max: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes, réessayez dans un instant.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = associationSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message || 'Données invalides.' },
      { status: 422 }
    );
  }

  const input = parsed.data;
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('associations')
    .insert({
      nom: input.nom,
      siret: input.siret || null,
      siren: input.siren || null,
      rna: input.rna || null,
      adresse: input.adresse || null,
      code_postal: input.code_postal || null,
      ville: input.ville || null,
      forme_juridique: input.forme_juridique || null,
      contact_nom: input.contact_nom,
      contact_role: input.contact_role || null,
      contact_email: input.contact_email,
      contact_telephone: input.contact_telephone || null,
      nb_membres: input.nb_membres ?? null,
      date_creation: input.date_creation || null,
      statut_profil: 'complet',
    })
    .select()
    .single();

  if (error) {
    // Le détail technique Postgres ne doit pas fuiter au client.
    console.error('Erreur insertion association:', error.message);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'enregistrement." },
      { status: 500 }
    );
  }

  return NextResponse.json({ association: data });
}
