import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

const ALLOWED_CHAMPS = new Set([
  'thematique', 'secteur_activite', 'beneficiaires_profil', 'beneficiaires_age',
  'beneficiaires_sexe', 'localisation_qpv', 'partenariats',
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const champ = searchParams.get('champ') ?? '';
  if (!ALLOWED_CHAMPS.has(champ)) return NextResponse.json({ suggestions: [] });

  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('demandes')
    .select('details_json')
    .not('details_json', 'is', null)
    .limit(500);

  const freq = new Map<string, number>();
  for (const row of data ?? []) {
    const val = (row.details_json as Record<string, unknown>)?.[champ];
    if (typeof val === 'string' && val.trim()) {
      const v = val.trim();
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
  }

  const suggestions = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([v]) => v);

  return NextResponse.json({ suggestions });
}
