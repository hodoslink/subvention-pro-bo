import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { demandeSchema } from '@/lib/validation';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = rateLimit(`demandes:${ip}`, { max: 10, windowMs: 60_000 });
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

  const parsed = demandeSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message || 'Données invalides.' },
      { status: 422 }
    );
  }

  const input = parsed.data;
  const supabase = getSupabaseServer();

  // On vérifie que l'association référencée existe réellement avant
  // d'accepter la demande — empêche de rattacher une demande à un
  // identifiant arbitraire envoyé directement à l'API.
  const { data: assoExists, error: assoError } = await supabase
    .from('associations')
    .select('id')
    .eq('id', input.association_id)
    .maybeSingle();

  if (assoError || !assoExists) {
    return NextResponse.json(
      { error: 'Association introuvable.' },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from('demandes')
    .insert({
      association_id: input.association_id,
      type_demande: input.type_demande ?? 'premiere',
      bilan_subvention_anterieure: input.bilan_subvention_anterieure ?? null,
      bilan_activites: input.bilan_activites || null,
      bilan_nb_beneficiaires_reel: input.bilan_nb_beneficiaires_reel ?? null,
      bailleur_type: input.bailleur_type,
      bailleur_nom: input.bailleur_nom,
      montant_demande: input.montant_demande ?? null,
      titre_projet: input.titre_projet,
      objectif_projet: input.objectif_projet,
      public_beneficiaire: input.public_beneficiaire || null,
      nb_beneficiaires_estime: input.nb_beneficiaires_estime ?? null,
      periode_debut: input.periode_debut || null,
      periode_fin: input.periode_fin || null,
      budget_previsionnel_json: input.budget_previsionnel_json || [],
      statut: 'collecte',
    })
    .select()
    .single();

  if (error) {
    console.error('Erreur insertion demande:', error.message);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'enregistrement." },
      { status: 500 }
    );
  }

  await supabase.from('journal').insert({
    demande_id: data.id,
    evenement: 'demande_creee',
    detail: `Demande créée pour ${input.titre_projet}`,
  });

  return NextResponse.json({ demande: data });
}
