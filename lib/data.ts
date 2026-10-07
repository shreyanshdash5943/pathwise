import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Answers } from "./questions";
import type { RoadmapOutline, TaskType } from "./roadmap-schema";
import type { Role } from "./roles";
import { addDays, todayIn } from "./dates";
import { loadTemplate } from "./templates";
import { assemblePlan, parseInputs, type PlanInputs, type PlanTask } from "./templates/personalize";

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

/** A user's plan: the stored row plus the task list rebuilt from its template. */
export type Plan = {
  id: string;
  templateId: string;
  templateVersion: number;
  inputs: PlanInputs;
  createdAt: string;
  role: Role;
  outline: RoadmapOutline;
  defs: PlanTask[];
};

/** A task as the UI sees it. id is the task key, which is stable within a plan. */
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
  skipped: boolean;
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

type ProgressRow = { task_key: string; scheduled_for: string | null; completed_on: string | null; skipped: boolean };
type StatePatch = Partial<Omit<ProgressRow, "task_key">>;

export async function getProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/** Loads the plan row and rebuilds its tasks from the template. Costs one small query. */
export async function getPlan(supabase: SupabaseClient): Promise<Plan | null> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, template_id, template_version, inputs, created_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const tpl = await loadTemplate(data.template_id as string, data.template_version as number);
  const inputs = parseInputs(data.inputs);
  const assembled = assemblePlan(`${tpl.id}@${tpl.version}`, tpl.body, tpl.role, inputs);
  return {
    id: data.id as string,
    templateId: tpl.id,
    templateVersion: tpl.version,
    inputs,
    createdAt: data.created_at as string,
    role: tpl.role,
    outline: assembled.outline,
    defs: assembled.tasks,
  };
}

/** Every task in the plan with its saved progress. One query for the progress rows. */
export async function getTasks(supabase: SupabaseClient, plan: Plan): Promise<Task[]> {
  const { data, error } = await supabase
    .from("task_progress")
    .select("task_key, scheduled_for, completed_on, skipped")
    .eq("plan_id", plan.id);
  if (error) throw error;
  const rows = new Map(((data ?? []) as ProgressRow[]).map((r) => [r.task_key, r]));
  return plan.defs.map((d, seq) => {
    const r = rows.get(d.key);
    return {
      id: d.key,
      seq,
      phase_index: d.phase_index,
      milestone_index: d.milestone_index,
      title: d.title,
      description: d.description,
      type: d.type,
      minutes: d.minutes,
      scheduled_for: r?.scheduled_for ?? null,
      completed_on: r?.completed_on ?? null,
      skipped: r?.skipped ?? false,
    };
  });
}

/**
 * Applies the same state to some tasks. Progress rows only exist for tasks someone has
 * touched, so missing rows are created first (ignoring any a parallel request just made),
 * then every row is updated. Both steps are idempotent.
 */
async function writeState(supabase: SupabaseClient, planId: string, keys: string[], patch: StatePatch, existing: Set<string>) {
  if (keys.length === 0) return;
  const missing = keys.filter((k) => !existing.has(k));
  if (missing.length) {
    const ins = await supabase
      .from("task_progress")
      .upsert(missing.map((task_key) => ({ plan_id: planId, task_key })), { onConflict: "plan_id,task_key", ignoreDuplicates: true });
    if (ins.error) throw ins.error;
  }
  const upd = await supabase.from("task_progress").update(patch).eq("plan_id", planId).in("task_key", keys);
  if (upd.error) throw upd.error;
}

const hasRow = (t: Task) => t.scheduled_for !== null || t.completed_on !== null || t.skipped;

/**
 * Builds today's checklist. Unfinished tasks from earlier days roll forward, then the
 * list is topped up with the next tasks in the plan until it fills the daily budget.
 * Every step is idempotent, so concurrent requests settle on the same result.
 * Returns today's tasks and the full, updated task list (for stats).
 */
