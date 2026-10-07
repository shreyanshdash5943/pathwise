"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Link2 } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import type { TaskType } from "@/lib/roadmap-schema";

export const TYPE_LABEL: Record<TaskType, string> = {
  learn: "Learn",
  build: "Build",
  practice: "Practice",
  reflect: "Reflect",
  connect: "Connect",
};

export function CheckCircle({ checked, onToggle, label, disabled }: { checked: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Mark "${label}" as not done` : `Mark "${label}" as done`}
      onClick={onToggle}
      disabled={disabled}
      whileTap={{ scale: 0.86 }}
      className="relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full"
    >
      <motion.span
        className="absolute inset-0 rounded-full border-2"
        initial={false}
        animate={{
          backgroundColor: checked ? "#1F5EEA" : "rgba(255,255,255,1)",
          borderColor: checked ? "#1F5EEA" : "#C5CAD2",
          scale: checked ? [1, 1.16, 1] : 1,
        }}
        transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
      />
      <svg viewBox="0 0 24 24" className="relative h-3.5 w-3.5" aria-hidden="true">
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="#fff"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.28, delay: checked ? 0.08 : 0, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
    </motion.button>
  );
}

export function TaskRow({
  title,
  description,
  type,
  minutes,
  checked,
  onToggle,
  busy,
  skipped,
  proofUrl,
  onProof,
}: {
  title: string;
  description: string;
  type: TaskType;
  minutes: number;
  checked: boolean;
  onToggle: () => void;
  busy?: boolean;
  skipped?: boolean;
  /** Link to the proof of work for this task, if there is one. */
  proofUrl?: string | null;
  /** Shown for tasks that can carry proof of work (build and connect). Opens the editor. */
  onProof?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = description.trim().length > 0 || !!onProof;

  return (
    <div className="group rounded-xl px-3 transition-colors duration-200 hover:bg-surface sm:px-4">
      <div className="flex items-start gap-3.5 py-3">
        <div className="pt-[1px]">
          <CheckCircle checked={checked} onToggle={onToggle} label={title} disabled={busy} />
        </div>
        <button
          type="button"
          onClick={() => hasDetails && setOpen((o) => !o)}
          aria-expanded={hasDetails ? open : undefined}
          className={clsx("flex min-w-0 flex-1 items-start gap-3 text-left", !hasDetails && "cursor-default")}
        >
          <span className="min-w-0 flex-1">
            <span
              className={clsx(
                "block text-[15.5px] leading-snug transition-colors duration-300",
                checked ? "text-faint line-through decoration-faint/50" : "text-ink"
              )}
            >
              {title}
            </span>
            <span className="mt-1 block text-[13px] text-faint">
              {TYPE_LABEL[type]}
              {skipped && checked && " · Skipped, you already know this"}
              {proofUrl && (
                <span className="text-accent">
                  {" · "}
                  <Link2 className="inline h-3.5 w-3.5 -translate-y-px" aria-hidden="true" /> Proof added
                </span>
              )}
            </span>
          </span>
          <span className="tabular mt-[2px] shrink-0 text-[13px] text-faint">{minutes} min</span>
          {hasDetails && (
            <ChevronDown
              className={clsx(
                "mt-0.5 h-4 w-4 shrink-0 text-faint opacity-0 transition-[transform,opacity] duration-300 ease-emphasized group-hover:opacity-100",
                open && "rotate-180 opacity-100"
              )}
            />
          )}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-4 pl-[36px] pr-2">
              {description.trim() && <p className="text-[14.5px] leading-relaxed text-muted">{description}</p>}
              {onProof && (
                <div className={clsx("flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]", description.trim() && "mt-2.5")}>
                  {proofUrl && (
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-accent hover:underline">
                      View proof
                    </a>
                  )}
                  <button type="button" onClick={onProof} className="font-medium text-accent hover:underline">
                    {proofUrl ? "Edit proof" : "Add proof of work"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
