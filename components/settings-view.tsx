"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { PageHeader } from "./page-header";
import { Toast, useToast } from "./toast";
import { RemindersPanel } from "./reminders-panel";

const OPTIONS = [30, 60, 90, 120, 180];
const label = (m: number) => (m < 60 ? `${m} min` : `${m / 60} hr`);

export function SettingsView({
  dailyMinutes,
  roleTitle,
  summary,
  reminders,
}: {
  dailyMinutes: number;
  roleTitle: string;
  summary: { question: string; answer: string }[];
  reminders: { daily_enabled: boolean; daily_hour: number; weekly_enabled: boolean } | null;
}) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(dailyMinutes);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast, show } = useToast();

  async function saveMinutes(m: number) {
    const prev = minutes;
    setMinutes(m);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_minutes: m }),
      });
      if (!res.ok) throw new Error();
      show(`Daily time set to ${label(m)}. Tomorrow's checklist will match.`);
      router.refresh();
    } catch {
      setMinutes(prev);
      show("Couldn't save your daily time. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan() {
    setDeleting(true);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.replace("/onboarding");
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirming(false);
      show("Couldn't delete your plan. Try again.");
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Adjust your plan or start a new one." />

      <div className="space-y-5">
        <section className="panel p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">Daily time</h2>
          <p className="mt-1 text-[14.5px] text-muted">How much time your checklist should fill on a normal day.</p>
          <div role="radiogroup" aria-label="Daily time" className="mt-5 inline-flex flex-wrap gap-1 rounded-full bg-surface p-1">
            {OPTIONS.map((m) => {
              const active = minutes === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={saving}
                  onClick={() => !active && saveMinutes(m)}
                  className={clsx("relative h-9 rounded-full px-4 text-[14px] font-medium transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}
                >
                  {active && <motion.span layoutId="minutes-pill" className="absolute inset-0 rounded-full bg-white shadow-lift" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
                  <span className="tabular relative">{label(m)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <RemindersPanel initial={reminders} show={show} />

        <section className="panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold">Your path</h2>
              <p className="mt-1 text-[14.5px] text-muted">
                You're working towards <span className="font-medium text-ink">{roleTitle}</span>.
              </p>
            </div>
            <Link href="/onboarding?retake=1" className="btn-outline h-10 shrink-0 text-[14px]">
              Change my path
            </Link>
          </div>
          <dl className="mt-6 divide-y divide-line border-t border-line">
            {summary.map((s) => (
              <div key={s.question} className="grid gap-1 py-3 sm:grid-cols-[1fr_1fr] sm:gap-6">
                <dt className="text-[14px] text-muted">{s.question}</dt>
                <dd className="text-[14px] font-medium">{s.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">Delete plan and answers</h2>
          <p className="mt-1 max-w-xl text-[14.5px] text-muted">
            Removes your roadmap, your progress and your onboarding answers. Your account stays. This can't be undone.
          </p>
          <button type="button" onClick={() => setConfirming(true)} className="btn mt-5 h-10 border border-line bg-white text-[14px] text-red-600 hover:border-red-200 hover:bg-red-50">
            Delete my plan
          </button>
        </section>
      </div>

      <ConfirmDialog open={confirming} busy={deleting} onCancel={() => setConfirming(false)} onConfirm={deletePlan} />
      <Toast message={toast} />
    </>
  );
}

function ConfirmDialog({ open, busy, onCancel, onConfirm }: { open: boolean; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => !busy && onCancel()} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-lift"
          >
            <h2 id="confirm-title" className="text-[18px] font-semibold">
              Delete your plan?
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Your roadmap, streak and answers will be removed. You'll go through onboarding again.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} type="button" className="btn-quiet h-10 text-[14px]" onClick={onCancel} disabled={busy}>
                Keep my plan
              </button>
              <button type="button" className="btn h-10 bg-red-600 text-[14px] text-white hover:bg-red-700" onClick={onConfirm} disabled={busy}>
                {busy ? "Deleting" : "Delete plan"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
