import type { Statut } from './supabase';

export const STATUTS: Record<Statut, {
  label: string;
  color: string;
  icon: string;
  next?: Statut;
  phase: 'instruction' | 'decision' | 'execution' | 'clos';
}> = {
  collecte:           { label: 'Collecte',              color: 'bg-slate-100 text-slate-700',   icon: '📂', next: 'redaction',          phase: 'instruction' },
  redaction:          { label: 'Rédaction',              color: 'bg-blue-100 text-blue-700',     icon: '✏️', next: 'controle_compta',    phase: 'instruction' },
  controle_compta:    { label: 'Contrôle comptable',     color: 'bg-yellow-100 text-yellow-800', icon: '🔢', next: 'depose',             phase: 'instruction' },
  depose:             { label: 'Déposé',                 color: 'bg-purple-100 text-purple-700', icon: '📬', next: 'decision_attente',   phase: 'instruction' },
  decision_attente:   { label: 'Décision en attente',    color: 'bg-orange-100 text-orange-700', icon: '⏳', next: undefined,            phase: 'decision' },
  accepte:            { label: 'Accepté',                color: 'bg-emerald-100 text-emerald-700', icon: '✅', next: 'convention_signee', phase: 'decision' },
  convention_signee:  { label: 'Convention signée',      color: 'bg-teal-100 text-teal-700',     icon: '📝', next: 'en_execution',       phase: 'execution' },
  en_execution:       { label: "En cours d'exécution",   color: 'bg-cyan-100 text-cyan-700',     icon: '▶️', next: 'bilan_final_soumis', phase: 'execution' },
  bilan_final_soumis: { label: 'Bilan final soumis',     color: 'bg-indigo-100 text-indigo-700', icon: '📤', next: 'clos',              phase: 'execution' },
  clos:               { label: 'Clôturé',                color: 'bg-gray-100 text-gray-600',     icon: '🔒', next: undefined,            phase: 'clos' },
  refuse:             { label: 'Refusé',                 color: 'bg-red-100 text-red-700',       icon: '❌', next: undefined,            phase: 'clos' },
};

export const STATUTS_INSTRUCTION: Statut[] = [
  'collecte', 'redaction', 'controle_compta', 'depose', 'decision_attente',
];

export const STATUTS_EXECUTION: Statut[] = [
  'convention_signee', 'en_execution', 'bilan_final_soumis',
];

export const STATUTS_CLOS: Statut[] = ['accepte', 'clos', 'refuse'];

export const STATUTS_ACTIFS: Statut[] = [...STATUTS_INSTRUCTION, ...STATUTS_EXECUTION];

export const ALL_STATUTS = Object.keys(STATUTS) as Statut[];

export const STATUTS_AVEC_BILAN: Statut[] = [
  'convention_signee', 'en_execution', 'bilan_final_soumis', 'clos',
];
