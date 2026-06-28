import type { Statut } from './supabase';

export const STATUTS: Record<Statut, { label: string; color: string; next?: Statut }> = {
  collecte:         { label: 'Collecte',          color: 'bg-slate-100 text-slate-700',    next: 'redaction' },
  redaction:        { label: 'Rédaction',          color: 'bg-blue-100 text-blue-700',      next: 'controle_compta' },
  controle_compta:  { label: 'Contrôle compta',    color: 'bg-yellow-100 text-yellow-800',  next: 'depose' },
  depose:           { label: 'Déposé',             color: 'bg-purple-100 text-purple-700',  next: 'decision_attente' },
  decision_attente: { label: 'Décision en attente',color: 'bg-orange-100 text-orange-700',  next: undefined },
  accepte:          { label: 'Accepté',            color: 'bg-green-100 text-green-700',    next: undefined },
  refuse:           { label: 'Refusé',             color: 'bg-red-100 text-red-700',        next: undefined },
};

export const STATUTS_ACTIFS: Statut[] = ['collecte', 'redaction', 'controle_compta', 'depose', 'decision_attente'];
export const STATUTS_CLOS: Statut[] = ['accepte', 'refuse'];

export const ALL_STATUTS = Object.keys(STATUTS) as Statut[];
