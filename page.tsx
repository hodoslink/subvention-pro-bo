"use client";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { STATUTS, STATUTS_ACTIFS } from "@/lib/statuts";
import type { Demande, Statut } from "@/lib/supabase";
import Link from "next/link";

type DemandeCard = Demande & { associations: { nom: string; ville?: string } };

const STEP_META: Record<string, { hint: string; icon: string }> = {
  collecte:         { icon: "📂", hint: "Rassemblez les documents" },
  redaction:        { icon: "✏️", hint: "Rédigez la demande" },
  controle_compta:  { icon: "🔢", hint: "Validez les chiffres avec le comptable" },
  depose:           { icon: "📬", hint: "Dossier envoyé — surveillez votre messagerie" },
  decision_attente: { icon: "⏳", hint: "Attendez la décision, relancez si besoin" },
};

const COL_COLORS: Record<string, { header: string; badge: string; drop: string }> = {
  collecte:         { header: "bg-slate-50 border-slate-200",   badge: "bg-slate-100 text-slate-600",   drop: "bg-slate-100/60 ring-slate-300" },
  redaction:        { header: "bg-blue-50 border-blue-200",     badge: "bg-blue-100 text-blue-700",     drop: "bg-blue-100/60 ring-blue-300" },
  controle_compta:  { header: "bg-amber-50 border-amber-200",   badge: "bg-amber-100 text-amber-700",   drop: "bg-amber-100/60 ring-amber-300" },
  depose:           { header: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-700", drop: "bg-purple-100/60 ring-purple-300" },
  decision_attente: { header: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700", drop: "bg-orange-100/60 ring-orange-300" },
};

export default function SuiviPage() {
  const [demandes, setDemandes] = useState<DemandeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demandes")
      .then(r => r.json())
      .then(({ demandes: d }) => { setDemandes(d || []); setLoading(false); });
  }, []);

  const byStatut = (s: Statut) => demandes.filter(d => d.statut === s);
  const enCours = demandes.filter(d => (STATUTS_ACTIFS as string[]).includes(d.statut));
  const acceptees = byStatut("accepte");
  const refusees = byStatut("refuse");
  const totalMontantAccepte = acceptees.reduce((s, d) => s + (d.montant_obtenu ?? d.montant_demande ?? 0), 0);

  const moveCard = async (demandeId: string, newStatut: Statut) => {
    const prev = demandes.find(d => d.id === demandeId);
    if (!prev || prev.statut === newStatut) return;
    // Optimistic
    setDemandes(all => all.map(d => d.id === demandeId ? { ...d, statut: newStatut } : d));
    const res = await fetch(`/api/demandes/${demandeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: newStatut }),
    });
    if (!res.ok) {
      // Rollback
      setDemandes(all => all.map(d => d.id === demandeId ? { ...d, statut: prev.statut } : d));
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('demandeId', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent, statut: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(statut);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, statut: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('demandeId');
    if (id) moveCard(id, statut as Statut);
    setDragOver(null);
    setDraggingId(null);
  };

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
              {enCours.length === 0 ? "Aucun dossier en cours" : `${enCours.length} dossier${enCours.length > 1 ? "s" : ""} en cours`}
              {acceptees.length > 0 && (
                <span className="ml-2 text-green-600 font-medium">
                  · {acceptees.length} accepté{acceptees.length > 1 ? "s" : ""}
                  {totalMontantAccepte > 0 && ` — ${totalMontantAccepte.toLocaleString("fr-FR")} € obtenus`} 🎉
                </span>
              )}
            </p>
          </div>
          <Link href="/nouvelle-demande" className="btn btn-primary text-sm shrink-0">+ Nouvelle demande</Link>
        </div>

        {/* Barre progression */}
        {demandes.length > 0 && (
          <div className="px-6 py-3 bg-white border-b border-gray-100">
            <div className="flex items-center gap-1 max-w-2xl">
              {STATUTS_ACTIFS.map((s, i) => {
                const count = byStatut(s as Statut).length;
                const pct = enCours.length > 0 ? (count / enCours.length) * 100 : 0;
                const colors: Record<string, string> = {
                  collecte: "bg-slate-400", redaction: "bg-blue-400", controle_compta: "bg-amber-400",
                  depose: "bg-purple-400", decision_attente: "bg-orange-400",
                };
                return (
                  <div key={s} className="flex items-center gap-1 flex-1">
                    {i > 0 && <div className="text-gray-200 text-xs">›</div>}
                    <div className="flex-1 relative group">
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${colors[s]}`} style={{ width: `${Math.max(pct, count > 0 ? 20 : 0)}%` }} />
                      </div>
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {STATUTS[s as Statut].label} · {count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Glissez les cartes pour changer le statut</p>
          </div>
        )}

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-6 items-start min-w-max">
            {STATUTS_ACTIFS.map(statut => {
              const items = byStatut(statut as Statut);
              const s = STATUTS[statut as Statut];
              const meta = STEP_META[statut];
              const col = COL_COLORS[statut];
              const isDropTarget = dragOver === statut;

              return (
                <div key={statut} className="w-72 flex-shrink-0 flex flex-col gap-3">
                  {/* En-tête */}
                  <div className={`rounded-xl border p-3.5 ${col.header}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <span className="font-semibold text-sm text-gray-800">{s.label}</span>
                      </div>
                      <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${col.badge}`}>{items.length}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{meta.hint}</p>
                  </div>

                  {/* Zone de drop */}
                  <div
                    className={[
                      "flex flex-col gap-3 min-h-24 rounded-xl transition-all duration-150 p-1 -m-1",
                      isDropTarget ? `ring-2 ${col.drop}` : "",
                    ].join(" ")}
                    onDragOver={e => handleDragOver(e, statut)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, statut)}
                  >
                    {items.length === 0 ? (
                      <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isDropTarget ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                        <p className="text-xs text-gray-400">{isDropTarget ? 'Déposer ici' : 'Aucun dossier'}</p>
                      </div>
                    ) : (
                      items.map(d => (
                        <DossierCard
                          key={d.id}
                          demande={d}
                          isDragging={draggingId === d.id}
                          onDragStart={e => handleDragStart(e, d.id)}
                          onDragEnd={handleDragEnd}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Clôturées (pas de drop — décision via fiche) */}
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
                  <p className="text-xs text-gray-400">Décision reçue — modifier via la fiche</p>
                </div>
                {[...acceptees, ...refusees].map(d => (
                  <DossierCard
                    key={d.id}
                    demande={d}
                    isDragging={draggingId === d.id}
                    onDragStart={e => handleDragStart(e, d.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            )}
          </div>

          {demandes.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-6">
              <div className="text-5xl">📭</div>
              <div>
                <p className="font-semibold text-gray-700">Aucun dossier pour l'instant</p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs">Créez votre première demande de subvention pour démarrer le suivi.</p>
              </div>
              <Link href="/nouvelle-demande" className="btn btn-primary">+ Créer un dossier</Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function DossierCard({
  demande: d,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  demande: DemandeCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const ageDays = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
  const ageLabel = ageDays === 0 ? "aujourd'hui" : ageDays === 1 ? "hier" : `${ageDays}j`;
  const isAccepte = d.statut === "accepte";
  const isRefuse = d.statut === "refuse";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={[
        "bg-white rounded-xl border p-4 transition-all duration-150 select-none",
        "cursor-grab active:cursor-grabbing",
        isDragging ? "opacity-40 scale-95 shadow-lg" : "hover:shadow-md hover:-translate-y-0.5",
        isAccepte ? "border-green-200 hover:border-green-300" : isRefuse ? "border-red-100 opacity-75" : "border-gray-200 hover:border-blue-200",
      ].join(" ")}
    >
      {/* Grip handle */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-sm text-gray-900 leading-snug">{d.associations?.nom ?? "—"}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {isAccepte && <span className="text-green-500 text-sm">✓</span>}
          {isRefuse && <span className="text-red-400 text-sm">✗</span>}
          <span className="text-gray-200 text-xs leading-none select-none" title="Glisser pour déplacer">⠿</span>
        </div>
      </div>

      {d.titre_projet && (
        <p className="text-xs text-gray-500 leading-snug line-clamp-2 mb-3">{d.titre_projet}</p>
      )}

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
            <span className="text-xs font-medium text-gray-700">{d.montant_demande.toLocaleString("fr-FR")} €</span>
            {isAccepte && d.montant_obtenu != null && (
              <span className="text-xs text-green-600 font-medium">→ {d.montant_obtenu.toLocaleString("fr-FR")} € obtenu</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <span className="text-xs text-gray-400 truncate max-w-[100px]">
          {d.presta_redacteur ? `@${d.presta_redacteur}` : <span className="italic">non assigné</span>}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{ageLabel}</span>
          <Link
            href={`/demandes/${d.id}`}
            onClick={e => e.stopPropagation()}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium shrink-0"
          >
            Ouvrir →
          </Link>
        </div>
      </div>
    </div>
  );
}
