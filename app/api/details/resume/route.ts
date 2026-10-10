import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getProfile } from "@/lib/data";
import { getRole } from "@/lib/roles";
import { getDetails, RESUME_BUCKET, RESUME_MAX_BYTES, resumePath, saveDetails } from "@/lib/details";
import { matchSkills, pdfText, ResumeError } from "@/lib/resume";
import { tagSkillsWithAi } from "@/lib/ai";
import { handleRouteError, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Opens the user's resume through a short-lived signed link. */
export async function GET() {
  try {
    const { supabase, userId } = await getSupabase();
    const details = await getDetails(supabase);
    if (!details?.resume_hash) return jsonError("You haven't uploaded a resume.", 404);
    const { data, error } = await supabase.storage
      .from(RESUME_BUCKET)
      .createSignedUrl(resumePath(userId), 60, { download: details.resume_name ?? "resume.pdf" });
    if (error) throw error;
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Reads the resume the browser just uploaded and finds which of the role's skills it
 * shows. Keyword matching first (free); the optional AI tagger only runs when that finds
 * fewer than two skills, and never twice for the same file. The text is not stored.
 */
export async function POST(req: Request) {
  try {
    let body: { name?: unknown };
    try {
      body = ((await req.json()) ?? {}) as { name?: unknown };
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.replace(/[\u0000-\u001f\u007f"\\/]/g, "").trim().slice(0, 200) || "resume.pdf"
        : "resume.pdf";

    const { supabase, userId } = await getSupabase();
    const [profile, details] = await Promise.all([getProfile(supabase), getDetails(supabase)]);
    const role = profile?.role_id ? getRole(profile.role_id) : undefined;
    if (!role) return jsonError("Build a plan to use your resume for it.", 404);

    const path = resumePath(userId);
    const file = await supabase.storage.from(RESUME_BUCKET).download(path);
    if (file.error || !file.data) return jsonError("We couldn't find your upload. Try again.", 404);
    if (file.data.size > RESUME_MAX_BYTES) {
      await supabase.storage.from(RESUME_BUCKET).remove([path]);
      return jsonError("Resumes can be at most 5 MB.", 400);
    }
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");

    if (details?.resume_hash === hash) {
      if (details.resume_name !== name) await saveDetails(supabase, userId, { resume_name: name });
      return NextResponse.json({ resumeSkills: details.resume_skills, name, size: bytes.length, uploadedAt: details.resume_uploaded_at });
    }

    let text: string;
    try {
      text = await pdfText(bytes);
    } catch (err) {
      await supabase.storage.from(RESUME_BUCKET).remove([path]);
      if (err instanceof ResumeError) return jsonError(err.message, 400);
      throw err;
    }

    let found = matchSkills(text, role.skills);
    let aiHash = details?.resume_ai_hash ?? null;
    if (found.length < 2 && text.trim().length > 200 && aiHash !== hash) {
      const tagged = await tagSkillsWithAi(supabase, text, role.skills);
      if (tagged) {
        found = role.skills.filter((s) => found.includes(s) || tagged.includes(s));
        aiHash = hash;
      }
    }

    const uploadedAt = new Date().toISOString();
    await saveDetails(supabase, userId, {
      resume_name: name,
      resume_size: bytes.length,
      resume_hash: hash,
      resume_skills: found,
      resume_ai_hash: aiHash,
      resume_uploaded_at: uploadedAt,
    });
    return NextResponse.json({ resumeSkills: found, name, size: bytes.length, uploadedAt });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Deletes the file and everything learned from it. */
export async function DELETE() {
  try {
    const { supabase, userId } = await getSupabase();
    const rm = await supabase.storage.from(RESUME_BUCKET).remove([resumePath(userId)]);
    if (rm.error) throw rm.error;
    await saveDetails(supabase, userId, {
      resume_name: null,
      resume_size: null,
      resume_hash: null,
      resume_skills: [],
      resume_ai_hash: null,
      resume_uploaded_at: null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
