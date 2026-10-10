"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Link2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Answer } from "@/lib/prep-shared";
import { questionsForField, type Question } from "@/lib/interview-questions";

export type ProofLite = { id: string; title: string; note: string };

const area = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent";

async function send(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

const isAnswered = (a: Answer | undefined) => !!a && !!(a.situation || a.task || a.action || a.result);

export function InterviewPrep({
  field,
  roleTitle,
  initialAnswers,
  proofs,
  show,
}: {
  field: string;
  roleTitle: string;
  initialAnswers: Answer[];
  proofs: ProofLite[];
  show: (t: string) => void;
}) {
  const questions = useMemo(() => questionsForField(field), [field]);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => Object.fromEntries(initialAnswers.map((a) => [a.question_key, a])));
  const [editing, setEditing] = useState<Question | null>(null);

  const answeredCount = questions.filter((q) => isAnswered(answers[q.key])).length;
  const pct = Math.round((answeredCount / questions.length) * 100);
  const behavioural = questions.filter((q) => q.category === "behavioural");
  const technical = questions.filter((q) => q.category === "technical");

  const groups: { title: string; note: string; items: Question[] }[] = [
    { title: "Behavioural", note: "Asked in almost every interview. Build these from the projects you've shipped.", items: behavioural },
    ...(technical.length ? [{ title: `Technical · ${roleTitle}`, note: "The kind of questions you'll get for this role.", items: technical }] : []),
  ];

  return (
    <>
      <div className="panel mb-6 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold">Interview readiness</h2>
            <p className="mt-1 text-[14.5px] text-muted">
              You&apos;ve prepared {answeredCount} of {questions.length} questions.
            </p>
          </div>
          <span className="tabular text-[28px] font-semibold tracking-[-0.02em]">{pct}%</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-sunk">
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 160, damping: 26 }} />
        </div>
      </div>

      {technical.length === 0 && (
        <div className="panel mb-6 flex items-center justify-between gap-4 p-5">
          <p className="text-[14.5px] text-muted">Build a career plan to unlock role-specific technical questions.</p>
          <Link href="/onboarding?build=1" className="btn-outline h-9 shrink-0 text-[14px]">
            Build a plan
          </Link>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.title} className="mb-6">
          <h3 className="text-[16px] font-semibold">{g.title}</h3>
          <p className="mt-0.5 text-[13.5px] text-muted">{g.note}</p>
          <ul className="mt-3 space-y-2">
            {g.items.map((q) => {
              const answered = isAnswered(answers[q.key]);
              const linked = answers[q.key]?.proof_id;
              return (
                <li key={q.key}>
                  <button
                    type="button"
                    onClick={() => setEditing(q)}
                    className="panel flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-accent-line"
                  >
                    <span
                      className={clsx(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                        answered ? "bg-accent text-white" : "border-2 border-dashed border-line-strong"
                      )}
                    >
                      {answered && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium leading-snug">{q.prompt}</span>
                      <span className="mt-0.5 block text-[13px] text-faint">
                        {answered ? "Prepared" : "Not prepared yet"}
                        {linked && (
                          <span className="text-accent">
                            {" · "}
                            <Link2 className="inline h-3 w-3 -translate-y-px" /> from a project
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <AnswerDialog
        question={editing}
        answer={editing ? answers[editing.key] : undefined}
        proofs={proofs}
        onClose={() => setEditing(null)}
        onSaved={(a) => {
          setAnswers((m) => ({ ...m, [a.question_key]: a }));
          setEditing(null);
          show("Answer saved.");
        }}
        onDeleted={(key) => {
          setAnswers((m) => {
            const n = { ...m };
            delete n[key];
            return n;
          });
          setEditing(null);
          show("Answer removed.");
        }}
        show={show}
      />
    </>
  );
}

const STAR: { key: "situation" | "task" | "action" | "result"; label: string; hint: string }[] = [
  { key: "situation", label: "Situation", hint: "Set the scene. What were you working on?" },
  { key: "task", label: "Task", hint: "What were you responsible for?" },
  { key: "action", label: "Action", hint: "What did you actually do? This is the heart of it." },
  { key: "result", label: "Result", hint: "How did it turn out? Numbers if you have them." },
];

function AnswerDialog({
  question,
  answer,
  proofs,
  onClose,
  onSaved,
  onDeleted,
  show,
}: {
  question: Question | null;
  answer: Answer | undefined;
  proofs: ProofLite[];
  onClose: () => void;
  onSaved: (a: Answer) => void;
  onDeleted: (key: string) => void;
  show: (t: string) => void;
}) {
  const [form, setForm] = useState({ situation: "", task: "", action: "", result: "", proofId: null as string | null });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  if (question && !ready) {
    setForm({
      situation: answer?.situation ?? "",
      task: answer?.task ?? "",
      action: answer?.action ?? "",
      result: answer?.result ?? "",
      proofId: answer?.proof_id ?? null,
    });
    setReady(true);
  }
  if (!question && ready) setReady(false);

  const isStar = question?.format === "star";

  function useProof(p: ProofLite) {
    setForm((f) => ({
      ...f,
      proofId: f.proofId === p.id ? null : p.id,
      // Drop the project in as the starting point, only if that box is empty.
      situation: f.proofId === p.id ? f.situation : f.situation || `On my project "${p.title}"${p.note ? `: ${p.note}` : ""}`,
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!question) return;
    setBusy(true);
    try {
      const payload = isStar
        ? { questionKey: question.key, ...form }
        : { questionKey: question.key, action: form.action, proofId: form.proofId };
      const data = await send("/api/interview/answers", payload);
      onSaved(data.answer as Answer);
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!question) return;
    setBusy(true);
    try {
      await send(`/api/interview/answers/${question.key}`, undefined, "DELETE");
      onDeleted(question.key);
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't remove that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {question && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
          <motion.form
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-label="Prepare your answer"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lift"
          >
            <h2 className="text-[18px] font-semibold leading-snug">{question.prompt}</h2>
            {question.tip && <p className="mt-1.5 text-[14px] text-muted">{question.tip}</p>}

            {isStar && proofs.length > 0 && (
              <div className="mt-4 rounded-xl bg-accent-soft/50 p-3.5">
                <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-accent">
                  <Sparkles className="h-4 w-4" /> Build it from something you shipped
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {proofs.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => useProof(p)}
                      className={clsx(
                        "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                        form.proofId === p.id ? "bg-accent text-white" : "bg-white text-ink ring-1 ring-line hover:ring-accent-line"
                      )}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
                {form.proofId && <p className="mt-2 text-[12.5px] text-muted">Linked. This answer is grounded in a real project — exactly what interviewers want.</p>}
              </div>
            )}

            {isStar ? (
              <div className="mt-4 space-y-4">
                {STAR.map((s) => (
                  <label key={s.key} className="block">
                    <span className="text-[14px] font-medium">{s.label}</span>
                    <span className="ml-2 text-[13px] text-faint">{s.hint}</span>
                    <textarea className={`${area} mt-1.5 min-h-[64px] resize-y`} value={form[s.key]} maxLength={s.key === "action" ? 2000 : 1500} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} />
                  </label>
                ))}
              </div>
            ) : (
              <label className="mt-4 block">
                <span className="text-[14px] font-medium">Your answer</span>
                <textarea className={`${area} mt-1.5 min-h-[140px] resize-y`} value={form.action} maxLength={2000} placeholder="Draft how you'd answer this out loud." onChange={(e) => setForm({ ...form, action: e.target.value })} />
              </label>
            )}

            <div className="mt-6 flex items-center justify-between gap-2">
              {answer ? (
                <button type="button" className="btn h-10 px-4 text-[14px] text-red-600 hover:bg-red-50" onClick={del} disabled={busy}>
                  Remove
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-quiet h-10 text-[14px]" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary h-10 text-[14px]" disabled={busy}>
                  {busy ? "Saving" : "Save answer"}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
