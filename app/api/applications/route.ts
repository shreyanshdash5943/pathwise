import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { APP_FIELDS, cleanJobUrl, STATUSES, type Status } from "@/lib/prep";
import { handleRouteError, jsonError } from "@/lib/http";

/** Adds an application. */
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const company = typeof body.company === "string" ? body.company.replace(/\s+/g, " ").trim() : "";
    if (!company || company.length > 120) return jsonError("Add the company name (up to 120 characters).", 400);
    const url = cleanJobUrl(body.url);
    if (url === null) return jsonError("The job link needs to be a full https address.", 400);
    const status = STATUSES.includes(body.status as Status) ? (body.status as Status) : "saved";
    const role = typeof body.role_title === "string" ? body.role_title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    const location = typeof body.location === "string" ? body.location.replace(/\s+/g, " ").trim().slice(0, 80) : "";

    const { supabase, userId } = await getSupabase();
    const { data, error } = await supabase
      .from("applications")
      .insert({ user_id: userId, company, role_title: role, url, location, status, applied_on: status === "saved" ? null : new Date().toISOString().slice(0, 10) })
      .select(APP_FIELDS)
      .single();
    if (error) {
      if (/application limit/.test(error.message)) return jsonError("You can track up to 300 applications.", 400);
      throw error;
    }
    return NextResponse.json({ application: data });
  } catch (err) {
    return handleRouteError(err);
  }
}
