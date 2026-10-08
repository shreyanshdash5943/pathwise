import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReminderPrefs = { daily_enabled: boolean; daily_hour: number; weekly_enabled: boolean };
export const DEFAULT_PREFS: ReminderPrefs = { daily_enabled: true, daily_hour: 18, weekly_enabled: true };

export async function getReminderPrefs(supabase: SupabaseClient): Promise<ReminderPrefs | null> {
  const { data, error } = await supabase.from("reminder_prefs").select("daily_enabled, daily_hour, weekly_enabled").maybeSingle();
  if (error) throw error;
  return data as ReminderPrefs | null;
}

/** Updates the caller's choices, creating the row the first time. The schedule is recalculated by a trigger. */
export async function saveReminderPrefs(supabase: SupabaseClient, userId: string, patch: Partial<ReminderPrefs & { last_test_at: string }>) {
  const upd = await supabase.from("reminder_prefs").update(patch).eq("user_id", userId).select("user_id");
  if (upd.error) throw upd.error;
  if (upd.data && upd.data.length > 0) return;
  const ins = await supabase.from("reminder_prefs").insert({ user_id: userId, ...DEFAULT_PREFS, ...patch });
  // 23505: a parallel request created it first; apply the change to that row.
  if (ins.error?.code === "23505") {
    const again = await supabase.from("reminder_prefs").update(patch).eq("user_id", userId);
    if (again.error) throw again.error;
  } else if (ins.error) {
    throw ins.error;
  }
}
