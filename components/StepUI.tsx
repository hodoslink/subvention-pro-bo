"use client";

export function StepCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in bg-white rounded-2xl border border-border-soft shadow-[0_4px_16px_-4px_rgba(31,36,33,0.08)] p-7 md:p-10">
      {eyebrow && (
        <p className="text-sm font-semibold text-terracotta-deep mb-2 tracking-wide">{eyebrow}</p>
      )}
      <h2 className="font-display text-2xl md:text-3xl text-sapin-deep mb-2 leading-snug">
        {title}
      </h2>
      {subtitle && <p className="text-ink-soft mb-7 leading-relaxed">{subtitle}</p>}
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
      {hint && <p className="text-sm text-ink-soft mb-2">{hint}</p>}
      {children}
    </div>
  );
}

export function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continuer",
  nextDisabled = false,
  showBack = true,
  loading = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          className="text-ink-soft font-medium hover:text-ink transition-colors px-2 py-2"
        >
          ← Retour
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || loading}
        className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-deep disabled:bg-border-soft disabled:text-ink-soft disabled:cursor-not-allowed text-white font-semibold px-7 py-3.5 rounded-full shadow-[0_2px_8px_-2px_rgba(143,85,48,0.4)] hover:shadow-[0_6px_16px_-4px_rgba(143,85,48,0.45)] transition-all duration-200 hover:-translate-y-px"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Enregistrement…
          </>
        ) : (
          <>
            {nextLabel}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
