'use client';
import { usePageCtx } from '../context';
import { SectionCard, Field, RowF, TextBlock, TextBlockF, QPVSelector } from '../components';
import type { DetailsJson, AutoritesDestinataires } from '@/lib/supabase';
import { BAILLEUR_TYPES } from '@/lib/supabase';
import { fmt } from '../types';
import type { FullDraft, AutreBailleurDraft } from '../types';

export function ProjetTab() {
  const ctx = usePageCtx();
  const {
    draft, editMode, demande, setField,
    setAutreBailleur, removeAutreBailleur, addAutreBailleur,
    suggestions, bailleurs, thematiqueSuggestions,
    reprendreValeursPrecedentes, reprenantN1,
  } = ctx;
  const det = (demande.details_json || {}) as DetailsJson;
  const asso = demande.associations;

  return (
    <>

      {/* Identification */}
      <SectionCard title="Identification du projet">
        {editMode ? (
          <div className="space-y-4">
            <Field label="Titre du projet">
              <input className="field-input" value={draft.titre_projet} onChange={e => setField('titre_projet', e.target.value)} placeholder="Ex : Ateliers d'insertion numérique pour les jeunes décrocheurs du 13e" />
            </Field>
            {/* Bailleur : référentiel ou texte libre */}
            <div className="space-y-2">
              <Field label="Bailleur (référentiel)">
                <select
                  className="field-input"
                  value={draft.bailleur_id}
                  onChange={e => {
                    const sel = bailleurs.find(b => b.id === e.target.value);
                    setField('bailleur_id', e.target.value);
                    if (sel && !draft.bailleur_nom) setField('bailleur_nom', sel.nom);
                  }}
                >
                  <option value="">— Saisie libre ou choisir dans le référentiel —</option>
                  {bailleurs.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom du bailleur (texte libre)">
                  <input className="field-input" value={draft.bailleur_nom} onChange={e => setField('bailleur_nom', e.target.value)} placeholder="Ex : Ville de Paris — DASES" />
                </Field>
                <Field label="Type de bailleur">
                  <select className="field-input" value={draft.bailleur_type} onChange={e => setField('bailleur_type', e.target.value as FullDraft['bailleur_type'])}>
                    <option value="">—</option>
                    {BAILLEUR_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </Field>
              </div>
            </div>
            {/* Demande précédente — masqué si lien déjà établi par groupe pluriannuel */}
            {suggestions.length > 0 && !demande.groupe_pluriannuel_id && (
              <Field label="Demande précédente (renouvellement)">
                <select
                  className="field-input"
                  value={draft.demande_precedente_id}
                  onChange={e => setField('demande_precedente_id', e.target.value)}
                >
                  <option value="">— Pas de lien ou première demande —</option>
                  {suggestions.map(s => (
                    <option key={s.demande_candidate_id} value={s.demande_candidate_id}>
                      {s.titre_projet || '(sans titre)'}{s.annee_millesime ? ` — ${s.annee_millesime}` : ''}{s.montant_demande ? ` — ${s.montant_demande.toLocaleString('fr-FR')} €` : ''} [{s.statut}]
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {/* D4 — Reprendre les valeurs N-1 */}
            {draft.demande_precedente_id && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-xs text-amber-700 flex-1">Reprendre objectif, besoins, actions et indicateurs de la demande précédente ?</span>
                <button
                  type="button"
                  onClick={reprendreValeursPrecedentes}
                  disabled={reprenantN1}
                  className="shrink-0 text-xs font-medium bg-amber-600 text-white rounded px-2.5 py-1 hover:bg-amber-700 disabled:opacity-50"
                >
                  {reprenantN1 ? '…' : '↩ Reprendre N-1'}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Millésime (année)">
                <input type="number" className="field-input" value={draft.annee_millesime} onChange={e => setField('annee_millesime', e.target.value)} placeholder={new Date().getFullYear().toString()} min={1990} max={2100} />
              </Field>
              <Field label="Réf. dossier plateforme">
                <input className="field-input" value={draft.plateforme_identifiant_dossier} onChange={e => setField('plateforme_identifiant_dossier', e.target.value)} placeholder="N° dossier sur Dauphin, etc." />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Montant demandé (€)">
                <input type="number" className="field-input" value={draft.montant_demande} onChange={e => setField('montant_demande', e.target.value)} placeholder="0" min={0} />
              </Field>
              <Field label="Période début">
                <input className="field-input" value={draft.periode_debut} onChange={e => setField('periode_debut', e.target.value)} placeholder="janv. 2025" />
              </Field>
              <Field label="Période fin">
                <input className="field-input" value={draft.periode_fin} onChange={e => setField('periode_fin', e.target.value)} placeholder="déc. 2025" />
              </Field>
            </div>
            <Field label="Date limite de dépôt">
              <input type="date" className="field-input w-48" value={draft.date_limite_depot} onChange={e => setField('date_limite_depot', e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Date fixée par le bailleur — affichée dans le formulaire public</p>
            </Field>
            <Field label="Thématique">
              <input
                className="field-input"
                list="thematique-suggestions"
                value={draft.thematique}
                onChange={e => setField('thematique', e.target.value)}
                placeholder="Ex : Insertion professionnelle, Éducation, Cohésion sociale, Santé…"
              />
              {thematiqueSuggestions.length > 0 && (
                <datalist id="thematique-suggestions">
                  {thematiqueSuggestions.map(s => <option key={s} value={s} />)}
                </datalist>
              )}
            </Field>
            <Field label="Objectif général du projet">
              <textarea rows={3} className="field-textarea" value={draft.objectif_projet} onChange={e => setField('objectif_projet', e.target.value)} placeholder="En 2-3 phrases : ce que le projet vise à accomplir, pour qui et avec quel résultat attendu." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Public visé">
                <input className="field-input" value={draft.public_beneficiaire} onChange={e => setField('public_beneficiaire', e.target.value)} placeholder="Ex : jeunes NEETs de 16 à 25 ans, résidents QPV" />
              </Field>
              <Field label="Nb bénéficiaires estimés">
                <input type="number" className="field-input" value={draft.nb_beneficiaires_estime} onChange={e => setField('nb_beneficiaires_estime', e.target.value)} placeholder="0" min={0} />
              </Field>
            </div>
            {/* Autres financements sollicités */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Autres financements sollicités pour ce projet</p>
              {draft.autres_bailleurs_sollicites.length > 0 && (
                <div className="space-y-2 mb-2">
                  <div className="grid grid-cols-[1fr_110px_120px_24px] gap-2 mb-1">
                    <span className="text-xs text-gray-400">Bailleur</span>
                    <span className="text-xs text-gray-400">Montant (€)</span>
                    <span className="text-xs text-gray-400">Statut</span>
                    <span />
                  </div>
                  {draft.autres_bailleurs_sollicites.map((b, i) => (
                    <div key={i} className="grid grid-cols-[1fr_110px_120px_24px] gap-2 items-center">
                      <input className="field-input text-sm" value={b.nom_bailleur} onChange={e => setAutreBailleur(i, { nom_bailleur: e.target.value })} placeholder="Ex : Département 75, CAF…" />
                      <input type="number" className="field-input text-sm" value={b.montant} onChange={e => setAutreBailleur(i, { montant: e.target.value })} placeholder="0" min={0} />
                      <select className="field-input text-sm" value={b.statut} onChange={e => setAutreBailleur(i, { statut: e.target.value as AutreBailleurDraft['statut'] })}>
                        <option value="">— statut —</option>
                        <option value="envisage">Envisagé</option>
                        <option value="demande">Demandé</option>
                        <option value="obtenu">Obtenu</option>
                      </select>
                      <button type="button" onClick={() => removeAutreBailleur(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={addAutreBailleur} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Ajouter un financement</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <RowF label="Titre" value={demande.titre_projet} />
            <RowF label="Bailleur" value={demande.bailleur_nom ? `${demande.bailleur_nom}${demande.bailleur_type ? ` (${BAILLEUR_TYPES.find(t => t.v === demande.bailleur_type)?.l ?? demande.bailleur_type})` : ''}` : null} />
            <RowF label="Millésime" value={demande.annee_millesime?.toString() ?? null} />
            <RowF label="Réf. plateforme" value={demande.plateforme_identifiant_dossier ?? null} />
            <RowF label="Période" value={`${demande.periode_debut || '—'} → ${demande.periode_fin || '—'}`} />
            {demande.date_limite_depot && (
              <RowF label="Date limite de dépôt" value={new Date(demande.date_limite_depot).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} />
            )}
            <RowF label="Montant demandé" value={demande.montant_demande ? `${fmt(demande.montant_demande)} €` : null} />
            <RowF label="Thématique" value={det.thematique ?? null} />
            {demande.objectif_projet
              ? <TextBlock label="Objectif" text={demande.objectif_projet} />
              : <div><p className="text-xs text-gray-500 mb-1">Objectif</p><p className="text-sm text-gray-300 italic">—</p></div>}
            <RowF label="Public" value={demande.public_beneficiaire ? `${demande.public_beneficiaire}${demande.nb_beneficiaires_estime ? ` (${demande.nb_beneficiaires_estime} pers.)` : ''}` : null} />
            <RowF label="Nb bénéficiaires estimés" value={!demande.public_beneficiaire && demande.nb_beneficiaires_estime ? `${demande.nb_beneficiaires_estime} personnes` : null} />
            {/* Autres financements */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Autres financements sollicités</p>
              {det.autres_bailleurs_sollicites?.filter(b => b.nom_bailleur).length ? (
                <div className="space-y-1">
                  {det.autres_bailleurs_sollicites.filter(b => b.nom_bailleur).map((b, i) => {
                    const statutColor = b.statut === 'obtenu' ? 'bg-green-100 text-green-700' : b.statut === 'demande' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500';
                    const statutLabel = b.statut === 'obtenu' ? 'Obtenu' : b.statut === 'demande' ? 'Demandé' : 'Envisagé';
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-700 flex-1">{b.nom_bailleur}</span>
                        {b.statut && <span className={`text-xs px-1.5 py-0.5 rounded-full ${statutColor}`}>{statutLabel}</span>}
                        <span className="font-medium tabular-nums text-gray-900">{b.montant ? `${parseFloat(b.montant).toLocaleString('fr-FR')} €` : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-300 italic">—</p>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Description */}
      <SectionCard title="Description du projet">
        {editMode ? (
          <div className="space-y-4">
            <Field label="À quels besoins répond le projet ? Pour qui ?">
              <textarea rows={5} className="field-textarea" value={draft.description_besoins} onChange={e => setField('description_besoins', e.target.value)} placeholder={"Décrivez le problème constaté sur le territoire et les personnes concernées.\n\nEx : Dans notre quartier, 38% des jeunes de 16-25 ans sont sans emploi et sans formation. Les dispositifs existants ne touchent pas les profils les plus éloignés. Depuis 2022, notre association constate une augmentation de 20% des demandes d'accompagnement sans pouvoir y répondre faute de moyens."} />
            </Field>
            <Field label="Où, quand, comment se déroule le projet ?">
              <textarea rows={5} className="field-textarea" value={draft.description_actions} onChange={e => setField('description_actions', e.target.value)} placeholder={"Détaillez les actions, le lieu, le rythme et les modalités concrètes.\n\nEx : Du 1er janvier au 31 décembre 2025, à la MJC du quartier (10 rue des Lilas) :\n• 2 ateliers collectifs de 3h par semaine (mardi et jeudi)\n• 1 suivi individuel mensuel par bénéficiaire\n• 3 immersions en entreprise partenaire sur l'année"} />
            </Field>
            <Field label="Partenariats et coopérations">
              <textarea rows={3} className="field-textarea" value={draft.partenariats} onChange={e => setField('partenariats', e.target.value)} placeholder={"Ex :\n• Mairie du 13e : mise à disposition gratuite des locaux\n• Mission locale Paris Sud : orientation des bénéficiaires\n• Entreprises partenaires (Accenture, SNCF) : accueil en stage et mentorat"} />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <TextBlockF label="Besoins identifiés" text={det.description_besoins} />
            <TextBlockF label="Déroulement" text={det.description_actions} />
            <TextBlockF label="Partenariats" text={det.partenariats} />
          </div>
        )}
      </SectionCard>

      {/* Bénéficiaires */}
      <SectionCard title="Bénéficiaires">
        {editMode ? (
          <div className="space-y-4">
            <Field label="Profil détaillé des bénéficiaires">
              <textarea rows={2} className="field-textarea" value={draft.beneficiaires_profil} onChange={e => setField('beneficiaires_profil', e.target.value)} placeholder="Ex : Jeunes hommes et femmes de 16 à 25 ans, résidents du QPV Croix-de-Chavaux, sans diplôme ni emploi depuis plus de 6 mois." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tranches d'âge">
                <input className="field-input" value={draft.beneficiaires_age} onChange={e => setField('beneficiaires_age', e.target.value)} placeholder="Ex : 16-18 ans (30%), 19-25 ans (70%)" />
              </Field>
              <Field label="Répartition hommes / femmes">
                <input className="field-input" value={draft.beneficiaires_sexe} onChange={e => setField('beneficiaires_sexe', e.target.value)} placeholder="Ex : 55% femmes, 45% hommes" />
              </Field>
            </div>
            <Field label="Localisation QPV / ZUS">
              <input className="field-input" value={draft.localisation_qpv} onChange={e => setField('localisation_qpv', e.target.value)} placeholder="Nom du quartier prioritaire ou N/A" />
            </Field>
            <QPVSelector
              codes={draft.qpv_codes}
              onChange={codes => setField('qpv_codes', codes)}
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            <TextBlockF label="Profil" text={det.beneficiaires_profil} />
            <RowF label="Tranches d'âge" value={det.beneficiaires_age} />
            <RowF label="Répartition sexe" value={det.beneficiaires_sexe} />
            <RowF label="QPV / ZUS" value={det.localisation_qpv} />
            {det.qpv_codes && det.qpv_codes.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Codes QPV</p>
                <div className="flex flex-wrap gap-1">
                  {det.qpv_codes.map(c => <span key={c} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{c}</span>)}
                </div>
              </div>
            )}
            <RowF label="Nombre estimé" value={demande.nb_beneficiaires_estime ? `${demande.nb_beneficiaires_estime} personnes` : null} />
          </div>
        )}
      </SectionCard>

      {/* Indicateurs */}
      <SectionCard title="Indicateurs d'évaluation">
        {editMode ? (
          <Field label="Indicateurs quantitatifs et qualitatifs (SMART)">
            <textarea rows={4} className="field-textarea" value={draft.indicateurs_evaluation} onChange={e => setField('indicateurs_evaluation', e.target.value)} placeholder={"Quantitatifs :\n• Nb d'ateliers réalisés (cible : 80 sur l'année)\n• Nb de participants distincts (cible : 120)\n• Nb de sorties positives emploi/formation (cible : 40, soit 33%)\n\nQualitatifs :\n• Enquête de satisfaction (cible : 80% de satisfaits)\n• Évolution de l'estime de soi (grille auto-évaluation début/fin)"} />
          </Field>
        ) : det.indicateurs_evaluation ? (
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{det.indicateurs_evaluation}</p>
        ) : <p className="text-sm text-gray-300 italic">—</p>}
      </SectionCard>

      {/* Champs déclaratifs Cerfa */}
      <SectionCard title="Champs déclaratifs Cerfa">
        {editMode ? (
          <div className="space-y-4">
            {/* E3 — Type de dossier Cerfa cible */}
            <Field label="Type de formulaire Cerfa cible">
              <select className="field-input" value={draft.type_cerfa_cible} onChange={e => setField('type_cerfa_cible', e.target.value)}>
                <option value="">— Non précisé —</option>
                <option value="12156_05">Cerfa 12156*05 — Subvention fonctionnement (État)</option>
                <option value="12156_collectivite">Cerfa 12156 — Collectivité territoriale</option>
                <option value="libre">Dossier de demande libre (sans Cerfa imposé)</option>
                <option value="dauphin">Dossier Dauphin / Subventions.fr</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Forme de la subvention (Cerfa p.1)">
                <select className="field-input" value={draft.forme_subvention} onChange={e => setField('forme_subvention', e.target.value as FullDraft['forme_subvention'])}>
                  <option value="">—</option>
                  <option value="numeraire">En numéraire (argent)</option>
                  <option value="nature">En nature</option>
                </select>
              </Field>
              <Field label="Objet de la demande (Cerfa p.1)">
                <select className="field-input" value={draft.objet_demande} onChange={e => setField('objet_demande', e.target.value as FullDraft['objet_demande'])}>
                  <option value="">—</option>
                  <option value="fonctionnement_global">Fonctionnement global</option>
                  <option value="projet_action">Projet / action spécifique</option>
                </select>
              </Field>
            </div>
            {/* B3 — Autorités destinataires */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Autorités destinataires (cumulables)</p>
              <div className="flex flex-wrap gap-3">
                {([
                  ['etat', 'État'],
                  ['region', 'Région'],
                  ['departement', 'Département'],
                  ['commune_epci', 'Commune / EPCI'],
                  ['etablissement_public', 'Établissement public'],
                  ['autre', 'Autre'],
                ] as [AutoritesDestinataires, string][]).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.autorites_destinataires.includes(v)}
                      onChange={e => setField('autorites_destinataires', e.target.checked
                        ? [...draft.autorites_destinataires, v]
                        : draft.autorites_destinataires.filter(x => x !== v)
                      )}
                    />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={draft.contrat_de_ville_concerne} onChange={e => setField('contrat_de_ville_concerne', e.target.checked)} />
                <span className="text-sm font-medium text-gray-700">Projet lié à un Contrat de Ville</span>
              </label>
              {draft.contrat_de_ville_concerne && (
                <div className="mt-2 ml-6">
                  <Field label="Nom du contrat de ville">
                    <input className="field-input" value={draft.contrat_de_ville_nom} onChange={e => setField('contrat_de_ville_nom', e.target.value)} placeholder="Ex : Contrat de Ville Grand Paris Métropole 2024-2030" />
                  </Field>
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.recrutement_envisage}
                  onChange={e => setField('recrutement_envisage', e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-700">Recrutement envisagé dans le cadre de ce projet ?</span>
              </label>
              {draft.recrutement_envisage && (
                <div className="mt-2 ml-6">
                  <Field label="Nombre d'ETPT recrutés">
                    <input className="field-input" value={draft.recrutement_etpt} onChange={e => setField('recrutement_etpt', e.target.value)} placeholder="Ex : 0,5 ETP" />
                  </Field>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {demande.type_cerfa_cible && <RowF label="Type Cerfa" value={demande.type_cerfa_cible} />}
            <RowF label="Forme" value={det.forme_subvention === 'numeraire' ? 'En numéraire' : det.forme_subvention === 'nature' ? 'En nature' : null} />
            <RowF label="Objet" value={det.objet_demande === 'fonctionnement_global' ? 'Fonctionnement global' : det.objet_demande === 'projet_action' ? 'Projet / action spécifique' : null} />
            {det.autorites_destinataires && det.autorites_destinataires.length > 0 && (
              <RowF label="Autorités destinataires" value={det.autorites_destinataires.join(', ')} />
            )}
            {det.contrat_de_ville?.concerne && (
              <RowF label="Contrat de Ville" value={det.contrat_de_ville.nom_contrat || 'Oui'} />
            )}
            <RowF label="Recrutement envisagé" value={det.recrutement_envisage ? `Oui${det.recrutement_etpt ? ` — ${det.recrutement_etpt} ETPT` : ''}` : det.recrutement_envisage === false ? 'Non' : null} />
          </div>
        )}
      </SectionCard>

      {/* Bilan renouvellement */}
      {demande.type_demande === 'renouvellement' && (
        <SectionCard title="Bilan année précédente">
          {demande.demande_precedente_id && (
            <p className="text-xs text-gray-500 mb-3">
              💡 Un bilan d&apos;exécution structuré existe peut-être sur la demande précédente :{' '}
              <a href={`/demandes/${demande.demande_precedente_id}/bilans`} className="text-blue-600 hover:underline">
                consulter ses bilans →
              </a>
            </p>
          )}
          {editMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Subvention reçue (€)">
                  <input type="number" className="field-input" value={draft.bilan_subvention_anterieure} onChange={e => setField('bilan_subvention_anterieure', e.target.value)} placeholder="0" min={0} />
                </Field>
                <Field label="Bénéficiaires réels">
                  <input type="number" className="field-input" value={draft.bilan_nb_beneficiaires_reel} onChange={e => setField('bilan_nb_beneficiaires_reel', e.target.value)} placeholder="0" min={0} />
                </Field>
              </div>
              <Field label="Bilan des actions réalisées">
                <textarea rows={4} className="field-textarea" value={draft.bilan_activites} onChange={e => setField('bilan_activites', e.target.value)} placeholder={"Résultats obtenus par rapport aux objectifs fixés, points forts, difficultés rencontrées et ajustements apportés.\n\nEx : 75 ateliers réalisés sur 80 prévus (94%). 108 participants touchés. 36 sorties positives dont 22 en emploi, 14 en formation. Difficulté principale : turnover des bénévoles au 2e trimestre — résolu par un partenariat avec l'université."} />
              </Field>
            </div>
          ) : (
            <div className="space-y-2.5">
              <RowF label="Subvention reçue" value={demande.bilan_subvention_anterieure ? `${fmt(demande.bilan_subvention_anterieure)} €` : null} />
              <RowF label="Bénéficiaires réels" value={demande.bilan_nb_beneficiaires_reel?.toString() ?? null} />
              <TextBlockF label="Bilan des actions" text={demande.bilan_activites} />
            </div>
          )}
        </SectionCard>
      )}

    </>
  );
}
