import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Formulaire de renseignements',
  description: 'Formulaire de collecte d\'informations pour votre dossier de subvention.',
};

export default function FormulaireLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
