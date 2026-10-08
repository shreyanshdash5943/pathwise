import { NextResponse } from "next/server";
import { cleanUsername, getPublicProfile } from "@/lib/public-profile";
import { recordProfileEvent } from "@/lib/analytics";

/**
 * Outbound link from a public profile, counted for the owner's analytics.
 * ?to=github|linkedin|portfolio or ?to=proof-<id>. The destination always comes from
 * the profile itself, never from the query, so this can't be used as an open redirect.
 */
export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const back = NextResponse.redirect(new URL(`/u/${encodeURIComponent(username)}`, req.url), 302);
  const u = cleanUsername(username);
  if (!u.ok) return back;
  const profile = await getPublicProfile(u.value).catch(() => null);
  if (!profile) return back;

  const to = new URL(req.url).searchParams.get("to") ?? "";
  let url: string | undefined;
  if (to === "github" || to === "linkedin" || to === "portfolio") url = profile.links[to];
  else if (to.startsWith("proof-")) url = profile.proofs.find((p) => p.id === to.slice(6))?.url;
  if (!url || !url.startsWith("https://")) return back;

  await recordProfileEvent(u.value, "link", to);
  return NextResponse.redirect(url, 302);
}
