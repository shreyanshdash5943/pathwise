import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { cleanProofUrl, cleanText, PROOF_COLUMNS, type Proof } from "@/lib/proofs";
import { revalidateOwnProfile } from "@/lib/public-profile";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That proof doesn't exist.", 404);
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }

    const patch: Partial<Pick<Proof, "url" | "note" | "title">> = {};
    if (body.url !== undefined) {
      const url = cleanProofUrl(body.url);
      if (!url) return jsonError("Add a full https link, like github.com/you/project.", 400);
      patch.url = url;
    }
    if (body.note !== undefined) {
      const note = cleanText(body.note, 280);
      if (note === null) return jsonError("Keep the note under 280 characters.", 400);
      patch.note = note;
    }
    if (body.title !== undefined) {
      const title = cleanText(body.title, 160);
      if (!title) return jsonError("Give your project a title under 160 characters.", 400);
      patch.title = title;
    }
    if (!Object.keys(patch).length) return jsonError("Nothing to change.", 400);

    const { supabase } = await getSupabase();
    const { data, error } = await supabase.from("proofs").update(patch).eq("id", id).select(PROOF_COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("That proof doesn't exist.", 404);
    await revalidateOwnProfile(supabase);
    return NextResponse.json({ proof: data as Proof });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That proof doesn't exist.", 404);
    const { supabase } = await getSupabase();
    const { error } = await supabase.from("proofs").delete().eq("id", id);
    if (error) throw error;
    await revalidateOwnProfile(supabase);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
