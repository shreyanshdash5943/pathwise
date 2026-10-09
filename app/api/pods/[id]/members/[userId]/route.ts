import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Owner removes a member from the pod. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await ctx.params;
    if (!UUID.test(id) || !userId) return jsonError("That pod doesn't exist.", 404);
    const { supabase } = await getSupabase();
    const { error } = await supabase.rpc("remove_pod_member", { p_pod_id: id, p_user_id: decodeURIComponent(userId) });
    if (error) {
      if (/not the pod owner/.test(error.message)) return jsonError("Only the pod's creator can remove people.", 403);
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
