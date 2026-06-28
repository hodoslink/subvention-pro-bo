import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SubventionPro — Backoffice',
  description: 'Outil de suivi et de rédaction des demandes de subvention',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
