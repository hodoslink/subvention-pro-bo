import type { Metadata } from "next";
import "./globals.css";

// NOTE: next/font/google nécessite un accès réseau à fonts.googleapis.com au
// moment du build. Sur Vercel ça fonctionne nativement. Si tu veux les vraies
// polices Fraunces + Inter, remplace ce bloc par :
//
// import { Fraunces, Inter } from "next/font/google";
// const fraunces = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["400","500","600","700"], style: ["normal","italic"] });
// const inter = Inter({ variable: "--font-body", subsets: ["latin"], weight: ["400","500","600","700"] });
// puis className={`${fraunces.variable} ${inter.variable} h-full antialiased`}

export const metadata: Metadata = {
  title: "Votre dossier, étape par étape — SubventionPro",
  description: "Un accompagnement simple pour préparer votre demande de subvention.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
