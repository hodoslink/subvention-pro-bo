"use client";
import { useEffect, useState, useRef, useCallback } from "react";

export type DocRecord = {
  id: string;
  created_at: string;
  nom_fichier: string;
  type_doc?: string;
  mime_type?: string;
  taille_octets?: number;
  storage_path?: string;
};

type EntityType = 'association' | 'demande';

type ExtractedAsso = {
  nom?: string; siret?: string; siren?: string; rna?: string;
  adresse?: string; code_postal?: string; ville?: string;
  forme_juridique?: string; nb_membres?: number; date_creation?: string; objet_social?: string;
};
type ExtractedDemande = {
  titre_projet?: string; objectif_projet?: string; public_beneficiaire?: string;
  nb_beneficiaires_estime?: number; montant_demande?: number; bailleur_nom?: string;
  bailleur_type?: string; periode_debut?: string; periode_fin?: string;
  date_depot?: string;
  type_demande?: string;
  plateforme_identifiant_dossier?: string;
  bilan_subvention_anterieure?: number; bilan_nb_beneficiaires_reel?: number; bilan_activites?: string;
  details_json?: Record<string, string>;
  budget_lignes?: {
    sens: string; compte: string; sous_categorie?: string;
    bailleur_detail?: string; montant: number; precisions?: string;
    statut_financement?: string;
  }[];
};
type ExtractedFields = ExtractedAsso | ExtractedDemande;

const ASSO_LABELS: Record<string, string> = {
  nom: 'Nom', siret: 'SIRET', siren: 'SIREN', rna: 'RNA',
  adresse: 'Adresse', code_postal: 'Code postal', ville: 'Ville',
  forme_juridique: 'Forme juridique', nb_membres: 'Nombre de membres',
  date_creation: 'Date de création', objet_social: 'Objet social',
};
const DEMANDE_LABELS: Record<string, string> = {
  titre_projet: 'Titre du projet',
  objectif_projet: 'Objectif',
  public_beneficiaire: 'Public bénéficiaire',
  nb_beneficiaires_estime: 'Nb bénéficiaires estimé',
  montant_demande: 'Montant demandé (€)',
  bailleur_nom: 'Bailleur',
  bailleur_type: 'Type bailleur',
  periode_debut: 'Date de début',
  periode_fin: 'Date de fin',
  date_depot: 'Date de dépôt',
  type_demande: 'Type (1ère demande / renouvellement)',
  plateforme_identifiant_dossier: 'N° dossier bailleur',
  bilan_subvention_anterieure: 'Subvention N-1 (€)',
  bilan_nb_beneficiaires_reel: 'Bénéficiaires réels N-1',
  bilan_activites: 'Bilan activités N-1',
};
const DETAILS_LABELS: Record<string, string> = {
  thematique: 'Thématique', description_besoins: 'Description des besoins',
  description_actions: 'Description des actions', partenariats: 'Partenariats',
  beneficiaires_profil: 'Profil bénéficiaires', beneficiaires_age: 'Âge bénéficiaires',
  beneficiaires_sexe: 'Sexe bénéficiaires', localisation_qpv: 'Localisation QPV',
  nb_benevoles: 'Nb bénévoles', nb_salaries: 'Nb salariés',
  moyens_description: 'Moyens mobilisés', indicateurs_evaluation: 'Indicateurs évaluation',
};

const TYPE_DOC_OPTIONS = [
  { value: 'statuts', label: 'Statuts' },
  { value: 'comptes_annuels', label: 'Comptes annuels' },
  { value: 'pv_ag', label: 'PV d\'AG' },
  { value: 'rapport_activite', label: 'Rapport d\'activité' },
  { value: 'rib', label: 'RIB' },
  { value: 'autre', label: 'Autre' },
];

