import "server-only";
import webpush from "web-push";

/**
 * Web push: free at any scale (the browser vendors' push services carry the messages).
 * Needs a VAPID key pair: `npx web-push generate-vapid-keys`.
 */

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url: string; tag: string };
export type SendResult = "sent" | "gone" | "failed";

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:reminders@example.com", pub, priv);
  return (configured = true);
}

export async function sendPush(target: PushTarget, message: PushMessage): Promise<SendResult> {
  if (!pushConfigured()) return "failed";
  try {
    await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(message), {
      TTL: 6 * 60 * 60, // a reminder older than 6 hours isn't worth showing
      urgency: "normal",
      timeout: 10_000,
    });
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410: the browser unsubscribed or the subscription expired. Forget it.
    if (status === 404 || status === 410) return "gone";
    console.error("[push]", status ?? "", err instanceof Error ? err.message : err);
    return "failed";
  }
}

/** Runs fn over items with at most `limit` in flight. */
export async function inBatches<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

export type ReminderRow = { daily_minutes: number | null; streak: number; done_today: boolean; week_done: number; role_title: string | null; has_plan: boolean };

const timeLabel = (m: number) => (m < 60 ? `${m} minutes` : m === 60 ? "an hour" : `${m / 60} hours`);

/** The daily nudge, or null when there's nothing to say (they've already been active today). */
export function dailyMessage(r: ReminderRow): PushMessage | null {
  if (r.done_today) return null;
  // Habits-only users: nudge about their habits, not a plan.
  if (!r.has_plan) {
    if (r.streak > 0) return { title: `Keep your ${r.streak}-day streak going`, body: "Your habits are waiting — a few minutes keeps it alive.", url: "/dashboard", tag: "daily" };
    return { title: "Time for your habits", body: "A few minutes today gets your streak going.", url: "/dashboard", tag: "daily" };
  }
  const time = timeLabel(r.daily_minutes ?? 60);
  const role = r.role_title ? `your ${r.role_title} goal` : "your goal";
  if (r.streak > 0) return { title: `Keep your ${r.streak}-day streak going`, body: `Today's plan is ready: about ${time}.`, url: "/dashboard", tag: "daily" };
  if (r.week_done > 0) return { title: "Today's plan is ready", body: `About ${time} towards ${role}.`, url: "/dashboard", tag: "daily" };
  return { title: "Ready when you are", body: `${time.charAt(0).toUpperCase()}${time.slice(1)} today moves you closer to ${role}.`, url: "/dashboard", tag: "daily" };
}

export function weeklyMessage(r: ReminderRow): PushMessage {
  if (!r.has_plan) {
    if (r.week_done > 0) {
      const days = `${r.week_done} day${r.week_done === 1 ? "" : "s"}`;
      return { title: `Your week: active ${days}`, body: r.streak > 1 ? `On a ${r.streak}-day streak. Keep it rolling.` : "Nice work. New week, same habits.", url: "/dashboard", tag: "weekly" };
    }
    return { title: "A fresh week", body: "A few minutes on your habits today starts it off right.", url: "/dashboard", tag: "weekly" };
  }
  if (r.week_done > 0) {
    const n = `${r.week_done} thing${r.week_done === 1 ? "" : "s"}`;
    return { title: `Your week: ${n} done`, body: r.streak > 1 ? `You're on a ${r.streak}-day streak. Next week's plan is ready.` : "Nice work. Next week's plan is ready.", url: "/roadmap", tag: "weekly" };
  }
  return { title: "A fresh week", body: `Even 15 minutes today gets your ${r.role_title ?? "career"} plan moving again.`, url: "/dashboard", tag: "weekly" };
}
