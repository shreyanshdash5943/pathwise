"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { TaskType } from "@/lib/roadmap-schema";
import { TYPE_LABEL } from "./task-row";

export type TaskDraft = { title: string; description: string; type: TaskType; minutes: number };
const field = "w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent";

/** Add a task to a milestone, or edit one you added. */
export function TaskEditDialog({
  open,
  heading,
  context,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  heading: string;
  context?: string;
  initial: TaskDraft | null;
  onClose: () => void;
  onSave: (draft: TaskDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<TaskDraft>({ title: "", description: "", type: "build", minutes: 30 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? { title: "", description: "", type: "build", minutes: 30 });
    setError(null);
    setTimeout(() => titleRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, initial, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await onSave(draft);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
          <motion.form
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-edit-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lift"
          >
            <h2 id="task-edit-title" className="text-[18px] font-semibold">
              {heading}
            </h2>
            {context && <p className="mt-1 text-[14px] text-muted">{context}</p>}
            <label className="mt-5 block">
              <span className="text-[14px] font-medium">Task</span>
              <input
                ref={titleRef}
                className={`${field} mt-1.5 h-11`}
                value={draft.title}
                maxLength={160}
                required
                placeholder="Solve 3 array problems on LeetCode"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-[14px] font-medium">Details (optional)</span>
              <textarea
                className={`${field} mt-1.5 min-h-[72px] resize-y py-2.5`}
                value={draft.description}
                maxLength={500}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[14px] font-medium">Type</span>
                <select className={`${field} mt-1.5 h-11`} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as TaskType })}>
                  {(Object.keys(TYPE_LABEL) as TaskType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[14px] font-medium">Minutes</span>
                <input
                  className={`${field} mt-1.5 h-11`}
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={draft.minutes}
                  onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })}
                />
              </label>
            </div>
            {error && <p className="mt-3 text-[14px] text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-quiet h-10 text-[14px]" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn-primary h-10 text-[14px]" disabled={busy}>
                {busy ? "Saving" : "Save task"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
