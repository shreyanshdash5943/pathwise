"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { QUESTIONS, type Answers } from "@/lib/questions";
import { matchRoles } from "@/lib/roles";
import { LogoMark } from "./logo";

type Stage = "questions" | "paths" | "building";
const STORAGE_KEY = "pathwise:onboarding:v1";
const BUILD_STEPS = ["Reading your answers", "Choosing your milestones", "Sizing your daily tasks", "Putting it all together"];

function loadSaved(): { answers: Answers; index: number } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.index === "number" && parsed.answers && typeof parsed.answers === "object") return parsed;
  } catch {}
  return null;
}

export function Onboarding({ firstName }: { firstName: string | null }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("questions");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [roleId, setRoleId] = useState<string | null>(null);
  const [buildStep, setBuildStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setAnswers(saved.answers);
      setIndex(Math.min(Math.max(0, saved.index), QUESTIONS.length - 1));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, index }));
    } catch {}
  }, [answers, index, hydrated]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const q = QUESTIONS[index];
  const selected = answers[q.id] ?? [];
  const matches = useMemo(() => (stage === "paths" ? matchRoles(answers) : []), [stage, answers]);
  // Furthest question someone can jump to: every question before it is answered.
  const reachable = useMemo(() => {
    const firstOpen = QUESTIONS.findIndex((x) => !(answers[x.id]?.length));
    return firstOpen === -1 ? QUESTIONS.length - 1 : firstOpen;
  }, [answers]);
  const answered = selected.length > 0;
  const isLast = index === QUESTIONS.length - 1;

  const goNext = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setDirection(1);
    if (index < QUESTIONS.length - 1) setIndex((i) => i + 1);
    else {
      setStage("paths");
      setRoleId(null);
    }
  }, [index]);

  const goBack = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setDirection(-1);
    if (stage === "paths") setStage("questions");
    else if (index > 0) setIndex((i) => i - 1);
  }, [index, stage]);

  const goTo = useCallback(
    (i: number) => {
      if (i === index || i < 0 || i > reachable) return;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      setDirection(i > index ? 1 : -1);
      setIndex(i);
    },
    [index, reachable]
  );

  const choose = useCallback(
    (optionId: string) => {
      if (q.multi) {
        setAnswers((prev) => {
          const cur = prev[q.id] ?? [];
          if (cur.includes(optionId)) return { ...prev, [q.id]: cur.filter((x) => x !== optionId) };
          if (q.max && cur.length >= q.max) return { ...prev, [q.id]: [...cur.slice(1), optionId] };
          return { ...prev, [q.id]: [...cur, optionId] };
        });
        return;
      }
      setAnswers((prev) => ({ ...prev, [q.id]: [optionId] }));
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(goNext, 260);
    },
    [q, goNext]
  );

  useEffect(() => {
    if (stage !== "questions") return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= q.options.length) {
        e.preventDefault();
        choose(q.options[n - 1].id);
      } else if ((e.key === "Enter" && q.multi) || e.key === "ArrowRight") {
        if (selected.length === 0) return;
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        goBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, q, index, selected.length, choose, goNext, goBack]);

  async function build() {
    if (!roleId) return;
    setStage("building");
    setError(null);
    setBuildStep(0);
    const ticker = setInterval(() => setBuildStep((s) => Math.min(s + 1, BUILD_STEPS.length - 1)), 500);
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, roleId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We couldn't build your plan. Try again.");
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
      setBuildStep(BUILD_STEPS.length - 1);
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't build your plan. Try again.");
    } finally {
      clearInterval(ticker);
    }
  }

  const progress = stage === "questions" ? index / QUESTIONS.length : 1;

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="text-[15px] font-semibold">Your plan</span>
          </div>
          {stage === "questions" && (
            <span className="tabular text-[14px] text-muted">
              {index + 1} of {QUESTIONS.length}
            </span>
          )}
        </div>
        <div className="h-[3px] w-full bg-surface-sunk">
          <motion.div className="h-full bg-accent" animate={{ width: `${progress * 100}%` }} transition={{ type: "spring", stiffness: 160, damping: 26 }} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16 pt-10 sm:pt-16">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          {stage === "questions" && (
            <motion.section
              key={q.id}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 28 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d * -28 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
              aria-labelledby={`q-${q.id}`}
            >
              {index === 0 && firstName && <p className="mb-3 text-[15px] text-muted">Hi {firstName}. Let's find your route.</p>}
              <h1 id={`q-${q.id}`} className="text-[30px] font-semibold leading-tight tracking-[-0.025em] sm:text-[36px]">
                {q.prompt}
              </h1>
              {q.helper && <p className="mt-3 text-[16px] text-muted">{q.helper}</p>}

              <div role={q.multi ? "group" : "radiogroup"} className="mt-8 grid gap-2.5">
                {q.options.map((o, i) => {
                  const active = selected.includes(o.id);
                  return (
                    <motion.button
                      key={o.id}
                      type="button"
                      role={q.multi ? "checkbox" : "radio"}
                      aria-checked={active}
                      onClick={() => choose(o.id)}
                      whileTap={{ scale: 0.985 }}
                      className={clsx(
                        "group flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow] duration-200 ease-emphasized sm:px-5 sm:py-4",
                        active ? "border-accent bg-accent-soft shadow-ring" : "border-line bg-white hover:border-line-strong hover:bg-surface"
                      )}
                    >
                      <kbd
                        className={clsx(
                          "tabular hidden h-7 w-7 shrink-0 place-items-center rounded-lg border font-sans text-[13px] font-medium transition-colors sm:grid",
                          active ? "border-accent bg-accent text-white" : "border-line-strong bg-white text-muted"
                        )}
                      >
                        {i + 1}
                      </kbd>
                      <span className="flex-1">
                        <span className="block text-[16px] font-medium text-ink">{o.label}</span>
                        {o.hint && <span className="mt-0.5 block text-[14px] text-muted">{o.hint}</span>}
                      </span>
                      <span
                        className={clsx(
                          "grid h-6 w-6 shrink-0 place-items-center border transition-all duration-200",
                          q.multi ? "rounded-md" : "rounded-full",
                          active ? "scale-100 border-accent bg-accent" : "scale-90 border-line-strong bg-white"
                        )}
                      >
                        <Check className={clsx("h-3.5 w-3.5 text-white transition-opacity", active ? "opacity-100" : "opacity-0")} strokeWidth={3} />
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-10 flex items-center justify-between gap-3">
                <button type="button" onClick={goBack} disabled={index === 0} className="btn-quiet -ml-3 shrink-0 whitespace-nowrap px-3 disabled:invisible">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <nav aria-label="Questions" className="hidden min-w-0 items-center gap-1.5 sm:flex">
                  {QUESTIONS.map((x, i) => {
                    const done = (answers[x.id]?.length ?? 0) > 0;
                    const current = i === index;
                    return (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => goTo(i)}
                        disabled={i > reachable}
                        aria-current={current ? "step" : undefined}
                        aria-label={`Question ${i + 1}${done ? ", answered" : ""}`}
                        className="grid h-6 w-4 place-items-center disabled:cursor-not-allowed"
                      >
                        <span
                          className={clsx(
                            "block h-1.5 rounded-full transition-all duration-200",
                            current ? "w-4 bg-accent" : done ? "w-1.5 bg-ink-soft" : "w-1.5 bg-line-strong"
                          )}
                        />
                      </button>
                    );
                  })}
                </nav>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={!answered}
                  title={answered ? undefined : "Pick an answer first"}
                  className="btn-primary shrink-0 whitespace-nowrap"
                >
                  {isLast ? "See my routes" : "Next"}
                  {!isLast && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </motion.section>
          )}

          {stage === "paths" && (
            <motion.section
              key="paths"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
            >
              <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.025em] sm:text-[36px]">Here are the routes that fit you.</h1>
              <p className="mt-3 text-[16px] text-muted">Pick one. You can change it later from settings.</p>

              <div role="radiogroup" className="mt-8 grid gap-3">
                {matches.map((r, i) => {
                  const active = roleId === r.id;
                  return (
                    <motion.button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setRoleId(r.id)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * i, duration: 0.35, ease: [0.2, 0, 0, 1] }}
                      className={clsx(
                        "w-full rounded-2xl border p-5 text-left transition-[background-color,border-color,box-shadow] duration-200 ease-emphasized sm:p-6",
                        active ? "border-accent bg-accent-soft/60 shadow-ring" : "border-line bg-white hover:border-line-strong"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h2 className="text-[19px] font-semibold tracking-[-0.015em]">{r.title}</h2>
                            {i === 0 && <span className="rounded-full bg-ink px-2 py-0.5 text-[12px] font-medium text-white">Best fit</span>}
                          </div>
                          <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-muted">{r.summary}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular text-[22px] font-semibold leading-none">{r.fit}%</p>
                          <p className="mt-1 text-[12.5px] text-faint">fit</p>
                        </div>
                      </div>
                      <p className="mt-4 text-[14.5px] text-ink-soft">{r.reason}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                        <span className="rounded-full border border-line bg-white px-2.5 py-1 text-muted">{r.demand} demand</span>
                        <span className="rounded-full border border-line bg-white px-2.5 py-1 text-muted">{r.difficulty}</span>
                        <span className="rounded-full border border-line bg-white px-2.5 py-1 text-muted">
                          Ready in {r.monthsToReady[0]} to {r.monthsToReady[1]} months
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-10 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={goBack} className="btn-quiet -ml-3 px-3">
                  <ArrowLeft className="h-4 w-4" /> Change my answers
                </button>
                <button type="button" onClick={build} disabled={!roleId} className="btn-primary h-12 px-6">
                  Build my plan
                </button>
              </div>
            </motion.section>
          )}

          {stage === "building" && (
            <motion.section
              key="building"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center pt-10 text-center"
              aria-live="polite"
            >
              <svg viewBox="0 0 200 80" className="w-56" aria-hidden="true">
                <path d="M10 65 C 50 65, 60 30, 100 30 S 150 15, 190 15" fill="none" stroke="#E6E8EC" strokeWidth="3" strokeLinecap="round" />
                <motion.path
                  d="M10 65 C 50 65, 60 30, 100 30 S 150 15, 190 15"
                  fill="none"
                  stroke="#1F5EEA"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={error ? { pathLength: 0.3 } : { pathLength: [0, 1] }}
                  transition={error ? { duration: 0.4 } : { duration: 2.4, repeat: Infinity, repeatType: "reverse", ease: [0.45, 0, 0.15, 1] }}
                />
              </svg>
              {error ? (
                <>
                  <h1 className="mt-8 text-[24px] font-semibold tracking-[-0.02em]">Your plan didn't build</h1>
                  <p className="mt-2 max-w-md text-[15.5px] text-muted">{error}</p>
                  <div className="mt-8 flex gap-3">
                    <button type="button" className="btn-outline" onClick={() => setStage("paths")}>
                      Back to routes
                    </button>
                    <button type="button" className="btn-primary" onClick={build}>
                      Try again
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="mt-8 text-[24px] font-semibold tracking-[-0.02em]">Building your plan</h1>
                  <div className="relative mt-2 h-6 w-full overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={buildStep}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="text-[15.5px] text-muted"
                      >
                        {BUILD_STEPS[buildStep]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <p className="mt-10 text-[13.5px] text-faint">This only takes a moment.</p>
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
