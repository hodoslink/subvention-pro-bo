"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { Association } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NewAssoForm = { nom: string; contact_nom: string; contact_email: string; ville: string };

function NouvelleAssoModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState<NewAssoForm>({ nom: '', contact_nom: '', contact_email: '', ville: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.nom.trim()) { setError('Le nom est requis.'); return; }
    if (!form.contact_nom.trim()) { setError('Le contact est requis.'); return; }
    if (!form.contact_email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contact_email)) {
      setError('Email de contact invalide.'); return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/associations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: form.nom.trim(), contact_nom: form.contact_nom.trim(), contact_email: form.contact_email.trim(), ville: form.ville.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `Erreur ${res.status}`); return; }
      onCreated(data.association.id);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Nouvelle association</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nom de l'association *</label>
            <input className="field-input w-full" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex : Association Jeunes Talents" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nom du contact *</label>
            <input className="field-input w-full" value={form.contact_nom} onChange={e => setForm(f => ({ ...f, contact_nom: e.target.value }))} placeholder="Prénom Nom" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Email du contact *</label>
            <input className="field-input w-full" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="contact@asso.fr" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ville</label>
            <input className="field-input w-full" value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} placeholder="Paris" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn btn-ghost text-sm">Annuler</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary text-sm">
            {saving ? 'Création…' : 'Créer l\'association'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssociationsPage() {
  const router = useRouter();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async (search: string) => {
    setLoading(true);
    const res = await fetch(`/api/associations${search ? `?q=${encodeURIComponent(search)}` : ''}`);
    const json = await res.json();
    setAssociations(json.associations || []);
    setLoading(false);
  };

  useEffect(() => { load(''); }, []);

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {showModal && (
          <NouvelleAssoModal
            onClose={() => setShowModal(false)}
            onCreated={(id) => { setShowModal(false); router.push(`/associations/${id}`); }}
          />
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Associations</h1>
          <button onClick={() => setShowModal(true)} className="btn btn-primary text-sm">+ Nouvelle association</button>
        </div>

        <div className="card flex gap-3">
          <input
            className="field-input max-w-sm"
            placeholder="Rechercher par nom…"
            value={q}
            onChange={(e) => { setQ(e.target.value); load(e.target.value); }}
          />
        </div>

        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Nom</th>
                <th className="text-left px-4 py-3 font-medium">Ville</th>
                <th className="text-left px-4 py-3 font-medium">Contact</th>
                <th className="text-left px-4 py-3 font-medium">Profil</th>
                <th className="text-left px-4 py-3 font-medium">Créée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Chargement…</td></tr>
              ) : associations.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Aucune association</td></tr>
              ) : associations.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/associations/${a.id}`} className="text-blue-600 hover:underline font-medium">
                      {a.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.ville || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.contact_email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.statut_profil === 'complet'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {a.statut_profil}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(a.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
