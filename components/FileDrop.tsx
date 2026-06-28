"use client";

import { useRef, useState } from "react";

export function FileDrop({
  label,
  hint,
  onFile,
  optional = false,
}: {
  label: string;
  hint?: string;
  onFile: (file: File | null) => void;
  optional?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File | null) => {
    setFileName(file ? file.name : null);
    onFile(file);
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-ink mb-1.5">
        {label} {optional && <span className="text-ink-soft font-normal">(si vous l&apos;avez sous la main)</span>}
      </label>
      {hint && <p className="text-sm text-ink-soft mb-2">{hint}</p>}
      <div
        className={[
          "rounded-xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer",
          dragOver ? "border-sapin bg-sapin-soft" : "border-border-soft bg-cream-deep",
          fileName ? "border-sapin bg-sapin-soft" : "",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0] || null;
          handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
        />
        {fileName ? (
          <p className="text-sapin-deep font-medium flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" />
            </svg>
            {fileName}
          </p>
        ) : (
          <p className="text-ink-soft text-sm">
            Glissez le fichier ici, ou{" "}
            <span className="text-terracotta-deep font-semibold">cliquez pour choisir</span>
          </p>
        )}
      </div>
    </div>
  );
}
