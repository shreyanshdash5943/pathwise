"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Map } from "lucide-react";
import { ActivityCard } from "./dashboard";
import { HabitsPanel, type HabitLite } from "./habits-panel";
import { Toast, useToast } from "./toast";

/**
 * The dashboard for someone tracking habits without a career plan. Habits are the whole
 * focus, with their streak and a standing invitation to build a plan when they're ready.
 */
export function HabitsDashboard({
  greeting,
  dateLabel,
  habits,
  today,
  activity: initialActivity,
  frozen,
  justFrozen,
  freezesLeft,
}: {
  greeting: string;
  dateLabel: string;
  habits: HabitLite[];
  today: string;
  activity: Record<string, number>;
  frozen: string[];
  justFrozen: string[];
  freezesLeft: number | null;
}) {
  const { toast, show } = useToast();
  const [activity, setActivity] = useState(initialActivity);
  const bump = (delta: number) => setActivity((a) => ({ ...a, [today]: Math.max(0, (a[today] ?? 0) + delta) }));

  useEffect(() => {
    if (!justFrozen.length) return;
    const names = justFrozen.map((d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }));
    show(`Your streak is safe. A streak freeze covered ${names.join(" and ")}.`);
  }, [justFrozen, show]);

  return (
    <>
      <div className="mb-7">
        <p className="text-[14.5px] text-muted">{dateLabel}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.025em] sm:text-[34px]">{greeting}</h1>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <HabitsPanel initial={habits} show={show} onDoneChange={bump} />

          <Link href="/onboarding?build=1" className="panel group flex items-center gap-4 p-5 transition-colors hover:border-accent-line sm:p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <Map className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">Ready for more than habits?</span>
              <span className="mt-0.5 block text-[14px] text-muted">Build a career plan — a step-by-step roadmap and a daily checklist for your goal.</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-accent transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid content-start gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <ActivityCard activity={activity} today={today} frozen={frozen} freezesLeft={freezesLeft} />
        </div>
      </div>

      <Toast message={toast} />
    </>
  );
}
