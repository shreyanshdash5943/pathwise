import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** What the profile page stores. Name, email and photo come from Clerk, not here. */
export type Details = {
  headline: string;
  links: Links;
  skills: string[];
  known_skills: string[];
  resume_name: string | null;
  resume_size: number | null;
  resume_hash: string | null;
  resume_skills: string[];
  resume_ai_hash: string | null;
  resume_uploaded_at: string | null;
  username: string | null;
  is_public: boolean;
  display_name: string | null;
  avatar_url: string | null;
};

export const LINK_KINDS = ["github", "linkedin", "portfolio"] as const;
export type Links = Partial<Record<(typeof LINK_KINDS)[number], string>>;

export const RESUME_BUCKET = "resumes";
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const resumePath = (userId: string) => `${userId}/resume.pdf`;

const COLUMNS = "headline, links, skills, known_skills, resume_name, resume_size, resume_hash, resume_skills, resume_ai_hash, resume_uploaded_at, username, is_public, display_name, avatar_url";

export async function getDetails(supabase: SupabaseClient): Promise<Details | null> {
  const { data, error } = await supabase.from("user_details").select(COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...(data as Details), links: cleanLinks((data as Details).links) ?? {} };
}

export async function saveDetails(supabase: SupabaseClient, userId: string, patch: Partial<Details>) {
  const { error } = await supabase.from("user_details").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Accepts only https URLs on sensible hosts. Returns null if anything is invalid. */
export function cleanLinks(input: unknown): Links | null {
  if (!input || typeof input !== "object") return null;
  const out: Links = {};
  for (const kind of LINK_KINDS) {
    const raw = (input as Record<string, unknown>)[kind];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw !== "string" || raw.length > 300) return null;
    let url: URL;
    try {
      url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (kind === "github" && host !== "github.com" && host !== "www.github.com") return null;
    if (kind === "linkedin" && !(host === "linkedin.com" || host.endsWith(".linkedin.com"))) return null;
    if (!host.includes(".")) return null;
    out[kind] = url.toString();
  }
  return out;
}

/** Free-text skills: trimmed, de-duplicated, at most 30 of up to 40 characters each. */
export function cleanSkills(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") return null;
    const s = raw.replace(/\s+/g, " ").trim();
    if (!s) continue;
    if (s.length > 40) return null;
    if (seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out.length <= 30 ? out : null;
}
