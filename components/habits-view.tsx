"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Pencil } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import { PageHeader } from "./page-header";
import { Toast, useToast } from "./toast";
import { HabitNoteDialog, type HabitLogLite } from "./habits-panel";

type Habit = { id: string; title: string; position: number; archived: boolean };

async function send(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function HabitsView({
  habits,
  selectedId,
  entries: initialEntries,
  streak,
  doneDays,
  today,
  paged,
}: {
  habits: Habit[];
  selectedId: string | null;
  entries: HabitLogLite[];
  streak: number;
  doneDays: number;
  today: string;
  paged: boolean;
}) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [entries, setEntries] = useState(initialEntries);
  const [editing, setEditing] = useState<HabitLogLite | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = habits.find((h) => h.id === selectedId) ?? null;
  const [name, setName] = useState(selected?.title ?? "");

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await send(`/api/habits/${selected.id}`, { method: "PATCH", body: JSON.stringify({ title: name }) });
      setRenaming(false);
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't rename it.");
    }
  }

  async function setArchived(archived: boolean) {
    if (!selected) return;
    try {
      await send(`/api/habits/${selected.id}`, { method: "PATCH", body: JSON.stringify({ archived }) });
      show(archived ? "Archived. It's off your dashboard, and its notes are kept." : "Back on your dashboard.");
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't change that.");
    }
  }

  async function remove() {
    if (!selected) return;
    try {
      await send(`/api/habits/${selected.id}`, { method: "DELETE" });
      router.replace("/habits");
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't delete it.");
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      show("Code copied.");
    } catch {
      show("Couldn't copy.");
    }
  }

  if (!habits.length) {
    return (
      <>
        <PageHeader title="Habits" description="Your own daily items and the notes you keep for them." />
        <div className="panel p-6 text-[15px] text-muted">
          No habits yet. Add one from{" "}
          <Link href="/dashboard" className="font-medium text-accent hover:underline">
            Today
          </Link>
          , like &ldquo;LeetCode daily&rdquo;.
        </div>
      </>
    );
  }

  const oldest = entries[entries.length - 1]?.day;

  return (
    <>
      <PageHeader title="Habits" description="Your own daily items and the notes you keep for them." />

      <nav className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Habits">
        {habits.map((h) => (
          <Link
            key={h.id}
            href={`/habits?h=${h.id}`}
            className={clsx(
              "shrink-0 rounded-full px-4 py-2 text-[14px] font-medium transition-colors",
              h.id === selectedId ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-line hover:bg-surface",
              h.archived && h.id !== selectedId && "text-faint"
            )}
          >
            {h.title}
            {h.archived && " (archived)"}
          </Link>
        ))}
      </nav>

      {selected && (
        <div className="space-y-5">
          <section className="panel p-5 sm:p-6">
            {renaming ? (
              <form onSubmit={rename} className="flex gap-2">
                <input
                  autoFocus
                  className="h-10 w-full rounded-xl border border-line px-3.5 text-[15px] outline-none focus:border-accent"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
                <button type="submit" className="btn-primary h-10 shrink-0 text-[14px]">
                  Save
                </button>
                <button type="button" className="btn-quiet h-10 shrink-0 text-[14px]" onClick={() => setRenaming(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{selected.title}</h2>
                  <p className="mt-0.5 text-[14.5px] text-muted">
                    {streak > 0 ? `${streak}-day streak` : "No current streak"} · {doneDays} day{doneDays === 1 ? "" : "s"} done in the past year
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="btn-quiet h-9 px-3 text-[14px]" onClick={() => setEditing({ habit_id: selected.id, day: today, done: false, title: "", url: "", notes: "", code: "", ...entries.find((e) => e.day === today) })}>
                    Today&apos;s note
                  </button>
                  <button type="button" className="btn-quiet h-9 px-3 text-[14px]" onClick={() => setRenaming(true)}>
                    Rename
                  </button>
                  <button type="button" className="btn-quiet h-9 px-3 text-[14px]" onClick={() => setArchived(!selected.archived)}>
                    {selected.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button type="button" className="btn-quiet h-9 px-3 text-[14px] text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </button>
                </div>
              </div>
            )}
            {confirmDelete && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] text-red-700">Delete this habit and every note in it? This can&apos;t be undone. Archive keeps the notes.</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn-quiet h-9 px-3 text-[14px]" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </button>
                  <button type="button" className="btn h-9 bg-red-600 px-4 text-[14px] text-white hover:bg-red-700" onClick={remove}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </section>

          {entries.length === 0 ? (
            <p className="panel p-6 text-[15px] text-muted">{paged ? "No older entries." : "No entries yet. Tick it off on Today, or add today's note above."}</p>
          ) : (
            <ol className="space-y-3">
              {entries.map((e) => (
                <li key={e.day} className="panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13px] font-medium text-faint">
                        {e.done && (
                          <span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        {dayLabel(e.day)}
                      </p>
                      {e.title &&
                        (e.url ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 flex items-center gap-1.5 text-[16px] font-semibold hover:text-accent">
                            {e.title} <ExternalLink className="h-3.5 w-3.5 text-faint" />
                          </a>
                        ) : (
                          <p className="mt-1 text-[16px] font-semibold">{e.title}</p>
                        ))}
                      {!e.title && e.url && (
                        <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block truncate text-[14.5px] text-accent hover:underline">
                          {e.url}
                        </a>
                      )}
                    </div>
                    <button type="button" aria-label={`Edit the note for ${dayLabel(e.day)}`} className="btn-quiet h-8 shrink-0 px-2.5" onClick={() => setEditing(e)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  {e.notes && <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-soft">{e.notes}</p>}
                  {e.code && (
                    <div className="relative mt-3">
                      <pre className="max-h-[360px] overflow-auto rounded-xl bg-ink px-4 py-3.5 font-mono text-[13px] leading-relaxed text-white/90">
                        <code>{e.code}</code>
                      </pre>
                      <button type="button" aria-label="Copy code" onClick={() => copy(e.code)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {!e.title && !e.url && !e.notes && !e.code && <p className="mt-1 text-[14px] text-faint">No note</p>}
                </li>
              ))}
            </ol>
          )}

          <div className="flex justify-between">
            {paged ? (
              <Link href={`/habits?h=${selected.id}`} className="btn-quiet h-10 text-[14px]">
                Back to latest
              </Link>
            ) : (
              <span />
            )}
            {entries.length === 30 && oldest && (
              <Link href={`/habits?h=${selected.id}&before=${oldest}`} className="btn-outline h-10 text-[14px]">
                Older entries
              </Link>
            )}
          </div>
        </div>
      )}

      <HabitNoteDialog
        habit={editing && selected ? { id: selected.id, title: selected.title } : null}
        log={editing}
        day={editing?.day || today}
        onClose={() => setEditing(null)}
        onSaved={(log) => {
          setEntries((all) => (all.some((x) => x.day === log.day) ? all.map((x) => (x.day === log.day ? log : x)) : [log, ...all].sort((a, b) => b.day.localeCompare(a.day))));
          setEditing(null);
          show("Note saved.");
          router.refresh();
        }}
      />
      <Toast message={toast} />
    </>
  );
}
