"use client";

import { useState, useEffect, useRef } from "react";

type Dirigeant = {
  nom: string;
  prenoms: string;
  qualite: string;
};

type Suggestion = {
  nom: string;
  siren: string;
  siret: string;
  rna: string | null;
  adresse: string;
  code_postal: string;
  ville: string;
  forme_juridique: string;
  date_creation: string | null;
  est_association: boolean | null;
  dirigeants: Dirigeant[];
};

export function SiretSearch({
  onSelect,
}: {
  onSelect: (s: Suggestion) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/siret?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-ink mb-2">
        Le nom de votre association
      </label>
      <p className="text-sm text-ink-soft mb-3">
        Commencez à taper, on retrouve les informations officielles pour vous —
        plus besoin de ressortir vos papiers.
      </p>
      <input
        type="text"
        className="field-input"
        placeholder="Ex. Association Sportive du Vallon"
        value={query}
        maxLength={120}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && (
        <p className="text-sm text-ink-soft mt-2 flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-sapin border-t-transparent rounded-full animate-spin" />
          Recherche en cours…
        </p>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-border-soft rounded-2xl shadow-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.siret || r.siren}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-cream-deep transition-colors border-b border-border-soft last:border-0"
              onClick={() => {
                onSelect(r);
                setQuery(r.nom);
                setOpen(false);
              }}
            >
              <p className="font-semibold text-ink">{r.nom}</p>
              <p className="text-sm text-ink-soft">
                {r.adresse}, {r.code_postal} {r.ville}
              </p>
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && query.trim().length >= 3 && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-border-soft rounded-2xl shadow-lg p-4">
          <p className="text-sm text-ink-soft">
            Pas trouvé ? Pas de souci, vous pourrez remplir les informations
            manuellement à l'étape suivante.
          </p>
        </div>
      )}
    </div>
  );
}
