"use client";
import { useEffect, useState, useRef, use, Fragment } from "react";
import { STATUTS } from "@/lib/statuts";
import { GROUPES_CHARGES, GROUPES_PRODUITS } from "@/lib/catalogue-budget";
import { BAILLEUR_TYPES } from "@/lib/supabase";
import type { Demande, DetailsJson, BudgetLigneDB, BudgetEquilibre, Bilan, Statut } from "@/lib/supabase";

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('fr-FR')} €`;

const dateFr = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <tr>
      <td className="align-top py-1 pr-4 text-gray-500 whitespace-nowrap" style={{ width: '220px' }}>{label}</td>
      <td className="align-top py-1 text-gray-900 whitespace-pre-wrap">{String(value)}</td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6" style={{ breakInside: 'avoid' }}>
      <h2 className="text-base font-bold text-gray-900 border-b-2 border-gray-800 pb-1 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function groupesAvecLignes(
  lignes: BudgetLigneDB[],
  sens: 'charge' | 'produit',
  groupes: { prefix: string; label: string; comptes: string[] }[]
) {
  const duSens = lignes.filter(l => l.sens === sens);
  const affectees = new Set<string>();
  const result = groupes
    .map(g => {
      const rows = duSens.filter(l => g.comptes.includes(l.compte) || l.compte.startsWith(g.prefix));
      rows.forEach(l => affectees.add(l.id));
      return { label: g.label, rows, total: rows.reduce((s, l) => s + (l.montant || 0), 0) };
    })
    .filter(g => g.rows.length > 0);
  const autres = duSens.filter(l => !affectees.has(l.id));
  if (autres.length > 0) {
    result.push({ label: 'Autres', rows: autres, total: autres.reduce((s, l) => s + (l.montant || 0), 0) });
  }
  return result;
}

export default function ExportDemande({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [demande, setDemande] = useState<Demande | null>(null);
  const [lignes, setLignes] = useState<BudgetLigneDB[]>([]);
  const [equilibre, setEquilibre] = useState<BudgetEquilibre | null>(null);
  const [bilans, setBilans] = useState<Bilan[]>([]);
  const [loading, setLoading] = useState(true);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/demandes/${id}`).then(r => r.json()),
      fetch(`/api/demandes/${id}/budget-lignes`).then(r => r.ok ? r.json() : { lignes: [], equilibre: null }),
      fetch(`/api/demandes/${id}/bilans`).then(r => r.ok ? r.json() : { bilans: [] }),
    ]).then(([d, b, bi]) => {
      setDemande(d.demande ?? null);
      setLignes(b.lignes ?? []);
      setEquilibre(b.equilibre ?? null);
      setBilans(bi.bilans ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const telechargerWord = () => {
    if (!docRef.current || !demande) return;
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Demande de subvention</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #111; }
  h1 { font-size: 16pt; } h2 { font-size: 13pt; border-bottom: 2px solid #333; padding-bottom: 2pt; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 3pt 6pt; vertical-align: top; }
  .budget-table td, .budget-table th { border: 1px solid #999; }
  .muted { color: #666; }
</style></head><body>${docRef.current.innerHTML}</body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nom = (demande.titre_projet || 'demande').replace(/[^a-zA-Z0-9àâäéèêëîïôöùûüç _-]/g, '').slice(0, 60);
    a.href = url;
    a.download = `demande-${nom}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 text-gray-400">Chargement…</div>;
  if (!demande) return <div className="p-8 text-red-500">Demande introuvable</div>;

  const det = (demande.details_json || {}) as DetailsJson;
  const asso = demande.associations;
  const statutInfo = STATUTS[demande.statut as Statut];
  const bailleurTypeLabel = BAILLEUR_TYPES.find(t => t.v === demande.bailleur_type)?.l ?? demande.bailleur_type;

  const groupesCharges = groupesAvecLignes(lignes, 'charge', GROUPES_CHARGES);
  const groupesProduits = groupesAvecLignes(lignes, 'produit', GROUPES_PRODUITS);
  const totalCharges = lignes.filter(l => l.sens === 'charge').reduce((s, l) => s + (l.montant || 0), 0);
  const totalProduits = lignes.filter(l => l.sens === 'produit').reduce((s, l) => s + (l.montant || 0), 0);

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="flex items-center gap-2 mb-6 print:hidden">
        <a href={`/demandes/${id}`} className="btn btn-ghost text-sm">← Retour à la demande</a>
        <div className="flex-1" />
        <button onClick={telechargerWord} className="btn btn-secondary text-sm">📄 Télécharger en Word</button>
        <button onClick={() => window.print()} className="btn btn-primary text-sm">🖨 Imprimer / PDF</button>
      </div>

      <div ref={docRef}>
        {/* En-tête */}
        <h1 className="text-xl font-bold text-gray-900 mb-1">{demande.titre_projet || 'Demande de subvention'}</h1>
        <p className="text-sm text-gray-500 mb-6">
          {asso?.nom}{demande.annee_millesime ? ` — millésime ${demande.annee_millesime}` : ''} — export du {new Date().toLocaleDateString('fr-FR')}
        </p>

        <Section title="Synthèse">
          <table className="w-full text-sm"><tbody>
            <Row label="Statut" value={statutInfo ? statutInfo.label : demande.statut} />
            <Row label="Type de demande" value={demande.type_demande === 'renouvellement' ? 'Renouvellement' : 'Première demande'} />
            <Row label="Bailleur" value={demande.bailleur_nom ? `${demande.bailleur_nom}${bailleurTypeLabel ? ` (${bailleurTypeLabel})` : ''}` : null} />
            <Row label="Montant demandé" value={demande.montant_demande != null ? eur(demande.montant_demande) : null} />
            <Row label="Montant obtenu" value={demande.montant_obtenu != null ? eur(demande.montant_obtenu) : null} />
            <Row label="Période de réalisation" value={demande.periode_debut || demande.periode_fin ? `${demande.periode_debut ?? '?'} → ${demande.periode_fin ?? '?'}` : null} />
            <Row label="Date de dépôt" value={demande.date_depot ? dateFr(demande.date_depot) : null} />
            <Row label="Date de décision" value={demande.date_decision ? dateFr(demande.date_decision) : null} />
            <Row label="N° dossier bailleur" value={demande.plateforme_identifiant_dossier} />
            <Row label="Prestataire assigné" value={demande.presta_redacteur} />
          </tbody></table>
        </Section>

        {asso && (
          <Section title="Association">
            <table className="w-full text-sm"><tbody>
              <Row label="Nom" value={`${asso.nom}${asso.sigle ? ` (${asso.sigle})` : ''}`} />
              <Row label="SIRET" value={asso.siret} />
              <Row label="RNA" value={asso.rna} />
              <Row label="Adresse" value={[asso.adresse, asso.code_postal, asso.ville].filter(Boolean).join(', ') || null} />
              <Row label="Secteur d'activité" value={asso.secteur_activite} />
              <Row label="Contact" value={[asso.contact_nom, asso.contact_role, asso.contact_email, asso.contact_telephone].filter(Boolean).join(' — ') || null} />
              <Row label="Contact demande" value={[demande.contact_nom, demande.contact_role, demande.contact_email, demande.contact_telephone].filter(Boolean).join(' — ') || null} />
            </tbody></table>
          </Section>
        )}

        <Section title="Projet">
          <table className="w-full text-sm"><tbody>
            <Row label="Objectif" value={demande.objectif_projet} />
            <Row label="Thématique" value={det.thematique} />
            <Row label="Besoins identifiés" value={det.description_besoins} />
            <Row label="Actions" value={det.description_actions} />
            <Row label="Partenariats" value={det.partenariats} />
            <Row label="Ce qui change cette année" value={demande.ce_qui_change_cette_annee} />
          </tbody></table>
        </Section>

        <Section title="Public bénéficiaire">
          <table className="w-full text-sm"><tbody>
            <Row label="Public" value={demande.public_beneficiaire} />
            <Row label="Nb bénéficiaires estimé" value={demande.nb_beneficiaires_estime} />
            <Row label="Profil" value={det.beneficiaires_profil} />
            <Row label="Âge" value={det.beneficiaires_age} />
            <Row label="Sexe" value={det.beneficiaires_sexe} />
            <Row label="Localisation / QPV" value={det.localisation_qpv} />
          </tbody></table>
        </Section>

        <Section title="Moyens humains et matériels">
          <table className="w-full text-sm"><tbody>
            <Row label="Bénévoles" value={det.nb_benevoles} />
            <Row label="Salariés" value={det.nb_salaries} />
            <Row label="Description des moyens" value={det.moyens_description} />
          </tbody></table>
          {det.prestataires && det.prestataires.length > 0 && (
            <>
              <p className="text-sm font-semibold text-gray-700 mt-3 mb-1">Prestataires</p>
              <table className="w-full text-sm budget-table border-collapse">
                <thead><tr className="text-left text-gray-500">
                  <th className="border border-gray-300 px-2 py-1">Intervenant</th>
                  <th className="border border-gray-300 px-2 py-1">Séances/ateliers</th>
                  <th className="border border-gray-300 px-2 py-1">Tarif unitaire</th>
                </tr></thead>
                <tbody>{det.prestataires.map((p, i) => (
                  <tr key={i}>
                    <td className="border border-gray-300 px-2 py-1">{p.nom_type}</td>
                    <td className="border border-gray-300 px-2 py-1">{p.nb_seances_ou_ateliers}</td>
                    <td className="border border-gray-300 px-2 py-1">{p.tarif_unitaire} €</td>
                  </tr>
                ))}</tbody>
              </table>
            </>
          )}
        </Section>

        {lignes.length > 0 && (
          <Section title="Budget prévisionnel">
            {([['CHARGES', groupesCharges, totalCharges], ['PRODUITS', groupesProduits, totalProduits]] as const).map(([titre, groupes, total]) => (
              <div key={titre} className="mb-4">
                <p className="text-sm font-bold text-gray-800 mb-1">{titre}</p>
                <table className="w-full text-sm budget-table border-collapse">
                  <thead><tr className="text-left text-gray-500">
                    <th className="border border-gray-300 px-2 py-1" style={{ width: '70px' }}>Compte</th>
                    <th className="border border-gray-300 px-2 py-1">Libellé</th>
                    <th className="border border-gray-300 px-2 py-1 text-right" style={{ width: '110px' }}>Montant</th>
                  </tr></thead>
                  <tbody>
                    {groupes.map(g => (
                      <Fragment key={g.label}>
                        <tr className="bg-gray-100">
                          <td className="border border-gray-300 px-2 py-1 font-semibold" colSpan={2}>{g.label}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{eur(g.total)}</td>
                        </tr>
                        {g.rows.map(l => (
                          <tr key={l.id}>
                            <td className="border border-gray-300 px-2 py-1 text-gray-500">{l.compte}</td>
                            <td className="border border-gray-300 px-2 py-1">
                              {l.sous_categorie || l.libelle_compte || '—'}
                              {l.bailleur_detail ? ` — ${l.bailleur_detail}` : ''}
                              {l.statut_financement ? ` [${l.statut_financement}]` : ''}
                              {l.precisions ? <span className="muted text-gray-500"> ({l.precisions})</span> : null}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">{eur(l.montant)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="bg-gray-200">
                      <td className="border border-gray-300 px-2 py-1 font-bold" colSpan={2}>TOTAL {titre}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-bold">{eur(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
            <p className="text-sm font-semibold">
              Équilibre : charges {eur(totalCharges)} / produits {eur(totalProduits)}
              {equilibre ? (equilibre.est_equilibre ? ' — budget équilibré ✓' : ` — écart ${eur(equilibre.ecart)}`) :
                (Math.abs(totalCharges - totalProduits) < 0.01 ? ' — budget équilibré ✓' : ` — écart ${eur(totalCharges - totalProduits)}`)}
            </p>
          </Section>
        )}

        {(det.indicateurs_evaluation || det.autres_bailleurs_sollicites?.length) && (
          <Section title="Évaluation et cofinancements">
            <table className="w-full text-sm"><tbody>
              <Row label="Indicateurs d'évaluation" value={det.indicateurs_evaluation} />
            </tbody></table>
            {det.autres_bailleurs_sollicites && det.autres_bailleurs_sollicites.length > 0 && (
              <>
                <p className="text-sm font-semibold text-gray-700 mt-3 mb-1">Autres bailleurs sollicités</p>
                <table className="w-full text-sm budget-table border-collapse">
                  <thead><tr className="text-left text-gray-500">
                    <th className="border border-gray-300 px-2 py-1">Bailleur</th>
                    <th className="border border-gray-300 px-2 py-1 text-right">Montant</th>
                    <th className="border border-gray-300 px-2 py-1">Statut</th>
                  </tr></thead>
                  <tbody>{det.autres_bailleurs_sollicites.map((b, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 px-2 py-1">{b.nom_bailleur}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{b.montant} €</td>
                      <td className="border border-gray-300 px-2 py-1">{b.statut}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </>
            )}
          </Section>
        )}

        {(demande.bilan_subvention_anterieure != null || demande.bilan_activites || demande.bilan_nb_beneficiaires_reel != null) && (
          <Section title="Bilan de la subvention antérieure (N-1)">
            <table className="w-full text-sm"><tbody>
              <Row label="Subvention N-1" value={demande.bilan_subvention_anterieure != null ? eur(demande.bilan_subvention_anterieure) : null} />
              <Row label="Bénéficiaires réels N-1" value={demande.bilan_nb_beneficiaires_reel} />
              <Row label="Bilan des activités" value={demande.bilan_activites} />
            </tbody></table>
          </Section>
        )}

        {bilans.length > 0 && (
          <Section title="Bilans d'exécution">
            <table className="w-full text-sm budget-table border-collapse">
              <thead><tr className="text-left text-gray-500">
                <th className="border border-gray-300 px-2 py-1">Type</th>
                <th className="border border-gray-300 px-2 py-1">Période</th>
                <th className="border border-gray-300 px-2 py-1">Statut</th>
              </tr></thead>
              <tbody>{bilans.map(b => (
                <tr key={b.id}>
                  <td className="border border-gray-300 px-2 py-1">{b.type === 'final' ? 'Bilan final' : `Bilan intermédiaire n°${b.numero_ordre}`}</td>
                  <td className="border border-gray-300 px-2 py-1">{dateFr(b.date_debut)} → {dateFr(b.date_fin)}</td>
                  <td className="border border-gray-300 px-2 py-1">{b.statut}</td>
                </tr>
              ))}</tbody>
            </table>
          </Section>
        )}

        {demande.notes && (
          <Section title="Notes internes">
            <p className="text-sm whitespace-pre-wrap">{demande.notes}</p>
          </Section>
        )}
      </div>
    </div>
  );
}
