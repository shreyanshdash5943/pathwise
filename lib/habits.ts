import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";

/** Something the person does every day on top of their plan, like "LeetCode daily". */
export type Habit = { id: string; title: string; position: number; archived: boolean };

/** One day of a habit, with an optional note: what they worked on, a link, approach, code. */
export type HabitLog = { habit_id: string; day: string; done: boolean; title: string; url: string; notes: string; code: string };

export type HabitToday = Habit & { today: HabitLog | null; streak: number };

export const HABIT_LIMITS = { title: 80, logTitle: 200, url: 500, notes: 5000, code: 20000 };

const LOG_COLUMNS = "habit_id, day, done, title, url, notes, code";

export async function listHabits(supabase: SupabaseClient, includeArchived = false): Promise<Habit[]> {
  let q = supabase.from("habits").select("id, title, position, archived").order("position").order("created_at");
  if (!includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Habit[];
}

/**
 * Active habits with today's log and streak, plus how many habits were done on each
 * day of the past ~13 months (for the activity grid). Three small queries.
 */
export async function habitsOverview(supabase: SupabaseClient, today: string): Promise<{ habits: HabitToday[]; doneByDay: Record<string, number> }> {
  const habits = await listHabits(supabase);
  if (!habits.length) {
    // Archived habits still count towards past activity.
    const past = await supabase.from("habit_logs").select("day").eq("done", true).gte("day", addDays(today, -400)).lte("day", today);
    return { habits: [], doneByDay: countByDay((past.data ?? []) as { day: string }[]) };
  }
  // Streaks need only dates; full notes are loaded for today alone.
  const [days, todays] = await Promise.all([
    supabase.from("habit_logs").select("habit_id, day, done").eq("done", true).gte("day", addDays(today, -400)).lte("day", today),
    supabase.from("habit_logs").select(LOG_COLUMNS).eq("day", today),
  ]);
  if (days.error) throw days.error;
  if (todays.error) throw todays.error;
  const done = (days.data ?? []) as Pick<HabitLog, "habit_id" | "day" | "done">[];
  const logs = (todays.data ?? []) as HabitLog[];
  return {
    habits: habits.map((h) => ({
      ...h,
      today: logs.find((l) => l.habit_id === h.id) ?? null,
      streak: streakOf(done.filter((l) => l.habit_id === h.id), today),
    })),
    doneByDay: countByDay(done),
  };
}

function countByDay(rows: { day: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.day] = (out[r.day] ?? 0) + 1;
  return out;
}

/** Consecutive done days ending today, or yesterday if today isn't done yet. */
export function streakOf(logs: Pick<HabitLog, "day" | "done">[], today: string): number {
  const done = new Set(logs.filter((l) => l.done).map((l) => l.day));
  let cursor = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Past entries for one habit, newest first. */
export async function habitHistory(supabase: SupabaseClient, habitId: string, before: string | null, limit = 30): Promise<HabitLog[]> {
  let q = supabase.from("habit_logs").select(LOG_COLUMNS).eq("habit_id", habitId).order("day", { ascending: false }).limit(limit);
  if (before) q = q.lt("day", before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HabitLog[];
}

/** Saves one day's log, creating it the first time. */
export async function saveLog(supabase: SupabaseClient, userId: string, habitId: string, day: string, patch: Partial<Omit<HabitLog, "habit_id" | "day">>): Promise<HabitLog> {
  const upd = await supabase.from("habit_logs").update(patch).eq("habit_id", habitId).eq("day", day).select(LOG_COLUMNS);
  if (upd.error) throw upd.error;
  if (upd.data?.length) return upd.data[0] as HabitLog;
  const ins = await supabase.from("habit_logs").insert({ habit_id: habitId, user_id: userId, day, ...patch }).select(LOG_COLUMNS).single();
  if (ins.error?.code === "23505") {
    // A parallel request created it first.
    const again = await supabase.from("habit_logs").update(patch).eq("habit_id", habitId).eq("day", day).select(LOG_COLUMNS).single();
    if (again.error) throw again.error;
    return again.data as HabitLog;
  }
  if (ins.error) throw ins.error;
  return ins.data as HabitLog;
}
