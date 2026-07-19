"use client";
import { useEffect, useState, use } from "react";
import type { Bilan, BilanLigne, BilanIndicateur, Statut } from "@/lib/supabase";
import { isCVN } from "@/lib/budgetTotaux";

const eur = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;

const dateFr = (d: string | null | undefined) =>
  d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

type DemandeExport = {
  id: string;
  titre_projet?: string;
  montant_demande?: number;
  montant_obtenu?: number;
  plateforme_identifiant_dossier?: string;
  statut: Statut;
  associations?: { nom: string; siret?: string; rna?: string; adresse?: string; code_postal?: string; ville?: string };
};

function Feuillet({ numero, titre, children }: { numero: number; titre: string; children: React.ReactNode }) {
  return (
    <section className="mb-8" style={{ breakInside: 'avoid' }}>
      <h2 className="text-base font-bold text-gray-900 border-b-2 border-gray-800 pb-1 mb-3">
        Feuillet {numero} — {titre}
      </h2>
      {children}
    </section>
  );
}

function LigneTable({ titre, rows, avecCle }: { titre: string; rows: BilanLigne[]; avecCle?: boolean }) {
  if (rows.length === 0) return null;
  const totalPrevu = rows.reduce((s, l) => s + l.montant_prevu, 0);
  const totalReel = rows.reduce((s, l) => s + (l.montant_reel ?? 0), 0);
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold text-gray-800 mb-1">{titre}</p>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="text-left text-gray-500 bg-gray-50">
          <th className="border border-gray-300 px-2 py-1" style={{ width: '65px' }}>Compte</th>
          <th className="border border-gray-300 px-2 py-1">Libellé</th>
          <th className="border border-gray-300 px-2 py-1 text-right" style={{ width: '100px' }}>Prévision</th>
          <th className="border border-gray-300 px-2 py-1 text-right" style={{ width: '100px' }}>Réalisation</th>
          <th className="border border-gray-300 px-2 py-1 text-right" style={{ width: '65px' }}>%</th>
        </tr></thead>
        <tbody>
          {rows.map(l => {
            const pct = l.montant_reel != null && l.montant_prevu !== 0
              ? (l.montant_reel / l.montant_prevu) * 100 : null;
            return (
              <tr key={l.id}>
                <td className="border border-gray-300 px-2 py-1 text-gray-500">{l.compte}</td>
                <td className="border border-gray-300 px-2 py-1">
                  {l.sous_categorie || l.bailleur_detail || '—'}
                  {avecCle && l.cle_repartition ? ` (clé : ${l.cle_repartition})` : ''}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">{eur(l.montant_prevu)}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{l.montant_reel != null ? eur(l.montant_reel) : '—'}</td>
                <td className="border border-gray-300 px-2 py-1 text-right text-gray-500">{pct != null ? `${pct.toFixed(0)} %` : '—'}</td>
              </tr>
            );
          })}
          <tr className="bg-gray-100 font-semibold">
            <td className="border border-gray-300 px-2 py-1" colSpan={2}>Sous-total</td>
            <td className="border border-gray-300 px-2 py-1 text-right">{eur(totalPrevu)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right">{eur(totalReel)}</td>
            <td className="border border-gray-300 px-2 py-1" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function ExportBilanCerfa({ params }: { params: Promise<{ id: string; bilanId: string }> }) {
  const { id, bilanId } = use(params);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [lignes, setLignes] = useState<BilanLigne[]>([]);
  const [indicateurs, setIndicateurs] = useState<BilanIndicateur[]>([]);
  const [demande, setDemande] = useState<DemandeExport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/bilans/${bilanId}`).then(r => r.json()),
      fetch(`/api/demandes/${id}`).then(r => r.json()),
    ]).then(([b, d]) => {
      setBilan(b.bilan ?? null);
      setLignes(b.lignes ?? []);
      setIndicateurs(b.indicateurs ?? []);
      setDemande(d.demande ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, bilanId]);

  if (loading) return <div className="p-8 text-gray-400">Chargement…</div>;
  if (!bilan || !demande) return <div className="p-8 text-red-500">Bilan introuvable</div>;

  const asso = demande.associations;

  const chargesDirectes = lignes.filter(l => l.sens === 'charge' && !isCVN(l.compte) && !l.est_charge_commune);
  const chargesIndirectes = lignes.filter(l => l.sens === 'charge' && !isCVN(l.compte) && l.est_charge_commune);
  const chargesCVN = lignes.filter(l => l.sens === 'charge' && isCVN(l.compte));
  const produitsHorsCVN = lignes.filter(l => l.sens === 'produit' && !isCVN(l.compte));
  const produitsCVN = lignes.filter(l => l.sens === 'produit' && isCVN(l.compte));

  const sumPrevu = (rows: BilanLigne[]) => rows.reduce((s, l) => s + l.montant_prevu, 0);
  const sumReel = (rows: BilanLigne[]) => rows.reduce((s, l) => s + (l.montant_reel ?? 0), 0);

  const totalChargesHorsCVNPrevu = sumPrevu(chargesDirectes) + sumPrevu(chargesIndirectes);
  const totalChargesHorsCVNReel = sumReel(chargesDirectes) + sumReel(chargesIndirectes);
  const totalProduitsReel = sumReel(produitsHorsCVN) + sumReel(produitsCVN);

  const montantSubvention = demande.montant_obtenu ?? demande.montant_demande ?? 0;
  const pctSubvention = totalProduitsReel > 0 ? (montantSubvention / totalProduitsReel) * 100 : null;

  // Écarts significatifs (>10 %) avec commentaire, agrégés pour le feuillet 3
  const ecartsSignificatifs = lignes.filter(l => {
    if (l.montant_reel == null || l.montant_prevu === 0) return false;
    return Math.abs((l.montant_reel - l.montant_prevu) / l.montant_prevu) > 0.10;
  });

  const titreBilan = bilan.type === 'final' ? 'Bilan final' : `Bilan intermédiaire n°${bilan.numero_ordre}`;

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white min-h-screen">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="flex items-center gap-2 mb-6 print:hidden">
        <a href={`/demandes/${id}/bilans/${bilanId}`} className="btn btn-ghost text-sm">← Retour au bilan</a>
        <div className="flex-1" />
        <button onClick={() => window.print()} className="btn btn-primary text-sm">🖨 Imprimer / PDF</button>
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-1">Compte rendu financier de subvention</h1>
      <p className="text-sm text-gray-500 mb-6">
        Structure CERFA 15059 — {titreBilan} — période {dateFr(bilan.date_debut)} → {dateFr(bilan.date_fin)}
      </p>

      {/* ─── Feuillet 1 : bilan qualitatif ─── */}
      <Feuillet numero={1} titre="Bilan qualitatif de l'action réalisée">
        <table className="w-full text-sm mb-4"><tbody>
          <tr><td className="py-1 pr-4 text-gray-500" style={{ width: '220px' }}>Association</td><td className="py-1 font-medium">{asso?.nom ?? '—'}</td></tr>
          {asso?.siret && <tr><td className="py-1 pr-4 text-gray-500">SIRET</td><td className="py-1">{asso.siret}</td></tr>}
          {asso?.rna && <tr><td className="py-1 pr-4 text-gray-500">N° RNA</td><td className="py-1">{asso.rna}</td></tr>}
          {(asso?.adresse || asso?.ville) && (
            <tr><td className="py-1 pr-4 text-gray-500">Adresse</td><td className="py-1">{[asso?.adresse, asso?.code_postal, asso?.ville].filter(Boolean).join(', ')}</td></tr>
          )}
          {demande.plateforme_identifiant_dossier && (
            <tr><td className="py-1 pr-4 text-gray-500">N° dossier / convention</td><td className="py-1">{demande.plateforme_identifiant_dossier}</td></tr>
          )}
          <tr><td className="py-1 pr-4 text-gray-500">Intitulé de l&apos;action</td><td className="py-1">{demande.titre_projet ?? '—'}</td></tr>
          {bilan.statut_action && (
            <tr><td className="py-1 pr-4 text-gray-500">Réalisation</td><td className="py-1">
              {bilan.statut_action === 'realise' ? 'Réalisée' : bilan.statut_action === 'partiellement_realise' ? 'Partiellement réalisée' : 'Non réalisée'}
            </td></tr>
          )}
        </tbody></table>

        {bilan.rapport_activite && (
          <>
            <p className="text-sm font-semibold text-gray-800 mb-1">Description de la mise en œuvre</p>
            <p className="text-sm whitespace-pre-wrap mb-4">{bilan.rapport_activite}</p>
          </>
        )}

        {bilan.beneficiaires_par_type && bilan.beneficiaires_par_type.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-1">Bénéficiaires par type de public</p>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-left text-gray-500 bg-gray-50">
                <th className="border border-gray-300 px-2 py-1">Type de public</th>
                <th className="border border-gray-300 px-2 py-1 text-right" style={{ width: '110px' }}>Nombre</th>
              </tr></thead>
              <tbody>{bilan.beneficiaires_par_type.map((b, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-1">{b.type}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{b.nombre ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {bilan.dates_lieux_realisation && bilan.dates_lieux_realisation.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-1">Dates et lieux de réalisation</p>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-left text-gray-500 bg-gray-50">
                <th className="border border-gray-300 px-2 py-1">Du</th>
                <th className="border border-gray-300 px-2 py-1">Au</th>
                <th className="border border-gray-300 px-2 py-1">Lieu</th>
              </tr></thead>
              <tbody>{bilan.dates_lieux_realisation.map((d, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-1">{dateFr(d.date_debut)}</td>
                  <td className="border border-gray-300 px-2 py-1">{dateFr(d.date_fin)}</td>
                  <td className="border border-gray-300 px-2 py-1">{d.lieu}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {indicateurs.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-1">Objectifs atteints au regard des indicateurs</p>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-left text-gray-500 bg-gray-50">
                <th className="border border-gray-300 px-2 py-1">Indicateur</th>
                <th className="border border-gray-300 px-2 py-1">Attendu</th>
                <th className="border border-gray-300 px-2 py-1">Obtenu</th>
              </tr></thead>
              <tbody>{indicateurs.map(ind => (
                <tr key={ind.id}>
                  <td className="border border-gray-300 px-2 py-1">{ind.indicateur}</td>
                  <td className="border border-gray-300 px-2 py-1">{ind.resultat_attendu ?? '—'}</td>
                  <td className="border border-gray-300 px-2 py-1">{ind.resultat_obtenu ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {bilan.bilan_qualitatif && (
          <>
            <p className="text-sm font-semibold text-gray-800 mb-1">Bilan qualitatif</p>
            <p className="text-sm whitespace-pre-wrap">{bilan.bilan_qualitatif}</p>
          </>
        )}
      </Feuillet>

      {/* ─── Feuillet 2 : tableau de synthèse ─── */}
      <Feuillet numero={2} titre="Tableau de synthèse — Prévision / Réalisation">
        <LigneTable titre="Charges directes affectées à l'action" rows={chargesDirectes} />
        <LigneTable titre="Charges indirectes réparties affectées à l'action" rows={chargesIndirectes} avecCle />
        <LigneTable titre="Emploi des contributions volontaires en nature (86)" rows={chargesCVN} />
        <LigneTable titre="Ressources affectées à l'action" rows={produitsHorsCVN} />
        <LigneTable titre="Contributions volontaires en nature (87)" rows={produitsCVN} />

        <table className="w-full text-sm border-collapse mt-2">
          <tbody>
            <tr className="bg-gray-100 font-semibold">
              <td className="border border-gray-300 px-2 py-1">TOTAL DES CHARGES HORS CVN</td>
              <td className="border border-gray-300 px-2 py-1 text-right" style={{ width: '110px' }}>{eur(totalChargesHorsCVNPrevu)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right" style={{ width: '110px' }}>{eur(totalChargesHorsCVNReel)}</td>
            </tr>
            <tr className="bg-gray-100 font-semibold">
              <td className="border border-gray-300 px-2 py-1">TOTAL DONT CVN (86)</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{eur(sumPrevu(chargesCVN))}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{eur(sumReel(chargesCVN))}</td>
            </tr>
            <tr className="bg-gray-100 font-semibold">
              <td className="border border-gray-300 px-2 py-1">TOTAL DES PRODUITS HORS CVN</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{eur(sumPrevu(produitsHorsCVN))}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{eur(sumReel(produitsHorsCVN))}</td>
            </tr>
            <tr className="bg-gray-100 font-semibold">
              <td className="border border-gray-300 px-2 py-1">TOTAL DONT CVN (87)</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{eur(sumPrevu(produitsCVN))}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{eur(sumReel(produitsCVN))}</td>
            </tr>
          </tbody>
        </table>

        <div className="border-2 border-gray-800 rounded p-3 mt-4 text-sm font-medium">
          La subvention de {eur(montantSubvention)} représente{' '}
          {pctSubvention != null ? `${pctSubvention.toFixed(1)} %` : '— %'} du total des produits :{' '}
          {eur(totalProduitsReel)}.
        </div>
      </Feuillet>

      {/* ─── Feuillet 3 : annexe ─── */}
      <Feuillet numero={3} titre="Annexe — Règles, écarts et attestation">
        <p className="text-sm font-semibold text-gray-800 mb-1">Règles de répartition des charges indirectes affectées à l&apos;action</p>
        <p className="text-sm whitespace-pre-wrap mb-4">{bilan.regles_repartition_charges_indirectes || '—'}</p>

        <p className="text-sm font-semibold text-gray-800 mb-1">Explications sur les écarts entre budget prévisionnel et réalisation</p>
        {bilan.commentaire_financier && <p className="text-sm whitespace-pre-wrap mb-2">{bilan.commentaire_financier}</p>}
        {ecartsSignificatifs.length > 0 ? (
          <ul className="text-sm list-disc pl-5 mb-4 space-y-1">
            {ecartsSignificatifs.map(l => {
              const pct = ((l.montant_reel! - l.montant_prevu) / l.montant_prevu) * 100;
              return (
                <li key={l.id}>
                  <span className="font-medium">{l.sous_categorie || l.bailleur_detail || l.compte}</span>
                  {' '}({l.compte}) : prévu {eur(l.montant_prevu)}, réalisé {eur(l.montant_reel)} ({pct > 0 ? '+' : ''}{pct.toFixed(1)} %)
                  {l.commentaire_ecart ? ` — ${l.commentaire_ecart}` : ''}
                </li>
              );
            })}
          </ul>
        ) : (
          !bilan.commentaire_financier && <p className="text-sm text-gray-500 mb-4">Aucun écart significatif (&gt;10 %) constaté.</p>
        )}

        <p className="text-sm font-semibold text-gray-800 mb-1">Méthode de valorisation des contributions volontaires en nature</p>
        <p className="text-sm whitespace-pre-wrap mb-4">{bilan.methode_valorisation_cvn || '—'}</p>

        <p className="text-sm font-semibold text-gray-800 mb-1">Observations à formuler sur le compte rendu financier</p>
        <p className="text-sm whitespace-pre-wrap mb-6">{bilan.observations || '—'}</p>

        <div className="border-2 border-gray-800 rounded p-4 text-sm" style={{ breakInside: 'avoid' }}>
          <p className="mb-3">
            Je soussigné(e), <span className="font-medium">{bilan.signe_par || '________________________'}</span>,
            représentant(e) légal(e) de l&apos;association {asso?.nom ?? ''}, certifie exactes les informations du présent compte rendu.
          </p>
          <p>Fait le <span className="font-medium">{bilan.signe_le ? dateFr(bilan.signe_le) : '____ / ____ / ________'}</span></p>
          <p className="mt-4 text-gray-500">Signature :</p>
          <div style={{ height: '60px' }} />
        </div>
      </Feuillet>
    </div>
  );
}
