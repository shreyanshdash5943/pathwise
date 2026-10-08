import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TASK_TYPES, type TaskType } from "./roadmap-schema";
import { jsonError } from "./http";
import { isProRequired } from "./pro";

/** Shared validation and writes for the roadmap-editing routes. */

export type TaskFields = { title?: string; description?: string; type?: TaskType; minutes?: number };

export function readTaskFields(body: Record<string, unknown>, requireAll: boolean): TaskFields | string {
  const out: TaskFields = {};
  if (body.title !== undefined || requireAll) {
    const t = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim() : "";
    if (t.length < 3 || t.length > 160) return "Give the task a title between 3 and 160 characters.";
    out.title = t;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.trim().length > 500) return "Keep the description under 500 characters.";
    out.description = body.description.trim();
  }
  if (body.type !== undefined || requireAll) {
    if (!TASK_TYPES.includes(body.type as TaskType)) return "Pick a task type.";
    out.type = body.type as TaskType;
  }
  if (body.minutes !== undefined || requireAll) {
    const m = Number(body.minutes);
    if (!Number.isInteger(m) || m < 5 || m > 180) return "Minutes must be between 5 and 180.";
    out.minutes = m;
  }
  return out;
}

/** Sets an override (hide or sort) on a template task, creating the row the first time. */
export async function setOverride(supabase: SupabaseClient, userId: string, planId: string, key: string, patch: { hidden?: boolean; sort?: number }) {
  const upd = await supabase.from("plan_task_overrides").update(patch).eq("plan_id", planId).eq("task_key", key).select("task_key");
  if (upd.error) throw upd.error;
  if (upd.data?.length) return;
  const ins = await supabase.from("plan_task_overrides").insert({ plan_id: planId, user_id: userId, task_key: key, hidden: false, ...patch });
  if (ins.error?.code === "23505") {
    const again = await supabase.from("plan_task_overrides").update(patch).eq("plan_id", planId).eq("task_key", key);
    if (again.error) throw again.error;
  } else if (ins.error) throw ins.error;
}

/** Turns the database's Pro check into a friendly 403. */
export function editError(err: unknown) {
  if (isProRequired(err)) return jsonError("Editing your roadmap is part of Pro.", 403);
  if (/custom task limit/.test((err as { message?: string } | null)?.message ?? "")) return jsonError("You can add up to 100 of your own tasks.", 400);
  return null;
}