const EXCEL_MIMES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const fmtSize = (b?: number) => !b ? '' : b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} Mo` : `${Math.round(b / 1_000)} Ko`;

/**
 * Normalise un JSON importé vers le format interne ExtractedDemande.
 * Accepte deux formes :
 *  - Forme A (plate) : les clés sont déjà au format ExtractedDemande
 *  - Forme B (structurée) : blocs { demande, details, budget, bilan_anterieur }
 */
function normaliserImportJson(raw: unknown): ExtractedDemande {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Le fichier ne contient pas un objet JSON valide.');
  }
  const obj = raw as Record<string, unknown>;

  // Détection Forme B : présence d'un bloc "demande" ou "budget" structuré
  const estFormeB = typeof obj.demande === 'object' || typeof obj.budget === 'object';

  if (!estFormeB) {
    // Forme A — validation minimale : au moins une clé connue
    const clesConnues = [...Object.keys(DEMANDE_LABELS), 'details_json', 'budget_lignes'];
    const aUneCleConnue = Object.keys(obj).some(k => clesConnues.includes(k));
    if (!aUneCleConnue) {
      throw new Error(
        'Format non reconnu. Le JSON doit contenir soit des champs de demande directs, soit des blocs "demande" / "details" / "budget".'
      );
    }
    return obj as ExtractedDemande;
  }

  // Forme B → conversion
  const demande = (obj.demande ?? {}) as Record<string, unknown>;
  const details = (obj.details ?? {}) as Record<string, string>;
  const budget = (obj.budget ?? {}) as {
    charges?: Array<Record<string, unknown>>;
    produits?: Array<Record<string, unknown>>;
  };
  const bilan = (obj.bilan_anterieur ?? {}) as Record<string, unknown>;

  const budget_lignes = [
    ...(budget.charges ?? []).map(l => ({
      sens: 'charge',
      compte: String(l.compte ?? '60'),
      sous_categorie: l.sous_categorie as string | undefined,
      montant: Number(l.montant ?? 0),
      precisions: l.precisions as string | undefined,
    })),
    ...(budget.produits ?? []).map(l => ({
      sens: 'produit',
      compte: String(l.compte ?? '70'),
      sous_categorie: l.sous_categorie as string | undefined,
      bailleur_detail: l.bailleur_detail as string | undefined,
      montant: Number(l.montant ?? 0),
      statut_financement: l.statut_financement as string | undefined,
    })),
  ].filter(l => l.montant > 0);

  return {
    ...demande,
    ...(Object.keys(details).length > 0 ? { details_json: details } : {}),
    ...(budget_lignes.length > 0 ? { budget_lignes } : {}),
    ...(bilan.montant_obtenu !== undefined ? { bilan_subvention_anterieure: Number(bilan.montant_obtenu) } : {}),
    ...(bilan.nb_beneficiaires_reel !== undefined ? { bilan_nb_beneficiaires_reel: Number(bilan.nb_beneficiaires_reel) } : {}),
    ...(bilan.description ? { bilan_activites: String(bilan.description) } : {}),
  } as ExtractedDemande;
}

/**
 * Validation de cohérence non bloquante sur le budget importé.
 */
function verifierCoherence(champs: ExtractedDemande): string[] {
  const avertissements: string[] = [];
  const lignes = champs.budget_lignes ?? [];
  if (!lignes.length) return avertissements;

  const t86 = lignes.filter(l => l.compte?.startsWith('86')).reduce((s, l) => s + (l.montant || 0), 0);
  const t87 = lignes.filter(l => l.compte?.startsWith('87')).reduce((s, l) => s + (l.montant || 0), 0);
  if (Math.abs(t86 - t87) > 0.01 && (t86 > 0 || t87 > 0)) {
    avertissements.push(`Valorisations non symétriques : 86x = ${t86} €, 87x = ${t87} €.`);
  }

  const tc = lignes.filter(l => l.sens === 'charge').reduce((s, l) => s + (l.montant || 0), 0);
  const tp = lignes.filter(l => l.sens === 'produit').reduce((s, l) => s + (l.montant || 0), 0);
  if (tc > 0 && tp > 0 && Math.abs(tc - tp) / tc > 0.05) {
    avertissements.push(`Budget déséquilibré : charges ${tc} € / produits ${tp} €.`);
  }

  if (champs.montant_demande && tp > 0 && champs.montant_demande > tp) {
    avertissements.push(
      `montant_demande (${champs.montant_demande} €) supérieur au total des produits — vérifiez qu'il s'agit bien du montant demandé à ce bailleur.`
    );
  }
  return avertissements;
}

export function DocumentList({
  entityType,
  entityId,
  onApplied,
}: {
  entityType: EntityType;
  entityId: string;
  onApplied?: () => void;
}) {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadTypeDoc, setUploadTypeDoc] = useState('autre');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<{
    docId: string;
    champs: ExtractedFields;
    avertissements?: string[];
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const listUrl = entityType === 'association'
    ? `/api/associations/${entityId}/documents`
    : `/api/demandes/${entityId}/documents`;

  const docBaseUrl = (docId: string) =>
    entityType === 'association'
      ? `/api/documents/asso/${docId}`
      : `/api/documents/demande/${docId}`;

  const load = useCallback(async () => {
    try {
      const r = await fetch(listUrl);
      if (!r.ok) { setLoading(false); return; }
      const json = await r.json();
      setDocs(json.documents ?? []);
    } catch {
      // réseau inaccessible — on garde l'état existant
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => { load(); }, [load]);

  async function openSignedUrl(docId: string) {
    const r = await fetch(`${docBaseUrl(docId)}?signed=true`);
    const { url } = await r.json();
    if (url) window.open(url, '_blank');
  }

  async function deleteDoc(docId: string) {
    setDeleting(docId);
    await fetch(docBaseUrl(docId), { method: 'DELETE' });
    await load();
    setDeleting(null);
    if (extracted?.docId === docId) setExtracted(null);
  }

  async function upload(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Fichier trop volumineux (max 50 Mo)');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (entityType === 'association') fd.append('type_doc', uploadTypeDoc);
      const r = await fetch(listUrl, { method: 'POST', body: fd });
      if (!r.ok) {
        let msg = `Erreur ${r.status}`;
        try { const j = await r.json(); msg = j.error || msg; } catch { /* pas de JSON */ }
        setUploadError(msg);
        return;
      }
      await load();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setUploading(false);
    }
  }

  function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setExtracted(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const champs = normaliserImportJson(raw);

        // Pré-sélection de tous les champs trouvés
        const keys = new Set<string>();
        Object.keys(champs).forEach(k => {
          if (k === 'details_json') {
            Object.keys(champs.details_json || {}).forEach(dk => keys.add(`details_json.${dk}`));
          } else if (k === 'budget_lignes') {
            keys.add('budget_lignes');
          } else {
            keys.add(k);
          }
        });
        setSelected(keys);
        setExtracted({
          docId: 'import-json',            // pas lié à un document stocké
          champs,
          avertissements: verifierCoherence(champs),
        });
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'JSON invalide.');
      } finally {
        // Reset l'input pour permettre de réimporter le même fichier
        if (jsonInputRef.current) jsonInputRef.current.value = '';
      }
    };
    reader.onerror = () => setImportError('Impossible de lire le fichier.');
    reader.readAsText(file);
  }

  async function applyFields() {
    if (!extracted) return;
    setApplying(true);

    if (entityType === 'association') {
      const champs = extracted.champs as ExtractedAsso;
      const body: Record<string, unknown> = {};
      for (const k of selected) {
        const v = (champs as Record<string, unknown>)[k];
        if (v !== undefined) body[k] = v;
      }
      if (Object.keys(body).length > 0) {
        await fetch(`/api/associations/${entityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    } else {
      const champs = extracted.champs as ExtractedDemande;
      const body: Record<string, unknown> = {};
      const detailsPatch: Record<string, unknown> = {};

      for (const k of selected) {
        if (k.startsWith('details_json.')) {
          const dk = k.replace('details_json.', '');
          const v = champs.details_json?.[dk];
          if (v !== undefined) detailsPatch[dk] = v;
        } else if (k !== 'budget_lignes') {
          const v = (champs as Record<string, unknown>)[k];
          if (v !== undefined) body[k] = v;
        }
      }

      if (Object.keys(detailsPatch).length > 0) body.details_json = detailsPatch;

      if (Object.keys(body).length > 0) {
        await fetch(`/api/demandes/${entityId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      // Créer les lignes budget extraites
      if (selected.has('budget_lignes') && champs.budget_lignes?.length) {
        await Promise.all(
          champs.budget_lignes.map(l =>
            fetch(`/api/demandes/${entityId}/budget-lignes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sens: l.sens,
                compte: l.compte,
                sous_categorie: l.sous_categorie,
                bailleur_detail: l.bailleur_detail,
                montant: l.montant,
                precisions: l.precisions,
                statut_financement: l.statut_financement ?? null,
              }),
            })
          )
        );
      }
    }

    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
    setApplying(false);
    setExtracted(null);
    onApplied?.();
  }

  function toggleKey(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) return <p className="text-sm text-gray-400">Chargement…</p>;

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div className="flex items-center gap-2 flex-wrap">
        {entityType === 'association' && (
          <select
            className="field-input text-xs w-36"
            value={uploadTypeDoc}
            onChange={e => setUploadTypeDoc(e.target.value)}
          >
            {TYPE_DOC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn btn-secondary text-xs"
        >
          {uploading ? '⏳ Upload…' : '+ Ajouter un document'}
        </button>
        <span className="text-xs text-gray-400">PDF, Excel, image — max 50 Mo</span>
        {entityType === 'demande' && (
          <>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJson}
            />
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="btn btn-secondary text-xs"
              title="Importer un fichier JSON d'extraction et pré-remplir les champs de la demande"
            >
              📥 Importer un JSON
            </button>
          </>
        )}
        {importError && (
          <p className="text-xs text-red-600 w-full">{importError}</p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,.xlsx"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
        {applied && <span className="text-xs text-green-600 font-medium">✓ Champs appliqués</span>}
      </div>
      {uploadError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="text-red-500 text-xs shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-xs text-red-700 font-medium">Échec de l&apos;upload</p>
            <p className="text-xs text-red-600 mt-0.5">{uploadError}</p>
          </div>
          <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* Liste */}
      {docs.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun document. Cliquez sur « Ajouter un document » pour commencer.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            return (
              <div key={doc.id} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                <span className="text-lg shrink-0">{doc.mime_type === 'application/pdf' ? '📄' : doc.mime_type?.startsWith('image/') ? '🖼' : EXCEL_MIMES.includes(doc.mime_type || '') ? '📊' : '📎'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate font-medium">{doc.nom_fichier}</p>
                  <p className="text-xs text-gray-400">
                    {doc.type_doc && <span className="mr-2">{TYPE_DOC_OPTIONS.find(o => o.value === doc.type_doc)?.label ?? doc.type_doc}</span>}
                    {fmtSize(doc.taille_octets)}
                    <span className="ml-2">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                  </p>
                </div>
                <div className="shrink-0 flex gap-1">
                  <button onClick={() => openSignedUrl(doc.id)} className="btn btn-ghost text-xs py-0.5 px-1.5">↗ Ouvrir</button>
                  <button
                    onClick={() => deleteDoc(doc.id)}
                    disabled={deleting === doc.id}
                    className="btn btn-ghost text-xs py-0.5 px-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    {deleting === doc.id ? '…' : '🗑'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panneau de prévisualisation des champs importés */}
      {extracted && (
        <div className="border border-blue-200 rounded-lg bg-blue-50 p-4 space-y-3 animate-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-900">Champs à importer</h3>
            <button onClick={() => setExtracted(null)} className="btn btn-ghost text-xs py-0.5 px-1.5">✕ Fermer</button>
          </div>
          <p className="text-xs text-blue-700">Cochez les champs à appliquer puis cliquez sur Appliquer.</p>

          {extracted.avertissements && extracted.avertissements.length > 0 && (
            <div className="space-y-1 mb-2">
              {extracted.avertissements.map((a, i) => (
                <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  ⚠️ {a}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1 max-h-80 overflow-y-auto">
            {entityType === 'association'
              ? <AssoFields champs={extracted.champs as ExtractedAsso} selected={selected} onToggle={toggleKey} />
              : <DemandeFields champs={extracted.champs as ExtractedDemande} selected={selected} onToggle={toggleKey} />
            }
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setExtracted(null)} className="btn btn-ghost text-xs">Annuler</button>
            <button onClick={applyFields} disabled={applying || selected.size === 0} className="btn btn-primary text-xs">
              {applying ? 'Application…' : `Appliquer (${selected.size} champ${selected.size > 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, checked, onToggle }: { label: string; value: unknown; checked: boolean; onToggle: () => void }) {
  const display = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  if (!display || display === 'undefined' || display === 'null') return null;
  return (
    <label className="flex items-start gap-2 cursor-pointer hover:bg-blue-100 rounded px-1 py-0.5">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 shrink-0" />
      <span className="text-xs text-blue-800"><span className="font-medium">{label} :</span> <span className="text-blue-600 line-clamp-2">{display}</span></span>
    </label>
  );
}

function AssoFields({ champs, selected, onToggle }: { champs: ExtractedAsso; selected: Set<string>; onToggle: (k: string) => void }) {
  return (
    <>
      {Object.entries(ASSO_LABELS).map(([k, label]) => {
        const v = (champs as Record<string, unknown>)[k];
        if (v === undefined) return null;
        return <FieldRow key={k} label={label} value={v} checked={selected.has(k)} onToggle={() => onToggle(k)} />;
      })}
    </>
  );
}

function DemandeFields({ champs, selected, onToggle }: { champs: ExtractedDemande; selected: Set<string>; onToggle: (k: string) => void }) {
  return (
    <>
      {Object.entries(DEMANDE_LABELS).map(([k, label]) => {
        const v = (champs as Record<string, unknown>)[k];
        if (v === undefined) return null;
        return <FieldRow key={k} label={label} value={v} checked={selected.has(k)} onToggle={() => onToggle(k)} />;
      })}

      {champs.details_json && Object.keys(champs.details_json).length > 0 && (
        <>
          <p className="text-xs font-semibold text-blue-800 mt-2 px-1">Description narrative</p>
          {Object.entries(DETAILS_LABELS).map(([k, label]) => {
            const v = champs.details_json?.[k];
            if (!v) return null;
            return <FieldRow key={`details_json.${k}`} label={label} value={v} checked={selected.has(`details_json.${k}`)} onToggle={() => onToggle(`details_json.${k}`)} />;
          })}
        </>
      )}

      {champs.budget_lignes && champs.budget_lignes.length > 0 && (
        <label className="flex items-start gap-2 cursor-pointer hover:bg-blue-100 rounded px-1 py-0.5">
          <input type="checkbox" checked={selected.has('budget_lignes')} onChange={() => onToggle('budget_lignes')} className="mt-0.5 shrink-0" />
          <span className="text-xs text-blue-800">
            <span className="font-medium">Lignes de budget :</span>{' '}
            <span className="text-blue-600">{champs.budget_lignes.length} ligne{champs.budget_lignes.length > 1 ? 's' : ''} ({champs.budget_lignes.map(l => `${l.sous_categorie || l.compte} ${l.montant} €`).join(', ')})</span>
          </span>
        </label>
      )}
    </>
  );
}
