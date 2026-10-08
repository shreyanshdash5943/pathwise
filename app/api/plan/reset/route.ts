import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getPlan } from "@/lib/data";
import { handleRouteError, jsonError } from "@/lib/http";

/**
 * Undoes roadmap edits. With { only: "removed" } brings back removed tasks; otherwise
 * restores the original plan (your added tasks are deleted). Progress on template tasks
 * is kept. Allowed even after Pro ends, so nobody is stuck with edits.
 */
export async function POST(req: Request) {
  try {
    let body: { only?: unknown } = {};
    try {
      body = ((await req.json()) ?? {}) as { only?: unknown };
    } catch {}
    const { supabase } = await getSupabase();
    const plan = await getPlan(supabase);
    if (!plan) return jsonError("Finish onboarding to get your plan.", 404);

    if (body.only === "removed") {
      const del = await supabase.from("plan_task_overrides").delete().eq("plan_id", plan.id).eq("hidden", true);
      if (del.error) throw del.error;
    } else {
      const custom = plan.defs.filter((d) => d.custom).map((d) => d.key);
      const [a, b] = await Promise.all([
        supabase.from("plan_task_overrides").delete().eq("plan_id", plan.id),
        supabase.from("plan_custom_tasks").delete().eq("plan_id", plan.id),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      if (custom.length) {
        const prog = await supabase.from("task_progress").delete().eq("plan_id", plan.id).in("task_key", custom);
        if (prog.error) throw prog.error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
