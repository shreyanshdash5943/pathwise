import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { handleRouteError, jsonError } from "@/lib/http";

const KEY = /^[a-z0-9._-]{1,64}$/;

export async function DELETE(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await ctx.params;
    if (!KEY.test(key)) return jsonError("That answer doesn't exist.", 404);
    const { supabase } = await getSupabase();
    const { error } = await supabase.from("interview_answers").delete().eq("question_key", key);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
