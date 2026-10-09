import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { podIdentity } from "@/lib/pod-identity";
import { handleRouteError, jsonError } from "@/lib/http";

/** Creates a pod. Returns its id and invite code. */
export async function POST(req: Request) {
  try {
    let body: { name?: unknown };
    try {
      body = ((await req.json()) ?? {}) as { name?: unknown };
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
    if (name.length < 2 || name.length > 40) return jsonError("Give your pod a name of 2 to 40 characters.", 400);

    const { supabase } = await getSupabase();
    const { name: display, avatar } = await podIdentity();
    const { data, error } = await supabase.rpc("create_pod", { p_name: name, p_display_name: display, p_avatar_url: avatar });
    if (error) {
      if (/pod limit/.test(error.message)) return jsonError("You can be in up to 3 pods. Leave one first.", 400);
      throw error;
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
