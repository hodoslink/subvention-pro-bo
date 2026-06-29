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
  site_web_url: string;
  secteur_activite: string;
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
    site_web_url: a.site_web_url || '',
    secteur_activite: a.secteur_activite || '',
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

  // Résumé
  const [editingResume, setEditingResume] = useState(false);
  const [resumeDraft, setResumeDraft] = useState('');
  const [savingResume, setSavingResume] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState('');

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
      site_web_url: draft.site_web_url || null,
      secteur_activite: draft.secteur_activite || null,
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

  const startEditResume = () => {
    setResumeDraft(asso?.resume_edite || asso?.resume_scrape || '');
    setEditingResume(true);
  };

  const saveResume = async () => {
    setSavingResume(true);
    await fetch(`/api/associations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume_edite: resumeDraft || null, resume_edite_par: 'consultant' }),
    });
    await load();
    setSavingResume(false);
    setEditingResume(false);
  };

  const scrape = async () => {
    setScraping(true);
    setScrapeMsg('');
    const r = await fetch(`/api/associations/${id}/scraper`, { method: 'POST' });
    const data = await r.json();
    if (!r.ok) {
      setScrapeMsg('Erreur : ' + (data.error || data.detail || 'Problème lors du scraping'));
    } else if (data.no_key) {
      setScrapeMsg('Texte récupéré mais clé HUGGINGFACE_API_KEY non configurée — résumé IA non généré. Ajoutez la clé dans Vercel pour activer le résumé automatique.');
      await load();
    } else {
      setScrapeMsg('Contexte mis à jour.');
      await load();
    }
    setScraping(false);
  };

  if (loading) return <AppShell><div className="p-8 text-gray-400">Chargement…</div></AppShell>;
  if (!asso || !draft) return <AppShell><div className="p-8 text-red-500">Association introuvable</div></AppShell>;

  const totalDemande = demandes.reduce((s, d) => s + (d.montant_demande || 0), 0);
  const totalObtenu = demandes.reduce((s, d) => s + (d.montant_obtenu || 0), 0);
  const acceptes = demandes.filter(d => d.statut === 'accepte').length;
  const resumeVisible = asso.resume_edite || asso.resume_scrape;
  const resumeIsEdited = !!asso.resume_edite;

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

        {/* Résumé de l'association */}
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Qui est cette association ?</h2>
              {resumeIsEdited && (
                <span className="text-xs text-green-600 font-medium">Version validée par le consultant</span>
              )}
              {!resumeIsEdited && asso.resume_scrape && (
                <span className="text-xs text-gray-400">Généré automatiquement — à relire et valider</span>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {asso.site_web_url && (
                <button
                  onClick={scrape}
                  disabled={scraping}
                  className="btn btn-ghost text-xs"
                  title="Scrape le site web et génère un résumé via IA"
                >
                  {scraping ? '⏳ Actualisation…' : '🔄 Actualiser le contexte'}
                </button>
              )}
              <button onClick={startEditResume} className="btn btn-ghost text-xs">✏️ Éditer ce résumé</button>
            </div>
          </div>

          {scrapeMsg && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{scrapeMsg}</p>
          )}

          {editingResume ? (
            <div className="space-y-2">
              <textarea
                className="field-input text-sm w-full"
                rows={4}
                value={resumeDraft}
                onChange={e => setResumeDraft(e.target.value)}
                placeholder="Décrivez l'association en 3-4 phrases : ce qu'elle fait, pour qui, depuis quand, sur quel territoire…"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingResume(false)} className="btn btn-ghost text-xs">Annuler</button>
                <button onClick={saveResume} disabled={savingResume} className="btn btn-primary text-xs">
                  {savingResume ? 'Enregistrement…' : '💾 Valider ce résumé'}
                </button>
              </div>
            </div>
          ) : resumeVisible ? (
            <p className="text-sm text-gray-700 leading-relaxed">{resumeVisible}</p>
          ) : (
            <div className="text-sm text-gray-400 italic">
              Aucun résumé pour l'instant.{' '}
              {asso.site_web_url
                ? 'Cliquez sur « Actualiser le contexte » pour générer un résumé automatique depuis le site web.'
                : 'Renseignez l\'URL du site web (section Informations) pour activer la génération automatique, ou rédigez directement via « Éditer ce résumé ».'}
            </div>
          )}

          {asso.resume_scrape_le && !resumeIsEdited && (
            <p className="text-xs text-gray-300">
              Mis à jour le {new Date(asso.resume_scrape_le).toLocaleDateString('fr-FR')}
            </p>
          )}
          {asso.resume_edite_le && resumeIsEdited && (
            <p className="text-xs text-gray-300">
              Validé le {new Date(asso.resume_edite_le).toLocaleDateString('fr-FR')}
            </p>
          )}
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
                <FieldInput label="Secteur d'activité" value={draft.secteur_activite} onChange={v => setF('secteur_activite', v)} placeholder="Ex. santé, insertion, culture…" />
                <FieldInput label="Site web" value={draft.site_web_url} onChange={v => setF('site_web_url', v)} placeholder="https://…" type="url" />
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
                <F label="Secteur" value={asso.secteur_activite} />
                {asso.site_web_url && (
                  <div className="flex justify-between text-sm gap-4">
                    <span className="text-gray-500 shrink-0">Site web</span>
                    <a href={asso.site_web_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-right truncate">{asso.site_web_url}</a>
                  </div>
                )}
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
