import { currentUser } from "@clerk/nextjs/server";
import { requirePlan } from "@/lib/session";
import { getStats, profileToday, scheduleDay } from "@/lib/data";
import { getNews } from "@/lib/news";
import { longDate } from "@/lib/dates";
import { Dashboard } from "@/components/dashboard";

export const metadata = { title: "Today" };

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
  const { supabase, profile, roadmap } = await requirePlan();
  const today = profileToday(profile);
  const [tasks, user, news] = await Promise.all([
    scheduleDay(supabase, roadmap.id, today, profile.daily_minutes),
    currentUser(),
    getNews("for-you", profile.field).catch(() => []),
  ]);
  const stats = await getStats(supabase, roadmap.id, today);

  return (
    <Dashboard
      greeting={`${greeting(profile.timezone)}${user?.firstName ? `, ${user.firstName}` : ""}`}
      dateLabel={longDate(today)}
      initialTasks={tasks}
      initialStats={stats}
      outline={roadmap.outline}
      dailyMinutes={profile.daily_minutes}
      news={news.slice(0, 4)}
    />
  );
}
