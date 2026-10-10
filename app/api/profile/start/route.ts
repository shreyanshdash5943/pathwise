import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getProfile } from "@/lib/data";
import { isValidTimeZone } from "@/lib/dates";
import { handleRouteError } from "@/lib/http";

/**
 * Creates a minimal profile so someone can start tracking habits without building a
 * career plan. Just stores their timezone (for a correct "today"). Idempotent: if a
 * profile already exists it's left as is.
 */
export async function POST(req: Request) {
  try {
    let body: { timezone?: unknown } = {};
    try {
      body = ((await req.json()) ?? {}) as { timezone?: unknown };
    } catch {}
    const tz = isValidTimeZone(body.timezone) ? body.timezone : "UTC";

    const { supabase, userId } = await getSupabase();
    const existing = await getProfile(supabase);
    if (!existing) {
      const { error } = await supabase.from("profiles").insert({ user_id: userId, timezone: tz });
      // 23505: a parallel request already created it — fine.
      if (error && error.code !== "23505") throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
