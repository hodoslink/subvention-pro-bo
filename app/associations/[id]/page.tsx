"use client";
import { useEffect, useState, use } from "react";
import { AppShell } from "@/components/AppShell";
import { StatutBadge } from "@/components/StatutBadge";
import { DocumentList } from "@/components/DocumentList";
import type { Association, Demande } from "@/lib/supabase";
import Link from "next/link";

type AssoDraft = {
  nom: string;
  siret: string;
  siren: string;
  rna: string;
  adresse: string;
  code_postal: string;
  ville: string;
  forme_juridique: string;
  nb_membres: string;
  date_creation: string;
  contact_nom: string;
  contact_role: string;
  contact_email: string;
  contact_telephone: string;
};

function draftFromAsso(a: Association): AssoDraft {
  return {
    nom: a.nom || '',
    siret: a.siret || '',
    siren: a.siren || '',
    rna: a.rna || '',
    adresse: a.adresse || '',
    code_postal: a.code_postal || '',
    ville: a.ville || '',
    forme_juridique: a.forme_juridique || '',
    nb_membres: a.nb_membres?.toString() || '',
    date_creation: a.date_creation || '',
    contact_nom: a.contact_nom || '',
    contact_role: a.contact_role || '',
    contact_email: a.contact_email || '',
    contact_telephone: a.contact_telephone || '',
  };
}

