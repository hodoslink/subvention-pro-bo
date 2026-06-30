"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/supabase";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: "▦" },
  { href: "/suivi", label: "Suivi pipeline", icon: "🗂" },
  { href: "/demandes", label: "Toutes les demandes", icon: "📋" },
  { href: "/associations", label: "Associations", icon: "🏛" },
  { href: "/bailleurs", label: "Bailleurs", icon: "🏦" },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Pick<Profile, 'nom_complet' | 'role'> | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then(({ profile }) => setProfile(profile))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      <div className="px-5 py-4 border-b border-gray-100">
        <span className="font-bold text-blue-700 text-sm tracking-wide">SubventionPro</span>
        <span className="ml-1 text-xs text-gray-400 font-normal">backoffice</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              ].join(" ")}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {profile && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
              {profile.nom_complet.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{profile.nom_complet}</p>
              <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </aside>
  );
}
