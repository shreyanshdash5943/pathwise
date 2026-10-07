import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { handleRouteError, jsonError } from "@/lib/http";

const ALLOWED_MINUTES = [30, 60, 90, 120, 180];

export async function PATCH(req: Request) {
  try {
    let body: { daily_minutes?: unknown };
    try {
      body = (await req.json()) ?? {};
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const minutes = Number(body.daily_minutes);
    if (!ALLOWED_MINUTES.includes(minutes)) return jsonError("Choose one of the listed daily times.", 400);
    const { supabase } = await getSupabase();
    const { error } = await supabase.from("profiles").update({ daily_minutes: minutes }).not("user_id", "is", null);
    if (error) throw error;
    return NextResponse.json({ ok: true, daily_minutes: minutes });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Starts over: removes the plan, its progress and the onboarding answers.
 * Profile details and the resume are kept; they have their own delete controls.
 */
export async function DELETE() {
  try {
    const { supabase } = await getSupabase();
    const plan = await supabase.from("plans").delete().not("id", "is", null);
    if (plan.error) throw plan.error;
    const r = await supabase.from("roadmaps").delete().not("id", "is", null);
    if (r.error) throw r.error;
    const p = await supabase.from("profiles").delete().not("user_id", "is", null);
    if (p.error) throw p.error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
