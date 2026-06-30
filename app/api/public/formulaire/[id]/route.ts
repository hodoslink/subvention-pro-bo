import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { validerReponsesFormulairePublic } from '@/lib/validationFormulairePublic';
import { syncBudgetAutoLignes } from '@/lib/budgetSync';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

async function resolveToken(id: string, token: string | null) {
  if (!token) return null;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('demandes')
    .select('id, token_formulaire_public, formulaire_public_ouvert_le, details_json, montant_demande, bailleur_nom, date_limite_depot')
    .eq('id', id)
    .eq('token_formulaire_public', token)
    .single();
  return data ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('t');

  const demande = await resolveToken(id, token);
  if (!demande) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 403 });
  }

  // Mark first open
  if (!demande.formulaire_public_ouvert_le) {
    const supabase = getSupabaseServer();
    await supabase
      .from('demandes')
      .update({ formulaire_public_ouvert_le: new Date().toISOString() })
      .eq('id', id);
  }

  return NextResponse.json({
    details_json: demande.details_json ?? {},
    date_limite_depot: demande.date_limite_depot ?? null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Rate limiting
  const ip = getClientIp(req);
  const { allowed } = rateLimit(`formulaire:${ip}:${id}`, { max: 30, windowMs: 10 * 60 * 1000 });
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans quelques minutes.' }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const { token, ...formData } = body as Record<string, unknown>;
  const demande = await resolveToken(id, (token as string) ?? null);
  if (!demande) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 403 });
  }

  const validation = validerReponsesFormulairePublic(formData);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  // Merge new answers into existing details_json
  const existingDetails = (demande.details_json ?? {}) as Record<string, unknown>;
  const merged = { ...existingDetails, ...validation.data };

  const supabase = getSupabaseServer();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('demandes')
    .update({
      details_json: merged,
      formulaire_public_rempli_le: now,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync budget auto lines
  await syncBudgetAutoLignes(
    supabase,
    id,
    merged as Parameters<typeof syncBudgetAutoLignes>[2],
    { montant_demande: demande.montant_demande ?? null, bailleur_nom: demande.bailleur_nom ?? null }
  );

  await supabase.from('journal').insert({
    demande_id: id,
    evenement: 'formulaire_public_rempli',
    detail: 'Réponses enregistrées via le formulaire public',
  });

  return NextResponse.json({ ok: true });
}
