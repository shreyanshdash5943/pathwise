import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { APP_FIELDS, cleanJobUrl, STATUSES, type Application, type Status } from "@/lib/prep";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Updates an application (status, notes, next step, etc.). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That application doesn't exist.", 404);
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }

    const patch: Partial<Application> = {};
    if (body.company !== undefined) {
      const c = typeof body.company === "string" ? body.company.replace(/\s+/g, " ").trim() : "";
      if (!c || c.length > 120) return jsonError("Add the company name (up to 120 characters).", 400);
      patch.company = c;
    }
    if (body.role_title !== undefined) {
      if (typeof body.role_title !== "string" || body.role_title.length > 120) return jsonError("Keep the role title under 120 characters.", 400);
      patch.role_title = body.role_title.replace(/\s+/g, " ").trim();
    }
    if (body.location !== undefined) {
      if (typeof body.location !== "string" || body.location.length > 80) return jsonError("Keep the location under 80 characters.", 400);
      patch.location = body.location.replace(/\s+/g, " ").trim();
    }
    if (body.url !== undefined) {
      const url = cleanJobUrl(body.url);
      if (url === null) return jsonError("The job link needs to be a full https address.", 400);
      patch.url = url;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as Status)) return jsonError("Pick a valid status.", 400);
      patch.status = body.status as Status;
    }
    if (body.notes !== undefined) {
      if (typeof body.notes !== "string" || body.notes.length > 2000) return jsonError("Keep notes under 2000 characters.", 400);
      patch.notes = body.notes;
    }
    if (body.next_step !== undefined) {
      if (typeof body.next_step !== "string" || body.next_step.length > 160) return jsonError("Keep the next step under 160 characters.", 400);
      patch.next_step = body.next_step.replace(/\s+/g, " ").trim();
    }
    if (body.next_step_on !== undefined) {
      if (body.next_step_on !== null && (typeof body.next_step_on !== "string" || !DATE.test(body.next_step_on))) return jsonError("Use a valid date.", 400);
      patch.next_step_on = body.next_step_on as string | null;
    }
    if (body.applied_on !== undefined) {
      if (body.applied_on !== null && (typeof body.applied_on !== "string" || !DATE.test(body.applied_on))) return jsonError("Use a valid date.", 400);
      patch.applied_on = body.applied_on as string | null;
    }
    if (!Object.keys(patch).length) return jsonError("Nothing to change.", 400);

    const { supabase } = await getSupabase();
    const { data, error } = await supabase.from("applications").update(patch).eq("id", id).select(APP_FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) return jsonError("That application doesn't exist.", 404);
    return NextResponse.json({ application: data });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) return jsonError("That application doesn't exist.", 404);
    const { supabase } = await getSupabase();
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
