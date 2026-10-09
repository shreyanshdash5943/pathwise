import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Application, Answer } from "./prep-shared";

/** The application tracker and interview answer bank. Both are private per user. */

export { STATUSES } from "./prep-shared";
export type { Status, Application, Answer } from "./prep-shared";

const APP_COLUMNS = "id, company, role_title, url, location, status, notes, next_step, next_step_on, applied_on, created_at, updated_at";
const ANSWER_COLUMNS = "id, question_key, question_text, situation, task, action, result, proof_id, updated_at";

export async function listApplications(supabase: SupabaseClient): Promise<Application[]> {
  const { data, error } = await supabase.from("applications").select(APP_COLUMNS).order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as Application[];
}

export async function listAnswers(supabase: SupabaseClient): Promise<Answer[]> {
  const { data, error } = await supabase.from("interview_answers").select(ANSWER_COLUMNS);
  if (error) return [];
  return (data ?? []) as Answer[];
}

export const APP_FIELDS = APP_COLUMNS;

/** Validates an https job link, or "" to clear it. Adds https:// if missing. */
export function cleanJobUrl(input: unknown): string | null {
  if (input === undefined || input === null || input === "") return "";
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString().length <= 500 ? u.toString() : null;
  } catch {
    return null;
  }
}
