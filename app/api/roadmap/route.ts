import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sanitizeAnswers } from "@/lib/questions";
import { getRole } from "@/lib/roles";
import { generateRoadmap } from "@/lib/ai";
import { toOutline } from "@/lib/roadmap-schema";
import { isValidTimeZone } from "@/lib/dates";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { supabase, userId } = await getSupabase();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const { answers: rawAnswers, roleId, timezone } = (body ?? {}) as Record<string, unknown>;

    const answers = sanitizeAnswers(rawAnswers);
    if (!answers) return jsonError("Some answers are missing. Go back and answer every question.", 400);
    const role = typeof roleId === "string" ? getRole(roleId) : undefined;
    if (!role || role.field !== answers.field[0]) return jsonError("Pick one of the suggested paths.", 400);
    const tz = isValidTimeZone(timezone) ? timezone : "UTC";
    const dailyMinutes = Number(answers.time[0]) || 60;

    const { roadmap, source } = await generateRoadmap(role, answers);

    // 1. Insert the new roadmap as inactive so the user keeps their old one if anything fails.
    const created = await supabase
      .from("roadmaps")
      .insert({ user_id: userId, title: roadmap.title, summary: roadmap.summary, outline: toOutline(roadmap), source, is_active: false })
      .select("id")
      .single();
    if (created.error) throw created.error;
    const roadmapId = created.data.id as string;

    // 2. Insert every task in order.
    let seq = 0;
    const rows = roadmap.phases.flatMap((phase, pi) =>
      phase.milestones.flatMap((m, mi) =>
        m.tasks.map((t) => ({
          user_id: userId,
          roadmap_id: roadmapId,
          seq: seq++,
          phase_index: pi,
          milestone_index: mi,
          title: t.title,
          description: t.description,
          type: t.type,
          minutes: t.minutes,
        }))
      )
    );
    const inserted = await supabase.from("tasks").insert(rows);
    if (inserted.error) {
      await supabase.from("roadmaps").delete().eq("id", roadmapId);
      throw inserted.error;
    }

    // 3. Swap the active roadmap and save the profile.
    const off = await supabase.from("roadmaps").update({ is_active: false }).eq("is_active", true);
    if (off.error) throw off.error;
    const on = await supabase.from("roadmaps").update({ is_active: true }).eq("id", roadmapId);
    if (on.error) throw on.error;

    const profile = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        answers,
        role_id: role.id,
        role_title: role.title,
        field: role.field,
        daily_minutes: dailyMinutes,
        timezone: tz,
      },
      { onConflict: "user_id" }
    );
    if (profile.error) throw profile.error;

    return NextResponse.json({ ok: true, roadmapId, source });
  } catch (err) {
    return handleRouteError(err);
  }
}
