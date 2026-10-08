"use client";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Check, ChevronDown, Hammer, Plus, Snowflake } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Stats, Task } from "@/lib/data";
import type { RoadmapOutline, TaskType } from "@/lib/roadmap-schema";
import type { NewsItem } from "@/lib/news";
import { addDays, timeAgo } from "@/lib/dates";
import { TaskRow, TYPE_LABEL } from "./task-row";
import { Toast, useToast } from "./toast";
import { useProofEditor, type ProofLite } from "./proof-dialog";
import { HabitsPanel, type HabitLite } from "./habits-panel";

const canProve = (t: Task) => t.type === "build" || t.type === "connect";

type Phase = { title: string; done: number; total: number };
type Upcoming = { id: string; title: string; type: TaskType; minutes: number };
type NextBuild = { id: string; title: string; milestone: string; scheduledToday: boolean };

type Props = {
  greeting: string;
  dateLabel: string;
  initialTasks: Task[];
  initialStats: Stats;
  outline: RoadmapOutline;
  dailyMinutes: number;
  news: NewsItem[];
  proofs: Record<string, ProofLite>;
  habits: HabitLite[];
  today: string;
  /** Things done per day (plan tasks + habits), for the streak and activity grid. */
  activity: Record<string, number>;
  phases: Phase[];
  upcoming: Upcoming[];
  nextBuild: NextBuild | null;
  /** Days a streak freeze covered. */
  frozen: string[];
  /** Freezes used on this visit, to tell the person. */
  justFrozen: string[];
  /** Freezes left this month for Pro, null for free users. */
  freezesLeft: number | null;
};

const SETTLE_MS = 650;

function duration(m: number) {
  if (m < 60) return `${m} minutes`;
  if (m === 60) return "an hour";
  const h = m / 60;
  return Number.isInteger(h) ? `${h} hours` : `${Math.floor(h)} hr ${m % 60} min`;
}

