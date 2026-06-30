"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { Bailleur } from "@/lib/supabase";
import { BAILLEUR_TYPES } from "@/lib/supabase";

const TYPES = BAILLEUR_TYPES;

const PLATEFORME_TYPES = [
  { v: 'plateforme_numerique', l: 'Plateforme numérique' },
  { v: 'pdf_papier', l: 'PDF / papier' },
  { v: 'email', l: 'Email' },
  { v: 'autre', l: 'Autre' },
];

type Draft = {
  nom: string;
  type_bailleur: string;
  plateforme_nom: string;
  plateforme_url: string;
  plateforme_type: string;
  contact_referent_nom: string;
  contact_referent_email: string;
  contact_referent_telephone: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  nom: '', type_bailleur: '', plateforme_nom: '', plateforme_url: '',
  plateforme_type: 'autre', contact_referent_nom: '', contact_referent_email: '',
  contact_referent_telephone: '', notes: '',
});

function draftFromBailleur(b: Bailleur): Draft {
  return {
    nom: b.nom || '',
    type_bailleur: b.type_bailleur || '',
    plateforme_nom: b.plateforme_nom || '',
    plateforme_url: b.plateforme_url || '',
    plateforme_type: b.plateforme_type || 'autre',
    contact_referent_nom: b.contact_referent_nom || '',
    contact_referent_email: b.contact_referent_email || '',
    contact_referent_telephone: b.contact_referent_telephone || '',
    notes: b.notes || '',
  };
}

function FI({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} className="field-input text-sm" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default function BailleursPage() {
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () =>
    fetch('/api/bailleurs')
      .then(r => r.json())
      .then(({ bailleurs: b }) => { setBailleurs(b || []); setLoading(false); });

  useEffect(() => { load(); }, []);

  const setF = (k: keyof Draft, v: string) => setDraft(prev => ({ ...prev, [k]: v }));

  const startCreate = () => { setDraft(emptyDraft()); setEditId(null); setShowForm(true); };
  const startEdit = (b: Bailleur) => { setDraft(draftFromBailleur(b)); setEditId(b.id); setShowForm(true); };
  const cancelForm = () => { setShowForm(false); setEditId(null); };

  const save = async () => {
    setSaving(true);
    const body = {
      nom: draft.nom,
      type_bailleur: draft.type_bailleur || null,
      plateforme_nom: draft.plateforme_nom || null,
      plateforme_url: draft.plateforme_url || null,
      plateforme_type: draft.plateforme_type || null,
      contact_referent_nom: draft.contact_referent_nom || null,
      contact_referent_email: draft.contact_referent_email || null,
      contact_referent_telephone: draft.contact_referent_telephone || null,
      notes: draft.notes || null,
    };
    if (editId) {
      await fetch(`/api/bailleurs/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    } else {
      await fetch('/api/bailleurs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    }
    await load();
    setSaving(false);
    setShowForm(false);
    setEditId(null);
  };

  const del = async (id: string) => {
    if (!confirm('Supprimer ce bailleur ? Les demandes qui lui sont liées ne seront pas supprimées.')) return;
    setDeleting(id);
    await fetch(`/api/bailleurs/${id}`, { method: 'DELETE' });
    await load();
    setDeleting(null);
  };

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Référentiel bailleurs</h1>
            <p className="text-sm text-gray-500 mt-0.5">Plateformes de dépôt, contacts référents côté bailleur</p>
          </div>
          <button onClick={startCreate} className="btn btn-primary text-sm">+ Ajouter un bailleur</button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">{editId ? 'Modifier le bailleur' : 'Nouveau bailleur'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FI label="Nom *" value={draft.nom} onChange={v => setF('nom', v)} placeholder="Ex. Ville de Bobigny" />
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                <select className="field-input text-sm" value={draft.type_bailleur} onChange={e => setF('type_bailleur', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Plateforme de dépôt</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FI label="Nom de la plateforme" value={draft.plateforme_nom} onChange={v => setF('plateforme_nom', v)} placeholder="Ex. Dauphin, Portail Région…" />
                <FI label="URL" value={draft.plateforme_url} onChange={v => setF('plateforme_url', v)} placeholder="https://…" />
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Mode de dépôt</label>
                  <select className="field-input text-sm" value={draft.plateforme_type} onChange={e => setF('plateforme_type', e.target.value)}>
                    {PLATEFORME_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact côté bailleur</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FI label="Nom du référent" value={draft.contact_referent_nom} onChange={v => setF('contact_referent_nom', v)} />
                <FI label="Email" value={draft.contact_referent_email} onChange={v => setF('contact_referent_email', v)} type="email" />
                <FI label="Téléphone" value={draft.contact_referent_telephone} onChange={v => setF('contact_referent_telephone', v)} type="tel" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs font-medium text-gray-600 block mb-1">Notes internes</label>
              <textarea className="field-input text-sm" rows={2} value={draft.notes} onChange={e => setF('notes', e.target.value)} placeholder="Ex. Transmettre aussi en copie papier avant le 15/12" />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={cancelForm} className="btn btn-ghost text-sm">Annuler</button>
              <button onClick={save} disabled={saving || !draft.nom} className="btn btn-primary text-sm">
                {saving ? 'Enregistrement…' : editId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <p className="text-gray-400 text-sm">Chargement…</p>
        ) : bailleurs.length === 0 ? (
          <div className="card text-center py-10 text-gray-400 text-sm">
            Aucun bailleur encore créé. Ajoutez-en un pour commencer.
          </div>
        ) : (
          <div className="space-y-3">
            {bailleurs.map(b => (
              <div key={b.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{b.nom}</span>
                      {b.type_bailleur && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {TYPES.find(t => t.v === b.type_bailleur)?.l || b.type_bailleur}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      {b.plateforme_nom && (
                        <p>
                          Plateforme : <span className="text-gray-700">{b.plateforme_nom}</span>
                          {b.plateforme_url && (
                            <a href={b.plateforme_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">↗</a>
                          )}
                          {b.plateforme_type && b.plateforme_type !== 'autre' && (
                            <span className="ml-1 text-gray-400">({PLATEFORME_TYPES.find(t => t.v === b.plateforme_type)?.l})</span>
                          )}
                        </p>
                      )}
                      {b.contact_referent_nom && (
                        <p>
                          Contact : <span className="text-gray-700">{b.contact_referent_nom}</span>
                          {b.contact_referent_email && <span className="ml-1">— {b.contact_referent_email}</span>}
                          {b.contact_referent_telephone && <span className="ml-1">— {b.contact_referent_telephone}</span>}
                        </p>
                      )}
                      {b.notes && <p className="italic text-gray-400">{b.notes}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(b)} className="btn btn-ghost text-xs px-2 py-1">✏️</button>
                    <button
                      onClick={() => del(b.id)}
                      disabled={deleting === b.id}
                      className="btn btn-ghost text-xs px-2 py-1 text-red-400 hover:text-red-600"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
