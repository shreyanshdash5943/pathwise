"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle } from "./task-row";
import { DELETE } from "@/app/api/habits/[id]/route";

export type HabitLogLite = {
  habit_id: string;
  day: string;
  done: boolean;
  title: string;
  url: string;
  notes: string;
  code: string;
};
export type HabitLite = {
  id: string;
  title: string;
  position: number;
  archived: boolean;
  today: HabitLogLite | null;
  streak: number;
};

const field =
  "w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent";

async function send(url: string, init: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

const hasNote = (l: HabitLogLite | null) =>
  !!l && !!(l.title || l.url || l.notes || l.code);

/** The person's own daily items, under the plan's checklist. */
export function HabitsPanel({
  initial,
  show,
  onDoneChange,
}: {
  initial: HabitLite[];
  show: (text: string) => void;
  /** Called with +1 or -1 when a habit is ticked or unticked today. */
  onDoneChange?: (delta: number) => void;
}) {
  const [habits, setHabits] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<HabitLite | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function deleteHabit(h: HabitLite) {
    if (busy.has(h.id)) return;

    setBusy((b) => new Set(b).add(h.id));

    try {
      await send(`/api/habits/${h.id}`, {
        method: "DELETE",
      });

      setHabits((hs) => hs.filter((x) => x.id !== h.id));

      if (editing?.id === h.id) {
        setEditing(null);
      }

      setDeleteTarget(null);
      show("Habit deleted.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't delete that habit.");
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(h.id);
        return next;
      });
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    try {
      const data = await send("/api/habits", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setHabits((hs) => [...hs, data.habit]);
      setDraft("");
      setAdding(false);
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't add that.");
    }
  }

  async function toggle(h: HabitLite) {
    if (busy.has(h.id)) return;
    const next = !h.today?.done;
    setBusy((b) => new Set(b).add(h.id));
    setHabits((hs) =>
      hs.map((x) =>
        x.id === h.id
          ? { ...x, today: { ...(x.today ?? emptyLog(x.id)), done: next } }
          : x,
      ),
    );
    try {
      const data = await send(`/api/habits/${h.id}/log`, {
        method: "PUT",
        body: JSON.stringify({ done: next }),
      });
      setHabits((hs) =>
        hs.map((x) =>
          x.id === h.id ? { ...x, today: data.log, streak: data.streak } : x,
        ),
      );
      const delta = Number(!!data.log?.done) - Number(!!h.today?.done);
      if (delta) onDoneChange?.(delta);
    } catch (err) {
      setHabits((hs) => hs.map((x) => (x.id === h.id ? h : x)));
      show(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(h.id);
        return n;
      });
    }
  }

  return (
    <section className="panel overflow-hidden" aria-labelledby="habits-heading">
      <div className="flex items-baseline justify-between gap-4 px-5 pt-5 sm:px-6">
        <h2
          id="habits-heading"
          className="text-[18px] font-semibold tracking-[-0.01em]"
        >
          Daily habits
        </h2>
        {habits.length > 0 && (
          <Link
            href="/habits"
            className="text-[13.5px] font-medium text-accent hover:underline"
          >
            Notes and history
          </Link>
        )}
      </div>
      {habits.length === 0 && !adding && (
        <p className="px-5 pt-1 text-[14px] text-faint sm:px-6">
          Things you do every day on top of your plan, like a LeetCode problem.
          Keep a short note for each day.
        </p>
      )}

      <div className="px-2 pb-2 pt-2">
        {habits.map((h) => (
          <div
            key={h.id}
            className="group flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors hover:bg-surface sm:px-4"
          >
            <CheckCircle
              checked={!!h.today?.done}
              onToggle={() => toggle(h)}
              label={h.title}
              disabled={busy.has(h.id)}
            />
            <button
              type="button"
              onClick={() => setEditing(h)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-[15.5px] leading-snug">
                {h.title}
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-faint">
                {h.streak > 0
                  ? `${h.streak}-day streak`
                  : "Start a streak today"}
                {h.today?.title && ` · ${h.today.title}`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEditing(h)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium text-accent transition-colors hover:bg-accent-soft"
            >
              <FileText className="h-3.5 w-3.5" />
              {hasNote(h.today) ? "Edit note" : "Add note"}
            </button>
            {/*Delete button for each thread on Daily habits section*/}

            <div className="relative shrink-0">
              {/* Delete button */}
              <button
                type="button"
                onClick={() =>
                  setDeleteTarget(deleteTarget === h.id ? null : h.id)
                }
                disabled={busy.has(h.id)}
                aria-label={`Delete ${h.title}`}
                title="Delete habit"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              {/* Confirmation popover above the delete button */}
              {deleteTarget === h.id && (
                <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-xl border border-line bg-white p-3 shadow-lg">
                  <p className="text-sm font-medium text-ink">
                    Delete this habit?
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Are you sure you want to delete "{h.title}"? This will also
                    delete its notes.
                  </p>

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteHabit(h)}
                      disabled={busy.has(h.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {busy.has(h.id) ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {adding ? (
          <form onSubmit={add} className="flex gap-2 px-3 py-2 sm:px-4">
            <input
              autoFocus
              className={`${field} h-10`}
              value={draft}
              maxLength={80}
              placeholder="LeetCode daily"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            />
            <button
              type="submit"
              className="btn-primary h-10 shrink-0 text-[14px]"
              disabled={!draft.trim()}
            >
              Add
            </button>
            <button
              type="button"
              className="btn-quiet h-10 shrink-0 text-[14px]"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mx-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-medium text-muted transition-colors hover:bg-surface hover:text-ink sm:px-4"
          >
            <Plus className="h-4 w-4" /> Add a habit
          </button>
        )}
      </div>

      <HabitNoteDialog
        habit={editing}
        log={editing?.today ?? null}
        onClose={() => setEditing(null)}
        onSaved={(log, streak) => {
          const before = habits.find((x) => x.id === log.habit_id)?.today?.done;
          const delta = Number(!!log.done) - Number(!!before);
          if (delta) onDoneChange?.(delta);
          setHabits((hs) =>
            hs.map((x) =>
              x.id === log.habit_id ? { ...x, today: log, streak } : x,
            ),
          );
          setEditing(null);
          show("Note saved.");
        }}
      />
    </section>
  );
}

function emptyLog(habitId: string): HabitLogLite {
  return {
    habit_id: habitId,
    day: "",
    done: false,
    title: "",
    url: "",
    notes: "",
    code: "",
  };
}

/** Editor for one day's note. With `day`, edits a past day; otherwise today. */
export function HabitNoteDialog({
  habit,
  log,
  day,
  onClose,
  onSaved,
}: {
  habit: { id: string; title: string } | null;
  log: HabitLogLite | null;
  day?: string;
  onClose: () => void;
  onSaved: (log: HabitLogLite, streak: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const [done, setDone] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!habit) return;
    setTitle(log?.title ?? "");
    setUrl(log?.url ?? "");
    setNotes(log?.notes ?? "");
    setCode(log?.code ?? "");
    setDone(log ? log.done || !hasNote(log) : true);
    setError(null);
    setTimeout(() => firstRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [habit, log, onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!habit) return;
    setBusy(true);
    setError(null);
    try {
      const data = await send(`/api/habits/${habit.id}/log`, {
        method: "PUT",
        body: JSON.stringify({ day, done, title, url, notes, code }),
      });
      onSaved(data.log, data.streak);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  // Tab inserts spaces in the code box instead of leaving it.
  function onCodeKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    const next = `${code.slice(0, s)}  ${code.slice(end)}`;
    setCode(next);
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
  }

  return (
    <AnimatePresence>
      {habit && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
            onClick={() => !busy && onClose()}
          />
          <motion.form
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lift"
          >
            <h2 id="note-title" className="text-[18px] font-semibold">
              {habit.title}
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              {day
                ? new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  })
                : "Today"}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[14px] font-medium">
                  What you worked on
                </span>
                <input
                  ref={firstRef}
                  className={`${field} mt-1.5 h-11`}
                  value={title}
                  maxLength={200}
                  placeholder="What you worked on"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-[14px] font-medium">Link (Optional)</span>
                <input
                  className={`${field} mt-1.5 h-11`}
                  value={url}
                  maxLength={500}
                  inputMode="url"
                  placeholder="Link (Optional)"
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-[14px] font-medium">
                Approach and notes
              </span>
              <textarea
                className={`${field} mt-1.5 min-h-[96px] resize-y py-2.5`}
                value={notes}
                maxLength={5000}
                placeholder="Approach and notes"
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-[14px] font-medium">Code (Optional)</span>
              <textarea
                className={`${field} mt-1.5 min-h-[160px] resize-y whitespace-pre bg-surface py-2.5 font-mono text-[13.5px] leading-relaxed`}
                value={code}
                maxLength={20000}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                wrap="off"
                placeholder="Code (Optional)"
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={onCodeKey}
              />
            </label>
            {error && <p className="mt-3 text-[14px] text-red-600">{error}</p>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2.5 text-[14.5px]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1F5EEA]"
                  checked={done}
                  onChange={(e) => setDone(e.target.checked)}
                />
                Done {day ? "that day" : "today"}
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-quiet h-10 text-[14px]"
                  onClick={onClose}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary h-10 text-[14px]"
                  disabled={busy}
                >
                  {busy ? "Saving" : "Save note"}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
