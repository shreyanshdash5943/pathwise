import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { podIdentity } from "@/lib/pod-identity";
import { handleRouteError, jsonError } from "@/lib/http";

/** Joins a pod by invite code. */
export async function POST(req: Request) {
  try {
    let body: { code?: unknown };
    try {
      body = ((await req.json()) ?? {}) as { code?: unknown };
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{5,10}$/.test(code)) return jsonError("Check the invite code and try again.", 400);

    const { supabase } = await getSupabase();
    const { name: display, avatar } = await podIdentity();
    const { data, error } = await supabase.rpc("join_pod", { p_code: code, p_display_name: display, p_avatar_url: avatar });
    if (error) {
      if (error.code === "P0002" || /no such pod/.test(error.message)) return jsonError("No pod has that invite code.", 404);
      if (/pod full/.test(error.message)) return jsonError("That pod is full (6 people).", 400);
      if (/pod limit/.test(error.message)) return jsonError("You can be in up to 3 pods. Leave one first.", 400);
      throw error;
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
