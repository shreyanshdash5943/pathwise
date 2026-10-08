import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getPlan } from "@/lib/data";
import { editError, setOverride } from "@/lib/plan-edit-api";
import { handleRouteError, jsonError } from "@/lib/http";

const KEY = /^[a-z0-9.\-]{1,64}$/;

/** Moves a task one place up or down within its milestone (Pro). */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await ctx.params;
    if (!KEY.test(key)) return jsonError("That task doesn't exist.", 404);
    let body: { direction?: unknown };
    try {
      body = ((await req.json()) ?? {}) as { direction?: unknown };
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    if (body.direction !== "up" && body.direction !== "down") return jsonError("Send direction as up or down.", 400);

    const { supabase, userId } = await getSupabase();
    const plan = await getPlan(supabase);
    if (!plan) return jsonError("Finish onboarding to get your plan.", 404);
    const task = plan.defs.find((d) => d.key === key);
    if (!task) return jsonError("That task doesn't exist.", 404);

    const here = plan.defs.filter((d) => d.phase_index === task.phase_index && d.milestone_index === task.milestone_index);
    const i = here.findIndex((d) => d.key === key);
    const j = body.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= here.length) return NextResponse.json({ ok: true });

    // Renumber the milestone 10 apart with the two swapped, then save only what changed.
    const order = [...here];
    [order[i], order[j]] = [order[j], order[i]];
    for (const [n, t] of order.entries()) {
      const sort = n * 10;
      if (t.sort === sort) continue;
      if (t.custom) {
        const upd = await supabase.from("plan_custom_tasks").update({ sort }).eq("plan_id", plan.id).eq("task_key", t.key);
        if (upd.error) throw upd.error;
      } else {
        await setOverride(supabase, userId, plan.id, t.key, { sort });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return editError(err) ?? handleRouteError(err);
  }
}
