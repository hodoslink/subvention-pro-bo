import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';
const HF_API = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const MAX_TEXT_CHARS = 6000;

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function findAboutUrl(html: string, base: string): string | null {
  const matches = [...html.matchAll(/href="([^"]+)"/gi)];
  const keywords = /\b(propos|about|qui|mission|projet|histoire|valeurs)\b/i;
  for (const m of matches) {
    const href = m[1];
    if (keywords.test(href)) {
      try {
        return new URL(href, base).href;
      } catch { /* ignore */ }
    }
  }
  return null;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SubventionPro/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function summariseWithHF(text: string): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('no_key');

  const prompt = `[INST] Résume en 3-4 phrases concises en français ce que fait cette association, pour qui et sur quel territoire, à partir du texte suivant :\n\n${text}\n\nRésumé : [/INST]`;

  const res = await fetch(HF_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 200, temperature: 0.3, return_full_text: false },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HF API ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const generated = Array.isArray(json) ? json[0]?.generated_text : json?.generated_text;
  if (!generated) throw new Error('Réponse HF vide');
  return generated.trim();
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: asso } = await supabase
    .from('associations')
    .select('site_web_url')
    .eq('id', id)
    .single();

  if (!asso?.site_web_url) {
    return NextResponse.json({ error: 'Aucun site web renseigné sur cette association' }, { status: 400 });
  }

  const baseUrl = asso.site_web_url;
  let contenu_brut = '';
  let statut: 'succes' | 'echec' | 'partiel' = 'succes';
  let erreur_detail: string | undefined;
  let resume_genere: string | undefined;

  // Scraping
  try {
    const homeHtml = await fetchPage(baseUrl);
    let text = extractText(homeHtml);

    const aboutUrl = findAboutUrl(homeHtml, baseUrl);
    if (aboutUrl && aboutUrl !== baseUrl) {
      try {
        const aboutHtml = await fetchPage(aboutUrl);
        text = (text + ' ' + extractText(aboutHtml)).slice(0, MAX_TEXT_CHARS);
      } catch { /* page about non critique */ }
    }
    contenu_brut = text;
  } catch (e: unknown) {
    statut = 'echec';
    erreur_detail = e instanceof Error ? e.message : String(e);
    await supabase.from('scraping_historique').insert({
      association_id: id,
      url_scrapee: baseUrl,
      contenu_brut: '',
      statut,
      erreur_detail,
      modele_utilise: HF_MODEL,
    });
    return NextResponse.json({ ok: false, reason: 'scraping_error', detail: erreur_detail }, { status: 502 });
  }

  // Résumé IA
  const hasKey = !!process.env.HUGGINGFACE_API_KEY;
  if (hasKey && contenu_brut) {
    try {
      resume_genere = await summariseWithHF(contenu_brut);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'no_key') {
        statut = 'partiel';
        erreur_detail = 'no_key';
      } else {
        statut = 'partiel';
        erreur_detail = msg;
      }
    }
  } else if (!hasKey) {
    statut = 'partiel';
    erreur_detail = 'no_key';
  }

  // Persistence
  await Promise.all([
    supabase.from('scraping_historique').insert({
      association_id: id,
      url_scrapee: baseUrl,
      contenu_brut,
      resume_genere,
      modele_utilise: HF_MODEL,
      statut,
      erreur_detail,
    }),
    resume_genere
      ? supabase.from('associations').update({
          resume_scrape: resume_genere,
          resume_scrape_le: new Date().toISOString(),
        }).eq('id', id)
      : Promise.resolve(),
  ]);

  return NextResponse.json({
    ok: true,
    statut,
    resume_genere,
    no_key: !hasKey,
    chars_scraped: contenu_brut.length,
  });
}
