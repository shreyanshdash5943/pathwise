import type { RoadmapOutline, TaskType } from "./roadmap-schema";
import type { PlanTask } from "./templates/personalize";

/**
 * A person's own changes on top of the shared template (Pro): tasks they added, tasks
 * they removed, and a new order within a milestone. The template itself is never
 * changed, so removing an edit always gets back the original plan.
 */

export type CustomTask = {
  task_key: string;
  phase_index: number;
  milestone_index: number;
  sort: number;
  title: string;
  description: string;
  type: TaskType;
  minutes: number;
};
export type Override = { task_key: string; hidden: boolean; sort: number | null };

export type EditedTask = PlanTask & { sort: number; custom: boolean };

/** Template tasks are spaced 10 apart, so a task can be slotted between two others. */
const STEP = 10;

export function applyEdits(outline: RoadmapOutline, defs: PlanTask[], custom: CustomTask[], overrides: Override[]): { tasks: EditedTask[]; hidden: number } {
  const over = new Map(overrides.map((o) => [o.task_key, o]));
  const position = new Map<string, number>();
  const base: EditedTask[] = [];
  for (const d of defs) {
    const k = `${d.phase_index}-${d.milestone_index}`;
    const i = position.get(k) ?? 0;
    position.set(k, i + 1);
    const o = over.get(d.key);
    if (o?.hidden) continue;
    base.push({ ...d, sort: o?.sort != null ? Number(o.sort) : i * STEP, custom: false });
  }
  const valid = (c: CustomTask) => !!outline.phases[c.phase_index]?.milestones[c.milestone_index];
  const added: EditedTask[] = custom.filter(valid).map((c) => ({
    key: c.task_key,
    phase_index: c.phase_index,
    milestone_index: c.milestone_index,
    title: c.title,
    description: c.description,
    type: c.type,
    minutes: c.minutes,
    skill: null,
    sort: Number(c.sort),
    custom: true,
  }));

  // Phases and milestones keep their order; tasks are ordered by sort inside each one.
  const tasks = [...base, ...added].sort(
    (a, b) => a.phase_index - b.phase_index || a.milestone_index - b.milestone_index || a.sort - b.sort || a.key.localeCompare(b.key)
  );
  const hidden = overrides.filter((o) => o.hidden && defs.some((d) => d.key === o.task_key)).length;
  return { tasks, hidden };
}

/** The sort value that puts a new task at the end of a milestone. */
export function endOfMilestone(tasks: EditedTask[], phase: number, milestone: number): number {
  const here = tasks.filter((t) => t.phase_index === phase && t.milestone_index === milestone);
  return here.length ? Math.max(...here.map((t) => t.sort)) + STEP : 0;
}

export function newCustomKey(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `c.${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}