export async function scheduleDay(
  supabase: SupabaseClient,
  plan: Plan,
  today: string,
  budget: number,
  extraMinutes = 0
): Promise<{ today: Task[]; all: Task[] }> {
  const all = await getTasks(supabase, plan);

  if (all.some((t) => !t.completed_on && t.scheduled_for && t.scheduled_for < today)) {
    const carry = await supabase
      .from("task_progress")
      .update({ scheduled_for: today })
      .eq("plan_id", plan.id)
      .is("completed_on", null)
      .lt("scheduled_for", today);
    if (carry.error) throw carry.error;
    for (const t of all) if (!t.completed_on && t.scheduled_for && t.scheduled_for < today) t.scheduled_for = today;
  }

  const todays = all.filter((t) => t.scheduled_for === today);
  const used = todays.reduce((sum, t) => sum + t.minutes, 0);
  const target = extraMinutes > 0 ? used + extraMinutes : budget;
  if (used >= target) return { today: todays, all };

  const picked: Task[] = [];
  let total = used;
  for (const t of all) {
    if (t.scheduled_for || t.completed_on) continue;
    const mustAddOne = picked.length === 0 && (extraMinutes > 0 || todays.length === 0);
    if (total + t.minutes > target && !mustAddOne) break;
    picked.push(t);
    total += t.minutes;
  }
  if (picked.length === 0) return { today: todays, all };

  await writeState(supabase, plan.id, picked.map((t) => t.id), { scheduled_for: today }, new Set(all.filter(hasRow).map((t) => t.id)));
  for (const t of picked) t.scheduled_for = today;
  return { today: all.filter((t) => t.scheduled_for === today), all };
}

/** Marks one task done or not done. Returns null if the key isn't in the plan. */
export async function setCompleted(supabase: SupabaseClient, plan: Plan, key: string, completed: boolean, today: string): Promise<Task[] | null> {
  const all = await getTasks(supabase, plan);
  const task = all.find((t) => t.id === key);
  if (!task) return null;
  const patch = { completed_on: completed ? today : null, skipped: false };
  await writeState(supabase, plan.id, [key], patch, new Set(all.filter(hasRow).map((t) => t.id)));
  Object.assign(task, patch);
  return all;
}

/**
 * Marks the learn and practice tasks for skills the person already has as skipped, and
 * brings back skipped tasks for skills they unticked. Tasks they finished themselves
 * are left alone. Returns how many tasks are now skipped.
 */
export async function applyKnownSkills(supabase: SupabaseClient, plan: Plan, skipKeys: string[], today: string): Promise<number> {
  const all = await getTasks(supabase, plan);
  const want = new Set(skipKeys);
  const existing = new Set(all.filter(hasRow).map((t) => t.id));
  const toSkip = all.filter((t) => want.has(t.id) && !t.completed_on).map((t) => t.id);
  const toRestore = all.filter((t) => t.skipped && !want.has(t.id)).map((t) => t.id);
  await writeState(supabase, plan.id, toSkip, { completed_on: today, skipped: true }, existing);
  await writeState(supabase, plan.id, toRestore, { completed_on: null, skipped: false }, existing);
  return all.filter((t) => (t.skipped && want.has(t.id)) || toSkip.includes(t.id)).length;
}

/** Progress numbers for the dashboard. Skipped tasks count towards progress but not the streak. */
export function computeStats(tasks: Task[], today: string): Stats {
  const days = new Map<string, number>();
  for (const t of tasks) if (t.completed_on && !t.skipped) days.set(t.completed_on, (days.get(t.completed_on) ?? 0) + 1);

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

  const firstOpen = tasks.find((t) => !t.completed_on);
  const current = firstOpen ? { phaseIndex: firstOpen.phase_index, milestoneIndex: firstOpen.milestone_index } : null;
  const inMilestone = current
    ? tasks.filter((t) => t.phase_index === current.phaseIndex && t.milestone_index === current.milestoneIndex)
    : [];

  return {
    streak,
    week,
    completed: tasks.filter((t) => t.completed_on).length,
    total: tasks.length,
    current,
    milestoneDone: inMilestone.filter((t) => t.completed_on).length,
    milestoneTotal: inMilestone.length,
  };
}

export function profileToday(profile: Pick<Profile, "timezone">): string {
  return todayIn(profile.timezone);
}
