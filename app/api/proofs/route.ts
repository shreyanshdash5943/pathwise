import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getPlan } from "@/lib/data";
import { cleanProofUrl, cleanText, PROOF_COLUMNS, type Proof } from "@/lib/proofs";
import { revalidateOwnProfile } from "@/lib/public-profile";
import { handleRouteError, jsonError } from "@/lib/http";

const TASK_KEY = /^[a-z0-9.\-]{1,64}$/;

/**
 * Adds proof of work. With taskKey, it's attached to that task in the current plan
 * (one per task; sending again replaces the link). Without, it's a standalone project
 * and needs a title.
 */
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const url = cleanProofUrl(body.url);
    if (!url) return jsonError("Add a full https link, like github.com/you/project.", 400);
    const note = cleanText(body.note, 280);
    if (note === null) return jsonError("Keep the note under 280 characters.", 400);

    const { supabase, userId } = await getSupabase();
    let row: { plan_id: string | null; task_key: string | null; title: string };

    if (body.taskKey !== undefined) {
      if (typeof body.taskKey !== "string" || !TASK_KEY.test(body.taskKey)) return jsonError("That task doesn't exist.", 404);
      const plan = await getPlan(supabase);
      const def = plan?.defs.find((d) => d.key === body.taskKey);
      if (!plan || !def) return jsonError("That task doesn't exist.", 404);
      row = { plan_id: plan.id, task_key: def.key, title: def.title };
    } else {
      const title = cleanText(body.title, 160);
      if (!title) return jsonError("Give your project a title under 160 characters.", 400);
      row = { plan_id: null, task_key: null, title };
    }

    let saved: Proof;
    const existing = row.task_key
      ? await supabase.from("proofs").select("id").eq("plan_id", row.plan_id!).eq("task_key", row.task_key).maybeSingle()
      : { data: null, error: null };
    if (existing.error) throw existing.error;
    if (existing.data) {
      const upd = await supabase.from("proofs").update({ url, note }).eq("id", existing.data.id).select(PROOF_COLUMNS).single();
      if (upd.error) throw upd.error;
      saved = upd.data as Proof;
    } else {
      const ins = await supabase.from("proofs").insert({ user_id: userId, ...row, url, note }).select(PROOF_COLUMNS).single();
      if (ins.error) {
        if (ins.error.code === "P0001" || /proof limit/.test(ins.error.message)) return jsonError("You can keep up to 100 proofs. Remove an old one first.", 400);
        throw ins.error;
      }
      saved = ins.data as Proof;
    }

    await revalidateOwnProfile(supabase);
    return NextResponse.json({ proof: saved });
  } catch (err) {
    return handleRouteError(err);
  }
}
