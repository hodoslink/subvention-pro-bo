import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  if (!q.trim() || q.trim().length < 2) return NextResponse.json({ qpvs: [] });

  try {
    const url = `https://sig.ville.gouv.fr/api/v1/qpv/?format=json&search=${encodeURIComponent(q.trim())}&limit=10`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const data = await r.json();
      const qpvs = (data.results ?? []).slice(0, 10).map((item: Record<string, string>) => ({
        code: item.code_qp ?? item.code ?? '',
        nom: item.nom_qp ?? item.nom ?? '',
        commune: item.commune_qp ?? item.libelle_commune ?? '',
      }));
      return NextResponse.json({ qpvs });
    }
  } catch { /* réseau indisponible */ }

  return NextResponse.json({ qpvs: [] });
}
