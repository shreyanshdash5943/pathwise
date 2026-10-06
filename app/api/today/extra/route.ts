import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getActiveRoadmap, getProfile, getStats, profileToday, scheduleDay } from "@/lib/data";
import { handleRouteError, jsonError } from "@/lib/http";

export async function POST() {
  try {
    const { supabase } = await getSupabase();
    const [profile, roadmap] = await Promise.all([getProfile(supabase), getActiveRoadmap(supabase)]);
    if (!profile || !roadmap) return jsonError("Finish onboarding to get your plan.", 404);
    const today = profileToday(profile);
    const tasks = await scheduleDay(supabase, roadmap.id, today, profile.daily_minutes, 30);
    const stats = await getStats(supabase, roadmap.id, today);
    return NextResponse.json({ today, tasks, stats });
  } catch (err) {
    return handleRouteError(err);
  }
}
