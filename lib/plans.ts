import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Answers } from "./questions";
import type { Role } from "./roles";
import { getRole } from "./roles";
import { currentTemplate, loadTemplate } from "./templates";
import { assemblePlan, inputsFromAnswers, skippableKeys } from "./templates/personalize";
import { getPlan, getProfile, type Plan, type Profile } from "./data";

/**
 * Creates (or replaces) the user's plan from the shared template for their role and
 * level. No AI call: the template is already in memory, and the swap is one RPC.
 */
export async function createPlan(supabase: SupabaseClient, role: Role, answers: Answers, knownSkills: string[], today: string): Promise<string> {
  const { id, version } = currentTemplate(role.id, answers.level?.[0]);
  const tpl = await loadTemplate(id, version);
  const inputs = inputsFromAnswers(answers);
  const assembled = assemblePlan(`${tpl.id}@${tpl.version}`, tpl.body, tpl.role, inputs);
  const skip = skippableKeys(assembled, knownSkills.filter((s) => role.skills.includes(s)));
  const { data, error } = await supabase.rpc("replace_plan", {
    p_template_id: tpl.id,
    p_template_version: tpl.version,
    p_inputs: inputs,
    p_skip_keys: skip,
    p_today: today,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Loads the user's plan. People who onboarded before plans existed have a profile but
 * no plan: they get one built from their saved answers, and any milestone they had fully
 * finished in their old roadmap is carried over as done. This runs once per person.
 */
export async function getOrMigratePlan(supabase: SupabaseClient, profile: Profile | null): Promise<Plan | null> {
  const plan = await getPlan(supabase);
  if (plan || !profile) return plan;
  const role = getRole(profile.role_id);
  if (!role) return null;

  const legacy = await supabase.from("roadmaps").select("id").eq("is_active", true).limit(1).maybeSingle();
  if (legacy.error) throw legacy.error;

  const today = new Date().toISOString().slice(0, 10);
  const planId = await createPlan(supabase, role, profile.answers, [], today);
  const created = await getPlan(supabase);
  if (!created || created.id !== planId || !legacy.data) return created;

  const old = await supabase.from("tasks").select("phase_index, milestone_index, completed_on").eq("roadmap_id", legacy.data.id);
  if (old.error) throw old.error;
  const groups = new Map<string, { done: number; total: number; last: string }>();
  for (const t of (old.data ?? []) as { phase_index: number; milestone_index: number; completed_on: string | null }[]) {
    const k = `${t.phase_index}-${t.milestone_index}`;
    const g = groups.get(k) ?? { done: 0, total: 0, last: "" };
    g.total++;
    if (t.completed_on) {
      g.done++;
      if (t.completed_on > g.last) g.last = t.completed_on;
    }
    groups.set(k, g);
  }
  const rows = created.defs
    .filter((d) => d.key.startsWith("p"))
    .flatMap((d) => {
      const g = groups.get(`${d.phase_index}-${d.milestone_index}`);
      return g && g.total > 0 && g.done === g.total ? [{ plan_id: planId, task_key: d.key, completed_on: g.last }] : [];
    });
  if (rows.length) {
    const ins = await supabase.from("task_progress").upsert(rows, { onConflict: "plan_id,task_key", ignoreDuplicates: true });
    if (ins.error) throw ins.error;
  }
  return created;
}

/** Profile and plan for API routes. */
export async function loadProfileAndPlan(supabase: SupabaseClient) {
  const profile = await getProfile(supabase);
  const plan = await getOrMigratePlan(supabase, profile);
  return { profile, plan };
}
