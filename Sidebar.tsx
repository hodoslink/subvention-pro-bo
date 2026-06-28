"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: "▦" },
  { href: "/suivi", label: "Suivi pipeline", icon: "🗂" },
  { href: "/demandes", label: "Toutes les demandes", icon: "📋" },
  { href: "/associations", label: "Associations", icon: "🏛" },
];

export function Sidebar() {
  const path = usePathname();
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
    </aside>
  );
}
