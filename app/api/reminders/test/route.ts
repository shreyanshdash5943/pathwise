import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { pushConfigured, sendPush, type PushTarget } from "@/lib/push";
import { saveReminderPrefs } from "@/lib/reminders";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";

const COOLDOWN_MS = 20_000;

/** Sends a test notification to every browser the person has turned reminders on in. */
export async function POST() {
  try {
    if (!pushConfigured()) return jsonError("Reminders aren't set up on this server yet.", 503);
    const { supabase, userId } = await getSupabase();

    const prefs = await supabase.from("reminder_prefs").select("last_test_at").maybeSingle();
    if (prefs.error) throw prefs.error;
    const last = prefs.data?.last_test_at ? new Date(prefs.data.last_test_at as string).getTime() : 0;
    if (Date.now() - last < COOLDOWN_MS) return jsonError("Give it a few seconds before sending another.", 429);
    await saveReminderPrefs(supabase, userId, { last_test_at: new Date().toISOString() });

    const subs = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
    if (subs.error) throw subs.error;
    const targets = (subs.data ?? []) as PushTarget[];
    if (!targets.length) return jsonError("Turn on reminders in this browser first.", 400);

    let sent = 0;
    const gone: string[] = [];
    for (const t of targets) {
      const r = await sendPush(t, { title: "Reminders are on", body: "This is what a Pathwise reminder looks like.", url: "/dashboard", tag: "test" });
      if (r === "sent") sent++;
      if (r === "gone") gone.push(t.endpoint);
    }
    if (gone.length) await supabase.from("push_subscriptions").delete().in("endpoint", gone);
    if (!sent) return jsonError("Couldn't reach your browser. Try turning reminders off and on again.", 502);
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    return handleRouteError(err);
  }
}
