"use client";
import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import clsx from "clsx";

type Prefs = { daily_enabled: boolean; daily_hour: number; weekly_enabled: boolean };
type State = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" });

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function send(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

/**
 * Settings section for push reminders. Reminders are per browser: turning them on here
 * subscribes this device; preferences (time, daily, weekly) apply to all devices.
 */
export function RemindersPanel({ initial, show }: { initial: Prefs | null; show: (text: string) => void }) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<State>("loading");
  const [prefs, setPrefs] = useState<Prefs>(initial ?? { daily_enabled: true, daily_hour: 18, weekly_enabled: true });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!supported) return setState(ios && !standalone ? "ios-install" : "unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setState(sub ? "on" : "off");
  }, []);

  useEffect(() => {
    refresh().catch(() => setState("unsupported"));
  }, [refresh]);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      await send("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      setState("on");
      show("Reminders are on for this device.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't turn on reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await send("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      show("Reminders are off for this device.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't turn off reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function update(patch: Partial<Prefs>) {
    const prev = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      await send("/api/reminders", {
        method: "PATCH",
        body: JSON.stringify({ dailyEnabled: patch.daily_enabled, dailyHour: patch.daily_hour, weeklyEnabled: patch.weekly_enabled }),
      });
    } catch (err) {
      setPrefs(prev);
      show(err instanceof Error ? err.message : "Couldn't save that.");
    }
  }

  async function test() {
    setBusy(true);
    try {
      await send("/api/reminders/test", { method: "POST" });
      show("Sent. It should appear in a moment.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't send a test.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="text-[17px] font-semibold">Reminders</h2>
      <p className="mt-1 max-w-xl text-[14.5px] text-muted">
        A nudge on days you haven't started yet, and a short summary on Sunday. Never more than one a day.
      </p>

      {!publicKey ? (
        <p className="mt-5 rounded-xl bg-surface px-4 py-3.5 text-[14.5px] text-muted">Reminders aren't set up on this server yet.</p>
      ) : state === "loading" ? (
        <div className="skeleton mt-5 h-10 w-48" />
      ) : state === "unsupported" ? (
        <p className="mt-5 rounded-xl bg-surface px-4 py-3.5 text-[14.5px] text-muted">This browser doesn't support notifications. Try Chrome, Edge, Firefox or Safari.</p>
      ) : state === "ios-install" ? (
        <p className="mt-5 rounded-xl bg-surface px-4 py-3.5 text-[14.5px] text-muted">
          On iPhone and iPad, first add Pathwise to your Home Screen: tap Share, then Add to Home Screen. Open it from there and turn reminders on.
        </p>
      ) : state === "blocked" ? (
        <p className="mt-5 rounded-xl bg-surface px-4 py-3.5 text-[14.5px] text-muted">
          Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload this page.
        </p>
      ) : state === "off" ? (
        <button type="button" className="btn-primary mt-5 h-10 text-[14px]" onClick={turnOn} disabled={busy}>
          <BellRing className="h-4 w-4" /> {busy ? "Turning on" : "Turn on reminders"}
        </button>
      ) : (
        <>
          <div className="mt-5 divide-y divide-line border-y border-line">
            <div className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <Toggle label="Daily nudge" hint="Only if you haven't done a task yet that day." on={prefs.daily_enabled} onChange={(v) => update({ daily_enabled: v })} />
              <label className="flex items-center gap-2 text-[14px] text-muted">
                at
                <select
                  className="h-9 rounded-lg border border-line bg-white px-2.5 text-[14px] text-ink outline-none focus:border-accent"
                  value={prefs.daily_hour}
                  onChange={(e) => update({ daily_hour: Number(e.target.value) })}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="py-3.5">
              <Toggle label="Sunday summary" hint="What you got done this week, at the same time." on={prefs.weekly_enabled} onChange={(v) => update({ weekly_enabled: v })} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-outline h-10 text-[14px]" onClick={test} disabled={busy}>
              Send a test
            </button>
            <button type="button" className="btn-quiet h-10 text-[14px]" onClick={turnOff} disabled={busy}>
              <BellOff className="h-4 w-4" /> Turn off on this device
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-start gap-3 text-left">
      <span className={clsx("relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-surface-sunk")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]", on ? "left-[18px]" : "left-0.5")} />
      </span>
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        <span className="block text-[13px] text-faint">{hint}</span>
      </span>
    </button>
  );
}
