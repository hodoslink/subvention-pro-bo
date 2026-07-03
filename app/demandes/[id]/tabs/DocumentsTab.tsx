'use client';
import { usePageCtx } from '../context';
import { SectionCard } from '../components';
import { DocumentList } from '@/components/DocumentList';

export function DocumentsTab() {
  const { demande, loadDemande, loadBudgetLignes } = usePageCtx();

  // Après application des champs importés, recharger la demande ET les
  // lignes budget pour que le mode lecture reflète tout immédiatement.
  const handleApplied = () => {
    loadDemande();
    loadBudgetLignes();
  };

  return (
    <>

      {/* Documents de la demande */}
      <SectionCard title="Documents de la demande">
        <p className="text-xs text-gray-400 mb-3">Dossiers N-1, devis, formulaires bailleur… Cliquez sur « 📥 Importer un JSON » pour pré-remplir les champs depuis une extraction.</p>
        <DocumentList entityType="demande" entityId={demande.id} onApplied={handleApplied} />
      </SectionCard>

    </>
  );
}
