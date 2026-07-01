'use client';
import { usePageCtx } from '../context';
import { SectionCard, Field, RowF, TextBlockF, AutoBudgetPreview } from '../components';
import type { DetailsJson } from '@/lib/supabase';
import { SMIC_HORAIRE_BRUT_DEFAUT } from '@/lib/budgetAuto';

export function MoyensTab() {
  const ctx = usePageCtx();
  const {
    draft, editMode, demande, setField,
    setPrestataire, removePrestataire, addPrestataire,
    setAchat, removeAchat, addAchat,
    lignesAutoPreview, activerPatternEtScroller,
    chargesCardRef, prestataireCardRef,
  } = ctx;
  const det = (demande.details_json || {}) as DetailsJson;

  return (
    <>

      {/* Moyens humains */}
      <SectionCard title="Moyens humains">
        {editMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Nb bénévoles">
                <input type="number" className="field-input" value={draft.nb_benevoles} onChange={e => setField('nb_benevoles', e.target.value)} placeholder="0" min={0} />
              </Field>
              <Field label="ETPT bénévoles">
                <input className="field-input" value={draft.etpt_benevoles} onChange={e => setField('etpt_benevoles', e.target.value)} placeholder="Ex : 2,5" />
              </Field>
              <Field label="Nb salariés impliqués">
                <input type="number" className="field-input" value={draft.nb_salaries} onChange={e => setField('nb_salaries', e.target.value)} placeholder="0" min={0} />
              </Field>
            </div>
            {/* Valorisation bénévolat — déclenche ligne auto 86/87 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heures de bénévolat / semaine">
                <input type="number" className="field-input" value={draft.heures_benevolat_semaine} onChange={e => setField('heures_benevolat_semaine', e.target.value)} placeholder="Ex : 4" min={0} step={0.5} />
              </Field>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Taux horaire valorisation (€/h)</label>
                <input type="number" className="field-input" value={draft.taux_horaire_valorisation} onChange={e => setField('taux_horaire_valorisation', e.target.value)} placeholder={String(SMIC_HORAIRE_BRUT_DEFAUT)} min={0} step={0.01} />
                <p className="text-xs text-amber-600 mt-0.5">Défaut SMIC brut ({SMIC_HORAIRE_BRUT_DEFAUT} €/h) — à vérifier chaque janv./nov.</p>
              </div>
            </div>
            {/* Coût salarial — déclenche ligne auto 64 */}
            <Field label="Coût salarial annuel estimé (€) — charges patronales incluses">
              <input type="number" className="field-input" value={draft.cout_salarial_annuel_estime} onChange={e => setField('cout_salarial_annuel_estime', e.target.value)} placeholder="Ex : 24 000" min={0} />
            </Field>
            {/* Live total */}
            {(() => {
              const coutBen = (parseFloat(draft.heures_benevolat_semaine || '0') * parseFloat(draft.taux_horaire_valorisation || String(SMIC_HORAIRE_BRUT_DEFAUT)) * 52);
              const coutSal = parseFloat(draft.cout_salarial_annuel_estime || '0');
              const total = coutBen + coutSal;
              if (total <= 0) return null;
              return (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 flex justify-between items-center">
                  <div className="text-xs text-indigo-600 space-y-0.5">
                    {coutBen > 0 && <p>Valorisation bénévolat : {coutBen.toLocaleString('fr-FR')} €/an</p>}
                    {coutSal > 0 && <p>Charges salariales : {coutSal.toLocaleString('fr-FR')} €/an</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-indigo-500">Total coût humain</p>
                    <p className="text-base font-bold text-indigo-800 tabular-nums">{total.toLocaleString('fr-FR')} €</p>
                  </div>
                </div>
              );
            })()}
            <Field label="Description des moyens mobilisés">
              <textarea rows={3} className="field-textarea" value={draft.moyens_description} onChange={e => setField('moyens_description', e.target.value)} placeholder={"Ex : 1 coordinatrice salariée à 0,6 ETP + 1 formatrice salariée à 0,8 ETP + 12 bénévoles dont 4 mentors actifs chaque semaine. Locaux mis à disposition gratuitement par la MJC."} />
            </Field>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex gap-6 text-sm flex-wrap">
              <span>
                <span className="text-gray-400 mr-1">Bénévoles</span>
                <strong className={det.nb_benevoles ? 'text-gray-900' : 'text-gray-300 font-normal italic'}>{det.nb_benevoles || '—'}</strong>
              </span>
              <span>
                <span className="text-gray-400 mr-1">ETPT</span>
                <strong className={det.etpt_benevoles ? 'text-gray-900' : 'text-gray-300 font-normal italic'}>{det.etpt_benevoles || '—'}</strong>
              </span>
              <span>
                <span className="text-gray-400 mr-1">Salariés</span>
                <strong className={det.nb_salaries ? 'text-gray-900' : 'text-gray-300 font-normal italic'}>{det.nb_salaries || '—'}</strong>
              </span>
            </div>
            {(() => {
              const coutBen = det.heures_benevolat_semaine
                ? parseFloat(det.heures_benevolat_semaine) * parseFloat(det.taux_horaire_valorisation || String(SMIC_HORAIRE_BRUT_DEFAUT)) * 52
                : 0;
              const coutSal = det.cout_salarial_annuel_estime ? parseFloat(det.cout_salarial_annuel_estime) : 0;
              const total = coutBen + coutSal;
              return (
                <>
                  {(det.heures_benevolat_semaine || det.taux_horaire_valorisation) && (
                    <p className="text-xs text-gray-500">
                      Valorisation : {det.heures_benevolat_semaine || '?'} h/sem × {det.taux_horaire_valorisation || SMIC_HORAIRE_BRUT_DEFAUT} €/h
                      {coutBen > 0 && <span className="ml-1 font-medium">= {coutBen.toLocaleString('fr-FR')} €/an</span>}
                    </p>
                  )}
                  <RowF label="Coût salarial estimé" value={coutSal > 0 ? `${coutSal.toLocaleString('fr-FR')} €/an` : null} />
                  {total > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 flex justify-between items-center">
                      <span className="text-xs font-semibold text-indigo-700">Total coût humain estimé</span>
                      <span className="text-sm font-bold text-indigo-800 tabular-nums">{total.toLocaleString('fr-FR')} €/an</span>
                    </div>
                  )}
                </>
              );
            })()}
            <TextBlockF label="Description" text={det.moyens_description} />
          </div>
        )}
      </SectionCard>

      {/* Prestataires et moyens matériels */}
      <div ref={prestataireCardRef}>
      <SectionCard title="Prestataires et moyens matériels">
        {editMode ? (
          <div className="space-y-5">
            {/* Prestataires */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.a_des_prestataires}
                  onChange={e => {
                    setField('a_des_prestataires', e.target.checked);
                    if (e.target.checked && draft.prestataires.length === 0) addPrestataire();
                  }}
                />
                <span className="text-sm font-medium text-gray-700">Avez-vous des prestataires / intervenants rémunérés ?</span>
              </label>
              {draft.a_des_prestataires && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-[1fr_100px_100px_24px] gap-2 mb-1">
                    <span className="text-xs text-gray-400">Type / nom</span>
                    <span className="text-xs text-gray-400">Nb séances</span>
                    <span className="text-xs text-gray-400">Tarif (€)</span>
                    <span />
                  </div>
                  {draft.prestataires.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_100px_100px_24px] gap-2 items-center">
                      <input className="field-input text-sm" value={p.nom_type} onChange={e => setPrestataire(i, { nom_type: e.target.value })} placeholder="Ex : Diététicien·ne, Coach APA…" />
                      <input type="number" className="field-input text-sm" value={p.nb_seances_ou_ateliers} onChange={e => setPrestataire(i, { nb_seances_ou_ateliers: e.target.value })} placeholder="12" min={0} />
                      <input type="number" className="field-input text-sm" value={p.tarif_unitaire} onChange={e => setPrestataire(i, { tarif_unitaire: e.target.value })} placeholder="80" min={0} step={0.01} />
                      <button type="button" onClick={() => removePrestataire(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  ))}
                  <button type="button" onClick={addPrestataire} className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1">+ Ajouter un prestataire</button>
                </div>
              )}
            </div>
            {/* Locaux — deux situations mutuellement exclusives regroupées */}
            <div className="space-y-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Locaux utilisés par le projet</p>
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.locaux_mis_a_disposition}
                    onChange={e => setField('locaux_mis_a_disposition', e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-700">Locaux mis à disposition <strong>GRATUITEMENT</strong> par un tiers (mairie, partenaire…)</span>
                </label>
                {draft.locaux_mis_a_disposition && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Qui met à disposition ?">
                      <input className="field-input" value={draft.locaux_bailleur} onChange={e => setField('locaux_bailleur', e.target.value)} placeholder="Ex : Mairie du 13e, MJC…" />
                    </Field>
                    <Field label="Valeur estimée (€/an)">
                      <input type="number" className="field-input" value={draft.locaux_valeur_estimee} onChange={e => setField('locaux_valeur_estimee', e.target.value)} placeholder="Ex : 2 400" min={0} />
                    </Field>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 italic">Un même local ne doit être déclaré que dans l&apos;une des deux situations ci-dessous, jamais les deux.</p>
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={draft.location_salle_payante} onChange={e => setField('location_salle_payante', e.target.checked)} />
                  <span className="text-sm font-medium text-gray-700">Location de salle que <strong>VOUS payez</strong> (compte 61)</span>
                </label>
                {draft.location_salle_payante && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Coût annuel total (€)">
                      <input type="number" className="field-input" value={draft.location_salle_cout_annuel} onChange={e => setField('location_salle_cout_annuel', e.target.value)} placeholder="Ex : 3 600" min={0} />
                    </Field>
                    <Field label="Précisions">
                      <input className="field-input" value={draft.location_salle_precisions} onChange={e => setField('location_salle_precisions', e.target.value)} placeholder="Ex : salle polyvalente 3h × 48 sem." />
                    </Field>
                  </div>
                )}
              </div>
              {draft.locaux_mis_a_disposition && draft.location_salle_payante && (
                <div className="flex gap-2 items-start text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-2">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>Vous avez coché à la fois &laquo;&nbsp;mis à disposition gratuitement&nbsp;&raquo; et &laquo;&nbsp;location payante&nbsp;&raquo; — vérifiez que ce ne sont pas le même local.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Prestataires rémunérés</p>
              {det.a_des_prestataires && det.prestataires?.some(p => p.nom_type) ? (
                <div className="space-y-1.5">
                  {det.prestataires.filter(p => p.nom_type).map((p, i) => {
                    const montant = (parseFloat(p.nb_seances_ou_ateliers) || 0) * (parseFloat(p.tarif_unitaire) || 0);
                    return (
                      <div key={i} className="flex justify-between text-sm gap-3">
                        <span className="text-gray-700 flex-1">{p.nom_type}</span>
                        <span className="text-gray-400 text-xs">{p.nb_seances_ou_ateliers}× {p.tarif_unitaire} €</span>
                        <span className="font-medium tabular-nums">{montant.toLocaleString('fr-FR')} €</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-300 italic">—</p>
              )}
            </div>
            <RowF
              label="Locaux mis à disposition GRATUITEMENT"
              value={det.locaux_mis_a_disposition
                ? `${det.locaux_bailleur || 'Oui'}${det.locaux_valeur_estimee ? ` — ${parseFloat(det.locaux_valeur_estimee).toLocaleString('fr-FR')} €/an` : ''}`
                : null}
            />
            <RowF
              label="Location de salle (payante)"
              value={det.location_salle_payante ? `${det.location_salle_cout_annuel ? `${parseFloat(det.location_salle_cout_annuel).toLocaleString('fr-FR')} €/an` : 'Oui'}${det.location_salle_precisions ? ` — ${det.location_salle_precisions}` : ''}` : null}
            />
          </div>
        )}
      </SectionCard>
      </div>

      {/* Charges et recettes additionnelles */}
      <div ref={chargesCardRef}>
      <SectionCard title="Charges et recettes additionnelles">
        {editMode ? (
          <div className="space-y-5">
            {/* Achats / fournitures récurrents */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Achats et fournitures récurrents (compte 60)</p>
              {draft.achats_recurrents.length > 0 && (
                <div className="space-y-2 mb-2">
                  <div className="grid grid-cols-[1fr_100px_100px_24px] gap-2 mb-1">
                    <span className="text-xs text-gray-400">Type / description</span>
                    <span className="text-xs text-gray-400">Qté/an</span>
                    <span className="text-xs text-gray-400">Coût unit. (€)</span>
                    <span />
                  </div>
                  {draft.achats_recurrents.map((a, i) => (
                    <div key={i} className="grid grid-cols-[1fr_100px_100px_24px] gap-2 items-center">
                      <input className="field-input text-sm" value={a.nom_type} onChange={e => setAchat(i, { nom_type: e.target.value })} placeholder="Ex : Fournitures pédagogiques, Alimentation…" />
                      <input type="number" className="field-input text-sm" value={a.quantite_annuelle} onChange={e => setAchat(i, { quantite_annuelle: e.target.value })} placeholder="12" min={0} />
                      <input type="number" className="field-input text-sm" value={a.cout_unitaire} onChange={e => setAchat(i, { cout_unitaire: e.target.value })} placeholder="50" min={0} step={0.01} />
                      <button type="button" onClick={() => removeAchat(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={addAchat} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Ajouter un achat</button>
            </div>
            {/* Assurance */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={draft.assurance_dediee} onChange={e => setField('assurance_dediee', e.target.checked)} />
                <span className="text-sm font-medium text-gray-700">Assurance dédiée au projet (compte 61)</span>
              </label>
              {draft.assurance_dediee && (
                <div className="mt-3">
                  <Field label="Coût annuel estimé (€)">
                    <input type="number" className="field-input" value={draft.assurance_cout_annuel} onChange={e => setField('assurance_cout_annuel', e.target.value)} placeholder="Ex : 800" min={0} />
                  </Field>
                </div>
              )}
            </div>
            {/* Déplacements */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={draft.deplacements_estimes} onChange={e => setField('deplacements_estimes', e.target.checked)} />
                <span className="text-sm font-medium text-gray-700">Déplacements / missions estimés (compte 62)</span>
              </label>
              {draft.deplacements_estimes && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Fréquence mensuelle (trajets/mois)">
                    <input type="number" className="field-input" value={draft.deplacements_frequence_mensuelle} onChange={e => setField('deplacements_frequence_mensuelle', e.target.value)} placeholder="Ex : 4" min={0} />
                  </Field>
                  <Field label="Coût moyen par trajet (€)">
                    <input type="number" className="field-input" value={draft.deplacements_cout_moyen} onChange={e => setField('deplacements_cout_moyen', e.target.value)} placeholder="Ex : 15" min={0} step={0.01} />
                  </Field>
                </div>
              )}
            </div>
            {/* Cotisations */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={draft.cotisations_actives} onChange={e => setField('cotisations_actives', e.target.checked)} />
                <span className="text-sm font-medium text-gray-700">Cotisations / prestations des bénéficiaires (compte 70)</span>
              </label>
              {draft.cotisations_actives && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Nb adhérents payants">
                    <input type="number" className="field-input" value={draft.nb_adherents_payants} onChange={e => setField('nb_adherents_payants', e.target.value)} placeholder="Ex : 80" min={0} />
                  </Field>
                  <Field label="Tarif moyen annuel (€/pers.)">
                    <input type="number" className="field-input" value={draft.tarif_moyen_annuel} onChange={e => setField('tarif_moyen_annuel', e.target.value)} placeholder="Ex : 50" min={0} step={0.01} />
                  </Field>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Achats */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Achats et fournitures récurrents</p>
              {det.achats_recurrents?.filter(a => a.nom_type).length ? (
                <div className="space-y-1">
                  {det.achats_recurrents.filter(a => a.nom_type).map((a, i) => {
                    const montant = (parseFloat(a.quantite_annuelle) || 0) * (parseFloat(a.cout_unitaire) || 0);
                    return (
                      <div key={i} className="flex justify-between text-sm gap-3">
                        <span className="text-gray-700 flex-1">{a.nom_type}</span>
                        <span className="text-gray-400 text-xs">{a.quantite_annuelle}× {a.cout_unitaire} €</span>
                        <span className="font-medium tabular-nums">{montant.toLocaleString('fr-FR')} €</span>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-gray-300 italic">—</p>}
            </div>
            <RowF label="Assurance dédiée" value={det.assurance_dediee && det.assurance_cout_annuel ? `${parseFloat(det.assurance_cout_annuel).toLocaleString('fr-FR')} €/an` : det.assurance_dediee ? 'Oui' : null} />
            <RowF label="Déplacements estimés" value={det.deplacements_estimes && det.deplacements_frequence_mensuelle && det.deplacements_cout_moyen ? `${det.deplacements_frequence_mensuelle} trajet(s)/mois × ${det.deplacements_cout_moyen} €` : det.deplacements_estimes ? 'Oui' : null} />
            <RowF label="Cotisations bénéficiaires" value={det.cotisations_actives && det.nb_adherents_payants ? `${det.nb_adherents_payants} adhérents × ${det.tarif_moyen_annuel || '?'} €/an` : det.cotisations_actives ? 'Oui' : null} />
          </div>
        )}
      </SectionCard>
      </div>

      {/* Aperçu des lignes budgétaires auto-générées (visible en mode édition) */}
      {editMode && lignesAutoPreview.length > 0 && (
        <AutoBudgetPreview lignes={lignesAutoPreview} demandeId={demande.id} />
      )}

    </>
  );
}
