import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { RESUME_BUCKET, resumePath } from "@/lib/details";
import { handleRouteError } from "@/lib/http";

/**
 * Hands the browser a one-time signed URL so it can upload the PDF straight to
 * Supabase Storage. The file never passes through the app servers; the bucket itself
 * enforces the 5 MB limit and PDF type.
 */
export async function POST() {
  try {
    const { supabase, userId } = await getSupabase();
    const path = resumePath(userId);
    const { data, error } = await supabase.storage.from(RESUME_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error) throw error;
    return NextResponse.json({ path: data.path, token: data.token });
  } catch (err) {
    return handleRouteError(err);
  }
}
