"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PathProgress } from "@/components/PathProgress";
import { SiretSearch } from "@/components/SiretSearch";
import { FileDrop } from "@/components/FileDrop";
import { VerifiedInfoCard } from "@/components/VerifiedInfoCard";
import { StepCard, Field, NavButtons } from "@/components/StepUI";

const STEPS = [
  { label: "Votre association" },
  { label: "Qui contacter" },
  { label: "Documents" },
  { label: "Votre projet" },
  { label: "Le budget" },
  { label: "Récapitulatif" },
];

type FormState = {
  // Identité association
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
  // Contact
  contact_nom: string;
  contact_role: string;
  contact_email: string;
  contact_telephone: string;
  // Nature de la demande
  type_demande: "premiere" | "renouvellement";
  bilan_subvention_anterieure: string;
  bilan_activites: string;
  bilan_nb_beneficiaires_reel: string;
  // Projet
  bailleur_type: string;
  bailleur_nom: string;
  montant_demande: string;
  titre_projet: string;
  objectif_projet: string;
  public_beneficiaire: string;
  nb_beneficiaires_estime: string;
  periode_debut: string;
  periode_fin: string;
  annee_millesime: string;
  // Pluriannuel
  est_pluriannuel: boolean;
  pluriannuel_nb_annees: "2" | "3" | "4";
};

type DirigeantTrouve = { nom: string; prenoms: string; qualite: string };

const initialState: FormState = {
  nom: "", siret: "", siren: "", rna: "", adresse: "", code_postal: "", ville: "",
  forme_juridique: "", nb_membres: "", date_creation: "",
  contact_nom: "", contact_role: "", contact_email: "", contact_telephone: "",
  type_demande: "premiere", bilan_subvention_anterieure: "", bilan_activites: "", bilan_nb_beneficiaires_reel: "",
  bailleur_type: "ville", bailleur_nom: "", montant_demande: "",
  titre_projet: "", objectif_projet: "", public_beneficiaire: "",
  nb_beneficiaires_estime: "", periode_debut: "", periode_fin: "",
  annee_millesime: String(new Date().getFullYear()),
  est_pluriannuel: false, pluriannuel_nb_annees: "3",
};

type BudgetLigne = { poste: string; montant: string };

