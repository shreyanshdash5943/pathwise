import { NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase";
import { cleanUsername } from "@/lib/public-profile";
import { recordProfileEvent } from "@/lib/analytics";

/**
 * Public resume download. Works only while the owner's profile is public and they've
 * switched on "show resume"; the storage policy re-checks that on every request.
 * The link it hands out expires after a minute.
 */
export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const u = cleanUsername(username);
  const back = NextResponse.redirect(new URL(`/u/${encodeURIComponent(username)}`, req.url), 302);
  if (!u.ok) return back;

  const supabase = getAnonSupabase();
  const { data: path, error } = await supabase.rpc("public_resume_path", { p_username: u.value });
  if (error || typeof path !== "string") return back;
  const signed = await supabase.storage.from("resumes").createSignedUrl(path, 60, { download: `${u.value}-resume.pdf` });
  if (signed.error || !signed.data) return back;
  await recordProfileEvent(u.value, "resume");
  return NextResponse.redirect(signed.data.signedUrl, 302);
}