/** Consecutive days ending today (or yesterday) that were active or covered by a freeze. */
function streakFrom(activity: Record<string, number>, today: string, frozen: Set<string>) {
  const kept = (d: string) => !!activity[d] || frozen.has(d);
  let cursor = kept(today) ? today : addDays(today, -1);
  let n = 0;
  while (kept(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

function longestFrom(activity: Record<string, number>, frozen: Set<string>) {
  const days = [...new Set([...Object.keys(activity).filter((d) => activity[d] > 0), ...frozen])].sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function Dashboard({
  greeting,
  dateLabel,
  initialTasks,
  initialStats,
  outline,
  dailyMinutes,
  news,
  proofs: initialProofs,
  habits,
  today,
  activity: initialActivity,
  phases: initialPhases,
  upcoming,
  nextBuild,
  frozen,
  justFrozen,
  freezesLeft,
}: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [stats, setStats] = useState(initialStats);
  const [activity, setActivity] = useState(initialActivity);
  const [phases, setPhases] = useState(initialPhases);
  const [settling, setSettling] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const { toast, show } = useToast();
  const proofEditor = useProofEditor(initialProofs, show);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!justFrozen.length) return;
    const names = justFrozen.map((d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }));
    show(`Your streak is safe. A streak freeze covered ${names.join(" and ")}.`);
  }, [justFrozen, show]);

  const bump = (delta: number) => setActivity((a) => ({ ...a, [today]: Math.max(0, (a[today] ?? 0) + delta) }));

  const open = tasks.filter((t) => !t.completed_on || settling.has(t.id));
  const done = tasks.filter((t) => t.completed_on && !settling.has(t.id));
  const doneCount = tasks.filter((t) => t.completed_on).length;
  const totalMinutes = tasks.reduce((s, t) => s + t.minutes, 0);
  const leftMinutes = tasks.filter((t) => !t.completed_on).reduce((s, t) => s + t.minutes, 0);
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const roadmapFinished = stats.total > 0 && stats.completed === stats.total;
  const onToday = new Set(tasks.map((t) => t.id));
  const comingUp = upcoming.filter((u) => !onToday.has(u.id)).slice(0, 3);
  const buildDone = nextBuild ? tasks.some((t) => t.id === nextBuild.id && t.completed_on) : false;

  const subtitle = allDone
    ? null
    : doneCount > 0
      ? `About ${duration(leftMinutes)} left`
      : totalMinutes > dailyMinutes
        ? `About ${duration(totalMinutes)} today, longer than your usual ${duration(dailyMinutes)}. Anything you don't finish moves to tomorrow.`
        : `About ${duration(totalMinutes)} today`;

  async function toggle(task: Task) {
    if (busy.has(task.id)) return;
    const next = !task.completed_on;
    const previous = task.completed_on;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed_on: next ? "pending" : null, skipped: false } : t)));
    setBusy((b) => new Set(b).add(task.id));

    if (next) {
      try {
        navigator.vibrate?.(8);
      } catch {}
      setSettling((s) => new Set(s).add(task.id));
      const existing = timers.current.get(task.id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        task.id,
        setTimeout(() => {
          setSettling((s) => {
            const n = new Set(s);
            n.delete(task.id);
            return n;
          });
          timers.current.delete(task.id);
        }, SETTLE_MS)
      );
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save that change.");
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed_on: data.task.completed_on, skipped: false } : t)));
      setStats(data.stats);
      setPhases((ps) => ps.map((p, i) => (i === task.phase_index ? { ...p, done: Math.max(0, p.done + (next ? 1 : -1)) } : p)));
      // Unticking only removes activity if it was counted today.
      if (next) bump(1);
      else if (previous === today && !task.skipped) bump(-1);
      // Finishing a build task is the moment people have something to show.
      if (next && task.type === "build" && !proofEditor.proofs[task.id]) proofEditor.open(task.id, task.title, true);
    } catch (e) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed_on: previous } : t)));
      setSettling((s) => {
        const n = new Set(s);
        n.delete(task.id);
        return n;
      });
      show(e instanceof Error ? e.message : "Couldn't save that change. Check your connection and try again.");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(task.id);
        return n;
      });
    }
  }

  async function addMore() {
    setAdding(true);
    try {
      const res = await fetch("/api/today/extra", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't add more tasks.");
      const before = tasks.length;
      setTasks(data.tasks);
      setStats(data.stats);
      if (data.tasks.length === before) show("You've reached the end of your roadmap.");
    } catch (e) {
      show(e instanceof Error ? e.message : "Couldn't add more tasks.");
    } finally {
      setAdding(false);
    }
  }

  const phase = stats.current ? outline.phases[stats.current.phaseIndex] : null;
  const milestone = phase && stats.current ? phase.milestones[stats.current.milestoneIndex] : null;

  return (
    <>
      <div className="mb-7">
        <p className="text-[14.5px] text-muted">{dateLabel}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[34px]">{greeting}</h1>
        <PathStrip phases={phases} current={stats.current?.phaseIndex ?? null} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        {/* Checklist and habits */}
        <div className="space-y-5">
          <section className="panel overflow-hidden" aria-labelledby="today-heading">
            <div className="px-5 pb-4 pt-5 sm:px-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="today-heading" className="text-[18px] font-semibold tracking-[-0.01em]">
                  Today&apos;s checklist
                </h2>
                <p className="tabular text-[14px] text-muted">
                  {doneCount} of {tasks.length} done
                </p>
              </div>
              {subtitle && <p className="mt-1 text-[14px] text-faint">{subtitle}</p>}
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-sunk">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={false}
                  animate={{ width: tasks.length ? `${(doneCount / tasks.length) * 100}%` : "0%" }}
                  transition={{ type: "spring", stiffness: 180, damping: 26 }}
                />
              </div>
            </div>

            <LayoutGroup>
              <div className="px-2 pb-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {allDone && !settling.size ? (
                    <motion.div
                      key="all-done"
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      className="mx-1 mb-2 flex flex-col gap-4 rounded-2xl bg-accent-soft/60 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
                    >
                      <DoneBadge />
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-semibold">{roadmapFinished ? "You finished your whole roadmap" : "Done for today"}</p>
                        <p className="text-[14px] text-muted">
                          {roadmapFinished ? (
                            <>
                              Every task, done. Start a new path from{" "}
                              <Link href="/settings" className="font-medium text-accent hover:underline">
                                Settings
                              </Link>{" "}
                              when you&apos;re ready.
                            </>
                          ) : (
                            `You put in about ${duration(totalMinutes)}. Tomorrow's list is ready when you are.`
                          )}
                        </p>
                      </div>
                      {!roadmapFinished && (
                        <button type="button" onClick={addMore} disabled={adding} className="btn-outline h-9 shrink-0 bg-white px-4 text-[14px]">
                          <Plus className="h-4 w-4" />
                          {adding ? "Adding" : "Add 30 more minutes"}
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    open.map((t) => (
                      <motion.div
                        key={t.id}
                        layout="position"
                        layoutId={`task-${t.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 38 }}
                      >
                        <TaskRow
                          {...t}
                          checked={!!t.completed_on}
                          busy={busy.has(t.id)}
                          onToggle={() => toggle(t)}
                          proofUrl={proofEditor.proofs[t.id]?.url}
                          onProof={canProve(t) ? () => proofEditor.open(t.id, t.title) : undefined}
                        />
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>

                {tasks.length === 0 && (
                  <div className="px-4 pb-4 pt-1 text-[14.5px] text-muted">
                    Nothing is scheduled for today.{" "}
                    {roadmapFinished ? (
                      "Your roadmap is complete."
                    ) : (
                      <button type="button" onClick={addMore} disabled={adding} className="font-medium text-accent hover:underline">
                        Pull in the next task
                      </button>
                    )}
                  </div>
                )}

                {comingUp.length > 0 && !roadmapFinished && (
                  <div className="mx-2 mt-1 border-t border-line px-2 pb-2 pt-3 sm:px-3">
                    <p className="text-[12.5px] font-medium uppercase tracking-[0.06em] text-faint">{allDone ? "Up next" : "Coming up after today"}</p>
                    <ul className="mt-1.5">
                      {comingUp.map((u) => (
                        <li key={u.id} className="flex items-center gap-3 py-2">
                          <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-dashed border-line-strong" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink-soft">{u.title}</span>
                          <span className="hidden shrink-0 text-[12.5px] text-faint sm:inline">{TYPE_LABEL[u.type]}</span>
                          <span className="tabular w-12 shrink-0 text-right text-[12.5px] text-faint">{u.minutes} min</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {done.length > 0 && (
                  <div className="mt-1 border-t border-line pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDone((s) => !s)}
                      aria-expanded={showDone}
                      className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-[14px] font-medium text-muted transition-colors hover:bg-surface"
                    >
                      <ChevronDown className={clsx("h-4 w-4 transition-transform duration-300 ease-emphasized", !showDone && "-rotate-90")} />
                      Completed today ({done.length})
                    </button>
                    <AnimatePresence initial={false}>
                      {showDone && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                          className="overflow-hidden"
                        >
                          {done.map((t) => (
                            <motion.div key={t.id} layoutId={`task-${t.id}`} transition={{ type: "spring", stiffness: 420, damping: 38 }}>
                              <TaskRow
                                {...t}
                                checked
                                busy={busy.has(t.id)}
                                onToggle={() => toggle(t)}
                                proofUrl={proofEditor.proofs[t.id]?.url}
                                onProof={canProve(t) ? () => proofEditor.open(t.id, t.title) : undefined}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </LayoutGroup>
          </section>

          <HabitsPanel initial={habits} show={show} onDoneChange={bump} />
          {news.length > 0 && (
            <section className="pt-3" aria-labelledby="news-heading">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 id="news-heading" className="text-[18px] font-semibold tracking-[-0.01em]">
                  In your field today
                </h2>
                <Link href="/news" className="text-[14px] font-medium text-accent hover:underline">
                  All news
                </Link>
              </div>
              <ul className="panel divide-y divide-line">
                {news.map((n) => (
                  <li key={n.id}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="block px-5 py-4 transition-colors hover:bg-surface sm:px-6">
                      <p className="text-[15.5px] font-medium leading-snug">{n.title}</p>
                      <p className="mt-1 text-[13px] text-faint">
                        {n.source}, {timeAgo(n.publishedAt)}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="grid content-start gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <ActivityCard activity={activity} today={today} frozen={frozen} freezesLeft={freezesLeft} />

          <section className="panel p-5" aria-labelledby="milestone-heading">
            <h2 id="milestone-heading" className="text-[14px] font-medium text-muted">
              Now working on
            </h2>
            {milestone && phase ? (
              <>
                <p className="mt-2 text-[16.5px] font-semibold leading-snug tracking-[-0.01em]">{milestone.title}</p>
                {milestone.outcome && <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{milestone.outcome}</p>}
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunk">
                    <motion.div
                      className="h-full rounded-full bg-ink"
                      initial={false}
                      animate={{ width: `${stats.milestoneTotal ? (stats.milestoneDone / stats.milestoneTotal) * 100 : 0}%` }}
                      transition={{ type: "spring", stiffness: 180, damping: 26 }}
                    />
                  </div>
                  <span className="tabular text-[13px] text-muted">
                    {stats.milestoneDone}/{stats.milestoneTotal}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-[16px] font-semibold">Every milestone complete</p>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <span className="tabular text-[13.5px] text-muted">{stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}% of roadmap</span>
              <Link href="/roadmap" className="text-[13.5px] font-medium text-accent hover:underline">
                See roadmap
              </Link>
            </div>
          </section>

          {nextBuild && !buildDone && (
            <section className="panel p-5" aria-labelledby="build-heading">
              <h2 id="build-heading" className="flex items-center gap-2 text-[14px] font-medium text-muted">
                <Hammer className="h-4 w-4" /> Next build
              </h2>
              <p className="mt-2 text-[15.5px] font-semibold leading-snug">{nextBuild.title}</p>
              {nextBuild.milestone && <p className="mt-1 text-[13px] text-faint">{nextBuild.milestone}</p>}
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
                When it&apos;s done, add a link to it. It goes on your{" "}
                <Link href="/profile" className="font-medium text-accent hover:underline">
                  public profile
                </Link>
                .
              </p>
              {nextBuild.scheduledToday && <p className="mt-3 inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-[12.5px] font-medium text-accent">On today&apos;s list</p>}
            </section>
          )}
        </div>
      </div>


      {proofEditor.dialog}
      <Toast message={toast} />
    </>
  );
}

/** Where the person is in their plan: four phases, the current one highlighted. */
function PathStrip({ phases, current }: { phases: Phase[]; current: number | null }) {
  return (
    <ol className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4" aria-label="Your path">
      {phases.map((p, i) => {
        const complete = p.total > 0 && p.done === p.total;
        const active = i === current;
        const pct = p.total ? (p.done / p.total) * 100 : 0;
        return (
          <li key={i} aria-current={active ? "step" : undefined}>
            <div className="flex items-center gap-1.5">
              {complete && <Check className="h-3.5 w-3.5 text-accent" strokeWidth={3} />}
              <span className={clsx("truncate text-[13px]", active ? "font-semibold text-ink" : complete ? "font-medium text-ink-soft" : "text-faint")}>{p.title}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunk">
              <motion.div
                className={clsx("h-full rounded-full", complete || active ? "bg-accent" : "bg-line-strong")}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 26 }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const WEEKS = 12;

/** Streak plus a 12-week grid of active days (plan tasks and habits together). */
function ActivityCard({ activity, today, frozen, freezesLeft }: { activity: Record<string, number>; today: string; frozen: string[]; freezesLeft: number | null }) {
  const frozenSet = useMemo(() => new Set(frozen), [frozen]);
  const streak = streakFrom(activity, today, frozenSet);
  const longest = Math.max(streak, longestFrom(activity, frozenSet));
  const week = Array.from({ length: 7 }, (_, i) => activity[addDays(today, -i)] ?? 0).reduce((a, b) => a + b, 0);

  const columns = useMemo(() => {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    const start = addDays(today, -dow - (WEEKS - 1) * 7);
    return Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  }, [today]);

  const shade = (n: number) => (n <= 0 ? "bg-surface-sunk" : n === 1 ? "bg-accent/30" : n === 2 ? "bg-accent/55" : n === 3 ? "bg-accent/80" : "bg-accent");

  return (
    <section className="panel p-5" aria-labelledby="streak-heading">
      <h2 id="streak-heading" className="text-[14px] font-medium text-muted">
        Streak
      </h2>
      <div className="mt-1 flex items-baseline gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={streak}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="tabular text-[40px] font-semibold leading-none tracking-[-0.03em]"
          >
            {streak}
          </motion.span>
        </AnimatePresence>
        <span className="text-[14.5px] text-muted">{streak === 1 ? "day" : "days"} in a row</span>
      </div>
      <p className="mt-1.5 text-[13px] text-faint">
        Longest {longest} · {week} done in the last 7 days
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-faint">
        <Snowflake className="h-3.5 w-3.5" />
        {freezesLeft === null ? (
          <>
            <Link href="/pro" className="hover:text-accent">
              Pro keeps your streak safe on missed days
            </Link>
          </>
        ) : (
          `${freezesLeft} streak ${freezesLeft === 1 ? "freeze" : "freezes"} left this month`
        )}
      </p>

      <div className="mt-4 grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`Activity over the last ${WEEKS} weeks`}>
        {columns.flat().map((d) =>
          d > today ? (
            <span key={d} className="aspect-square" />
          ) : frozenSet.has(d) && !activity[d] ? (
            <span key={d} title={`Streak freeze on ${new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`} className="aspect-square rounded-[3px] bg-sky-100 ring-1 ring-inset ring-sky-300" />
          ) : (
            <span
              key={d}
              title={`${activity[d] ?? 0} done on ${new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`}
              className={clsx("aspect-square rounded-[3px] transition-colors", shade(activity[d] ?? 0), d === today && "ring-1 ring-ink/40 ring-offset-1")}
            />
          )
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-faint">
        Less
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} className={clsx("h-2.5 w-2.5 rounded-[2px]", shade(n))} />
        ))}
        More
      </div>
    </section>
  );
}

function DoneBadge() {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
    </motion.div>
  );
}
