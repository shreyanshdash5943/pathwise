import { currentUser } from "@clerk/nextjs/server";
import { requireProfile } from "@/lib/session";
import { computeStats, profileToday, scheduleDay } from "@/lib/data";
import { getNews } from "@/lib/news";
import { addDays, longDate } from "@/lib/dates";
import { Dashboard } from "@/components/dashboard";
import { HabitsDashboard } from "@/components/habits-dashboard";
import { proofsByTask } from "@/lib/proofs";
import { habitsOverview } from "@/lib/habits";
import { FREEZES_PER_MONTH, getEntitlement } from "@/lib/pro";
import type { SupabaseClient } from "@supabase/supabase-js";

/** For Pro: covers yesterday's gap with streak freezes if any are left, then lists frozen days. */
async function freezes(supabase: SupabaseClient, today: string, pro: boolean) {
  let justFrozen: string[] = [];
  if (pro) {
    const applied = await supabase.rpc("apply_streak_freezes", { p_today: today });
    if (!applied.error && Array.isArray(applied.data)) justFrozen = (applied.data as string[]).map((d) => String(d).slice(0, 10));
  }
  const { data, error } = await supabase.from("streak_freezes").select("day").gte("day", addDays(today, -400));
  const days = error ? [] : ((data ?? []) as { day: string }[]).map((r) => r.day);
  const usedThisMonth = days.filter((d) => d.slice(0, 7) === today.slice(0, 7)).length;
  return { frozen: days, justFrozen, left: pro ? Math.max(0, FREEZES_PER_MONTH - usedThisMonth) : null };
}

export const metadata = { title: "Today" };

/** Just the first word, capitalised: people often type their full name into the first-name field. */
function firstName(raw: string | null | undefined) {
  const word = raw?.trim().split(/\s+/)[0] ?? "";
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

function greeting(timeZone: string) {
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date()));
  } catch {}
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const { supabase, profile, plan } = await requireProfile();
  const today = profileToday(profile);
  const [ent, user] = await Promise.all([getEntitlement(supabase), currentUser()]);
  const greet = `${greeting(profile.timezone)}${firstName(user?.firstName) ? `, ${firstName(user?.firstName)}` : ""}`;

  // Habits-only: no plan yet. Show the habit-focused dashboard.
  if (!plan) {
    const [habitsOnly, freeze] = await Promise.all([
      habitsOverview(supabase, today).catch(() => ({ habits: [], doneByDay: {} as Record<string, number> })),
      freezes(supabase, today, ent.pro).catch(() => ({ frozen: [] as string[], justFrozen: [] as string[], left: null })),
    ]);
    return (
      <HabitsDashboard
        greeting={greet}
        dateLabel={longDate(today)}
        habits={habitsOnly.habits}
        today={today}
        activity={habitsOnly.doneByDay}
        frozen={freeze.frozen}
        justFrozen={freeze.justFrozen}
        freezesLeft={freeze.left}
      />
    );
  }

  const [day, news, proofs, habits, freeze] = await Promise.all([
    scheduleDay(supabase, plan, today, profile.daily_minutes),
    getNews("for-you", profile.field ?? "software").catch(() => []),
    proofsByTask(supabase, plan.id),
    habitsOverview(supabase, today).catch(() => ({ habits: [], doneByDay: {} as Record<string, number> })),
    freezes(supabase, today, ent.pro).catch(() => ({ frozen: [] as string[], justFrozen: [] as string[], left: null })),
  ]);

  // Activity per day: plan tasks finished (not skipped) plus habits done. Drives the
  // streak and the activity grid, so a LeetCode-only day still counts.
  const activity: Record<string, number> = { ...habits.doneByDay };
  for (const t of day.all) if (t.completed_on && !t.skipped) activity[t.completed_on] = (activity[t.completed_on] ?? 0) + 1;

  const phases = plan.outline.phases.map((p, i) => {
    const inPhase = day.all.filter((t) => t.phase_index === i);
    return { title: p.title, done: inPhase.filter((t) => t.completed_on).length, total: inPhase.length };
  });
  const upcoming = day.all
    .filter((t) => !t.scheduled_for && !t.completed_on)
    .slice(0, 8)
    .map((t) => ({ id: t.id, title: t.title, type: t.type, minutes: t.minutes }));
  const build = day.all.find((t) => t.type === "build" && !t.completed_on);
  const nextBuild = build
    ? {
        id: build.id,
        title: build.title,
        milestone: plan.outline.phases[build.phase_index]?.milestones[build.milestone_index]?.title ?? "",
        scheduledToday: build.scheduled_for === today,
      }
    : null;

  return (
    <Dashboard
      greeting={greet}
      dateLabel={longDate(today)}
      initialTasks={day.today}
      initialStats={computeStats(day.all, today)}
      outline={plan.outline}
      dailyMinutes={profile.daily_minutes}
      news={news.slice(0, 4)}
      proofs={proofs}
      habits={habits.habits}
      today={today}
      activity={activity}
      phases={phases}
      upcoming={upcoming}
      nextBuild={nextBuild}
      frozen={freeze.frozen}
      justFrozen={freeze.justFrozen}
      freezesLeft={freeze.left}
    />
  );
}
