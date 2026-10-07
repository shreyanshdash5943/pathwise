"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export type ProofLite = { id: string; task_key: string | null; title: string; url: string; note: string; created_at: string };
type Target = { taskKey: string | null; title: string; proof: ProofLite | null; afterComplete?: boolean };

const field = "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent";

async function send(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

/**
 * Proof of work editing for task lists. Holds the proofs keyed by task, and renders the
 * dialog. open() starts editing; after finishing a build task the dialog opens on its
 * own, which is when people are most likely to add a link.
 */
export function useProofEditor(initial: Record<string, ProofLite>, show: (text: string) => void) {
  const [proofs, setProofs] = useState(initial);
  const [target, setTarget] = useState<Target | null>(null);

  const open = useCallback(
    (taskKey: string, title: string, afterComplete = false) => setTarget({ taskKey, title, proof: proofs[taskKey] ?? null, afterComplete }),
    [proofs]
  );

  const dialog = (
    <ProofDialog
      target={target}
      onClose={() => setTarget(null)}
      onSaved={(p) => {
        if (target?.taskKey) setProofs((all) => ({ ...all, [target.taskKey!]: p }));
        setTarget(null);
        show("Proof saved. It shows on your profile.");
      }}
      onRemoved={() => {
        if (target?.taskKey) {
          setProofs((all) => {
            const next = { ...all };
            delete next[target.taskKey!];
            return next;
          });
        }
        setTarget(null);
        show("Proof removed.");
      }}
    />
  );

  return { proofs, open, dialog };
}

export function ProofDialog({
  target,
  onClose,
  onSaved,
  onRemoved,
}: {
  target: Target | null;
  onClose: () => void;
  onSaved: (p: ProofLite) => void;
  onRemoved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const standalone = target !== null && target.taskKey === null;

  useEffect(() => {
    if (!target) return;
    setTitle(target.proof?.title ?? target.title);
    setUrl(target.proof?.url ?? "");
    setNote(target.proof?.note ?? "");
    setError(null);
    setTimeout(() => urlRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const data = target.proof
        ? await send(`/api/proofs/${target.proof.id}`, { method: "PATCH", body: JSON.stringify(standalone ? { url, note, title } : { url, note }) })
        : await send("/api/proofs", { method: "POST", body: JSON.stringify(standalone ? { url, note, title } : { taskKey: target.taskKey, url, note }) });
      onSaved(data.proof);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!target?.proof) return;
    setBusy(true);
    try {
      await send(`/api/proofs/${target.proof.id}`, { method: "DELETE" });
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {target && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
          <motion.form
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-labelledby="proof-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lift"
          >
            <h2 id="proof-title" className="text-[18px] font-semibold">
              {target.afterComplete ? "Nice work. Show what you made?" : target.proof ? "Edit proof of work" : "Add proof of work"}
            </h2>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
              {standalone ? "Add a project you built. It shows on your profile." : <>A link to what you made for <span className="font-medium text-ink">{target.title}</span>. It shows on your profile.</>}
            </p>

            {standalone && (
              <label className="mt-5 block">
                <span className="text-[14px] font-medium">Title</span>
                <input className={`${field} mt-1.5`} value={title} maxLength={160} required onChange={(e) => setTitle(e.target.value)} placeholder="Weather dashboard" />
              </label>
            )}
            <label className="mt-5 block">
              <span className="text-[14px] font-medium">Link</span>
              <input
                ref={urlRef}
                className={`${field} mt-1.5`}
                value={url}
                maxLength={300}
                inputMode="url"
                required
                placeholder="github.com/you/project"
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-[14px] font-medium">Note (optional)</span>
              <textarea
                className="mt-1.5 min-h-[80px] w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent"
                value={note}
                maxLength={280}
                placeholder="What it does, or what you learned"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error && <p className="mt-3 text-[14px] text-red-600">{error}</p>}

            <div className="mt-6 flex items-center justify-between gap-2">
              {target.proof ? (
                <button type="button" className="btn h-10 px-4 text-[14px] text-red-600 hover:bg-red-50" onClick={remove} disabled={busy}>
                  Remove
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-quiet h-10 text-[14px]" onClick={onClose} disabled={busy}>
                  {target.afterComplete ? "Skip" : "Cancel"}
                </button>
                <button type="submit" className="btn-primary h-10 text-[14px]" disabled={busy}>
                  {busy ? "Saving" : "Save"}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
