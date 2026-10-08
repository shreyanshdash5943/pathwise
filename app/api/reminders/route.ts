import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { saveReminderPrefs, type ReminderPrefs } from "@/lib/reminders";
import { handleRouteError, jsonError } from "@/lib/http";

export async function PATCH(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const patch: Partial<ReminderPrefs> = {};
    if (body.dailyEnabled !== undefined) {
      if (typeof body.dailyEnabled !== "boolean") return jsonError("Send dailyEnabled as true or false.", 400);
      patch.daily_enabled = body.dailyEnabled;
    }
    if (body.weeklyEnabled !== undefined) {
      if (typeof body.weeklyEnabled !== "boolean") return jsonError("Send weeklyEnabled as true or false.", 400);
      patch.weekly_enabled = body.weeklyEnabled;
    }
    if (body.dailyHour !== undefined) {
      if (!Number.isInteger(body.dailyHour) || (body.dailyHour as number) < 0 || (body.dailyHour as number) > 23) return jsonError("Pick an hour from the list.", 400);
      patch.daily_hour = body.dailyHour as number;
    }
    if (!Object.keys(patch).length) return jsonError("Nothing to change.", 400);

    const { supabase, userId } = await getSupabase();
    await saveReminderPrefs(supabase, userId, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
