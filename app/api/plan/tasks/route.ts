import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getPlan } from "@/lib/data";
import { endOfMilestone, newCustomKey } from "@/lib/plan-edits";
import { editError, readTaskFields } from "@/lib/plan-edit-api";
import { handleRouteError, jsonError } from "@/lib/http";

/** Adds the person's own task at the end of a milestone (Pro). */
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const fields = readTaskFields(body, true);
    if (typeof fields === "string") return jsonError(fields, 400);
    const phase = Number(body.phaseIndex);
    const milestone = Number(body.milestoneIndex);

    const { supabase, userId } = await getSupabase();
    const plan = await getPlan(supabase);
    if (!plan) return jsonError("Finish onboarding to get your plan.", 404);
    if (!plan.outline.phases[phase]?.milestones[milestone]) return jsonError("Pick a milestone in your plan.", 400);

    const { error } = await supabase.from("plan_custom_tasks").insert({
      plan_id: plan.id,
      user_id: userId,
      task_key: newCustomKey(),
      phase_index: phase,
      milestone_index: milestone,
      sort: endOfMilestone(plan.defs, phase, milestone),
      title: fields.title,
      description: fields.description ?? "",
      type: fields.type,
      minutes: fields.minutes,
    });
    if (error) return editError(error) ?? handleRouteError(error);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return editError(err) ?? handleRouteError(err);
  }
}
