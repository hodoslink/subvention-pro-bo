'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Bilan } from '@/lib/supabase';

type DemandeMin = {
  id: string;
  titre_projet?: string;
  periode_debut?: string;
  periode_fin?: string;
};

const BILAN_STATUT_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  valide: 'bg-emerald-100 text-emerald-700',
  transmis: 'bg-blue-100 text-blue-700',
};

const BILAN_STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  valide: 'Validé',
  transmis: 'Transmis',
};

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BilansPage() {
  const { id } = useParams<{ id: string }>();
  const [demande, setDemande] = useState<DemandeMin | null>(null);
  const [bilans, setBilans] = useState<Bilan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'intermediaire' | 'final'>('intermediaire');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const [demRes, bilRes] = await Promise.all([
        fetch(`/api/demandes/${id}`),
        fetch(`/api/demandes/${id}/bilans`),
      ]);
      const demData = await demRes.json();
      const bilData = await bilRes.json();
      setDemande(demData.demande ?? null);
      setBilans(bilData.bilans ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  function openModal(type: 'intermediaire' | 'final') {
    setModalType(type);
    setError('');
    if (demande) {
      setDateDebut(demande.periode_debut ?? '');
      setDateFin(type === 'final' ? (demande.periode_fin ?? '') : new Date().toISOString().slice(0, 10));
    }
    setShowModal(true);
  }

  async function creerBilan() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/demandes/${id}/bilans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: modalType, date_debut: dateDebut, date_fin: dateFin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de la création');
        return;
      }
      setBilans(prev => [...prev, data.bilan]);
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  const hasFinal = bilans.some(b => b.type === 'final');
  const hasIntermedaireBrouillon = bilans.some(b => b.type === 'intermediaire' && b.statut === 'brouillon');

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/demandes/${id}`} className="text-sm text-blue-600 hover:underline">
          ← Retour à la fiche demande
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          Bilans d&apos;exécution
        </h1>
        {demande?.titre_projet && (
          <p className="text-gray-500 mt-1">{demande.titre_projet}</p>
        )}
      </div>

      {bilans.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
          La demande est acceptée. Créez un premier bilan intermédiaire dès que le projet démarre.
        </div>
      )}

      {bilans.length > 0 && (
        <div className="space-y-3 mb-8">
          {bilans.map(b => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.type === 'final' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                    {b.type === 'final' ? 'Bilan final' : `Intermédiaire n°${b.numero_ordre}`}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${BILAN_STATUT_COLORS[b.statut] ?? ''}`}>
                    {BILAN_STATUT_LABELS[b.statut] ?? b.statut}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Période : {formatDate(b.date_debut)} → {formatDate(b.date_fin)}
                </p>
              </div>
              <Link
                href={`/demandes/${id}/bilans/${b.id}`}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Ouvrir →
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => openModal('intermediaire')}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
        >
          + Créer un bilan intermédiaire
        </button>
        {!hasFinal && (
          <button
            onClick={() => openModal('final')}
            disabled={hasIntermedaireBrouillon}
            title={hasIntermedaireBrouillon ? 'Validez d\'abord les bilans intermédiaires en brouillon' : undefined}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Créer le bilan final
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Créer un bilan {modalType === 'final' ? 'final' : 'intermédiaire'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Les lignes budgétaires actuelles seront copiées dans ce bilan comme montants prévisionnels.
              Vous renseignerez les montants réels dans le bilan.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date de début</label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={e => setDateDebut(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date de fin</label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={e => setDateFin(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={creerBilan}
                disabled={saving || !dateDebut || !dateFin}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Création…' : 'Créer et initialiser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
