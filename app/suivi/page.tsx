"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { STATUTS, STATUTS_ACTIFS } from "@/lib/statuts";
import type { Demande, Statut } from "@/lib/supabase";
import Link from "next/link";

type DemandeCard = Demande & { associations: { nom: string; ville?: string } };

const STEP_META: Record<string, { hint: string; icon: string; action: string }> = {
  collecte: {
    icon: "📂",
    hint: "Rassemblez les documents",
    action: "Compléter les infos",
  },
  redaction: {
    icon: "✏️",
    hint: "Rédigez la demande",
    action: "Ouvrir et rédiger",
  },
  controle_compta: {
    icon: "🔢",
    hint: "Validez les chiffres avec le comptable",
    action: "Vérifier les budgets",
  },
  depose: {
    icon: "📬",
    hint: "Dossier envoyé — surveillez votre messagerie",
    action: "Voir le dossier",
  },
  decision_attente: {
    icon: "⏳",
    hint: "Attendez la décision, relancez si besoin",
    action: "Voir le dossier",
  },
};

export default function SuiviPage() {
  const [demandes, setDemandes] = useState<DemandeCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/demandes")
      .then((r) => r.json())
      .then(({ demandes: d }) => {
        setDemandes(d || []);
        setLoading(false);
      });
  }, []);

  const byStatut = (s: Statut) => demandes.filter((d) => d.statut === s);
  const enCours = demandes.filter((d) =>
    (STATUTS_ACTIFS as string[]).includes(d.statut)
  );
  const acceptees = byStatut("accepte");
  const refusees = byStatut("refuse");

  const totalMontantAccepte = acceptees.reduce(
    (sum, d) => sum + (d.montant_obtenu ?? d.montant_demande ?? 0),
    0
  );

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="text-4xl animate-bounce">📋</div>
          <p className="text-sm text-gray-400">Chargement des dossiers…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <div className="px-6 py-5 bg-white border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Suivi des dossiers</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {enCours.length === 0
                ? "Aucun dossier en cours"
                : `${enCours.length} dossier${enCours.length > 1 ? "s" : ""} en cours`}
              {acceptees.length > 0 && (
                <span className="ml-2 text-green-600 font-medium">
                  · {acceptees.length} accepté{acceptees.length > 1 ? "s" : ""}{" "}
                  {totalMontantAccepte > 0 &&
                    `— ${totalMontantAccepte.toLocaleString("fr-FR")} € obtenus`}{" "}
                  🎉
                </span>
              )}
            </p>
          </div>
          <Link
            href="/nouvelle-demande"
            className="btn btn-primary text-sm shrink-0"
          >
            + Nouvelle demande
          </Link>
        </div>

        {/* Pipeline barre de progression */}
        {demandes.length > 0 && (
          <div className="px-6 py-3 bg-white border-b border-gray-100">
            <div className="flex items-center gap-1 max-w-2xl">
              {STATUTS_ACTIFS.map((s, i) => {
                const count = byStatut(s as Statut).length;
                const total = enCours.length;
                const pct = total > 0 ? (count / total) * 100 : 0;
                const colors: Record<string, string> = {
                  collecte: "bg-slate-400",
                  redaction: "bg-blue-400",
                  controle_compta: "bg-amber-400",
                  depose: "bg-purple-400",
                  decision_attente: "bg-orange-400",
                };
                return (
                  <div key={s} className="flex items-center gap-1 flex-1">
                    {i > 0 && <div className="text-gray-200 text-xs">›</div>}
                    <div className="flex-1 relative group">
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${colors[s]}`}
                          style={{ width: `${Math.max(pct, count > 0 ? 20 : 0)}%` }}
                        />
                      </div>
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {STATUTS[s as Statut].label} · {count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Progression globale du pipeline
            </p>
          </div>
        )}

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-6 items-start min-w-max">
            {STATUTS_ACTIFS.map((statut) => {
              const items = byStatut(statut as Statut);
              const s = STATUTS[statut as Statut];
              const meta = STEP_META[statut];

              const colColors: Record<string, { header: string; badge: string }> = {
                collecte:         { header: "bg-slate-50 border-slate-200",   badge: "bg-slate-100 text-slate-600" },
                redaction:        { header: "bg-blue-50 border-blue-200",     badge: "bg-blue-100 text-blue-700" },
                controle_compta:  { header: "bg-amber-50 border-amber-200",   badge: "bg-amber-100 text-amber-700" },
                depose:           { header: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-700" },
                decision_attente: { header: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700" },
              };
              const col = colColors[statut];

              return (
                <div key={statut} className="w-72 flex-shrink-0 flex flex-col gap-3">
                  {/* Column header */}
                  <div className={`rounded-xl border p-3.5 ${col.header}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <span className="font-semibold text-sm text-gray-800">
                          {s.label}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-bold rounded-full px-2 py-0.5 ${col.badge}`}
                      >
                        {items.length}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{meta.hint}</p>
                  </div>

                  {/* Cards */}
                  {items.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-xs text-gray-400">Aucun dossier ici</p>
                    </div>
                  ) : (
                    items.map((d) => (
                      <DossierCard key={d.id} demande={d} actionLabel={meta.action} />
                    ))
                  )}
                </div>
              );
            })}

            {/* Colonne clôturées */}
            {(acceptees.length > 0 || refusees.length > 0) && (
              <div className="w-72 flex-shrink-0 flex flex-col gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏁</span>
                      <span className="font-semibold text-sm text-gray-700">Clôturées</span>
                    </div>
                    <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-gray-200 text-gray-600">
                      {acceptees.length + refusees.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Dossiers ayant reçu une décision</p>
                </div>
                {acceptees.map((d) => (
                  <DossierCard key={d.id} demande={d} actionLabel="Voir la décision" />
                ))}
                {refusees.map((d) => (
                  <DossierCard key={d.id} demande={d} actionLabel="Voir la décision" />
                ))}
              </div>
            )}
          </div>

          {/* Empty state global */}
          {demandes.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
              <div className="text-5xl">📭</div>
              <div>
                <p className="font-semibold text-gray-700">Aucun dossier pour l'instant</p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs">
                  Créez votre première demande de subvention pour démarrer le suivi.
                </p>
              </div>
              <Link href="/nouvelle-demande" className="btn btn-primary">
                + Créer un dossier
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function DossierCard({
  demande: d,
  actionLabel,
}: {
  demande: DemandeCard;
  actionLabel: string;
}) {
  const ageDays = Math.floor(
    (Date.now() - new Date(d.created_at).getTime()) / 86400000
  );
  const ageLabel =
    ageDays === 0 ? "aujourd'hui" : ageDays === 1 ? "hier" : `${ageDays}j`;

  const isAccepte = d.statut === "accepte";
  const isRefuse = d.statut === "refuse";

  return (
    <Link href={`/demandes/${d.id}`} className="block group">
      <div
        className={[
          "bg-white rounded-xl border p-4 transition-all duration-150",
          "hover:shadow-md hover:-translate-y-0.5",
          isAccepte
            ? "border-green-200 hover:border-green-400"
            : isRefuse
            ? "border-red-100 hover:border-red-300 opacity-75"
            : "border-gray-200 hover:border-blue-300",
        ].join(" ")}
      >
        {/* Association */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-sm text-gray-900 leading-snug group-hover:text-blue-700 transition-colors">
            {d.associations?.nom ?? "—"}
          </p>
          {isAccepte && <span className="text-green-500 text-sm shrink-0">✓</span>}
          {isRefuse && <span className="text-red-400 text-sm shrink-0">✗</span>}
        </div>

        {/* Projet */}
        {d.titre_projet && (
          <p className="text-xs text-gray-500 leading-snug line-clamp-2 mb-3">
            {d.titre_projet}
          </p>
        )}

        {/* Méta */}
        <div className="space-y-1 mb-3">
          {d.bailleur_nom && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-300 text-xs">→</span>
              <span className="text-xs text-gray-500 truncate">{d.bailleur_nom}</span>
            </div>
          )}
          {d.montant_demande != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-300 text-xs">€</span>
              <span className="text-xs font-medium text-gray-700">
                {d.montant_demande.toLocaleString("fr-FR")} €
              </span>
              {isAccepte && d.montant_obtenu != null && (
                <span className="text-xs text-green-600 font-medium">
                  → {d.montant_obtenu.toLocaleString("fr-FR")} € obtenu
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400 truncate max-w-[110px]">
            {d.presta_redacteur ? `@${d.presta_redacteur}` : <span className="italic">non assigné</span>}
          </span>
          <span className="text-xs text-gray-400">{ageLabel}</span>
        </div>
      </div>
    </Link>
  );
}
