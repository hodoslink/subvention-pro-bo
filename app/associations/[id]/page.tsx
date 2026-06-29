"use client";
import { useEffect, useState, use } from "react";
import { AppShell } from "@/components/AppShell";
import { StatutBadge } from "@/components/StatutBadge";
import { DocumentList } from "@/components/DocumentList";
import type { Association, Demande } from "@/lib/supabase";
import Link from "next/link";

export default function FicheAssociation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [asso, setAsso] = useState<Association | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/associations/${id}`)
      .then((r) => r.json())
      .then(({ association, demandes: d }) => {
        setAsso(association);
        setDemandes(d || []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;
  if (!asso) return <AppShell><div className="p-8 text-red-500">Association introuvable</div></AppShell>;

  const totalDemande = demandes.reduce((s, d) => s + (d.montant_demande || 0), 0);
  const totalObtenu = demandes.reduce((s, d) => s + (d.montant_obtenu || 0), 0);
  const acceptes = demandes.filter((d) => d.statut === 'accepte').length;

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/associations" className="text-xs text-gray-400 hover:text-gray-600">← Associations</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{asso.nom}</h1>
          {asso.ville && <p className="text-sm text-gray-500">{asso.code_postal} {asso.ville}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Dossiers soumis</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{demandes.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Acceptés</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{acceptes}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Obtenu (total)</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{totalObtenu.toLocaleString('fr-FR')} €</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Informations</h2>
            {[
              ['RNA', asso.rna],
              ['SIRET', asso.siret],
              ['SIREN', asso.siren],
              ['Forme juridique', asso.forme_juridique],
              ['Adresse', [asso.adresse, asso.code_postal, asso.ville].filter(Boolean).join(', ')],
              ['Membres', asso.nb_membres?.toString()],
              ['Création', asso.date_creation ? new Date(asso.date_creation).toLocaleDateString('fr-FR') : undefined],
            ].map(([label, value]) =>
              value ? (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-900 font-medium text-right max-w-[60%]">{value}</span>
                </div>
              ) : null
            )}
          </div>

          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Contact</h2>
            {[
              ['Nom', asso.contact_nom],
              ['Rôle', asso.contact_role],
              ['Email', asso.contact_email],
              ['Téléphone', asso.contact_telephone],
            ].map(([label, value]) =>
              value ? (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-900 font-medium text-right">{value}</span>
                </div>
              ) : null
            )}
          </div>
        </div>

        {/* Documents de l'association */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Documents de l'association</h2>
          <p className="text-xs text-gray-400">Statuts, comptes annuels, PV d'AG, RIB… Cliquez sur « 🤖 Analyser » pour auto-compléter la fiche.</p>
          <DocumentList entityType="association" entityId={id} onApplied={() => window.location.reload()} />
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Historique des demandes
            {totalDemande > 0 && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                {totalDemande.toLocaleString('fr-FR')} € demandés · {totalObtenu.toLocaleString('fr-FR')} € obtenus
              </span>
            )}
          </h2>
          <div className="divide-y divide-gray-50">
            {demandes.length === 0 && (
              <p className="text-sm text-gray-400 py-4">Aucune demande pour cette association</p>
            )}
            {demandes.map((d) => (
              <Link
                key={d.id}
                href={`/demandes/${d.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 px-1 rounded transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.titre_projet || '(sans titre)'}</p>
                  <p className="text-xs text-gray-500">
                    {d.bailleur_nom} · {new Date(d.created_at).getFullYear()}
                    {d.type_demande === 'renouvellement' && (
                      <span className="ml-1.5 text-amber-600">↻ renouvellement</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-right">
                    {d.montant_obtenu ? (
                      <p className="text-sm font-semibold text-green-600">{d.montant_obtenu.toLocaleString('fr-FR')} € obtenus</p>
                    ) : d.montant_demande ? (
                      <p className="text-sm text-gray-500">{d.montant_demande.toLocaleString('fr-FR')} € demandés</p>
                    ) : null}
                  </div>
                  <StatutBadge statut={d.statut} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
