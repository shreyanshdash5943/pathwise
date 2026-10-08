"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { Task } from "@/lib/data";
import type { RoadmapOutline } from "@/lib/roadmap-schema";
import { TaskRow } from "./task-row";
import { Toast, useToast } from "./toast";
import { useProofEditor, type ProofLite } from "./proof-dialog";
import { TaskEditDialog, type TaskDraft } from "./task-edit-dialog";
import { ProBadge } from "./pro-badge";

type MState = "done" | "current" | "upcoming";

export function RoadmapView({
  outline,
  initialTasks,
  proofs: initialProofs,
  pro,
  hiddenCount,
  edited,
}: {
  outline: RoadmapOutline;
  initialTasks: Task[];
  roleTitle?: string;
  proofs: Record<string, ProofLite>;
  pro: boolean;
  hiddenCount: number;
  edited: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  // After an edit the server sends the new task list; take it.
  useEffect(() => setTasks(initialTasks), [initialTasks]);
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ phase: number; milestone: number; task: Task | null } | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const { toast, show } = useToast();
  const proofEditor = useProofEditor(initialProofs, show);

  const firstOpen = tasks.find((t) => !t.completed_on);
  const currentKey = firstOpen ? `${firstOpen.phase_index}-${firstOpen.milestone_index}` : null;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(currentKey ? [currentKey] : []));

  const byMilestone = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const k = `${t.phase_index}-${t.milestone_index}`;
      const list = map.get(k);
      if (list) list.push(t);
      else map.set(k, [t]);
    }
    return map;
  }, [tasks]);

  const completed = tasks.filter((t) => t.completed_on).length;
  const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  function stateOf(key: string): MState {
    const list = byMilestone.get(key) ?? [];
    if (list.length && list.every((t) => t.completed_on)) return "done";
    return key === currentKey ? "current" : "upcoming";
  }

  function toggleExpanded(key: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function toggleTask(task: Task) {
    if (busy.has(task.id)) return;
    const next = !task.completed_on;
    const prev = task.completed_on;
    setBusy((b) => new Set(b).add(task.id));
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed_on: next ? "pending" : null, skipped: false } : t)));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save that change.");
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed_on: data.task.completed_on, skipped: false } : t)));
      if (next && task.type === "build" && !proofEditor.proofs[task.id]) proofEditor.open(task.id, task.title, true);
    } catch (e) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed_on: prev } : t)));
      show(e instanceof Error ? e.message : "Couldn't save that change.");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(task.id);
        return n;
      });
    }
  }

  async function call(url: string, init: RequestInit, done?: string) {
    setWorking(true);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save that change.");
      if (done) show(done);
      router.refresh();
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save that change.";
      show(msg);
      return msg;
    } finally {
      setWorking(false);
    }
  }

  async function saveTask(draft: TaskDraft) {
    if (!dialog) return null;
    const err = dialog.task
      ? await call(`/api/plan/tasks/${dialog.task.id}`, { method: "PATCH", body: JSON.stringify(draft) }, "Task updated.")
      : await call("/api/plan/tasks", { method: "POST", body: JSON.stringify({ ...draft, phaseIndex: dialog.phase, milestoneIndex: dialog.milestone }) }, "Task added.");
    if (!err) setDialog(null);
    return err;
  }

  return (
    <>
      <div className="mb-10">
        <h1 className="max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[34px]">{outline.title}</h1>
        {outline.summary && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted">{outline.summary}</p>}
        <div className="mt-6 flex max-w-md items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunk">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 24, delay: 0.1 }}
            />
          </div>
          <span className="tabular text-[14px] text-muted">
            {completed} of {tasks.length} tasks
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {pro ? (
            <button type="button" className={editing ? "btn-primary h-9 px-4 text-[14px]" : "btn-outline h-9 px-4 text-[14px]"} onClick={() => setEditing((e) => !e)}>
              <Pencil className="h-4 w-4" /> {editing ? "Done editing" : "Edit roadmap"}
            </button>
          ) : (
            <Link href="/pro" className="btn-outline h-9 px-4 text-[14px]">
              <Pencil className="h-4 w-4 text-muted" /> Edit roadmap <ProBadge className="pointer-events-none ml-1" />
            </Link>
          )}
          {(editing || !pro) && hiddenCount > 0 && (
            <button type="button" className="btn-quiet h-9 px-3 text-[14px]" disabled={working} onClick={() => call("/api/plan/reset", { method: "POST", body: JSON.stringify({ only: "removed" }) }, "Removed tasks are back.")}>
              Restore {hiddenCount} removed {hiddenCount === 1 ? "task" : "tasks"}
            </button>
          )}
          {(editing || !pro) && edited && (
            <button type="button" className="btn-quiet h-9 px-3 text-[14px]" disabled={working} onClick={() => call("/api/plan/reset", { method: "POST", body: "{}" }, "Your plan is back to the original.")}>
              Reset to the original plan
            </button>
          )}
        </div>
        {editing && (
          <p className="mt-3 max-w-2xl rounded-xl bg-accent-soft/60 px-4 py-3 text-[14px] text-ink-soft">
            Open a milestone to move, remove or add tasks. Changes save straight away, and today&apos;s checklist follows the new order.
          </p>
        )}
      </div>

      <ol className="space-y-10">
        {outline.phases.map((phase, pi) => (
          <li key={pi}>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="tabular text-[14px] font-semibold text-faint">Phase {pi + 1}</span>
              <h2 className="text-[20px] font-semibold tracking-[-0.015em]">{phase.title}</h2>
            </div>
            {phase.summary && <p className="mb-5 max-w-2xl text-[15px] text-muted">{phase.summary}</p>}

            <ol className="panel overflow-hidden">
              {phase.milestones.map((m, mi) => {
                const key = `${pi}-${mi}`;
                const list = byMilestone.get(key) ?? [];
                const doneHere = list.filter((t) => t.completed_on).length;
                const state = stateOf(key);
                const isOpen = expanded.has(key);
                const last = mi === phase.milestones.length - 1;
                return (
                  <li key={key} className={clsx(!last && "border-b border-line")}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-surface sm:px-6"
                    >
                      <MilestoneNode state={state} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={clsx("text-[16px] font-semibold leading-snug", state === "upcoming" ? "text-ink-soft" : "text-ink")}>{m.title}</span>
                          {state === "current" && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">You're here</span>}
                        </span>
                        {m.outcome && <span className="mt-1 block text-[14px] leading-relaxed text-muted">{m.outcome}</span>}
                      </span>
                      <span className="tabular hidden shrink-0 pt-0.5 text-[13.5px] text-faint sm:block">
                        {doneHere}/{list.length}
                      </span>
                      <ChevronDown className={clsx("mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform duration-300 ease-emphasized", isOpen && "rotate-180")} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-2 pb-3 sm:pl-10 sm:pr-3">
                            {list.map((t, ti) => (
                              <div key={t.id} className="flex items-start gap-1">
                                <div className="min-w-0 flex-1">
                                  <TaskRow
                                    {...t}
                                    checked={!!t.completed_on}
                                    busy={busy.has(t.id)}
                                    onToggle={() => toggleTask(t)}
                                    proofUrl={proofEditor.proofs[t.id]?.url}
                                    onProof={t.type === "build" || t.type === "connect" ? () => proofEditor.open(t.id, t.title) : undefined}
                                  />
                                </div>
                                {editing && (
                                  <div className="flex shrink-0 items-center gap-0.5 pt-2.5">
                                    <IconButton label="Move up" disabled={working || ti === 0} onClick={() => call(`/api/plan/tasks/${t.id}/move`, { method: "POST", body: JSON.stringify({ direction: "up" }) })}>
                                      <ArrowUp className="h-4 w-4" />
                                    </IconButton>
                                    <IconButton label="Move down" disabled={working || ti === list.length - 1} onClick={() => call(`/api/plan/tasks/${t.id}/move`, { method: "POST", body: JSON.stringify({ direction: "down" }) })}>
                                      <ArrowDown className="h-4 w-4" />
                                    </IconButton>
                                    {t.custom && (
                                      <IconButton label="Edit task" disabled={working} onClick={() => setDialog({ phase: t.phase_index, milestone: t.milestone_index, task: t })}>
                                        <Pencil className="h-4 w-4" />
                                      </IconButton>
                                    )}
                                    {confirmRemove === t.id ? (
                                      <button
                                        type="button"
                                        className="h-8 rounded-lg bg-red-600 px-2.5 text-[13px] font-medium text-white hover:bg-red-700"
                                        disabled={working}
                                        onClick={() => {
                                          setConfirmRemove(null);
                                          call(`/api/plan/tasks/${t.id}`, { method: "DELETE" }, t.custom ? "Task deleted." : "Task removed. You can restore it any time.");
                                        }}
                                      >
                                        Remove
                                      </button>
                                    ) : (
                                      <IconButton label="Remove task" disabled={working} onClick={() => setConfirmRemove(t.id)}>
                                        <Trash2 className="h-4 w-4" />
                                      </IconButton>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {editing && (
                              <button
                                type="button"
                                onClick={() => setDialog({ phase: pi, milestone: mi, task: null })}
                                className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-medium text-accent transition-colors hover:bg-accent-soft/60 sm:px-4"
                              >
                                <Plus className="h-4 w-4" /> Add a task here
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {proofEditor.dialog}
      <TaskEditDialog
        open={!!dialog}
        heading={dialog?.task ? "Edit your task" : "Add a task"}
        context={dialog ? outline.phases[dialog.phase]?.milestones[dialog.milestone]?.title : undefined}
        initial={dialog?.task ? { title: dialog.task.title, description: dialog.task.description, type: dialog.task.type, minutes: dialog.task.minutes } : null}
        onClose={() => setDialog(null)}
        onSave={saveTask}
      />
      <Toast message={toast} />
    </>
  );
}

function MilestoneNode({ state }: { state: MState }) {
  return (
    <span className="relative mt-[3px] grid h-5 w-5 shrink-0 place-items-center" aria-hidden="true">
      {state === "current" && <span className="absolute inset-[-5px] rounded-full bg-accent/15" />}
      <motion.span
        initial={false}
        animate={{
          backgroundColor: state === "upcoming" ? "#FFFFFF" : "#1F5EEA",
          borderColor: state === "upcoming" ? "#C5CAD2" : "#1F5EEA",
        }}
        className="grid h-5 w-5 place-items-center rounded-full border-2"
      >
        {state === "done" && (
          <svg viewBox="0 0 24 24" className="h-3 w-3">
            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {state === "current" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </motion.span>
    </span>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
