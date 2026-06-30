import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion — Subvention Pro',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
