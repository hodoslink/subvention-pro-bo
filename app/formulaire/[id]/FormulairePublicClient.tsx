'use client';

import { useState } from 'react';

type Details = Record<string, unknown>;

interface Props {
  demandeId: string;
  token: string;
  associationNom: string;
  dateLimiteDepot: string | null;
  initialDetails: Details;
}

function numVal(details: Details, key: string): string {
  const v = details[key];
  return typeof v === 'string' ? v : '';
}

function boolVal(details: Details, key: string): boolean {
  return details[key] === true;
}

export default function FormulairePublicClient({
  demandeId,
  token,
  associationNom,
  dateLimiteDepot,
  initialDetails,
}: Props) {
  const [details, setDetails] = useState<Details>(initialDetails);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: unknown) {
    setDetails(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/public/formulaire/${demandeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...details }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Erreur ${res.status}`);
      } else {
        setSaved(true);
      }
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.');
    } finally {
      setSaving(false);
    }
  }

  const prestataires: Array<{ nom_type?: string; nb_seances_ou_ateliers?: string; tarif_unitaire?: string }> =
    Array.isArray(details.prestataires) ? (details.prestataires as typeof prestataires) : [];

  const achatsRecurrents: Array<{ nom_type?: string; quantite_annuelle?: string; cout_unitaire?: string }> =
    Array.isArray(details.achats_recurrents) ? (details.achats_recurrents as typeof achatsRecurrents) : [];

  const autresBailleurs: Array<{ nom_bailleur?: string; montant?: string; statut?: string }> =
    Array.isArray(details.autres_bailleurs_sollicites) ? (details.autres_bailleurs_sollicites as typeof autresBailleurs) : [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">Formulaire de renseignements</p>
        <h1 className="text-2xl font-bold text-gray-900">{associationNom || 'Votre association'}</h1>
        <p className="text-gray-600 text-sm">
          Ces informations permettront à votre conseiller de constituer votre dossier de demande de subvention.
          Vous pouvez enregistrer plusieurs fois.
        </p>
        {dateLimiteDepot && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <span className="text-amber-600 mt-0.5">📅</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Date limite de dépôt du dossier</p>
              <p className="text-sm text-amber-700">
                {new Date(dateLimiteDepot).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1 : L'équipe */}
        <section className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-800">1. L'équipe</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de bénévoles actifs</label>
              <input
                type="text"
                inputMode="numeric"
                className="field-input"
                value={numVal(details, 'nb_benevoles')}
                onChange={e => setField('nb_benevoles', e.target.value)}
                placeholder="ex: 12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heures de bénévolat / semaine</label>
              <input
                type="text"
                inputMode="numeric"
                className="field-input"
                value={numVal(details, 'heures_benevolat_semaine')}
                onChange={e => setField('heures_benevolat_semaine', e.target.value)}
                placeholder="ex: 20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taux horaire de valorisation (€)</label>
              <input
                type="text"
                inputMode="decimal"
                className="field-input"
                value={numVal(details, 'taux_horaire_valorisation')}
                onChange={e => setField('taux_horaire_valorisation', e.target.value)}
                placeholder="ex: 11,65"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de salariés</label>
              <input
                type="text"
                inputMode="numeric"
                className="field-input"
                value={numVal(details, 'nb_salaries')}
                onChange={e => setField('nb_salaries', e.target.value)}
                placeholder="ex: 2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Coût salarial annuel estimé (€)</label>
              <input
                type="text"
                inputMode="decimal"
                className="field-input"
                value={numVal(details, 'cout_salarial_annuel_estime')}
                onChange={e => setField('cout_salarial_annuel_estime', e.target.value)}
                placeholder="ex: 35000"
              />
            </div>
          </div>
        </section>

        {/* Section 2 : Intervenants extérieurs */}
        <section className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-800">2. Intervenants extérieurs (prestataires)</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={boolVal(details, 'a_des_prestataires')}
              onChange={e => setField('a_des_prestataires', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Nous faisons appel à des prestataires / intervenants rémunérés</span>
          </label>

          {boolVal(details, 'a_des_prestataires') && (
            <div className="space-y-3">
              {prestataires.map((p, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Type / nom du prestataire</label>
                    <input
                      className="field-input"
                      value={p.nom_type ?? ''}
                      onChange={e => {
                        const updated = [...prestataires];
                        updated[i] = { ...updated[i], nom_type: e.target.value };
                        setField('prestataires', updated);
                      }}
                      placeholder="ex: Animateur sportif"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nb séances / an</label>
                    <input
                      className="field-input"
                      inputMode="numeric"
                      value={p.nb_seances_ou_ateliers ?? ''}
                      onChange={e => {
                        const updated = [...prestataires];
                        updated[i] = { ...updated[i], nb_seances_ou_ateliers: e.target.value };
                        setField('prestataires', updated);
                      }}
                      placeholder="ex: 10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tarif unitaire (€)</label>
                    <input
                      className="field-input"
                      inputMode="decimal"
                      value={p.tarif_unitaire ?? ''}
                      onChange={e => {
                        const updated = [...prestataires];
                        updated[i] = { ...updated[i], tarif_unitaire: e.target.value };
                        setField('prestataires', updated);
                      }}
                      placeholder="ex: 150"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-700"
                      onClick={() => setField('prestataires', prestataires.filter((_, j) => j !== i))}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
              {prestataires.length < 10 && (
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => setField('prestataires', [...prestataires, { nom_type: '', nb_seances_ou_ateliers: '', tarif_unitaire: '' }])}
                >
                  + Ajouter un prestataire
                </button>
              )}
            </div>
          )}
        </section>

        {/* Section 3 : Lieu et matériel */}
        <section className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-800">3. Lieu et matériel</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={boolVal(details, 'locaux_mis_a_disposition')}
              onChange={e => setField('locaux_mis_a_disposition', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Des locaux nous sont mis à disposition gratuitement</span>
          </label>

          {boolVal(details, 'locaux_mis_a_disposition') && (
            <div className="grid grid-cols-2 gap-4 pl-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Par qui ? (bailleur des locaux)</label>
                <input
                  className="field-input"
                  value={numVal(details, 'locaux_bailleur')}
                  onChange={e => setField('locaux_bailleur', e.target.value)}
                  placeholder="ex: Mairie de…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valeur estimée annuelle (€)</label>
                <input
                  className="field-input"
                  inputMode="decimal"
                  value={numVal(details, 'locaux_valeur_estimee')}
                  onChange={e => setField('locaux_valeur_estimee', e.target.value)}
                  placeholder="ex: 3000"
                />
              </div>
            </div>
          )}

          <div className="pt-2 space-y-3">
            <p className="text-sm font-medium text-gray-700">Achats et fournitures récurrents</p>
            {achatsRecurrents.map((a, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Type d'achat</label>
                  <input
                    className="field-input"
                    value={a.nom_type ?? ''}
                    onChange={e => {
                      const updated = [...achatsRecurrents];
                      updated[i] = { ...updated[i], nom_type: e.target.value };
                      setField('achats_recurrents', updated);
                    }}
                    placeholder="ex: Matériel pédagogique"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Quantité / an</label>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    value={a.quantite_annuelle ?? ''}
                    onChange={e => {
                      const updated = [...achatsRecurrents];
                      updated[i] = { ...updated[i], quantite_annuelle: e.target.value };
                      setField('achats_recurrents', updated);
                    }}
                    placeholder="ex: 5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Coût unitaire (€)</label>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={a.cout_unitaire ?? ''}
                    onChange={e => {
                      const updated = [...achatsRecurrents];
                      updated[i] = { ...updated[i], cout_unitaire: e.target.value };
                      setField('achats_recurrents', updated);
                    }}
                    placeholder="ex: 50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:text-red-700"
                    onClick={() => setField('achats_recurrents', achatsRecurrents.filter((_, j) => j !== i))}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            {achatsRecurrents.length < 15 && (
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={() => setField('achats_recurrents', [...achatsRecurrents, { nom_type: '', quantite_annuelle: '', cout_unitaire: '' }])}
              >
                + Ajouter un achat récurrent
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              className="rounded"
              checked={boolVal(details, 'location_salle_payante')}
              onChange={e => setField('location_salle_payante', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Nous louons une salle (payante)</span>
          </label>

          {boolVal(details, 'location_salle_payante') && (
            <div className="grid grid-cols-2 gap-4 pl-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coût annuel location (€)</label>
                <input
                  className="field-input"
                  inputMode="decimal"
                  value={numVal(details, 'location_salle_cout_annuel')}
                  onChange={e => setField('location_salle_cout_annuel', e.target.value)}
                  placeholder="ex: 1200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Précisions</label>
                <input
                  className="field-input"
                  value={numVal(details, 'location_salle_precisions')}
                  onChange={e => setField('location_salle_precisions', e.target.value)}
                  placeholder="ex: Salle polyvalente municipale"
                />
              </div>
            </div>
          )}
        </section>

        {/* Section 4 : Assurance et déplacements */}
        <section className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-800">4. Assurance et déplacements</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={boolVal(details, 'assurance_dediee')}
              onChange={e => setField('assurance_dediee', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Nous avons une assurance dédiée à ce projet</span>
          </label>

          {boolVal(details, 'assurance_dediee') && (
            <div className="pl-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Coût annuel assurance (€)</label>
              <input
                className="field-input w-48"
                inputMode="decimal"
                value={numVal(details, 'assurance_cout_annuel')}
                onChange={e => setField('assurance_cout_annuel', e.target.value)}
                placeholder="ex: 400"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              className="rounded"
              checked={boolVal(details, 'deplacements_estimes')}
              onChange={e => setField('deplacements_estimes', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Des déplacements sont prévus</span>
          </label>

          {boolVal(details, 'deplacements_estimes') && (
            <div className="grid grid-cols-2 gap-4 pl-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence mensuelle estimée</label>
                <input
                  className="field-input"
                  inputMode="numeric"
                  value={numVal(details, 'deplacements_frequence_mensuelle')}
                  onChange={e => setField('deplacements_frequence_mensuelle', e.target.value)}
                  placeholder="ex: 4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coût moyen par déplacement (€)</label>
                <input
                  className="field-input"
                  inputMode="decimal"
                  value={numVal(details, 'deplacements_cout_moyen')}
                  onChange={e => setField('deplacements_cout_moyen', e.target.value)}
                  placeholder="ex: 25"
                />
              </div>
            </div>
          )}
        </section>

        {/* Section 5 : Participation des bénéficiaires */}
        <section className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-800">5. Participation des bénéficiaires</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={boolVal(details, 'cotisations_actives')}
              onChange={e => setField('cotisations_actives', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Les bénéficiaires paient une cotisation / adhésion</span>
          </label>

          {boolVal(details, 'cotisations_actives') && (
            <div className="grid grid-cols-2 gap-4 pl-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre d'adhérents payants</label>
                <input
                  className="field-input"
                  inputMode="numeric"
                  value={numVal(details, 'nb_adherents_payants')}
                  onChange={e => setField('nb_adherents_payants', e.target.value)}
                  placeholder="ex: 50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarif moyen annuel (€)</label>
                <input
                  className="field-input"
                  inputMode="decimal"
                  value={numVal(details, 'tarif_moyen_annuel')}
                  onChange={e => setField('tarif_moyen_annuel', e.target.value)}
                  placeholder="ex: 30"
                />
              </div>
            </div>
          )}
        </section>

        {/* Section 6 : Autres financements */}
        <section className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-800">6. Autres financements sollicités</h2>
          <p className="text-sm text-gray-500">Listez les autres bailleurs / financeurs sollicités pour ce projet.</p>

          <div className="space-y-3">
            {autresBailleurs.map((b, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">Bailleur / financeur</label>
                  <input
                    className="field-input"
                    value={b.nom_bailleur ?? ''}
                    onChange={e => {
                      const updated = [...autresBailleurs];
                      updated[i] = { ...updated[i], nom_bailleur: e.target.value };
                      setField('autres_bailleurs_sollicites', updated);
                    }}
                    placeholder="ex: Région IDF"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Montant (€)</label>
                  <input
                    className="field-input"
                    inputMode="decimal"
                    value={b.montant ?? ''}
                    onChange={e => {
                      const updated = [...autresBailleurs];
                      updated[i] = { ...updated[i], montant: e.target.value };
                      setField('autres_bailleurs_sollicites', updated);
                    }}
                    placeholder="ex: 5000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Statut</label>
                  <select
                    className="field-input"
                    value={b.statut ?? 'envisage'}
                    onChange={e => {
                      const updated = [...autresBailleurs];
                      updated[i] = { ...updated[i], statut: e.target.value };
                      setField('autres_bailleurs_sollicites', updated);
                    }}
                  >
                    <option value="obtenu">Obtenu</option>
                    <option value="demande">Demandé</option>
                    <option value="envisage">Envisagé</option>
                  </select>
                </div>
                <div className="col-span-3 flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:text-red-700"
                    onClick={() => setField('autres_bailleurs_sollicites', autresBailleurs.filter((_, j) => j !== i))}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            {autresBailleurs.length < 10 && (
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800"
                onClick={() => setField('autres_bailleurs_sollicites', [...autresBailleurs, { nom_bailleur: '', montant: '', statut: 'envisage' }])}
              >
                + Ajouter un financement
              </button>
            )}
          </div>
        </section>

        {/* Submit */}
        <div className="sticky bottom-4 bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-lg">
          {error && <p className="text-sm text-red-600 flex-1">{error}</p>}
          {saved && !error && (
            <p className="text-sm text-green-700 flex-1">Réponses enregistrées avec succès.</p>
          )}
          {!saved && !error && <div className="flex-1" />}
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary shrink-0"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer mes réponses'}
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-gray-400 pb-8">
        Vos réponses sont transmises directement à votre conseiller. Ce formulaire ne constitue pas une demande officielle.
      </p>
    </div>
  );
}
