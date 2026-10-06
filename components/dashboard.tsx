"use client";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Stats, Task } from "@/lib/data";
import type { RoadmapOutline } from "@/lib/roadmap-schema";
import type { NewsItem } from "@/lib/news";
import { timeAgo, weekdayShort } from "@/lib/dates";
import { TaskRow } from "./task-row";
import { Toast, useToast } from "./toast";

type Props = {
  greeting: string;
  dateLabel: string;
  initialTasks: Task[];
  initialStats: Stats;
  outline: RoadmapOutline;
  dailyMinutes: number;
  news: NewsItem[];
};

const SETTLE_MS = 650;

export function Dashboard({ greeting, dateLabel, initialTasks, initialStats, outline, dailyMinutes, news }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [stats, setStats] = useState(initialStats);
  const [settling, setSettling] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const { toast, show } = useToast();

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const open = tasks.filter((t) => !t.completed_on || settling.has(t.id));
  const done = tasks.filter((t) => t.completed_on && !settling.has(t.id));
  const doneCount = tasks.filter((t) => t.completed_on).length;
  const totalMinutes = tasks.reduce((s, t) => s + t.minutes, 0);
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const roadmapFinished = stats.total > 0 && stats.completed === stats.total;

  async function toggle(task: Task) {
    if (busy.has(task.id)) return;
    const next = !task.completed_on;
    const previous = task.completed_on;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed_on: next ? "pending" : null } : t)));
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
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed_on: data.task.completed_on } : t)));
      setStats(data.stats);
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
      <div className="mb-8">
        <p className="text-[14.5px] text-muted">{dateLabel}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[34px]">{greeting}</h1>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        {/* Checklist */}
        <section className="panel overflow-hidden" aria-labelledby="today-heading">
          <div className="px-5 pb-4 pt-5 sm:px-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="today-heading" className="text-[18px] font-semibold tracking-[-0.01em]">
                Today's checklist
              </h2>
              <p className="tabular text-[14px] text-muted">
                {doneCount} of {tasks.length} done
              </p>
            </div>
            <p className="mt-1 text-[14px] text-faint">
              About {totalMinutes} minutes, planned for your {dailyMinutes}-minute day
            </p>
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
            <div className="px-2 pb-2 sm:px-2">
              <AnimatePresence initial={false} mode="popLayout">
                {allDone && !settling.size ? (
                  <motion.div
                    key="all-done"
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    className="mx-2 mb-3 flex flex-col items-center rounded-2xl bg-surface px-6 py-9 text-center"
                  >
                    <DoneBadge />
                    <h3 className="mt-4 text-[18px] font-semibold">
                      {roadmapFinished ? "You finished your whole roadmap" : "You're done for today"}
                    </h3>
                    <p className="mt-1.5 max-w-sm text-[14.5px] text-muted">
                      {roadmapFinished
                        ? "That's every task. Head to settings to start a new path whenever you're ready."
                        : "Come back tomorrow for the next step, or keep the momentum going now."}
                    </p>
                    {!roadmapFinished && (
                      <button type="button" onClick={addMore} disabled={adding} className="btn-outline mt-5 h-10 text-[14px]">
                        <Plus className="h-4 w-4" />
                        {adding ? "Adding tasks" : "Add 30 more minutes"}
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
                      <TaskRow {...t} checked={!!t.completed_on} busy={busy.has(t.id)} onToggle={() => toggle(t)} />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>

              {tasks.length === 0 && (
                <div className="px-4 pb-6 pt-2 text-[14.5px] text-muted">
                  Nothing is scheduled for today. Your roadmap may be complete.{" "}
                  <Link href="/roadmap" className="font-medium text-accent hover:underline">
                    Open your roadmap
                  </Link>
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
                    Completed ({done.length})
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
                            <TaskRow {...t} checked busy={busy.has(t.id)} onToggle={() => toggle(t)} />
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

        {/* Side column */}
        <div className="grid content-start gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <StreakCard stats={stats} />
          <section className="panel p-5" aria-labelledby="milestone-heading">
            <h2 id="milestone-heading" className="text-[14px] font-medium text-muted">
              Now working on
            </h2>
            {milestone && phase ? (
              <>
                <p className="mt-2 text-[16.5px] font-semibold leading-snug tracking-[-0.01em]">{milestone.title}</p>
                <p className="mt-1 text-[13.5px] text-faint">{phase.title}</p>
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
              <span className="tabular text-[13.5px] text-muted">
                {stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}% of roadmap
              </span>
              <Link href="/roadmap" className="text-[13.5px] font-medium text-accent hover:underline">
                See roadmap
              </Link>
            </div>
          </section>
        </div>
      </div>

      {news.length > 0 && (
        <section className="mt-10" aria-labelledby="news-heading">
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

      <Toast message={toast} />
    </>
  );
}

function StreakCard({ stats }: { stats: Stats }) {
  const max = useMemo(() => Math.max(1, ...stats.week.map((d) => d.count)), [stats.week]);
  return (
    <section className="panel p-5" aria-labelledby="streak-heading">
      <h2 id="streak-heading" className="text-[14px] font-medium text-muted">
        Streak
      </h2>
      <div className="mt-1 flex items-baseline gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={stats.streak}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="tabular text-[40px] font-semibold leading-none tracking-[-0.03em]"
          >
            {stats.streak}
          </motion.span>
        </AnimatePresence>
        <span className="text-[14.5px] text-muted">{stats.streak === 1 ? "day" : "days"} in a row</span>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1.5" role="img" aria-label="Tasks completed over the last seven days">
        {stats.week.map((d, i) => {
          const isToday = i === stats.week.length - 1;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <div className="flex h-12 w-full items-end overflow-hidden rounded-md bg-surface-sunk">
                <motion.div
                  className={clsx("w-full rounded-md", isToday ? "bg-accent" : "bg-ink")}
                  initial={false}
                  animate={{ height: d.count ? `${Math.max(18, (d.count / max) * 100)}%` : "0%" }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                />
              </div>
              <span className={clsx("text-[11.5px]", isToday ? "font-semibold text-ink" : "text-faint")}>{weekdayShort(d.date).slice(0, 2)}</span>
            </div>
          );
        })}
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
      className="grid h-14 w-14 place-items-center rounded-full bg-accent"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="#fff"
          strokeWidth="2.8"
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
