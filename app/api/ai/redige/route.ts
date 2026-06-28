import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  let body: { demande_id: string; style?: 'formel' | 'accessible' };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: demande, error } = await supabase
    .from('demandes')
    .select('*, associations(*)')
    .eq('id', body.demande_id)
    .single();

  if (error || !demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });

  const asso = demande.associations as Record<string, unknown>;
  const budget = (demande.budget_previsionnel_json as Array<{ poste: string; montant?: string | number }> | null) || [];
  const totalBudget = budget.reduce((s, l) => s + (Number(l.montant) || 0), 0);

  const prompt = `Tu es un expert en rédaction de demandes de subvention pour des associations françaises.

Rédige une lettre de demande de subvention complète et professionnelle pour :

**Association :** ${asso.nom}
**Adresse :** ${asso.adresse || ''}, ${asso.code_postal || ''} ${asso.ville || ''}
**RNA :** ${asso.rna || 'non renseigné'}
**Représentant légal :** ${asso.contact_nom} (${asso.contact_role || 'représentant'})
**Membres :** ${asso.nb_membres ?? 'non renseigné'}

**Bailleur :** ${demande.bailleur_nom} (${demande.bailleur_type === 'ville' ? 'Ville / Mairie' : 'Département'})
**Type de demande :** ${demande.type_demande === 'renouvellement' ? 'Renouvellement' : 'Première demande'}

**Projet : ${demande.titre_projet}**
${demande.objectif_projet}

**Public bénéficiaire :** ${demande.public_beneficiaire || 'non précisé'} (${demande.nb_beneficiaires_estime ?? '?'} personnes estimées)
**Période :** du ${demande.periode_debut || '?'} au ${demande.periode_fin || '?'}
**Montant demandé :** ${demande.montant_demande ? demande.montant_demande + ' €' : 'à préciser'}

${budget.length > 0 ? `**Budget prévisionnel :**
${budget.map((l) => `- ${l.poste} : ${Number(l.montant) ? Number(l.montant).toLocaleString('fr-FR') + ' €' : '?'}`).join('\n')}
Total : ${totalBudget.toLocaleString('fr-FR')} €
` : ''}

${demande.type_demande === 'renouvellement' ? `**Bilan de l'année précédente :**
- Subvention obtenue : ${demande.bilan_subvention_anterieure ? demande.bilan_subvention_anterieure + ' €' : 'non renseigné'}
- Bénéficiaires réels : ${demande.bilan_nb_beneficiaires_reel ?? 'non renseigné'}
- Bilan des actions : ${demande.bilan_activites || 'non renseigné'}
` : ''}

Rédige la lettre en respectant :
1. En-tête avec les coordonnées de l'association et du bailleur
2. Objet de la lettre
3. Introduction présentant l'association
4. Description du projet et de ses objectifs
5. Public visé et impact attendu
6. Budget synthétique
7. ${demande.type_demande === 'renouvellement' ? 'Bilan de l\'année précédente (obligatoire pour un renouvellement)' : 'Cadre de première demande'}
8. Conclusion avec remerciements et coordonnées de contact
9. Formule de politesse professionnelle
10. Signature

Style : ${body.style === 'accessible' ? 'clair et accessible, sans jargon administratif excessif' : 'formel et administratif, ton institutionnel'}
Longueur : 500-800 mots.
Langue : français, date du jour (${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}).`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const texte = response.content[0].type === 'text' ? response.content[0].text : '';

    await supabase.from('journal').insert({
      demande_id: demande.id,
      evenement: 'lettre_generee',
      detail: `Lettre de demande générée (style: ${body.style || 'formel'})`,
    });

    return NextResponse.json({ texte });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur IA';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
