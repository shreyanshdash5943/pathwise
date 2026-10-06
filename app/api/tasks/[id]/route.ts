import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getProfile, getStats, profileToday } from "@/lib/data";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That task doesn't exist.", 404);
    let body: { completed?: unknown };
    try {
      body = (await req.json()) ?? {};
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    if (typeof body.completed !== "boolean") return jsonError("Send completed as true or false.", 400);

    const { supabase } = await getSupabase();
    const profile = await getProfile(supabase);
    if (!profile) return jsonError("Finish onboarding to get your plan.", 404);
    const today = profileToday(profile);

    const { data, error } = await supabase
      .from("tasks")
      .update({ completed_on: body.completed ? today : null })
      .eq("id", id)
      .select("id, roadmap_id, completed_on")
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("That task doesn't exist.", 404);

    const stats = await getStats(supabase, data.roadmap_id as string, today);
    return NextResponse.json({ task: { id: data.id, completed_on: data.completed_on }, stats });
  } catch (err) {
    return handleRouteError(err);
  }
}
