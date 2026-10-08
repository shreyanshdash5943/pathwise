import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase";
import { dailyMessage, inBatches, pushConfigured, sendPush, weeklyMessage, type PushTarget, type ReminderRow } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 500;
const CONCURRENCY = 50;
const TIME_BUDGET_MS = 45_000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sends due reminders. Call it hourly (GitHub Actions, Vercel Cron or any scheduler)
 * with `Authorization: Bearer <CRON_SECRET>`. Each batch is claimed in the database
 * before sending, so overlapping or retried runs never send the same reminder twice.
 * If a run runs out of time, the rest are picked up by the next run.
 */
async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!pushConfigured()) return NextResponse.json({ error: "Push isn't configured (VAPID keys missing)." }, { status: 500 });

  const started = Date.now();
  const supabase = getAnonSupabase();
  const secret = process.env.CRON_SECRET!;
  const totals = { daily: 0, weekly: 0, skipped: 0, failed: 0, removed: 0 };

  for (const kind of ["weekly", "daily"] as const) {
    while (Date.now() - started < TIME_BUDGET_MS) {
      const { data, error } = await supabase.rpc("claim_due_reminders", { p_secret: secret, p_kind: kind, p_limit: BATCH });
      if (error) {
        console.error("[cron/reminders]", error);
        return NextResponse.json({ error: "Couldn't claim reminders.", totals }, { status: 500 });
      }
      const rows = (data ?? []) as (ReminderRow & { send: boolean; subscriptions: PushTarget[] | null })[];
      const jobs: { target: PushTarget; message: NonNullable<ReturnType<typeof dailyMessage>> }[] = [];
      for (const row of rows) {
        const message = !row.send ? null : kind === "daily" ? dailyMessage(row) : weeklyMessage(row);
        if (!message) {
          totals.skipped++;
          continue;
        }
        for (const target of row.subscriptions ?? []) jobs.push({ target, message });
        totals[kind]++;
      }

      const gone: string[] = [];
      await inBatches(jobs, CONCURRENCY, async ({ target, message }) => {
        const result = await sendPush(target, message);
        if (result === "gone") gone.push(target.endpoint);
        if (result === "failed") totals.failed++;
      });
      if (gone.length) {
        const rm = await supabase.rpc("remove_push_subscriptions", { p_secret: secret, p_endpoints: gone });
        if (!rm.error) totals.removed += (rm.data as number) ?? 0;
      }
      if (rows.length < BATCH) break;
    }
  }

  return NextResponse.json({ ok: true, totals, ms: Date.now() - started });
}

export const GET = run; // Vercel Cron sends GET
export const POST = run;
