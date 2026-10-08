import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getReminderPrefs, saveReminderPrefs } from "@/lib/reminders";
import { handleRouteError, jsonError } from "@/lib/http";

type Body = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

async function readBody(req: Request): Promise<Body | null> {
  try {
    return ((await req.json()) ?? {}) as Body;
  } catch {
    return null;
  }
}

/** Saves this browser's push subscription (the object from PushManager.subscribe). */
export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    if (!body) return jsonError("The request body wasn't valid JSON.", 400);
    const { endpoint, keys } = body;
    if (typeof endpoint !== "string" || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
      return jsonError("That isn't a valid push subscription.", 400);
    }
    const { supabase, userId } = await getSupabase();
    const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
    if (error) {
      if (error.code === "22023") return jsonError("That isn't a valid push subscription.", 400);
      throw error;
    }
    // First subscription: switch reminders on with the defaults.
    if (!(await getReminderPrefs(supabase))) await saveReminderPrefs(supabase, userId, {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Forgets this browser. */
export async function DELETE(req: Request) {
  try {
    const body = await readBody(req);
    if (!body || typeof body.endpoint !== "string") return jsonError("Send the endpoint to remove.", 400);
    const { supabase } = await getSupabase();
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