function F({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
      <input type={type} className="field-input text-sm" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default function FicheAssociation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [asso, setAsso] = useState<Association | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<AssoDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () =>
    fetch(`/api/associations/${id}`)
      .then(r => r.json())
      .then(({ association, demandes: d }) => {
        setAsso(association);
        setDraft(draftFromAsso(association));
        setDemandes(d || []);
        setLoading(false);
      });

  useEffect(() => { load(); }, [id]);

  const setF = <K extends keyof AssoDraft>(k: K, v: string) =>
    setDraft(prev => prev ? { ...prev, [k]: v } : prev);

  const cancelEdit = () => {
    if (asso) setDraft(draftFromAsso(asso));
    setEditMode(false);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const body = {
      nom: draft.nom || undefined,
      siret: draft.siret || null,
      siren: draft.siren || null,
      rna: draft.rna || null,
      adresse: draft.adresse || null,
      code_postal: draft.code_postal || null,
      ville: draft.ville || null,
      forme_juridique: draft.forme_juridique || null,
      nb_membres: draft.nb_membres ? Number(draft.nb_membres) : null,
      date_creation: draft.date_creation || null,
      contact_nom: draft.contact_nom || undefined,
      contact_role: draft.contact_role || null,
      contact_email: draft.contact_email || undefined,
      contact_telephone: draft.contact_telephone || null,
    };
    await fetch(`/api/associations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await load();
    setSaving(false);
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;
  if (!asso || !draft) return <AppShell><div className="p-8 text-red-500">Association introuvable</div></AppShell>;

  const totalDemande = demandes.reduce((s, d) => s + (d.montant_demande || 0), 0);
  const totalObtenu = demandes.reduce((s, d) => s + (d.montant_obtenu || 0), 0);
  const acceptes = demandes.filter(d => d.statut === 'accepte').length;

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/associations" className="text-xs text-gray-400 hover:text-gray-600">← Associations</Link>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{asso.nom}</h1>
            {asso.ville && <p className="text-sm text-gray-500">{asso.code_postal} {asso.ville}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && <span className="text-xs text-green-600 font-medium">✓ Enregistré</span>}
            {!editMode
              ? <button onClick={() => setEditMode(true)} className="btn btn-secondary text-sm">✏️ Modifier</button>
              : <>
                  <button onClick={cancelEdit} className="btn btn-ghost text-sm">Annuler</button>
                  <button onClick={save} disabled={saving} className="btn btn-primary text-sm">
                    {saving ? 'Enregistrement…' : '💾 Enregistrer'}
                  </button>
                </>
            }
          </div>
        </div>

        {/* Chiffres clés */}
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

        {/* Informations + Contact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Informations */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Informations</h2>
            {editMode ? (
              <div className="space-y-3">
                <FieldInput label="Nom de l'association *" value={draft.nom} onChange={v => setF('nom', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="RNA" value={draft.rna} onChange={v => setF('rna', v)} placeholder="W123456789" />
                  <FieldInput label="SIRET" value={draft.siret} onChange={v => setF('siret', v)} placeholder="14 chiffres" />
                </div>
                <FieldInput label="SIREN" value={draft.siren} onChange={v => setF('siren', v)} placeholder="9 chiffres" />
                <FieldInput label="Forme juridique" value={draft.forme_juridique} onChange={v => setF('forme_juridique', v)} placeholder="Association loi 1901" />
                <FieldInput label="Adresse" value={draft.adresse} onChange={v => setF('adresse', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Code postal" value={draft.code_postal} onChange={v => setF('code_postal', v)} />
                  <FieldInput label="Ville" value={draft.ville} onChange={v => setF('ville', v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Nb membres" value={draft.nb_membres} onChange={v => setF('nb_membres', v)} type="number" />
                  <FieldInput label="Date de création" value={draft.date_creation} onChange={v => setF('date_creation', v)} placeholder="AAAA-MM-JJ" />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <F label="RNA" value={asso.rna} />
                <F label="SIRET" value={asso.siret} />
                <F label="SIREN" value={asso.siren} />
                <F label="Forme juridique" value={asso.forme_juridique} />
                <F label="Adresse" value={[asso.adresse, asso.code_postal, asso.ville].filter(Boolean).join(', ')} />
                <F label="Membres" value={asso.nb_membres?.toString()} />
                <F label="Création" value={asso.date_creation ? new Date(asso.date_creation).toLocaleDateString('fr-FR') : undefined} />
              </div>
            )}
          </div>

          {/* Contact association */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Contact de l'association</h2>
            {editMode ? (
              <div className="space-y-3">
                <FieldInput label="Nom *" value={draft.contact_nom} onChange={v => setF('contact_nom', v)} />
                <FieldInput label="Rôle / fonction" value={draft.contact_role} onChange={v => setF('contact_role', v)} placeholder="Président·e, Directeur·rice…" />
                <FieldInput label="Email *" value={draft.contact_email} onChange={v => setF('contact_email', v)} type="email" />
                <FieldInput label="Téléphone" value={draft.contact_telephone} onChange={v => setF('contact_telephone', v)} type="tel" placeholder="06 XX XX XX XX" />
              </div>
            ) : (
              <div className="space-y-2.5">
                <F label="Nom" value={asso.contact_nom} />
                <F label="Rôle" value={asso.contact_role} />
                <F label="Email" value={asso.contact_email} />
                <F label="Téléphone" value={asso.contact_telephone} />
              </div>
            )}
          </div>
        </div>

        {/* Documents de l'association */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Documents de l'association</h2>
          <p className="text-xs text-gray-400">Statuts, comptes annuels, PV d'AG, RIB… Cliquez sur « 🤖 Analyser » pour auto-compléter la fiche.</p>
          <DocumentList entityType="association" entityId={id} onApplied={load} />
        </div>

        {/* Historique */}
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
            {demandes.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune demande pour cette association</p>}
            {demandes.map(d => (
              <Link key={d.id} href={`/demandes/${d.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 px-1 rounded transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.titre_projet || '(sans titre)'}</p>
                  <p className="text-xs text-gray-500">
                    {d.bailleur_nom} · {new Date(d.created_at).getFullYear()}
                    {d.type_demande === 'renouvellement' && <span className="ml-1.5 text-amber-600">↻ renouvellement</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-right">
                    {d.montant_obtenu
                      ? <p className="text-sm font-semibold text-green-600">{d.montant_obtenu.toLocaleString('fr-FR')} € obtenus</p>
                      : d.montant_demande
                        ? <p className="text-sm text-gray-500">{d.montant_demande.toLocaleString('fr-FR')} € demandés</p>
                        : null}
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
