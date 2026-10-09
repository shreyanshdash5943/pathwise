import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Toggles a cheer for a teammate today. Returns whether it's now on. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That pod doesn't exist.", 404);
    let body: { to?: unknown };
    try {
      body = ((await req.json()) ?? {}) as { to?: unknown };
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    if (typeof body.to !== "string" || !body.to) return jsonError("Who are you cheering?", 400);

    const { supabase } = await getSupabase();
    const { data, error } = await supabase.rpc("cheer_pod_member", { p_pod_id: id, p_to_user: body.to });
    if (error) {
      if (/not a member/.test(error.message)) return jsonError("You're not in this pod.", 403);
      if (/bad target/.test(error.message)) return jsonError("You can't cheer that person.", 400);
      throw error;
    }
    return NextResponse.json({ cheered: data === true });
  } catch (err) {
    return handleRouteError(err);
  }
}
