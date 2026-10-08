import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getPlan } from "@/lib/data";
import { editError, readTaskFields, setOverride } from "@/lib/plan-edit-api";
import { handleRouteError, jsonError } from "@/lib/http";

const KEY = /^[a-z0-9.\-]{1,64}$/;

/** Edits one of the person's own tasks (Pro). Template tasks can't be rewritten, only moved or removed. */
export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await ctx.params;
    if (!KEY.test(key) || !key.startsWith("c.")) return jsonError("Only tasks you added can be edited.", 400);
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const fields = readTaskFields(body, false);
    if (typeof fields === "string") return jsonError(fields, 400);
    if (!Object.keys(fields).length) return jsonError("Nothing to change.", 400);

    const { supabase } = await getSupabase();
    const plan = await getPlan(supabase);
    if (!plan) return jsonError("Finish onboarding to get your plan.", 404);
    const { data, error } = await supabase.from("plan_custom_tasks").update(fields).eq("plan_id", plan.id).eq("task_key", key).select("task_key");
    if (error) return editError(error) ?? handleRouteError(error);
    if (!data?.length) return jsonError("That task doesn't exist.", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return editError(err) ?? handleRouteError(err);
  }
}

/** Removes a task: deletes one you added, or hides a template task (Pro). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await ctx.params;
    if (!KEY.test(key)) return jsonError("That task doesn't exist.", 404);
    const { supabase, userId } = await getSupabase();
    const plan = await getPlan(supabase);
    if (!plan) return jsonError("Finish onboarding to get your plan.", 404);
    if (!plan.defs.some((d) => d.key === key)) return jsonError("That task doesn't exist.", 404);

    if (key.startsWith("c.")) {
      const del = await supabase.from("plan_custom_tasks").delete().eq("plan_id", plan.id).eq("task_key", key);
      if (del.error) throw del.error;
      const prog = await supabase.from("task_progress").delete().eq("plan_id", plan.id).eq("task_key", key);
      if (prog.error) throw prog.error;
    } else {
      // Hidden, not deleted: hidden tasks drop out of totals, and restoring brings back any progress.
      await setOverride(supabase, userId, plan.id, key, { hidden: true });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return editError(err) ?? handleRouteError(err);
  }
}
