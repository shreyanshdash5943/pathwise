import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabase } from "./supabase";
import { getActiveRoadmap, getProfile } from "./data";

/** Loads the signed-in user's profile and active roadmap once per request. */
export const loadSession = cache(async () => {
  const { supabase, userId } = await getSupabase();
  const [profile, roadmap] = await Promise.all([getProfile(supabase), getActiveRoadmap(supabase)]);
  return { supabase, userId, profile, roadmap };
});

/** Same as loadSession, but sends people without a plan to onboarding. */
export const requirePlan = cache(async () => {
  const s = await loadSession();
  if (!s.profile || !s.roadmap) redirect("/onboarding");
  return { ...s, profile: s.profile, roadmap: s.roadmap };
});
