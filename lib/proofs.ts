import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A link to something the person made. Usually attached to a build task. */
export type Proof = {
  id: string;
  task_key: string | null;
  title: string;
  url: string;
  note: string;
  created_at: string;
};

const COLUMNS = "id, task_key, title, url, note, created_at";

/** Accepts any https URL without credentials. Adds https:// if it's missing. */
export function cleanProofUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > 300) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
    const out = url.toString();
    return out.length <= 300 ? out : null;
  } catch {
    return null;
  }
}

export function cleanText(input: unknown, max: number): string | null {
  if (input === undefined || input === null) return "";
  if (typeof input !== "string") return null;
  const s = input.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : null;
}

/** Proofs attached to tasks in this plan, keyed by task key. */
export async function proofsByTask(supabase: SupabaseClient, planId: string): Promise<Record<string, Proof>> {
  const { data, error } = await supabase.from("proofs").select(COLUMNS).eq("plan_id", planId).not("task_key", "is", null);
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as Proof[]).map((p) => [p.task_key!, p]));
}

/** All of the person's proofs, newest first. */
export async function listProofs(supabase: SupabaseClient): Promise<Proof[]> {
  const { data, error } = await supabase.from("proofs").select(COLUMNS).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as Proof[];
}

export const PROOF_COLUMNS = COLUMNS;
