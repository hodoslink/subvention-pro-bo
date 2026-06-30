import { genererLignesAuto } from "./budgetAuto";
import type { DetailsJson } from "./supabase";
import type { getSupabaseServer } from "./supabase";

type SupabaseClient = ReturnType<typeof getSupabaseServer>;

export async function syncBudgetAutoLignes(
  supabase: SupabaseClient,
  demandeId: string,
  details: DetailsJson,
  context: { montant_demande: number | null; bailleur_nom: string | null }
): Promise<{ warnings: string[] }> {
  const lignesAuto = genererLignesAuto(details, context);

  const { data: existingLines } = await supabase
    .from("budget_lignes")
    .select("id, cle_generation")
    .eq("demande_id", demandeId)
    .not("cle_generation", "is", null);

  const existingByCle = new Map(
    (existingLines ?? []).map(l => [l.cle_generation as string, l.id as string])
  );
  const clesCourantes = new Set(lignesAuto.map(l => l.cle_generation));
  const warnings: string[] = [];

  // Delete auto lines that are no longer generated
  const idsToDelete = (existingLines ?? [])
    .filter(l => !clesCourantes.has(l.cle_generation as string))
    .map(l => l.id as string);
  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase.from("budget_lignes").delete().in("id", idsToDelete);
    if (delErr) {
      console.error("[budget-sync] delete error:", delErr.message);
      warnings.push(`delete: ${delErr.message}`);
    }
  }

  // Insert or update each generated line
  for (const l of lignesAuto) {
    const existingId = existingByCle.get(l.cle_generation);
    const row = {
      demande_id: demandeId,
      sens: l.sens,
      compte: l.compte,
      sous_categorie: l.sous_categorie,
      bailleur_detail: l.bailleur_detail ?? null,
      quantite: l.quantite ?? null,
      prix_unitaire: l.prix_unitaire ?? null,
      montant: l.montant,
      precisions: l.precisions,
      est_valorisation_benevolat: l.est_valorisation_benevolat,
      est_charge_commune: false,
      cle_generation: l.cle_generation,
      statut_financement: l.statut_financement ?? null,
    };
    if (existingId) {
      const { error: updErr } = await supabase.from("budget_lignes").update(row).eq("id", existingId);
      if (updErr) {
        console.error(`[budget-sync] update error (${l.cle_generation}):`, updErr.message);
        warnings.push(`update ${l.cle_generation}: ${updErr.message}`);
      }
    } else {
      const { error: insErr } = await supabase.from("budget_lignes").insert(row);
      if (insErr) {
        console.error(`[budget-sync] insert error (${l.cle_generation}):`, insErr.message);
        warnings.push(`insert ${l.cle_generation}: ${insErr.message}`);
      }
    }
  }

  return { warnings };
}
