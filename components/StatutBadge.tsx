import { STATUTS } from "@/lib/statuts";
import type { Statut } from "@/lib/supabase";

export function StatutBadge({ statut }: { statut: Statut }) {
  const s = STATUTS[statut];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}
