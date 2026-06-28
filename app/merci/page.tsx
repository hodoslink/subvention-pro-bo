export default function Merci() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-sapin-soft rounded-full flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="text-sapin-deep">
            <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-sapin-deep mb-4">
          C&apos;est tout pour vous, merci !
        </h1>
        <p className="text-ink-soft leading-relaxed mb-8">
          On a bien reçu toutes les informations. On revient vers vous très
          vite si une précision manque — sinon, on prend la main pour rédiger
          et déposer le dossier.
        </p>
        <div className="bg-white rounded-2xl border border-border-soft p-6 text-left">
          <p className="text-sm font-semibold text-ink mb-3">Et maintenant ?</p>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>📝 On rédige le dossier complet sous quelques jours</li>
            <li>📨 On vous l&apos;envoie pour relecture avant dépôt</li>
            <li>📬 On dépose et on suit la réponse pour vous</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
