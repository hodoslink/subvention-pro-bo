"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { Association } from "@/lib/supabase";
import Link from "next/link";

export default function AssociationsPage() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

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
        <h1 className="text-xl font-bold text-gray-900">Associations</h1>

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
