import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { applyKnownSkills, profileToday } from "@/lib/data";
import { loadProfileAndPlan } from "@/lib/plans";
import { cleanEmail, cleanLinks, cleanPhone, cleanSkills, getDetails, saveDetails, type Details } from "@/lib/details";
import { cleanUsername, revalidatePublicProfile } from "@/lib/public-profile";
import { skippableKeys } from "@/lib/templates/personalize";
import { handleRouteError, jsonError } from "@/lib/http";
import { isProRequired } from "@/lib/pro";

/**
 * Saves profile details. When knownSkills is sent, the plan is updated too: learn and
 * practice tasks for those skills are skipped, and tasks for unticked skills come back.
 * username and isPublic control the public page at /u/<username>; publishing copies the
 * name and photo from Clerk so public views never call Clerk.
 */
export async function PATCH(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }

    const patch: Partial<Details> = {};
    if (body.headline !== undefined) {
      if (typeof body.headline !== "string" || body.headline.trim().length > 120) return jsonError("Keep your headline under 120 characters.", 400);
      patch.headline = body.headline.replace(/\s+/g, " ").trim();
    }
    if (body.links !== undefined) {
      const links = cleanLinks(body.links);
      if (!links) return jsonError("Check your links. They need to be full https addresses on the right site.", 400);
      patch.links = links;
    }
    if (body.skills !== undefined) {
      const skills = cleanSkills(body.skills);
      if (!skills) return jsonError("Add up to 30 skills, each under 40 characters.", 400);
      patch.skills = skills;
    }

    if (body.username !== undefined && body.username !== null && body.username !== "") {
      const u = cleanUsername(body.username);
      if (!u.ok) return jsonError(u.error, 400);
      patch.username = u.value;
    }
    if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") return jsonError("Send isPublic as true or false.", 400);
    if (body.contactEmail !== undefined) {
      const email = cleanEmail(body.contactEmail);
      if (email === undefined) return jsonError("That email address doesn't look right.", 400);
      patch.contact_email = email;
    }
    if (body.phone !== undefined) {
      const phone = cleanPhone(body.phone);
      if (phone === undefined) return jsonError("Use digits for the phone number, with an optional + and country code.", 400);
      patch.phone = phone;
    }
    if (body.cardTheme !== undefined) {
      if (body.cardTheme !== "classic" && body.cardTheme !== "midnight" && body.cardTheme !== "minimal") return jsonError("Pick one of the card designs.", 400);
      patch.card_theme = body.cardTheme;
    }
    for (const [key, column] of [["showEmail", "show_email"], ["showPhone", "show_phone"], ["showResume", "show_resume"], ["hideBranding", "hide_branding"]] as const) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== "boolean") return jsonError(`Send ${key} as true or false.`, 400);
      patch[column] = body[key] as boolean;
    }

    const { supabase, userId } = await getSupabase();
    const before = await getDetails(supabase);
    if (typeof body.isPublic === "boolean") {
      patch.is_public = body.isPublic;
      if (body.isPublic) {
        if (!patch.username && !before?.username) return jsonError("Choose a username first.", 400);
        const user = await currentUser();
        const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
        patch.display_name = name ? name.slice(0, 80) : null;
        patch.avatar_url = user?.hasImage && user.imageUrl?.startsWith("https://") && user.imageUrl.length <= 500 ? user.imageUrl : null;
      }
    }

    let skipped: number | undefined;
    if (body.knownSkills !== undefined) {
      const { profile, plan } = await loadProfileAndPlan(supabase);
      if (!profile || !plan) return jsonError("Finish onboarding to get your plan.", 404);
      if (!Array.isArray(body.knownSkills)) return jsonError("Send knownSkills as a list.", 400);
      const known = plan.role.skills.filter((s) => (body.knownSkills as unknown[]).includes(s));
      patch.known_skills = known;
      await saveDetails(supabase, userId, patch);
      const assembled = { outline: plan.outline, tasks: plan.defs };
      skipped = await applyKnownSkills(supabase, plan, skippableKeys(assembled, known), profileToday(profile));
    } else if (Object.keys(patch).length) {
      await saveDetails(supabase, userId, patch);
    }

    revalidatePublicProfile(before?.username);
    if (patch.username) revalidatePublicProfile(patch.username);
    return NextResponse.json({ ok: true, skipped });
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "23505") return jsonError("That username is taken. Try another.", 409);
    if (isProRequired(err)) {
      const msg = (err as { message?: string }).message ?? "";
      if (/short username/.test(msg)) return jsonError("Usernames under 6 characters are part of Pro. Pick a longer one, or see Pro.", 403);
      if (/card theme/.test(msg)) return jsonError("That card design is part of Pro.", 403);
      if (/branding/.test(msg)) return jsonError("Hiding the Pathwise footer is part of Pro.", 403);
      return jsonError("That's part of Pro.", 403);
    }
    return handleRouteError(err);
  }
}
