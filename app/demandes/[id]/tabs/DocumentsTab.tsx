'use client';
import { usePageCtx } from '../context';
import { SectionCard } from '../components';
import { DocumentList } from '@/components/DocumentList';

export function DocumentsTab() {
  const { demande, loadDemande } = usePageCtx();
  return (
    <>

      {/* Documents de la demande */}
      <SectionCard title="Documents de la demande">
        <p className="text-xs text-gray-400 mb-3">Dossiers N-1, devis, formulaires bailleur… Cliquez sur « 🤖 Analyser » pour auto-compléter les champs.</p>
        <DocumentList entityType="demande" entityId={demande.id} onApplied={loadDemande} />
      </SectionCard>

    </>
  );
}
