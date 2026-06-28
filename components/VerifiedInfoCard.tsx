"use client";

type VerifyLink = {
  label: string;
  url: string;
};

export function VerifiedInfoCard({
  title,
  rows,
  links,
  note,
}: {
  title: string;
  rows: { label: string; value: string }[];
  links: VerifyLink[];
  note?: string;
}) {
  return (
    <div className="bg-sapin-soft rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-sapin-deep mt-0.5 shrink-0"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <p className="font-semibold text-sapin-deep text-sm">{title}</p>
      </div>

      <dl className="space-y-1 pl-1">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3 text-sm">
            <dt className="text-sapin-deep/70">{r.label}</dt>
            <dd className="text-sapin-deep font-medium text-right">{r.value || "—"}</dd>
          </div>
        ))}
      </dl>

      {note && <p className="text-xs text-sapin-deep/70 pl-1">{note}</p>}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sapin-deep bg-white px-3 py-1.5 rounded-full border border-sapin/20 hover:border-sapin/50 transition-colors"
            >
              {link.label}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
