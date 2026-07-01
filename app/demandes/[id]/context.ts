import { createContext, useContext } from 'react';
import type React from 'react';
import type { FullDemande, FullDraft, PrestataireDraft, AchatDraft, AutreBailleurDraft } from './types';
import type { BudgetLigneDB, BudgetEquilibre, TauxFinancement, Bailleur } from '@/lib/supabase';
import type { LigneAutoGeneree } from '@/lib/budgetAuto';

export type PageCtxValue = {
  editMode: boolean;
  savingDraft: boolean;
  startEdit: () => void;
  saveAll: () => void;
  cancelEdit: () => void;
  savedDraft: boolean;
  saveError: string | null;
  draft: FullDraft;
  setField: <K extends keyof FullDraft>(key: K, val: FullDraft[K]) => void;
  setPrestataire: (i: number, patch: Partial<PrestataireDraft>) => void;
  removePrestataire: (i: number) => void;
  addPrestataire: () => void;
  setAchat: (i: number, patch: Partial<AchatDraft>) => void;
  removeAchat: (i: number) => void;
  addAchat: () => void;
  setAutreBailleur: (i: number, patch: Partial<AutreBailleurDraft>) => void;
  removeAutreBailleur: (i: number) => void;
  addAutreBailleur: () => void;
  demande: FullDemande;
  budgetLignes: BudgetLigneDB[];
  budgetEquilibre: BudgetEquilibre | null;
  budgetTaux: TauxFinancement[];
  bailleurs: Bailleur[];
  lignesAutoPreview: LigneAutoGeneree[];
  loadBudgetLignes: () => void;
  loadDemande: () => void;
  activerPatternEtScroller: (cle: string, sectionCible: string) => void;
  reprendreValeursPrecedentes: () => Promise<void>;
  reprenantN1: boolean;
  thematiqueSuggestions: string[];
  suggestions: Array<{
    demande_candidate_id: string;
    titre_projet: string;
    annee_millesime: number | null;
    montant_demande: number | null;
    montant_obtenu: number | null;
    statut: string;
  }>;
  savingCeQuiChange: boolean;
  lienFormulaire: {
    ouvert_le: string | null;
    rempli_le: string | null;
    dernier_envoi: { email: string; envoye_le: string } | null;
    historique: Array<{ email: string; envoye_le: string }>;
  } | null;
  lienEmail: string;
  setLienEmail: (v: string) => void;
  lienUrl: string | null;
  setLienUrl: (v: string | null) => void;
  lienGenerating: boolean;
  setLienGenerating: (v: boolean) => void;
  loadLienFormulaire: () => void;
  chargesCardRef: React.RefObject<HTMLDivElement | null>;
  prestataireCardRef: React.RefObject<HTMLDivElement | null>;
};

export const PageEditCtx = createContext<PageCtxValue | null>(null);

export function usePageCtx(): PageCtxValue {
  const ctx = useContext(PageEditCtx);
  if (!ctx) throw new Error('usePageCtx must be used inside FicheDemande');
  return ctx;
}
