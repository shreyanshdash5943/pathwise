import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { computeStats, profileToday, setCompleted } from "@/lib/data";
import { loadProfileAndPlan } from "@/lib/plans";
import { handleRouteError, jsonError } from "@/lib/http";

const TASK_KEY = /^[a-z0-9.\-]{1,64}$/;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!TASK_KEY.test(id)) return jsonError("That task doesn't exist.", 404);
    let body: { completed?: unknown };
    try {
      body = (await req.json()) ?? {};
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    if (typeof body.completed !== "boolean") return jsonError("Send completed as true or false.", 400);

    const { supabase } = await getSupabase();
    const { profile, plan } = await loadProfileAndPlan(supabase);
    if (!profile || !plan) return jsonError("Finish onboarding to get your plan.", 404);
    const today = profileToday(profile);

    const all = await setCompleted(supabase, plan, id, body.completed, today);
    if (!all) return jsonError("That task doesn't exist.", 404);
    const task = all.find((t) => t.id === id)!;
    return NextResponse.json({ task: { id, completed_on: task.completed_on, skipped: task.skipped }, stats: computeStats(all, today) });
  } catch (err) {
    return handleRouteError(err);
  }
}
