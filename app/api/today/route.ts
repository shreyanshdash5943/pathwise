import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { computeStats, profileToday, scheduleDay } from "@/lib/data";
import { loadProfileAndPlan } from "@/lib/plans";
import { handleRouteError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase } = await getSupabase();
    const { profile, plan } = await loadProfileAndPlan(supabase);
    if (!profile || !plan) return jsonError("Finish onboarding to get your plan.", 404);
    const today = profileToday(profile);
    const day = await scheduleDay(supabase, plan, today, profile.daily_minutes);
    return NextResponse.json({ today, tasks: day.today, stats: computeStats(day.all, today) });
  } catch (err) {
    return handleRouteError(err);
  }
}
