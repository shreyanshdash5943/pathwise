import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnonSupabase } from "./supabase";
import { addDays } from "./dates";

/**
 * Profile analytics. Each visitor counts once per day per thing. Visitors are a salted
 * hash of IP + browser + day, made here and never stored raw. Because the day is part
 * of the hash, nobody can be followed from one day to the next. Bots and link previews are skipped,
 * and so is the owner looking at their own page.
 */

export type EventKind = "view" | "card" | "resume" | "link";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|headless|lighthouse|curl|wget|python-requests|axios|node-fetch/i;

/** Records an event after the response is sent, so visitors never wait on it. */
export async function recordProfileEvent(username: string, kind: EventKind, target = "") {
  try {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    if (!ua || BOT.test(ua) || h.get("purpose") === "prefetch" || h.get("next-router-prefetch")) return;
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
    const day = new Date().toISOString().slice(0, 10);
    const salt = process.env.ANALYTICS_SALT || process.env.CRON_SECRET || "pathwise";
    const visitor = createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex");
    const { userId } = await auth();
    after(async () => {
      const { error } = await getAnonSupabase().rpc("record_profile_event", {
        p_username: username,
        p_kind: kind,
        p_target: target.slice(0, 64),
        p_visitor: visitor,
        p_viewer: userId ?? null,
      });
      if (error && error.code !== "PGRST202") console.error("[analytics]", error.message);
    });
  } catch (err) {
    console.error("[analytics]", err instanceof Error ? err.message : err);
  }
}

export type ProfileStats = {
  days: number;
  views: number;
  cards: number;
  resumes: number;
  links: { target: string; n: number }[];
  daily: { date: string; views: number }[];
};

/** The caller's numbers for the last `days` days, summed in the database. */
export async function getProfileStats(supabase: SupabaseClient, today: string, days = 30): Promise<ProfileStats | null> {
  const from = addDays(today, -(days - 1));
  const { data, error } = await supabase.rpc("my_profile_stats", { p_from: from });
  if (error) return null; // before migration 007
  const rows = (data ?? []) as { kind: EventKind; target: string; day: string; n: number }[];
  const sum = (k: EventKind) => rows.filter((r) => r.kind === k).reduce((a, r) => a + r.n, 0);
  const links = new Map<string, number>();
  for (const r of rows) if (r.kind === "link") links.set(r.target, (links.get(r.target) ?? 0) + r.n);
  const byDay = new Map<string, number>();
  for (const r of rows) if (r.kind === "view") byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.n);
  return {
    days,
    views: sum("view"),
    cards: sum("card"),
    resumes: sum("resume"),
    links: [...links].map(([target, n]) => ({ target, n })).sort((a, b) => b.n - a.n),
    daily: Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      return { date, views: byDay.get(date) ?? 0 };
    }),
  };
}
