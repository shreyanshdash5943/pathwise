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

/** Same as loadSession, but sends people without a plan to onboarding. */
export const requirePlan = cache(async () => {
  const s = await loadSession();
  if (!s.profile || !s.plan) redirect("/onboarding");
  return { ...s, profile: s.profile, plan: s.plan };
});
