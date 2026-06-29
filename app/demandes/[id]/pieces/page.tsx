"use client";
import { useEffect, useState, use, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import type { PieceRequise } from "@/lib/supabase";

const STATUT_LABELS: Record<PieceRequise['statut'], string> = {
  manquant: 'Manquant',
  fourni: 'Fourni',
  perime: 'Périmé',
  non_applicable: 'N/A',
};

const STATUT_COLORS: Record<PieceRequise['statut'], string> = {
  manquant: 'bg-red-100 text-red-700',
  fourni: 'bg-green-100 text-green-700',
  perime: 'bg-amber-100 text-amber-700',
  non_applicable: 'bg-gray-100 text-gray-500',
};

const STATUTS_ORDRE: PieceRequise['statut'][] = ['fourni', 'manquant', 'perime', 'non_applicable'];

export default function PiecesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pieces, setPieces] = useState<PieceRequise[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/demandes/${id}/pieces-requises`);
    const { pieces: p } = await r.json();
    setPieces(p ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function setStatut(piece: PieceRequise, statut: PieceRequise['statut']) {
    setUpdating(piece.id);
    const r = await fetch(`/api/pieces-requises/${piece.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    });
    if (r.ok) {
      const { piece: updated } = await r.json();
      setPieces(prev => prev.map(p => p.id === piece.id ? updated : p));
    }
    setUpdating(null);
  }

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;

  const nbFourni = pieces.filter(p => p.statut === 'fourni').length;
  const nbObligatoiresManquants = pieces.filter(p => p.obligatoire && p.statut === 'manquant').length;
  const total = pieces.length;

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href={`/demandes/${id}`} className="text-xs text-gray-400 hover:text-gray-600">← Retour au dossier</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Pièces justificatives</h1>
          <p className="text-xs text-gray-500 mt-0.5">Checklist documentaire générique — à collecter avant dépôt</p>
        </div>

        {/* Résumé */}
        <div className="card flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fournies</p>
            <p className="text-2xl font-bold text-gray-900">{nbFourni} / {total}</p>
          </div>
          {nbObligatoiresManquants > 0 && (
            <div>
              <p className="text-xs font-medium text-red-500 uppercase tracking-wide">Obligatoires manquantes</p>
              <p className="text-2xl font-bold text-red-600">{nbObligatoiresManquants}</p>
            </div>
          )}
          {nbObligatoiresManquants === 0 && (
            <div className="flex items-center">
              <p className="text-sm font-medium text-green-700">✓ Aucune pièce obligatoire manquante</p>
            </div>
          )}
        </div>

        {/* Liste */}
        <div className="card space-y-0">
          {pieces.map((piece, i) => (
            <div key={piece.id} className={['flex items-start gap-3 py-3', i < pieces.length - 1 ? 'border-b border-gray-100' : ''].join(' ')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-800">{piece.libelle}</p>
                  {piece.obligatoire && <span className="text-xs text-gray-400">*</span>}
                </div>
                {piece.statut === 'perime' && (
                  <p className="text-xs text-amber-600 mt-0.5">Document périmé — à renouveler avant dépôt</p>
                )}
              </div>

              {/* Statut actuel */}
              <span className={['shrink-0 text-xs font-medium px-2 py-0.5 rounded-full', STATUT_COLORS[piece.statut]].join(' ')}>
                {STATUT_LABELS[piece.statut]}
              </span>

              {/* Boutons de changement de statut */}
              <div className="shrink-0 flex gap-1">
                {STATUTS_ORDRE.filter(s => s !== piece.statut).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatut(piece, s)}
                    disabled={updating === piece.id}
                    className="btn btn-ghost text-xs py-0.5 px-1.5"
                    title={`Marquer comme ${STATUT_LABELS[s]}`}
                  >
                    {updating === piece.id ? '…' : STATUT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center">* Pièce obligatoire</p>
      </div>
    </AppShell>
  );
}
