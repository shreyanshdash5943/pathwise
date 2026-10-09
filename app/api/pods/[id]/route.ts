import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Leave a pod (any member) or delete it (owner), chosen by { action }. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That pod doesn't exist.", 404);
    let body: { action?: unknown };
    try {
      body = ((await req.json()) ?? {}) as { action?: unknown };
    } catch {
      body = {};
    }
    const { supabase } = await getSupabase();
    const fn = body.action === "delete" ? "delete_pod" : "leave_pod";
    const { error } = await supabase.rpc(fn, { p_pod_id: id });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
