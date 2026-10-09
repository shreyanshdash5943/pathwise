import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getPod } from "@/lib/pods";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Posts a short update to the pod. Returns the refreshed posts list. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That pod doesn't exist.", 404);
    let body: { body?: unknown };
    try {
      body = ((await req.json()) ?? {}) as { body?: unknown };
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) return jsonError("Write something first.", 400);
    if (text.length > 500) return jsonError("Keep it under 500 characters.", 400);

    const { supabase } = await getSupabase();
    const { error } = await supabase.rpc("post_to_pod", { p_pod_id: id, p_body: text });
    if (error) {
      if (/not a member/.test(error.message)) return jsonError("You're not in this pod.", 403);
      if (/too many posts/.test(error.message)) return jsonError("You've posted a lot today. Try again tomorrow.", 429);
      throw error;
    }
    const pod = await getPod(supabase, id);
    return NextResponse.json({ posts: pod?.posts ?? [] });
  } catch (err) {
    return handleRouteError(err);
  }
}
