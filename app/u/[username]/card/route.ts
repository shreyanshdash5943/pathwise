import { NextResponse } from "next/server";
import { cleanUsername, getPublicProfile } from "@/lib/public-profile";
import { buildProfileCard } from "@/lib/profile-card";
import { recordProfileEvent } from "@/lib/analytics";

export const runtime = "nodejs";

/** The public profile as a downloadable one-page PDF with clickable links. */
export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const u = cleanUsername(username);
  const profile = u.ok ? await getPublicProfile(u.value).catch(() => null) : null;
  if (!profile) return NextResponse.redirect(new URL(`/u/${encodeURIComponent(username)}`, req.url), 302);

  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const pdf = await buildProfileCard(profile, origin);
  await recordProfileEvent(profile.username, "card");
  const file = `${(profile.displayName ?? profile.username).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || profile.username}-profile.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"`,
      // Not cached by the CDN, so every download is counted. Building it takes milliseconds,
      // and the profile data behind it is still cached for 5 minutes.
      "Cache-Control": "private, no-store",
    },
  });
}
