import { requireProfile } from "@/lib/session";
import { profileToday } from "@/lib/data";
import { habitHistory, listHabits, streakOf } from "@/lib/habits";
import { addDays } from "@/lib/dates";
import { HabitsView } from "@/components/habits-view";

export const metadata = { title: "Habits" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ h?: string; before?: string }> }) {
  const { h, before } = await searchParams;
  const { supabase, profile } = await requireProfile();
  const today = profileToday(profile);
  const habits = await listHabits(supabase, true).catch(() => []);
  const selected = habits.find((x) => x.id === h && UUID.test(h ?? "")) ?? habits.find((x) => !x.archived) ?? habits[0] ?? null;

  let entries: Awaited<ReturnType<typeof habitHistory>> = [];
  let streak = 0;
  let total = 0;
  if (selected) {
    const [page, done] = await Promise.all([
      habitHistory(supabase, selected.id, before && DATE.test(before) ? before : null, 30),
      supabase.from("habit_logs").select("day, done").eq("habit_id", selected.id).eq("done", true).gt("day", addDays(today, -365)),
    ]);
    entries = page;
    streak = streakOf((done.data ?? []) as { day: string; done: boolean }[], today);
    total = done.data?.length ?? 0;
  }

  return <HabitsView key={`${selected?.id}-${before ?? ""}`} habits={habits} selectedId={selected?.id ?? null} entries={entries} streak={streak} doneDays={total} today={today} paged={!!before} />;
}
