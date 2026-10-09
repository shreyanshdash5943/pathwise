"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, ExternalLink, MessagesSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { STATUSES, type Application, type Answer, type Status } from "@/lib/prep-shared";
import { PageHeader } from "./page-header";
import { Toast, useToast } from "./toast";
import { InterviewPrep, type ProofLite } from "./interview-prep";

const field = "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent";

const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
const STATUS_STYLE: Record<Status, string> = {
  saved: "bg-surface-sunk text-ink-soft",
  applied: "bg-accent-soft text-accent",
  interviewing: "bg-amber-100 text-amber-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-surface text-muted",
  withdrawn: "bg-surface text-muted",
};
const ACTIVE: Status[] = ["saved", "applied", "interviewing", "offer"];

async function send(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export function JobsView({
  field: userField,
  roleTitle,
  applications: initialApps,
  answers: initialAnswers,
  proofs,
}: {
  field: string;
  roleTitle: string;
  applications: Application[];
  answers: Answer[];
  proofs: ProofLite[];
}) {
  const { toast, show } = useToast();
  const [tab, setTab] = useState<"apps" | "prep">("apps");
  const [apps, setApps] = useState(initialApps);
  const [editing, setEditing] = useState<Application | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const stats = useMemo(() => {
    const c = (s: Status[]) => apps.filter((a) => s.includes(a.status)).length;
    return { inProgress: c(["saved", "applied", "interviewing", "offer"]), interviews: c(["interviewing", "offer"]), offers: c(["offer"]) };
  }, [apps]);

  const active = apps.filter((a) => ACTIVE.includes(a.status));
  const closed = apps.filter((a) => !ACTIVE.includes(a.status));

  async function changeStatus(app: Application, status: Status) {
    const prev = app.status;
    setApps((xs) => xs.map((a) => (a.id === app.id ? { ...a, status } : a)));
    try {
      await send(`/api/applications/${app.id}`, { status }, "PATCH");
      if (status === "rejected") show("Marked as rejected. A no is about fit, not your worth — keep going.");
      else if (status === "offer") show("An offer! That's the whole point. Well done.");
      else if (status === "interviewing") show("Interviewing — time to prep. Open the Interview prep tab.");
    } catch (err) {
      setApps((xs) => xs.map((a) => (a.id === app.id ? { ...a, status: prev } : a)));
      show(err instanceof Error ? err.message : "Couldn't update that.");
    }
  }

  async function remove(id: string) {
    const prev = apps;
    setApps((xs) => xs.filter((a) => a.id !== id));
    setConfirmDelete(null);
    try {
      await send(`/api/applications/${id}`, undefined, "DELETE");
    } catch (err) {
      setApps(prev);
      show(err instanceof Error ? err.message : "Couldn't delete that.");
    }
  }

  function onSaved(app: Application) {
    setApps((xs) => (xs.some((a) => a.id === app.id) ? xs.map((a) => (a.id === app.id ? app : a)) : [app, ...xs]));
    setEditing(null);
  }

  return (
    <>
      <PageHeader title="Getting hired" description="Track where you've applied, and walk into interviews with answers built from what you've actually done." />

      <div className="mb-6 inline-flex rounded-full bg-surface p-1">
        {([["apps", "Applications", Briefcase], ["prep", "Interview prep", MessagesSquare]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx("relative flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors", tab === id ? "text-ink" : "text-muted hover:text-ink")}
          >
            {tab === id && <motion.span layoutId="jobs-tab" className="absolute inset-0 rounded-full bg-white shadow-lift" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {tab === "apps" ? (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              ["In progress", stats.inProgress],
              ["Interviews", stats.interviews],
              ["Offers", stats.offers],
            ].map(([k, v]) => (
              <div key={k} className="panel p-4">
                <p className="text-[13px] text-muted">{k}</p>
                <p className="tabular mt-0.5 text-[26px] font-semibold tracking-[-0.02em]">{v}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Your applications</h2>
            <button type="button" className="btn-primary h-10 text-[14px]" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          {apps.length === 0 ? (
            <div className="panel p-6 text-[14.5px] text-muted">
              Nothing tracked yet. When you save or apply to a role, add it here — seeing your pipeline makes a hard process feel like progress.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {[...active, ...closed].map((a) => (
                <li key={a.id} className={clsx("panel p-4 sm:p-5", !ACTIVE.includes(a.status) && "opacity-70")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[16px] font-semibold">{a.company}</span>
                        {a.role_title && <span className="text-[14px] text-muted">· {a.role_title}</span>}
                      </p>
                      {(a.location || a.url) && (
                        <p className="mt-0.5 flex items-center gap-2 text-[13px] text-faint">
                          {a.location}
                          {a.url && (
                            <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-accent hover:underline">
                              Job post <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </p>
                      )}
                      {a.next_step && (
                        <p className="mt-2 inline-flex rounded-lg bg-surface px-2.5 py-1 text-[13px] text-ink-soft">
                          Next: {a.next_step}
                          {a.next_step_on && ` · ${new Date(`${a.next_step_on}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`}
                        </p>
                      )}
                      {a.notes && <p className="mt-2 whitespace-pre-wrap text-[13.5px] text-muted">{a.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface hover:text-ink" onClick={() => setEditing(a)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface hover:text-red-600" onClick={() => setConfirmDelete(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="sr-only" htmlFor={`status-${a.id}`}>
                      Status for {a.company}
                    </label>
                    <select
                      id={`status-${a.id}`}
                      value={a.status}
                      onChange={(e) => changeStatus(a, e.target.value as Status)}
                      className={clsx("h-8 rounded-full border-0 px-3 text-[13px] font-medium outline-none focus:ring-2 focus:ring-accent/40", STATUS_STYLE[a.status])}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {confirmDelete === a.id && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-2.5">
                      <span className="text-[13.5px] text-red-700">Delete this application?</span>
                      <span className="flex gap-2">
                        <button type="button" className="btn-quiet h-8 px-3 text-[13.5px]" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </button>
                        <button type="button" className="btn h-8 bg-red-600 px-3 text-[13.5px] text-white hover:bg-red-700" onClick={() => remove(a.id)}>
                          Delete
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <ApplicationDialog open={editing !== null} app={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={onSaved} show={show} />
        </>
      ) : (
        <InterviewPrep field={userField} roleTitle={roleTitle} initialAnswers={initialAnswers} proofs={proofs} show={show} />
      )}

      <Toast message={toast} />
    </>
  );
}

function ApplicationDialog({
  open,
  app,
  onClose,
  onSaved,
  show,
}: {
  open: boolean;
  app: Application | null;
  onClose: () => void;
  onSaved: (a: Application) => void;
  show: (t: string) => void;
}) {
  const [form, setForm] = useState({ company: "", role_title: "", url: "", location: "", status: "saved" as Status, next_step: "", next_step_on: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // Reset the form each time the dialog opens.
  if (open && !ready) {
    setForm(
      app
        ? { company: app.company, role_title: app.role_title, url: app.url, location: app.location, status: app.status, next_step: app.next_step, next_step_on: app.next_step_on ?? "", notes: app.notes }
        : { company: "", role_title: "", url: "", location: "", status: "saved", next_step: "", next_step_on: "", notes: "" }
    );
    setReady(true);
  }
  if (!open && ready) setReady(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, next_step_on: form.next_step_on || null };
      const data = app
        ? await send(`/api/applications/${app.id}`, payload, "PATCH")
        : await send("/api/applications", payload);
      onSaved(data.application as Application);
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
          <motion.form
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-label={app ? "Edit application" : "Add application"}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-lift"
          >
            <h2 className="text-[18px] font-semibold">{app ? "Edit application" : "Add application"}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[14px] font-medium">Company</span>
                <input autoFocus className={`${field} mt-1.5`} value={form.company} maxLength={120} required onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[14px] font-medium">Role</span>
                <input className={`${field} mt-1.5`} value={form.role_title} maxLength={120} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[14px] font-medium">Job link</span>
                <input className={`${field} mt-1.5`} value={form.url} maxLength={500} inputMode="url" placeholder="company.com/careers/…" onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[14px] font-medium">Location</span>
                <input className={`${field} mt-1.5`} value={form.location} maxLength={80} placeholder="Remote, Bangalore…" onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[14px] font-medium">Status</span>
                <select className={`${field} mt-1.5`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[14px] font-medium">Next step date</span>
                <input className={`${field} mt-1.5`} type="date" value={form.next_step_on} onChange={(e) => setForm({ ...form, next_step_on: e.target.value })} />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-[14px] font-medium">Next step</span>
              <input className={`${field} mt-1.5`} value={form.next_step} maxLength={160} placeholder="Phone screen with the hiring manager" onChange={(e) => setForm({ ...form, next_step: e.target.value })} />
            </label>
            <label className="mt-4 block">
              <span className="text-[14px] font-medium">Notes</span>
              <textarea className={`${field} mt-1.5 min-h-[80px] resize-y py-2.5`} value={form.notes} maxLength={2000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-quiet h-10 text-[14px]" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn-primary h-10 text-[14px]" disabled={busy || !form.company.trim()}>
                {busy ? "Saving" : "Save"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
