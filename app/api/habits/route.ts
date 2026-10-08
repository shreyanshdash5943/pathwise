import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { HABIT_LIMITS, listHabits } from "@/lib/habits";
import { handleRouteError, jsonError } from "@/lib/http";

/** Adds a habit. */
export async function POST(req: Request) {
  try {
    let body: { title?: unknown };
    try {
      body = ((await req.json()) ?? {}) as { title?: unknown };
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim() : "";
    if (!title || title.length > HABIT_LIMITS.title) return jsonError(`Name it in ${HABIT_LIMITS.title} characters or fewer.`, 400);

    const { supabase, userId } = await getSupabase();
    const existing = await listHabits(supabase, true);
    if (existing.filter((h) => !h.archived).length >= 10) return jsonError("You can track up to 10 habits at once.", 400);
    const position = existing.reduce((m, h) => Math.max(m, h.position), -1) + 1;
    const { data, error } = await supabase
      .from("habits")
      .insert({ user_id: userId, title, position: Math.min(position, 100) })
      .select("id, title, position, archived")
      .single();
    if (error) {
      if (/habit limit/.test(error.message)) return jsonError("You've reached the limit. Delete an old habit first.", 400);
      throw error;
    }
    return NextResponse.json({ habit: { ...data, today: null, streak: 0 } });
  } catch (err) {
    return handleRouteError(err);
  }
}
