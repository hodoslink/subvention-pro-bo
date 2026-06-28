import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <div className="inline-flex items-center gap-2 bg-sapin-soft text-sapin-deep text-sm font-semibold px-4 py-2 rounded-full mb-8">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
          </svg>
          Votre dossier de subvention
        </div>

        <h1 className="font-display text-4xl md:text-5xl text-sapin-deep mb-5 leading-tight">
          On s&apos;occupe du dossier.
          <br />
          Vous, racontez-nous votre projet.
        </h1>

        <p className="text-lg text-ink-soft mb-10 leading-relaxed">
          Pas de jargon administratif, pas de formulaire interminable.
          Quelques questions simples, à votre rythme — on transforme vos
          réponses en dossier solide pour la mairie ou le département.
        </p>

        <div className="animate-fade-in bg-white rounded-2xl border border-border-soft shadow-[0_4px_16px_-4px_rgba(31,36,33,0.08)] p-6 mb-10 text-left">
          <p className="text-sm font-semibold text-ink mb-4">Comment ça se passe :</p>
          <ol className="space-y-3">
            {[
              ["1", "Quelques infos sur votre association (2 min, on vous aide à les retrouver)"],
              ["2", "Votre projet, racontez-le comme vous le feriez à un proche"],
              ["3", "On rédige et on dépose le dossier pour vous"],
            ].map(([n, text]) => (
              <li key={n} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-terracotta-soft text-terracotta-deep text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {n}
                </span>
                <span className="text-ink-soft">{text}</span>
              </li>
            ))}
          </ol>
        </div>

        <Link
          href="/nouvelle-demande"
          className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-deep text-white font-semibold text-lg px-8 py-4 rounded-full shadow-[0_2px_8px_-2px_rgba(143,85,48,0.4)] hover:shadow-[0_8px_20px_-6px_rgba(143,85,48,0.45)] transition-all duration-200 hover:-translate-y-0.5"
        >
          Commencer
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>

        <p className="text-sm text-ink-soft mt-6">
          Vous pouvez vous arrêter et reprendre plus tard, rien n&apos;est perdu.
        </p>

        <div className="flex items-center justify-center gap-5 mt-10 pt-6 border-t border-border-soft">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-sapin">
              <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Données protégées (RGPD)
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-sapin">
              <circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" />
            </svg>
            Aucun frais caché
          </span>
        </div>
      </div>
    </main>
  );
}
