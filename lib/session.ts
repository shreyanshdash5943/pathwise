import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabase } from "./supabase";
import { loadProfileAndPlan } from "./plans";

/** Loads the signed-in user's profile and plan once per request. */
export const loadSession = cache(async () => {
  const { supabase, userId } = await getSupabase();
  const { profile, plan } = await loadProfileAndPlan(supabase);
  return { supabase, userId, profile, plan };
});

/**
 * Requires a profile (so the account is set up), but the plan may be null — a user can
 * track habits without ever building a career plan. Pages branch on `plan`.
 */
export const requireProfile = cache(async () => {
  const s = await loadSession();
  if (!s.profile) redirect("/onboarding");
  return { ...s, profile: s.profile };
});

/** Stricter: requires both a profile and a plan. Only for pages that are meaningless without one. */
export const requirePlan = cache(async () => {
  const s = await loadSession();
  if (!s.profile || !s.plan) redirect("/onboarding");
  return { ...s, profile: s.profile, plan: s.plan };
});
