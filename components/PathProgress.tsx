"use client";

type Step = {
  label: string;
};

export function PathProgress({
  steps,
  currentIndex,
}: {
  steps: Step[];
  currentIndex: number;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1 mb-3">
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <div
                className={[
                  "flex items-center justify-center rounded-full shrink-0 transition-all duration-300",
                  active
                    ? "w-9 h-9 bg-terracotta text-white shadow-md scale-105"
                    : done
                    ? "w-7 h-7 bg-sapin text-white"
                    : "w-7 h-7 bg-white border-2 border-border-soft text-ink-soft",
                ].join(" ")}
                aria-current={active ? "step" : undefined}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="text-xs font-semibold">{i + 1}</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={[
                    "h-[2px] flex-1 mx-1 rounded transition-all duration-300",
                    done ? "bg-sapin" : "bg-border-soft",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-ink-soft font-medium">
        Étape {currentIndex + 1} sur {steps.length} — {steps[currentIndex]?.label}
      </p>
    </div>
  );
}
