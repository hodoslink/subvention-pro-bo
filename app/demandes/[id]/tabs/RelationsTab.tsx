'use client';
import Link from 'next/link';
import { usePageCtx } from '../context';
import { SectionCard, Field, Row, RowF } from '../components';
import type { DetailsJson } from '@/lib/supabase';

export function RelationsTab() {
  const ctx = usePageCtx();
  const {
    demande, draft, editMode, setField,
    lienFormulaire, lienEmail, setLienEmail,
    lienUrl, setLienUrl, lienGenerating, setLienGenerating,
    loadLienFormulaire,
  } = ctx;
  const det = (demande.details_json || {}) as DetailsJson;
  const asso = demande.associations;

  return (
    <>

      {/* Contact référent de la demande */}
      <SectionCard title="Contact référent">
        {(() => {
          const hasDemandeContact = !!(demande.contact_nom || demande.contact_email);
          const contactNom = demande.contact_nom || asso.contact_nom;
          const contactRole = demande.contact_role || asso.contact_role;
          const contactEmail = demande.contact_email || asso.contact_email;
          const contactTel = demande.contact_telephone || asso.contact_telephone;
          return editMode ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Laissez vide pour utiliser le contact de l'association ({asso.contact_nom}).</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Nom</label>
                  <input className="field-input text-sm" value={draft.contact_nom} onChange={e => setField('contact_nom', e.target.value)} placeholder={asso.contact_nom} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Rôle / fonction</label>
                  <input className="field-input text-sm" value={draft.contact_role} onChange={e => setField('contact_role', e.target.value)} placeholder={asso.contact_role || 'Président·e…'} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                <input type="email" className="field-input text-sm" value={draft.contact_email} onChange={e => setField('contact_email', e.target.value)} placeholder={asso.contact_email} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Téléphone</label>
                <input type="tel" className="field-input text-sm" value={draft.contact_telephone} onChange={e => setField('contact_telephone', e.target.value)} placeholder={asso.contact_telephone || '06 XX XX XX XX'} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {!hasDemandeContact && (
                <p className="text-xs text-gray-400 mb-2">Contact de l'association (aucun contact spécifique défini pour cette demande)</p>
              )}
              <RowF label="Nom" value={contactNom} />
              <RowF label="Rôle" value={contactRole} />
              <RowF label="Email" value={contactEmail} />
              <RowF label="Téléphone" value={contactTel} />
            </div>
          );
        })()}
      </SectionCard>

      {/* Formulaire public association */}
      <SectionCard title="Formulaire association">
        {(() => {
          function labelIncertain(cle: string): string {
            const labels: Record<string, string> = {
              taux_horaire_valorisation_incertain:        'Taux horaire de valorisation bénévoles',
              cout_salarial_annuel_estime_incertain:      'Coût salarial annuel estimé',
              locaux_valeur_estimee_incertain:            'Valeur estimée des locaux mis à disposition',
              location_salle_cout_annuel_incertain:       'Coût annuel location de salle',
              assurance_cout_annuel_incertain:            'Coût annuel assurance',
              deplacements_frequence_mensuelle_incertain: 'Fréquence mensuelle des déplacements',
              deplacements_cout_moyen_incertain:          'Coût moyen par déplacement',
              nb_adherents_payants_incertain:             "Nombre d'adhérents payants",
              tarif_moyen_annuel_incertain:               "Tarif moyen annuel d'adhésion",
            };
            if (cle.startsWith('prestataires[')) {
              const match = cle.match(/prestataires\[(\d+)\]/);
              const idx = match ? parseInt(match[1]) + 1 : '?';
              return `Tarif du prestataire n°${idx}`;
            }
            return labels[cle] ?? cle;
          }

          const champsIncertains: string[] = [];
          if (demande?.details_json) {
            const dj = demande.details_json as Record<string, unknown>;
            const clesCibles = [
              'taux_horaire_valorisation_incertain',
              'cout_salarial_annuel_estime_incertain',
              'locaux_valeur_estimee_incertain',
              'location_salle_cout_annuel_incertain',
              'assurance_cout_annuel_incertain',
              'deplacements_frequence_mensuelle_incertain',
              'deplacements_cout_moyen_incertain',
              'nb_adherents_payants_incertain',
              'tarif_moyen_annuel_incertain',
            ];
            clesCibles.forEach(cle => {
              if (dj[cle] === true) champsIncertains.push(cle);
            });
            if (Array.isArray(dj.prestataires)) {
              (dj.prestataires as Array<{ tarif_incertain?: boolean }>)
                .forEach((p, i) => {
                  if (p.tarif_incertain) champsIncertains.push(`prestataires[${i}].tarif_unitaire`);
                });
            }
          }
          const nbIncertains = champsIncertains.length;

          const dj = (demande?.details_json ?? {}) as Record<string, unknown>;
          const notesRenseignees = [
            { key: 'notes_section_1', label: "L'équipe" },
            { key: 'notes_section_2', label: 'Intervenants extérieurs' },
            { key: 'notes_section_3', label: 'Lieu et matériel' },
            { key: 'notes_section_4', label: 'Assurance et déplacements' },
            { key: 'notes_section_5', label: 'Participation des bénéficiaires' },
            { key: 'notes_section_6', label: 'Autres financements' },
          ].filter(n => typeof dj[n.key] === 'string' && (dj[n.key] as string).trim());

          return (
        <div className="space-y-4">
          {lienFormulaire?.rempli_le && (
            <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <span>✅</span>
              <span>Réponses reçues le {new Date(lienFormulaire.rempli_le).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
          {lienFormulaire?.ouvert_le && !lienFormulaire.rempli_le && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <span>👁</span>
              <span>Formulaire ouvert le {new Date(lienFormulaire.ouvert_le).toLocaleDateString('fr-FR')} — aucune réponse enregistrée</span>
            </div>
          )}
          {nbIncertains > 0 && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <span>⚠️</span>
              <div className="space-y-1">
                <span className="font-medium">
                  {nbIncertains} champ{nbIncertains > 1 ? 's' : ''} à confirmer avec l&apos;association
                </span>
                <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                  {champsIncertains.map(c => (
                    <li key={c}>{labelIncertain(c)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {notesRenseignees.length > 0 && (
            <div className="space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">💬 Notes du référent</p>
              {notesRenseignees.map(n => (
                <div key={n.key}>
                  <p className="text-xs text-gray-400 font-medium">{n.label}</p>
                  <p className="text-sm text-gray-700 mt-0.5">{dj[n.key] as string}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 font-medium">Email de l&apos;association</label>
            <input
              type="email"
              className="field-input"
              value={lienEmail}
              onChange={e => setLienEmail(e.target.value)}
              placeholder="contact@association.fr"
            />
          </div>
          {lienUrl && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Lien magic à copier et envoyer à l&apos;association :</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={lienUrl}
                  className="field-input text-xs flex-1 bg-gray-50"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  className="btn btn-ghost text-xs shrink-0"
                  onClick={() => navigator.clipboard.writeText(lienUrl ?? '')}
                >
                  Copier
                </button>
              </div>
              <p className="text-xs text-amber-600">Ce lien est à usage unique — copiez-le avant de fermer.</p>
            </div>
          )}
          {!lienUrl && lienFormulaire?.dernier_envoi && (
            <p className="text-xs text-gray-400">
              Dernier lien généré pour {lienFormulaire.dernier_envoi.email} le {new Date(lienFormulaire.dernier_envoi.envoye_le).toLocaleDateString('fr-FR')}
            </p>
          )}
          {!lienUrl && !lienFormulaire?.dernier_envoi && (
            <p className="text-sm text-gray-500">Aucun lien généré pour l&apos;instant.</p>
          )}
          <button
            className="btn btn-primary text-sm"
            disabled={lienGenerating || !lienEmail.includes('@')}
            onClick={async () => {
              setLienGenerating(true);
              setLienUrl(null);
              try {
                const res = await fetch(`/api/demandes/${demande.id}/lien-formulaire`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: lienEmail }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setLienUrl(data.url);
                  await loadLienFormulaire();
                }
              } finally {
                setLienGenerating(false);
              }
            }}
          >
            {lienGenerating ? 'Génération…' : '🔗 Générer le lien magic'}
          </button>
          <p className="text-xs text-gray-400">Chaque génération crée un nouveau lien à usage unique.</p>
        </div>
          );
        })()}
      </SectionCard>

      {/* Relations administratives (C) */}
      <SectionCard title="Relations administratives">
        {editMode ? (
          <div className="space-y-4">
            {/* Agréments */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Agréments ministériels / préfectoraux</p>
              {draft.agrements.length > 0 && (
                <div className="space-y-2 mb-2">
                  <div className="grid grid-cols-[1fr_1fr_120px_24px] gap-2 mb-1">
                    <span className="text-xs text-gray-400">Type d'agrément</span>
                    <span className="text-xs text-gray-400">Autorité</span>
                    <span className="text-xs text-gray-400">Date</span>
                    <span />
                  </div>
                  {draft.agrements.map((a, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_120px_24px] gap-2 items-center">
                      <input className="field-input text-sm" value={a.type} onChange={e => setField('agrements', draft.agrements.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} placeholder="Ex : Jeunesse et sport, ESS…" />
                      <input className="field-input text-sm" value={a.autorite} onChange={e => setField('agrements', draft.agrements.map((x, j) => j === i ? { ...x, autorite: e.target.value } : x))} placeholder="Ex : Préfecture du 75" />
                      <input type="date" className="field-input text-sm" value={a.date_obtention} onChange={e => setField('agrements', draft.agrements.map((x, j) => j === i ? { ...x, date_obtention: e.target.value } : x))} />
                      <button type="button" onClick={() => setField('agrements', draft.agrements.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setField('agrements', [...draft.agrements, { type: '', autorite: '', date_obtention: '' }])} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Ajouter un agrément</button>
            </div>
            {/* Utilité publique */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={draft.reconnue_utilite_publique} onChange={e => setField('reconnue_utilite_publique', e.target.checked)} />
                <span className="text-sm font-medium text-gray-700">Association reconnue d'utilité publique (RUP)</span>
              </label>
              {draft.reconnue_utilite_publique && (
                <div className="ml-6">
                  <Field label="Date publication JO">
                    <input type="date" className="field-input" value={draft.date_publication_jo_utilite_publique} onChange={e => setField('date_publication_jo_utilite_publique', e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={draft.assujettie_impots_commerciaux} onChange={e => setField('assujettie_impots_commerciaux', e.target.checked)} />
              <span className="text-sm font-medium text-gray-700">Assujettie aux impôts commerciaux</span>
            </label>
            <Field label="Réseaux d'affiliation (séparés par virgule)">
              <input className="field-input" value={draft.reseaux_affiliation} onChange={e => setField('reseaux_affiliation', e.target.value)} placeholder="Ex : Ligue de l'enseignement, Réseau national des MJC…" />
            </Field>
            <Field label="Adhérents personnes morales (séparés par virgule)">
              <input className="field-input" value={draft.adherents_personnes_morales} onChange={e => setField('adherents_personnes_morales', e.target.value)} placeholder="Ex : Association A, Association B…" />
            </Field>
          </div>
        ) : (
          <div className="space-y-2.5">
            {det.agrements && det.agrements.length > 0 ? (
              <div>
                <p className="text-xs text-gray-500 mb-1">Agréments</p>
                {det.agrements.map((a, i) => (
                  <div key={i} className="text-sm text-gray-700">
                    {a.type}{a.autorite ? ` — ${a.autorite}` : ''}{a.date_obtention ? ` (${a.date_obtention})` : ''}
                  </div>
                ))}
              </div>
            ) : <RowF label="Agréments" value={null} />}
            <RowF label="Utilité publique" value={det.reconnue_utilite_publique ? `Oui${det.date_publication_jo_utilite_publique ? ` — JO du ${det.date_publication_jo_utilite_publique}` : ''}` : null} />
            <RowF label="Impôts commerciaux" value={det.assujettie_impots_commerciaux ? 'Oui' : null} />
            <RowF label="Réseaux" value={det.reseaux_affiliation?.join(', ') || null} />
            <RowF label="Personnes morales affiliées" value={det.adherents_personnes_morales?.map(a => a.nom).join(', ') || null} />
          </div>
        )}
      </SectionCard>

      {/* Association — lecture seule */}
      <SectionCard title="Association">
        <div className="space-y-2.5">
          <Row label="Nom" value={asso.nom} />
          {asso.sigle && <Row label="Sigle" value={asso.sigle} />}
          <Row label="Adresse" value={[asso.adresse, asso.code_postal, asso.ville].filter(Boolean).join(', ')} />
          <Row label="RNA" value={asso.rna} />
          <Row label="SIRET" value={asso.siret} />
          <Row label="Membres" value={asso.nb_membres?.toString()} />
          <Link href={`/associations/${asso.id}`} className="text-xs text-blue-600 hover:underline">Voir la fiche association →</Link>
        </div>
      </SectionCard>

    </>
  );
}
