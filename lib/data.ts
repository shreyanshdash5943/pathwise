import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Answers } from "./questions";
import type { RoadmapOutline, TaskType } from "./roadmap-schema";
import { addDays, todayIn } from "./dates";

export type Profile = {
  user_id: string;
  answers: Answers;
  role_id: string;
  role_title: string;
  field: string;
  daily_minutes: number;
  timezone: string;
  created_at: string;
};

export type Roadmap = {
  id: string;
  title: string;
  summary: string;
  outline: RoadmapOutline;
  source: "ai" | "template";
  created_at: string;
};

export type Task = {
  id: string;
  seq: number;
  phase_index: number;
  milestone_index: number;
  title: string;
  description: string;
  type: TaskType;
  minutes: number;
  scheduled_for: string | null;
  completed_on: string | null;
};

export type Stats = {
  streak: number;
  week: { date: string; count: number }[];
  completed: number;
  total: number;
  current: { phaseIndex: number; milestoneIndex: number } | null;
  milestoneDone: number;
  milestoneTotal: number;
};

const TASK_COLUMNS =
  "id, seq, phase_index, milestone_index, title, description, type, minutes, scheduled_for, completed_on";

export async function getProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getActiveRoadmap(supabase: SupabaseClient): Promise<Roadmap | null> {
  const { data, error } = await supabase
    .from("roadmaps")
    .select("id, title, summary, outline, source, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Roadmap | null;
}

/**
 * Builds today's checklist. Unfinished tasks from earlier days roll forward, then the
 * list is topped up with the next tasks in the roadmap until it fills the daily budget.
 * Every step is idempotent, so concurrent requests settle on the same result.
 */
export async function scheduleDay(
  supabase: SupabaseClient,
  roadmapId: string,
  today: string,
  budget: number,
  extraMinutes = 0
): Promise<Task[]> {
  const carry = await supabase
    .from("tasks")
    .update({ scheduled_for: today })
    .eq("roadmap_id", roadmapId)
    .is("completed_on", null)
    .lt("scheduled_for", today);
  if (carry.error) throw carry.error;

  const current = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("roadmap_id", roadmapId)
    .eq("scheduled_for", today)
    .order("seq");
  if (current.error) throw current.error;
  const todays = (current.data ?? []) as Task[];

  const used = todays.reduce((sum, t) => sum + t.minutes, 0);
  const target = extraMinutes > 0 ? used + extraMinutes : budget;
  if (used >= target) return todays;

  const next = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("roadmap_id", roadmapId)
    .is("scheduled_for", null)
    .is("completed_on", null)
    .order("seq")
    .limit(20);
  if (next.error) throw next.error;

  const picked: Task[] = [];
  let total = used;
  for (const t of (next.data ?? []) as Task[]) {
    const mustAddOne = picked.length === 0 && (extraMinutes > 0 || todays.length === 0);
    if (total + t.minutes > target && !mustAddOne) break;
    picked.push(t);
    total += t.minutes;
  }
  if (picked.length === 0) return todays;

  const upd = await supabase
    .from("tasks")
    .update({ scheduled_for: today })
    .in("id", picked.map((t) => t.id))
    .is("scheduled_for", null);
  if (upd.error) throw upd.error;

  return [...todays, ...picked.map((t) => ({ ...t, scheduled_for: today }))].sort((a, b) => a.seq - b.seq);
}

export async function getStats(supabase: SupabaseClient, roadmapId: string, today: string): Promise<Stats> {
  const { data, error } = await supabase
    .from("tasks")
    .select("seq, phase_index, milestone_index, completed_on")
    .eq("roadmap_id", roadmapId)
    .order("seq");
  if (error) throw error;
  const rows = (data ?? []) as Pick<Task, "seq" | "phase_index" | "milestone_index" | "completed_on">[];

  const days = new Map<string, number>();
  for (const r of rows) if (r.completed_on) days.set(r.completed_on, (days.get(r.completed_on) ?? 0) + 1);

  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, count: days.get(date) ?? 0 };
  });

  const firstOpen = rows.find((r) => !r.completed_on);
  const current = firstOpen ? { phaseIndex: firstOpen.phase_index, milestoneIndex: firstOpen.milestone_index } : null;
  const inMilestone = current
    ? rows.filter((r) => r.phase_index === current.phaseIndex && r.milestone_index === current.milestoneIndex)
    : [];

  return {
    streak,
    week,
    completed: rows.filter((r) => r.completed_on).length,
    total: rows.length,
    current,
    milestoneDone: inMilestone.filter((r) => r.completed_on).length,
    milestoneTotal: inMilestone.length,
  };
}

export async function getAllTasks(supabase: SupabaseClient, roadmapId: string): Promise<Task[]> {
  const { data, error } = await supabase.from("tasks").select(TASK_COLUMNS).eq("roadmap_id", roadmapId).order("seq");
  if (error) throw error;
  return (data ?? []) as Task[];
}

export function profileToday(profile: Pick<Profile, "timezone">): string {
  return todayIn(profile.timezone);
}
