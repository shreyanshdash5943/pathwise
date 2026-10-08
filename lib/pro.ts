import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pro status. The database enforces every Pro-only write itself (triggers call
 * is_pro()), so this is only for showing the right UI and friendlier errors.
 */
export type Entitlement = { pro: boolean; until: string | null };

export async function getEntitlement(supabase: SupabaseClient): Promise<Entitlement> {
  const { data, error } = await supabase.from("entitlements").select("pro_until").maybeSingle();
  // Before migration 007 the table doesn't exist; treat everyone as free.
  if (error || !data) return { pro: false, until: null };
  const until = data.pro_until as string;
  return { pro: new Date(until).getTime() > Date.now(), until };
}

/** True for the database's "pro required" errors. */
export function isProRequired(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === "42501" && /pro required/.test(e.message ?? "");
}

export const PRO_PRICE = { monthly: "₹149", yearly: "₹999" };
export const FREEZES_PER_MONTH = 3;
