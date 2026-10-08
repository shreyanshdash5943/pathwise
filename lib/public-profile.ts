import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnonSupabase } from "./supabase";
import { loadTemplate } from "./templates";
import { assemblePlan, parseInputs } from "./templates/personalize";

/**
 * Public profiles at /u/<username>. Visitors aren't signed in, so the page reads through
 * get_public_profile() with the anon key, which only returns safe fields for profiles
 * their owner made public. Results are cached for 5 minutes and refreshed straight away
 * when the owner changes something, so a popular profile costs one query per 5 minutes.
 */

export type PublicProof = { id: string; title: string; url: string; note: string; created_at: string };

export type PublicProfile = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string;
  links: { github?: string; linkedin?: string; portfolio?: string };
  skills: string[];
  knownSkills: string[];
  roleTitle: string | null;
  progress: {
    done: number;
    total: number;
    startedAt: string;
    phases: { title: string; done: number; total: number }[];
  } | null;
  proofs: PublicProof[];
};

const RESERVED = new Set([
  "admin", "api", "app", "about", "account", "dashboard", "help", "login", "logout", "me", "news", "onboarding",
  "pathwise", "privacy", "profile", "roadmap", "root", "settings", "signin", "sign-in", "signup", "sign-up",
  "support", "system", "team", "terms", "u", "user", "users", "www",
]);

/** Lowercase letters, digits, - and _, 3 to 30 characters, starting with a letter or digit. */
export function cleanUsername(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "Choose a username." };
  const u = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(u)) return { ok: false, error: "Usernames are 3 to 30 characters: letters, numbers, - and _." };
  if (RESERVED.has(u)) return { ok: false, error: "That username is reserved. Try another." };
  return { ok: true, value: u };
}

const tagFor = (username: string) => `public-profile:${username.toLowerCase()}`;

export function revalidatePublicProfile(username: string | null | undefined) {
  if (username) revalidateTag(tagFor(username));
}

/** Looks up the caller's username and refreshes their public page. */
export async function revalidateOwnProfile(supabase: SupabaseClient) {
  const { data } = await supabase.from("user_details").select("username").maybeSingle();
  revalidatePublicProfile((data as { username: string | null } | null)?.username);
}

type Row = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  links: Record<string, unknown> | null;
  skills: string[] | null;
  known_skills: string[] | null;
  role_title: string | null;
  plan: { template_id: string; template_version: number; inputs: unknown; created_at: string; done: string[] } | null;
  proofs: PublicProof[] | null;
};

async function fetchProfile(username: string): Promise<PublicProfile | null> {
  const supabase = getAnonSupabase();

  const { data, error } = await supabase.rpc("get_public_profile", { p_username: username });
  if (error) throw error;
  if (!data) return null;
  const r = data as Row;

  let progress: PublicProfile["progress"] = null;
  if (r.plan) {
    try {
      const tpl = await loadTemplate(r.plan.template_id, r.plan.template_version);
      const plan = assemblePlan(`${tpl.id}@${tpl.version}`, tpl.body, tpl.role, parseInputs(r.plan.inputs));
      const done = new Set(r.plan.done ?? []);
      progress = {
        done: plan.tasks.filter((t) => done.has(t.key)).length,
        total: plan.tasks.length,
        startedAt: r.plan.created_at,
        phases: plan.outline.phases.map((p, pi) => {
          const tasks = plan.tasks.filter((t) => t.phase_index === pi);
          return { title: p.title, done: tasks.filter((t) => done.has(t.key)).length, total: tasks.length };
        }),
      };
    } catch (err) {
      console.error("[public-profile] couldn't build progress:", err instanceof Error ? err.message : err);
    }
  }

  const links = r.links ?? {};
  const str = (v: unknown) => (typeof v === "string" && v.startsWith("https://") ? v : undefined);
  return {
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    headline: r.headline ?? "",
    links: { github: str(links.github), linkedin: str(links.linkedin), portfolio: str(links.portfolio) },
    skills: r.skills ?? [],
    knownSkills: r.known_skills ?? [],
    roleTitle: r.role_title,
    progress,
    proofs: (r.proofs ?? []).filter((p) => typeof p.url === "string" && p.url.startsWith("https://")),
  };
}

export function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const u = username.toLowerCase();
  return unstable_cache(() => fetchProfile(u), ["public-profile", u], { revalidate: 300, tags: [tagFor(u)] })();
}
