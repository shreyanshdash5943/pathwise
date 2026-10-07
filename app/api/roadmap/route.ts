import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sanitizeAnswers } from "@/lib/questions";
import { getRole } from "@/lib/roles";
import { createPlan } from "@/lib/plans";
import { getDetails } from "@/lib/details";
import { isValidTimeZone, todayIn } from "@/lib/dates";
import { handleRouteError, jsonError } from "@/lib/http";

const COOLDOWN_MS = 5_000;

/**
 * Builds a plan from the shared template for the chosen role and level. There is no AI
 * call here: plans are assembled from pre-written templates in memory, so this is fast
 * and costs the same for one user or a million.
 */
export async function POST(req: Request) {
  try {
    const { supabase, userId } = await getSupabase();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const { answers: rawAnswers, roleId, timezone } = (body ?? {}) as Record<string, unknown>;

    const answers = sanitizeAnswers(rawAnswers);
    if (!answers) return jsonError("Some answers are missing. Go back and answer every question.", 400);
    const role = typeof roleId === "string" ? getRole(roleId) : undefined;
    if (!role || role.field !== answers.field[0]) return jsonError("Pick one of the suggested paths.", 400);
    const tz = isValidTimeZone(timezone) ? timezone : "UTC";
    const dailyMinutes = Number(answers.time[0]) || 60;

    // Cooldown: protects the database from repeat clicks and scripts.
    const latest = await supabase.from("plans").select("created_at").maybeSingle();
    if (latest.error) throw latest.error;
    if (latest.data && Date.now() - new Date(latest.data.created_at as string).getTime() < COOLDOWN_MS) {
      return jsonError("You just made a plan. Wait a few seconds before making another.", 429);
    }

    const details = await getDetails(supabase);
    const planId = await createPlan(supabase, role, answers, details?.known_skills ?? [], todayIn(tz));

    const profile = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        answers,
        role_id: role.id,
        role_title: role.title,
        field: role.field,
        daily_minutes: dailyMinutes,
        timezone: tz,
      },
      { onConflict: "user_id" }
    );
    if (profile.error) throw profile.error;

    // Old-style roadmaps are no longer read; clear them out (their tasks cascade).
    const legacy = await supabase.from("roadmaps").delete().not("id", "is", null);
    if (legacy.error) throw legacy.error;

    return NextResponse.json({ ok: true, planId });
  } catch (err) {
    return handleRouteError(err);
  }
}
