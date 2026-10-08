import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getProfile, profileToday } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { HABIT_LIMITS, saveLog, streakOf, type HabitLog } from "@/lib/habits";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Saves a day of a habit: done or not, and the note. Defaults to today. Past days up to a
 * year back can be edited (to fix a note); future days can't.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That habit doesn't exist.", 404);
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }

    const patch: Partial<Omit<HabitLog, "habit_id" | "day">> = {};
    if (body.done !== undefined) {
      if (typeof body.done !== "boolean") return jsonError("Send done as true or false.", 400);
      patch.done = body.done;
    }
    const text = (key: "title" | "notes" | "code", max: number, label: string) => {
      const v = body[key];
      if (v === undefined) return null;
      if (typeof v !== "string") return `Send ${label} as text.`;
      // Code keeps its whitespace; the rest is trimmed.
      const value = key === "code" ? v.replace(/\s+$/, "") : v.trim();
      if (value.length > max) return `Keep ${label} under ${max.toLocaleString("en-US")} characters.`;
      patch[key] = value;
      return null;
    };
    const err = text("title", HABIT_LIMITS.logTitle, "the title") ?? text("notes", HABIT_LIMITS.notes, "your notes") ?? text("code", HABIT_LIMITS.code, "the code");
    if (err) return jsonError(err, 400);
    if (body.url !== undefined) {
      if (typeof body.url !== "string") return jsonError("Send the link as text.", 400);
      const raw = body.url.trim();
      if (raw) {
        try {
          const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
          if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".") || u.toString().length > HABIT_LIMITS.url) throw new Error();
          patch.url = u.toString();
        } catch {
          return jsonError("Add a full https link, like leetcode.com/problems/two-sum.", 400);
        }
      } else {
        patch.url = "";
      }
    }
    if (!Object.keys(patch).length) return jsonError("Nothing to save.", 400);

    const { supabase, userId } = await getSupabase();
    const profile = await getProfile(supabase);
    const today = profile ? profileToday(profile) : new Date().toISOString().slice(0, 10);
    let day = today;
    if (body.day !== undefined) {
      if (typeof body.day !== "string" || !DATE.test(body.day) || body.day > today || body.day < addDays(today, -366)) return jsonError("Pick a day from the past year.", 400);
      day = body.day;
    }

    const habit = await supabase.from("habits").select("id").eq("id", id).maybeSingle();
    if (habit.error) throw habit.error;
    if (!habit.data) return jsonError("That habit doesn't exist.", 404);

    const log = await saveLog(supabase, userId, id, day, patch);
    const recent = await supabase.from("habit_logs").select("day, done").eq("habit_id", id).eq("done", true).gte("day", addDays(today, -400)).lte("day", today);
    if (recent.error) throw recent.error;
    return NextResponse.json({ log, streak: streakOf((recent.data ?? []) as { day: string; done: boolean }[], today) });
  } catch (err) {
    return handleRouteError(err);
  }
}
