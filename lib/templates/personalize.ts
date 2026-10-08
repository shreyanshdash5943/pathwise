import type { Answers } from "../questions.ts";
import type { Role } from "../roles.ts";
import type { RoadmapOutline, TaskType } from "../roadmap-schema.ts";
import { projectMilestone } from "./builtin.ts";
import type { TemplateBody } from "./schema.ts";

/**
 * Turns a shared template into one person's plan, using their onboarding answers.
 * Pure and deterministic: the same template, version and inputs always give the same
 * tasks with the same keys, so plans are rebuilt in memory on every request and only
 * progress is stored.
 *
 * Task keys:
 *   p{phase}.m{milestone}.t{task}  tasks from the template, by position
 *   x.<name>                       tasks added here
 * Changing what this file adds renames or removes x.* keys for existing plans. Only
 * ever add new rules; never rename a key.
 */

export type PlanInputs = { style: string[]; blockers: string[]; goal: string; setting: string };

export type PlanTask = {
  key: string;
  phase_index: number;
  milestone_index: number;
  title: string;
  description: string;
  type: TaskType;
  minutes: number;
  skill: string | null;
};

export type AssembledPlan = { outline: RoadmapOutline; tasks: PlanTask[] };

const STYLES = ["video", "reading", "projects", "courses"];
const BLOCKERS = ["direction", "consistency", "portfolio", "interviews", "time"];

export function inputsFromAnswers(answers: Answers): PlanInputs {
  return {
    style: (answers.style ?? []).filter((s) => STYLES.includes(s)).sort(),
    blockers: (answers.blockers ?? []).filter((b) => BLOCKERS.includes(b)).sort(),
    goal: answers.goal?.[0] ?? "",
    setting: answers.setting?.[0] ?? "",
  };
}

/** Reads inputs back from plans.inputs, tolerating anything malformed. */
export function parseInputs(raw: unknown): PlanInputs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const one = (v: unknown) => (typeof v === "string" ? [v] : []);
  return inputsFromAnswers({ style: list(r.style), blockers: list(r.blockers), goal: one(r.goal), setting: one(r.setting) });
}

type Draft = Omit<PlanTask, "phase_index" | "milestone_index">;
type DraftMilestone = { title: string; outcome: string; skill: string | null; tasks: Draft[] };

const GOAL_TASK: Record<string, Omit<Draft, "key" | "skill">> = {
  "first-job": { title: "Apply to five internships or junior roles", description: "Pick roles that match the projects you built. Tailor the first line of each application and track them in one place.", type: "connect", minutes: 45 },
  switch: { title: "Write your career-change story", description: "In five sentences: where you're coming from, why this role, and what you've built to prove it. Use it in applications and intros.", type: "reflect", minutes: 25 },
  grow: { title: "Ask your manager for a stretch assignment", description: "Show one project from this plan and ask for a piece of work that uses the same skills in your current job.", type: "connect", minutes: 20 },
  independent: { title: "Pitch your services to three potential clients", description: "Pick three people or businesses with a problem you can solve. Send each a short, specific offer that links to your best project.", type: "connect", minutes: 45 },
};

const SETTING_TASK: Record<string, Omit<Draft, "key" | "skill">> = {
  startup: { title: "Talk to someone at an early-stage startup", description: "Ask what a normal week looks like and what they look for when hiring. Note one thing to add to your portfolio.", type: "connect", minutes: 25 },
  enterprise: { title: "Study how a large tech company hires", description: "Read the published interview guide of one big company you'd like to join and list the skills it asks for.", type: "learn", minutes: 25 },
  remote: { title: "Join a remote-first community in your field", description: "Find one active online community and introduce yourself with a link to a project. Remote teams hire from these.", type: "connect", minutes: 20 },
  freelance: { title: "Set up a simple page listing your services", description: "One page: what you do, two projects as proof, and how to reach you. Keep it plain and fast.", type: "build", minutes: 45 },
};

function assembleUncached(body: TemplateBody, role: Role, inputs: PlanInputs): AssembledPlan {
  const phases = body.phases.map((p, pi) => ({
    title: p.title,
    summary: p.summary,
    milestones: p.milestones.map(
      (m, mi): DraftMilestone => ({
        title: m.title,
        outcome: m.outcome,
        skill: m.skill,
        tasks: m.tasks.map((t, ti) => ({
          key: `p${pi}.m${mi}.t${ti}`,
          title: t.title,
          description: t.description,
          type: t.type,
          minutes: t.minutes,
          skill: m.skill,
        })),
      })
    ),
  }));
  const lastMilestone = (pi: number) => phases[pi].milestones[phases[pi].milestones.length - 1];

  if (inputs.blockers.includes("portfolio") && role.projects[2]) {
    const extra = projectMilestone(role.projects[2]);
    phases[2].milestones.push({
      title: extra.title,
      outcome: extra.outcome,
      skill: null,
      tasks: extra.tasks.map((t, i) => ({ ...t, key: `x.portfolio.t${i}`, skill: null })),
    });
  }

  if (inputs.blockers.includes("consistency")) {
    phases.forEach((_, pi) =>
      lastMilestone(pi).tasks.push({
        key: `x.reflect.p${pi}`,
        title: "Look back on this stretch",
        description: "Write down what went well, what got in the way, and one thing you'll change for the next part of your plan.",
        type: "reflect",
        minutes: 10,
        skill: null,
      })
    );
  }

  const last = lastMilestone(3);
  const goal = GOAL_TASK[inputs.goal];
  if (goal) last.tasks.push({ ...goal, key: "x.goal", skill: null });
  const setting = SETTING_TASK[inputs.setting];
  if (setting) last.tasks.push({ ...setting, key: "x.setting", skill: null });
  if (inputs.blockers.includes("interviews")) {
    last.tasks.push(
      { key: "x.interviews.1", title: "Run a mock interview with yourself on video", description: "Answer three common questions out loud, then watch it back once and note one thing to improve.", type: "practice", minutes: 30, skill: null },
      { key: "x.interviews.2", title: "Do a mock interview with a friend", description: "Ask them to play the interviewer for 30 minutes. Ask for blunt feedback.", type: "practice", minutes: 40, skill: null }
    );
  }

  return {
    outline: {
      title: body.title,
      summary: body.summary,
      phases: phases.map((p) => ({ title: p.title, summary: p.summary, milestones: p.milestones.map((m) => ({ title: m.title, outcome: m.outcome })) })),
    },
    tasks: phases.flatMap((p, pi) => p.milestones.flatMap((m, mi) => m.tasks.map((t) => ({ ...t, phase_index: pi, milestone_index: mi })))),
  };
}

// Inputs have a few hundred combinations per template, so a small in-memory cache
// means each server instance assembles each plan shape once.
const cache = new Map<string, AssembledPlan>();
const CACHE_LIMIT = 2000;

export function assemblePlan(cacheKey: string, body: TemplateBody, role: Role, inputs: PlanInputs): AssembledPlan {
  const key = `${cacheKey}|${inputs.style.join(",")}|${inputs.blockers.join(",")}|${inputs.goal}|${inputs.setting}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const plan = assembleUncached(body, role, inputs);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, plan);
  return plan;
}

/** Keys of the learn and practice tasks someone who already knows these skills can skip. */
export function skippableKeys(plan: AssembledPlan, knownSkills: string[]): string[] {
  if (!knownSkills.length) return [];
  const known = new Set(knownSkills);
  return plan.tasks.filter((t) => t.skill && known.has(t.skill) && (t.type === "learn" || t.type === "practice")).map((t) => t.key);
}
