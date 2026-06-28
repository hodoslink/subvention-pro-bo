import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  let body: { demande_id: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Charger la demande + association
  const { data: demande, error } = await supabase
    .from('demandes')
    .select('*, associations(*)')
    .eq('id', body.demande_id)
    .single();

  if (error || !demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });

  const asso = demande.associations as Record<string, unknown>;

  // Charger les demandes précédentes de cette association (historique)
  const { data: historique } = await supabase
    .from('demandes')
    .select('titre_projet, bailleur_nom, montant_demande, montant_obtenu, statut, created_at, bilan_activites')
    .eq('association_id', demande.association_id)
    .neq('id', demande.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Scraping du site web de l'association si disponible
  let siteContent = '';
  const siteUrl = (asso?.site_web as string | undefined) || '';
  if (siteUrl) {
    try {
      const resp = await fetch(siteUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'SubventionPro/1.0 (assistant rédaction dossiers subvention)' },
      });
      if (resp.ok) {
        const html = await resp.text();
        // Extraire le texte brut (supprimer les balises HTML)
        siteContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000);
      }
    } catch {
      // Scraping optionnel — on continue sans
    }
  }

  const prompt = `Tu es un expert en rédaction de dossiers de subvention pour des associations françaises.

Voici le contexte de la demande à enrichir :

**Association :** ${asso.nom} (${asso.ville || 'ville inconnue'})
**Contact :** ${asso.contact_nom} — ${asso.contact_email}
**Membres :** ${asso.nb_membres ?? 'inconnu'}
**Création :** ${asso.date_creation ?? 'inconnue'}
**Forme juridique :** ${asso.forme_juridique ?? 'inconnue'}

**Projet en cours :**
- Titre : ${demande.titre_projet || '(non renseigné)'}
- Objectif : ${demande.objectif_projet || '(non renseigné)'}
- Bailleur : ${demande.bailleur_nom || 'inconnu'} (${demande.bailleur_type || '?'})
- Montant demandé : ${demande.montant_demande ? demande.montant_demande + ' €' : 'non renseigné'}
- Bénéficiaires estimés : ${demande.nb_beneficiaires_estime ?? 'inconnu'}
- Public : ${demande.public_beneficiaire || 'non renseigné'}
- Période : ${demande.periode_debut || '?'} → ${demande.periode_fin || '?'}

${demande.type_demande === 'renouvellement' ? `**Renouvellement — bilan N-1 :**
- Subvention reçue : ${demande.bilan_subvention_anterieure ? demande.bilan_subvention_anterieure + ' €' : 'inconnu'}
- Bénéficiaires réels : ${demande.bilan_nb_beneficiaires_reel ?? 'inconnu'}
- Bilan activités : ${demande.bilan_activites || 'non renseigné'}
` : ''}

${historique && historique.length > 0 ? `**Historique des demandes précédentes :**
${historique.map((h) => `- ${h.titre_projet || 'sans titre'} → ${h.bailleur_nom} — demandé: ${h.montant_demande ?? '?'}€ / obtenu: ${h.montant_obtenu ?? 'inconnu'}€ (${h.statut})`).join('\n')}
` : ''}

${siteContent ? `**Contenu du site web de l'association (extrait) :**
${siteContent}
` : ''}

Sur la base de ces informations, génère un **rapport d'enrichissement** structuré en JSON avec les champs suivants :
{
  "points_forts": ["liste de 3-5 arguments forts pour ce dossier"],
  "points_attention": ["liste de 2-3 risques ou manques à combler"],
  "suggestion_objectif": "réécriture améliorée de l'objectif projet pour le dossier officiel (2-4 phrases, ton administratif mais concret)",
  "suggestion_public": "description affinée du public bénéficiaire",
  "contexte_territorial": "1-2 phrases sur le contexte local si identifiable",
  "elements_manquants": ["liste des informations qu'il faudrait encore collecter"],
  "conseil_montant": "commentaire sur le montant demandé vs historique et ambition du projet"
}

Réponds UNIQUEMENT avec le JSON valide, sans commentaire.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Extraire le JSON de la réponse
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });

    const analyse = JSON.parse(jsonMatch[0]);

    // Journaliser
    await supabase.from('journal').insert({
      demande_id: demande.id,
      evenement: 'enrichissement_ia',
      detail: `Enrichissement IA généré`,
    });

    return NextResponse.json({ analyse, site_scrappe: !!siteContent });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur IA';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