export default function NouvelleDemande() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [budget, setBudget] = useState<BudgetLigne[]>([{ poste: "", montant: "" }]);
  const [dirigeantsTrouves, setDirigeantsTrouves] = useState<DirigeantTrouve[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const assoRes = await fetch("/api/associations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nb_membres: form.nb_membres ? Number(form.nb_membres) : null,
          date_creation: form.date_creation || null,
        }),
      });
      const assoData = await assoRes.json();
      if (!assoRes.ok) throw new Error(assoData.error || "Erreur association");

      const demandeBody: Record<string, unknown> = {
        association_id: assoData.association.id,
        type_demande: form.type_demande,
        bilan_subvention_anterieure: form.type_demande === "renouvellement" && form.bilan_subvention_anterieure
          ? Number(form.bilan_subvention_anterieure)
          : null,
        bilan_activites: form.type_demande === "renouvellement" ? form.bilan_activites : "",
        bilan_nb_beneficiaires_reel: form.type_demande === "renouvellement" && form.bilan_nb_beneficiaires_reel
          ? Number(form.bilan_nb_beneficiaires_reel)
          : null,
        bailleur_type: form.bailleur_type,
        bailleur_nom: form.bailleur_nom,
        montant_demande: form.est_pluriannuel ? null : (form.montant_demande ? Number(form.montant_demande) : null),
        titre_projet: form.titre_projet,
        objectif_projet: form.objectif_projet,
        public_beneficiaire: form.public_beneficiaire,
        nb_beneficiaires_estime: form.nb_beneficiaires_estime ? Number(form.nb_beneficiaires_estime) : null,
        periode_debut: form.periode_debut || null,
        periode_fin: form.periode_fin || null,
        annee_millesime: form.annee_millesime ? Number(form.annee_millesime) : null,
        budget_previsionnel_json: budget.filter((b) => b.poste),
      };

      if (form.est_pluriannuel) {
        demandeBody.pluriannuel_nb_annees = Number(form.pluriannuel_nb_annees);
      }

      const demandeRes = await fetch("/api/demandes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demandeBody),
      });
      const demandeData = await demandeRes.json();
      if (!demandeRes.ok) throw new Error(demandeData.error || "Erreur demande");

      router.push(`/demandes/${demandeData.demande.id}`);
    } catch (e: any) {
      setError(e.message || "Une erreur est survenue, réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 px-4 md:px-6 py-10 md:py-14">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <PathProgress steps={STEPS} currentIndex={stepIndex} />
        </div>

        {stepIndex === 0 && (
          <StepCard
            eyebrow="Étape 1"
            title="Parlez-nous de votre association"
            subtitle="On retrouve les informations officielles automatiquement — pas besoin de ressortir les statuts tout de suite."
          >
            <SiretSearch
              onSelect={(s) => {
                update({
                  nom: s.nom,
                  siret: s.siret,
                  siren: s.siren,
                  rna: s.rna || "",
                  adresse: s.adresse,
                  code_postal: s.code_postal,
                  ville: s.ville,
                  forme_juridique: s.forme_juridique,
                  date_creation: s.date_creation || "",
                });
                setDirigeantsTrouves(s.dirigeants || []);
              }}
            />
            {form.nom && (
              <VerifiedInfoCard
                title="Voici ce qu'on a retrouvé — vérifiez que tout est juste"
                rows={[
                  { label: "Nom", value: form.nom },
                  { label: "Adresse", value: `${form.adresse}, ${form.code_postal} ${form.ville}` },
                  { label: "SIREN", value: form.siren },
                  { label: "N° RNA", value: form.rna || "Non trouvé automatiquement" },
                  ...(dirigeantsTrouves.length > 0
                    ? [{
                        label: "Dirigeant(s) connu(s)",
                        value: dirigeantsTrouves
                          .map((d) => `${d.prenoms} ${d.nom} (${d.qualite})`)
                          .join(", "),
                      }]
                    : []),
                ]}
                note={
                  form.rna
                    ? "Le numéro RNA peut parfois être ancien — un coup d'œil sur le Journal Officiel permet de confirmer qu'il est toujours à jour."
                    : "On n'a pas trouvé le numéro RNA automatiquement — vous le trouverez sur le récépissé de déclaration, ou via le lien ci-dessous."
                }
                links={[
                  {
                    label: "Vérifier sur l'Annuaire des Entreprises",
                    url: `https://annuaire-entreprises.data.gouv.fr/etablissement/${form.siret || form.siren}`,
                  },
                  {
                    label: "Rechercher sur le Journal Officiel",
                    url: `https://www.journal-officiel.gouv.fr/pages/associations-recherche/?denomination=${encodeURIComponent(form.nom)}`,
                  },
                ]}
              />
            )}
            <Field
              label="Numéro RNA"
              hint={
                form.rna
                  ? "Pré-rempli automatiquement — corrigez si besoin."
                  : "On ne l'a pas trouvé automatiquement. Vous le trouverez sur le récépissé de déclaration de votre association."
              }
            >
              <input
                className="field-input"
                placeholder="Ex. W123456789"
                value={form.rna}
                maxLength={10}
                onChange={(e) => update({ rna: e.target.value })}
              />
            </Field>
            <Field label="Combien de membres compte l'association environ ?">
              <input
                type="number"
                className="field-input"
                placeholder="Ex. 180"
                value={form.nb_membres}
                min={0}
                max={1000000}
                onChange={(e) => update({ nb_membres: e.target.value })}
              />
            </Field>
            <NavButtons showBack={false} onNext={next} nextDisabled={!form.nom} />
          </StepCard>
        )}

        {stepIndex === 1 && (
          <StepCard
            eyebrow="Étape 2"
            title="Qui pouvons-nous contacter ?"
            subtitle="La personne qui pourra répondre à nos petites questions pendant la rédaction."
          >
            <Field label="Nom et prénom">
              <input
                className="field-input"
                placeholder="Ex. Marie Dupont"
                value={form.contact_nom}
                maxLength={150}
                onChange={(e) => update({ contact_nom: e.target.value })}
              />
            </Field>
            <Field label="Fonction dans l'association">
              <input
                className="field-input"
                placeholder="Ex. Présidente, Trésorier…"
                value={form.contact_role}
                maxLength={100}
                onChange={(e) => update({ contact_role: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className="field-input"
                placeholder="exemple@association.fr"
                value={form.contact_email}
                maxLength={255}
                onChange={(e) => update({ contact_email: e.target.value })}
              />
            </Field>
            <Field label="Téléphone" hint="Utile si on a besoin d'une réponse rapide.">
              <input
                type="tel"
                className="field-input"
                placeholder="06 00 00 00 00"
                value={form.contact_telephone}
                maxLength={20}
                onChange={(e) => update({ contact_telephone: e.target.value })}
              />
            </Field>
            <NavButtons
              onBack={back}
              onNext={next}
              nextDisabled={!form.contact_nom || !form.contact_email}
            />
          </StepCard>
        )}

        {stepIndex === 2 && (
          <StepCard
            eyebrow="Étape 3"
            title="Quelques documents"
            subtitle="Tout n'est pas obligatoire dès maintenant — on peut continuer et vous les redemander si besoin."
          >
            <div className="bg-cream-deep rounded-xl p-4 text-sm text-ink-soft space-y-2">
              <p>
                Ces documents ne sont malheureusement pas téléchargeables en
                ligne automatiquement — ils sont conservés par votre
                association ou par votre préfecture.
              </p>
              <p>
                Pas sous la main ?{" "}
                <a
                  href="https://www.service-public.gouv.fr/associations/vosdroits/F1119"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terracotta-deep font-semibold underline"
                >
                  Voici comment les redemander à votre greffe
                </a>
                .
              </p>
            </div>
            <FileDrop label="Statuts de l'association" onFile={() => {}} optional />
            <FileDrop label="Récépissé RNA ou extrait Journal Officiel" onFile={() => {}} optional />
            <FileDrop label="Derniers comptes approuvés" onFile={() => {}} optional />
            <FileDrop label="Dernier rapport d'activité" onFile={() => {}} optional />
            {form.type_demande === "renouvellement" && (
              <FileDrop
                label="Justification de la subvention précédente (bilan financier, factures acquittées)"
                onFile={() => {}}
                optional
              />
            )}
            <NavButtons onBack={back} onNext={next} />
          </StepCard>
        )}

        {stepIndex === 3 && (
          <StepCard
            eyebrow="Étape 4"
            title="Votre projet, avec vos mots"
            subtitle="Racontez-le comme vous le feriez à quelqu'un qui ne connaît pas l'association. On reformule ensuite pour le dossier officiel."
          >
            <Field label="Cette demande est-elle une première demande ou un renouvellement ?">
              <div className="flex gap-3">
                {[
                  { v: "premiere", l: "Première demande" },
                  { v: "renouvellement", l: "Renouvellement" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => update({ type_demande: opt.v as "premiere" | "renouvellement" })}
                    className={[
                      "flex-1 h-[52px] rounded-[10px] border-[1.5px] font-medium transition-all",
                      form.type_demande === opt.v
                        ? "border-sapin bg-sapin-soft text-sapin-deep"
                        : "border-border-soft text-ink-soft hover:border-sapin/40",
                    ].join(" ")}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </Field>

            {form.type_demande === "renouvellement" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-0.5">Bilan de l'année précédente</p>
                  <p className="text-sm text-amber-700">
                    Ces informations sont obligatoires pour les bailleurs — elles montrent l'utilisation
                    de la subvention reçue et la continuité de votre action.
                  </p>
                </div>
                <Field label="Montant de la subvention reçue l'année précédente (€)">
                  <input
                    type="number"
                    className="field-input"
                    placeholder="Ex. 500"
                    value={form.bilan_subvention_anterieure}
                    min={0}
                    max={1000000}
                    onChange={(e) => update({ bilan_subvention_anterieure: e.target.value })}
                  />
                </Field>
                <Field
                  label="Bilan des actions réalisées"
                  hint="Résumez ce qui a été accompli : activités organisées, fréquentation, résultats concrets, difficultés rencontrées."
                >
                  <textarea
                    rows={5}
                    className="field-textarea"
                    placeholder="Ex. Nous avons organisé 242 activités, touché 82 adhérents… Des groupes de paroles, de l'aquagym, des ateliers diététiques…"
                    value={form.bilan_activites}
                    maxLength={3000}
                    onChange={(e) => update({ bilan_activites: e.target.value })}
                  />
                </Field>
                <Field label="Nombre de bénéficiaires réels (exercice précédent)">
                  <input
                    type="number"
                    className="field-input"
                    placeholder="Ex. 82"
                    value={form.bilan_nb_beneficiaires_reel}
                    min={0}
                    max={1000000}
                    onChange={(e) => update({ bilan_nb_beneficiaires_reel: e.target.value })}
                  />
                </Field>
                <div className="bg-white/70 rounded-lg p-3 text-sm text-amber-800">
                  Pensez à joindre dans l'étape <strong>Documents</strong> : la justification de la subvention
                  précédente (bilan financier, copies de factures acquittées).
                </div>
              </div>
            )}

            {/* Pluriannuel */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-sapin"
                  checked={form.est_pluriannuel}
                  onChange={e => update({ est_pluriannuel: e.target.checked })}
                />
                <span className="text-sm font-medium text-ink">
                  Cette demande est pluriannuelle (Cerfa multi-années)
                  <span className="block text-xs font-normal text-ink-soft mt-0.5">
                    Le bailleur s'engage sur plusieurs années en une seule décision — jusqu'à 4 ans sur le Cerfa 12156*06.
                  </span>
                </span>
              </label>
              {form.est_pluriannuel && (
                <div className="ml-7 grid grid-cols-2 gap-3">
                  <Field label="Nombre d'années">
                    <select
                      className="field-input"
                      value={form.pluriannuel_nb_annees}
                      onChange={e => update({ pluriannuel_nb_annees: e.target.value as "2" | "3" | "4" })}
                    >
                      <option value="2">2 ans</option>
                      <option value="3">3 ans</option>
                      <option value="4">4 ans</option>
                    </select>
                  </Field>
                  <Field label="Première année">
                    <input
                      type="number"
                      className="field-input"
                      value={form.annee_millesime}
                      min={2020}
                      max={2035}
                      onChange={e => update({ annee_millesime: e.target.value })}
                    />
                  </Field>
                  <p className="col-span-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    {Number(form.pluriannuel_nb_annees)} fiches demande seront créées automatiquement ({
                      Array.from({ length: Number(form.pluriannuel_nb_annees) }, (_, i) =>
                        (Number(form.annee_millesime) || new Date().getFullYear()) + i
                      ).join(', ')
                    }). Le montant demandé peut différer par année — vous le saisirez sur chaque fiche.
                  </p>
                </div>
              )}
              {!form.est_pluriannuel && (
                <div className="ml-7">
                  <Field label="Millésime (année)">
                    <input
                      type="number"
                      className="field-input"
                      value={form.annee_millesime}
                      min={2020}
                      max={2035}
                      onChange={e => update({ annee_millesime: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {[
                { v: "ville", l: "Ville / mairie" },
                { v: "departement", l: "Département" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => update({ bailleur_type: opt.v })}
                  className={[
                    "flex-1 h-[52px] rounded-[10px] border-[1.5px] font-medium transition-all",
                    form.bailleur_type === opt.v
                      ? "border-sapin bg-sapin-soft text-sapin-deep"
                      : "border-border-soft text-ink-soft hover:border-sapin/40",
                  ].join(" ")}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <Field label="Nom de la collectivité visée">
              <input
                className="field-input"
                placeholder="Ex. Mairie de Pantin"
                value={form.bailleur_nom}
                maxLength={200}
                onChange={(e) => update({ bailleur_nom: e.target.value })}
              />
            </Field>
            <Field label="Titre simple de votre projet">
              <input
                className="field-input"
                placeholder="Ex. Ateliers d'activité physique adaptée pour seniors"
                value={form.titre_projet}
                maxLength={200}
                onChange={(e) => update({ titre_projet: e.target.value })}
              />
            </Field>
            <Field
              label="Concrètement, qu'est-ce que ce projet change pour vos membres ?"
              hint="Exemple : « Des séances hebdomadaires encadrées par un éducateur, pour des personnes en sortie de traitement, afin qu'elles retrouvent une activité physique en sécurité. »"
            >
              <textarea
                rows={5}
                className="field-textarea"
                placeholder="Écrivez ici, avec vos mots — quelques phrases suffisent…"
                value={form.objectif_projet}
                maxLength={3000}
                onChange={(e) => update({ objectif_projet: e.target.value })}
              />
            </Field>
            <Field label="Qui en bénéficie ?" hint="Ex. seniors, patients en rémission, jeunes du quartier…">
              <input
                className="field-input"
                value={form.public_beneficiaire}
                maxLength={300}
                onChange={(e) => update({ public_beneficiaire: e.target.value })}
              />
            </Field>
            <div className="field-row">
              <Field label="Combien de personnes environ ?">
                <input
                  type="number"
                  className="field-input"
                  placeholder="Ex. 40"
                  value={form.nb_beneficiaires_estime}
                  min={0}
                  max={1000000}
                  onChange={(e) => update({ nb_beneficiaires_estime: e.target.value })}
                />
              </Field>
              {!form.est_pluriannuel && (
                <Field label="Montant demandé (€)">
                  <input
                    type="number"
                    className="field-input"
                    placeholder="Ex. 800"
                    value={form.montant_demande}
                    min={0}
                    max={1000000}
                    onChange={(e) => update({ montant_demande: e.target.value })}
                  />
                </Field>
              )}
            </div>
            <div className="field-row">
              <Field label="Le projet démarre quand ?" hint="Date de lancement des actions.">
                <input
                  type="date"
                  className="field-input"
                  value={form.periode_debut}
                  onChange={(e) => {
                    const debut = e.target.value;
                    if (debut) {
                      const d = new Date(debut);
                      d.setFullYear(d.getFullYear() + 1);
                      const finProposee = d.toISOString().split("T")[0];
                      update({
                        periode_debut: debut,
                        // On ne propose la fin automatiquement que si elle
                        // n'a pas déjà été choisie à la main par la personne.
                        periode_fin: form.periode_fin || finProposee,
                      });
                    } else {
                      update({ periode_debut: debut });
                    }
                  }}
                />
              </Field>
              <Field label="Et se termine quand ?" hint="Pré-rempli à un an, modifiable.">
                <input
                  type="date"
                  className="field-input"
                  value={form.periode_fin}
                  onChange={(e) => update({ periode_fin: e.target.value })}
                />
              </Field>
            </div>
            <NavButtons
              onBack={back}
              onNext={next}
              nextDisabled={!form.titre_projet || !form.objectif_projet}
            />
          </StepCard>
        )}

        {stepIndex === 4 && (
          <StepCard
            eyebrow="Étape 5"
            title="Le budget, ligne par ligne"
            subtitle="Listez simplement à quoi servira l'argent. Pas besoin d'être expert-comptable."
          >
            <div className="space-y-3">
              {budget.map((ligne, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_128px_44px] gap-3 items-start"
                >
                  <input
                    className="field-input w-full"
                    placeholder="Ex. Salaire de l'éducateur sportif"
                    value={ligne.poste}
                    maxLength={200}
                    onChange={(e) => {
                      const copy = [...budget];
                      copy[i].poste = e.target.value;
                      setBudget(copy);
                    }}
                  />
                  <input
                    type="number"
                    className="field-input w-full"
                    placeholder="€"
                    value={ligne.montant}
                    onChange={(e) => {
                      const copy = [...budget];
                      copy[i].montant = e.target.value;
                      setBudget(copy);
                    }}
                  />
                  {budget.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setBudget(budget.filter((_, idx) => idx !== i))}
                      className="h-[52px] w-full sm:w-[44px] shrink-0 flex items-center justify-center text-ink-soft hover:text-error transition-colors"
                      aria-label="Supprimer cette ligne"
                    >
                      ✕
                    </button>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setBudget([...budget, { poste: "", montant: "" }])}
              className="text-terracotta-deep font-semibold text-sm flex items-center gap-1.5"
            >
              + Ajouter une ligne
            </button>
            <NavButtons onBack={back} onNext={next} />
          </StepCard>
        )}

        {stepIndex === 5 && (
          <StepCard
            eyebrow="Dernière étape"
            title="On relit ensemble, puis c'est parti"
            subtitle="Vérifiez que tout est correct. Vous pourrez toujours nous écrire pour ajuster un détail."
          >
            <div className="space-y-4">
              <SummaryBlock title="Association" rows={[
                ["Nom", form.nom],
                ["Adresse", `${form.adresse}, ${form.code_postal} ${form.ville}`],
                ["Contact", `${form.contact_nom} (${form.contact_role || "—"})`],
                ["Email", form.contact_email],
              ]} />
              <SummaryBlock title="Projet" rows={[
                ["Nature", form.type_demande === "renouvellement" ? "Renouvellement" : "Première demande"],
                ["Engagement", form.est_pluriannuel ? `Pluriannuel — ${form.pluriannuel_nb_annees} ans (${Array.from({ length: Number(form.pluriannuel_nb_annees) }, (_, i) => (Number(form.annee_millesime) || new Date().getFullYear()) + i).join(', ')})` : "Annuel"],
                ["Bailleur", `${form.bailleur_type === "ville" ? "Ville" : "Département"} — ${form.bailleur_nom}`],
                ["Titre", form.titre_projet],
                ["Description", form.objectif_projet],
                ["Bénéficiaires", `${form.nb_beneficiaires_estime || "—"} personnes — ${form.public_beneficiaire || "—"}`],
                ["Période", `${form.periode_debut || "—"} → ${form.periode_fin || "—"}`],
                ["Montant demandé", form.est_pluriannuel ? "À saisir par année" : (form.montant_demande ? `${form.montant_demande} €` : "—")],
              ]} />
              {form.type_demande === "renouvellement" && (
                <SummaryBlock title="Bilan année précédente" rows={[
                  ["Subvention reçue", form.bilan_subvention_anterieure ? `${form.bilan_subvention_anterieure} €` : "—"],
                  ["Bénéficiaires réels", form.bilan_nb_beneficiaires_reel || "—"],
                  ["Bilan des actions", form.bilan_activites || "—"],
                ]} />
              )}
            </div>
            {error && (
              <p className="text-error text-sm bg-error-soft rounded-xl p-3">{error}</p>
            )}
            <NavButtons
              onBack={back}
              onNext={submit}
              nextLabel="Envoyer mon dossier"
              loading={loading}
            />
          </StepCard>
        )}
      </div>
    </main>
  );
}

function SummaryBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="bg-cream-deep rounded-xl p-4">
      <p className="text-sm font-semibold text-sapin-deep mb-2">{title}</p>
      <dl className="space-y-2.5">
        {rows.map(([label, value]) => {
          const isLong = (value || "").length > 40;
          return (
            <div key={label} className={isLong ? "" : "flex justify-between gap-3"}>
              <dt className="text-sm text-ink-soft">{label}</dt>
              <dd
                className={[
                  "text-sm text-ink font-medium",
                  isLong ? "mt-1 leading-relaxed" : "text-right",
                ].join(" ")}
              >
                {value || "—"}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
