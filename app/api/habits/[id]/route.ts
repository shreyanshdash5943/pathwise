import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { HABIT_LIMITS } from "@/lib/habits";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Renames or archives a habit. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That habit doesn't exist.", 404);
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const patch: { title?: string; archived?: boolean } = {};
    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim() : "";
      if (!title || title.length > HABIT_LIMITS.title) return jsonError(`Name it in ${HABIT_LIMITS.title} characters or fewer.`, 400);
      patch.title = title;
    }
    if (body.archived !== undefined) {
      if (typeof body.archived !== "boolean") return jsonError("Send archived as true or false.", 400);
      patch.archived = body.archived;
    }
    if (!Object.keys(patch).length) return jsonError("Nothing to change.", 400);

    const { supabase } = await getSupabase();
    const { data, error } = await supabase.from("habits").update(patch).eq("id", id).select("id, title, position, archived").maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("That habit doesn't exist.", 404);
    return NextResponse.json({ habit: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Deletes a habit and all its notes. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That habit doesn't exist.", 404);
    const { supabase } = await getSupabase();
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
