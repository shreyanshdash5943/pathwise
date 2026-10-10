"use client";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, FileText, Globe, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import clsx from "clsx";
import { PageHeader } from "./page-header";
import { CheckCircle } from "./task-row";
import { Toast, useToast } from "./toast";
import { ProofDialog, type ProofLite } from "./proof-dialog";
import { ProfileAnalytics } from "./profile-analytics";
import { ProBadge } from "./pro-badge";

type Links = { github?: string; linkedin?: string; portfolio?: string };
type CardTheme = "classic" | "midnight" | "minimal";
const THEMES: { id: CardTheme; label: string; pro: boolean }[] = [
  { id: "classic", label: "Classic", pro: false },
  { id: "midnight", label: "Midnight", pro: true },
  { id: "minimal", label: "Minimal", pro: true },
];
type Contact = { email: string; phone: string; showEmail: boolean; showPhone: boolean; showResume: boolean };
type Resume = { name: string; size: number; uploadedAt: string | null; skills: string[] };

type Props = {
  identity: { name: string | null; email: string | null; imageUrl: string | null };
  roleTitle: string;
  roleSkills: string[];
  initial: {
    headline: string;
    links: Links;
    skills: string[];
    knownSkills: string[];
    resume: Resume | null;
    username: string;
    isPublic: boolean;
    proofs: ProofLite[];
    contact: Contact;
    premium: { hideBranding: boolean; cardTheme: CardTheme };
  };
  pro: boolean;
  stats: Parameters<typeof ProfileAnalytics>[0]["stats"];
};

const MAX_BYTES = 5 * 1024 * 1024;
const field = "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent";
const LINK_FIELDS: { key: keyof Links; label: string; placeholder: string }[] = [
  { key: "github", label: "GitHub", placeholder: "github.com/yourname" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourname" },
  { key: "portfolio", label: "Portfolio", placeholder: "yoursite.com" },
];

const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function send(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export function ProfileView({ identity, roleTitle, roleSkills, initial, pro, stats }: Props) {
  const router = useRouter();
  const { toast, show } = useToast();

  const [headline, setHeadline] = useState(initial.headline);
  const [links, setLinks] = useState<Links>(initial.links);
  const [skills, setSkills] = useState(initial.skills);
  const [skillDraft, setSkillDraft] = useState("");
  const [savingAbout, setSavingAbout] = useState(false);

  const [known, setKnown] = useState(new Set(initial.knownSkills));
  const [savedKnown, setSavedKnown] = useState(new Set(initial.knownSkills));
  const [savingKnown, setSavingKnown] = useState(false);
  const knownDirty = known.size !== savedKnown.size || [...known].some((s) => !savedKnown.has(s));

  const [resume, setResume] = useState(initial.resume);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(initial.username);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [savedUsername, setSavedUsername] = useState(initial.isPublic ? initial.username : "");
  const [publishing, setPublishing] = useState(false);
  const publicPath = savedUsername ? `/u/${savedUsername}` : null;

  const [premium, setPremium] = useState(initial.premium);

  async function savePremium(patch: Partial<typeof premium>) {
    const prev = premium;
    setPremium({ ...premium, ...patch });
    try {
      await send("/api/details", {
        method: "PATCH",
        body: JSON.stringify({ hideBranding: patch.hideBranding, cardTheme: patch.cardTheme }),
      });
      show("Saved.");
    } catch (err) {
      setPremium(prev);
      show(err instanceof Error ? err.message : "Couldn't save that.");
    }
  }

  const [contact, setContact] = useState<Contact>(initial.contact);
  const [savedContact, setSavedContact] = useState<Contact>(initial.contact);
  const [savingContact, setSavingContact] = useState(false);
  const contactDirty = JSON.stringify(contact) !== JSON.stringify(savedContact);

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSavingContact(true);
    try {
      await send("/api/details", {
        method: "PATCH",
        body: JSON.stringify({
          contactEmail: contact.email.trim(),
          phone: contact.phone.trim(),
          showEmail: contact.showEmail && !!contact.email.trim(),
          showPhone: contact.showPhone && !!contact.phone.trim(),
          showResume: contact.showResume && !!resume,
        }),
      });
      setSavedContact(contact);
      show("Contact details saved.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't save your contact details.");
    } finally {
      setSavingContact(false);
    }
  }

  const [proofs, setProofs] = useState(initial.proofs);
  const [editing, setEditing] = useState<{ taskKey: string | null; title: string; proof: ProofLite | null } | null>(null);

  async function setPublic(next: boolean) {
    setPublishing(true);
    try {
      const u = username.trim().toLowerCase();
      await send("/api/details", { method: "PATCH", body: JSON.stringify(next ? { username: u, isPublic: true } : { isPublic: false }) });
      setIsPublic(next);
      if (next) {
        setUsername(u);
        setSavedUsername(u);
      }
      show(next ? "Your profile is public." : "Your profile is private again.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setPublishing(false);
    }
  }

  async function copyLink() {
    if (!publicPath) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
      show("Link copied.");
    } catch {
      show("Couldn't copy. Open the page and copy the address instead.");
    }
  }

  function addSkill() {
    const s = skillDraft.replace(/\s+/g, " ").trim();
    if (!s) return;
    if (s.length > 40) return show("Keep each skill under 40 characters.");
    if (skills.length >= 30) return show("You can list up to 30 skills.");
    if (!skills.some((x) => x.toLowerCase() === s.toLowerCase())) setSkills([...skills, s]);
    setSkillDraft("");
  }

  async function saveAbout(e: React.FormEvent) {
    e.preventDefault();
    setSavingAbout(true);
    try {
      await send("/api/details", { method: "PATCH", body: JSON.stringify({ headline, links, skills }) });
      show("Profile saved.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't save your profile.");
    } finally {
      setSavingAbout(false);
    }
  }

  async function saveKnown() {
    setSavingKnown(true);
    try {
      const data = await send("/api/details", { method: "PATCH", body: JSON.stringify({ knownSkills: [...known] }) });
      setSavedKnown(new Set(known));
      show(data.skipped ? `Plan updated. ${data.skipped} tasks you don't need are skipped.` : "Plan updated. Nothing is skipped.");
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't update your plan.");
    } finally {
      setSavingKnown(false);
    }
  }

  async function upload(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return show("Upload your resume as a PDF.");
    if (file.size > MAX_BYTES) return show("Resumes can be at most 5 MB.");
    setUploading(true);
    try {
      const { path, token } = await send("/api/details/resume/upload", { method: "POST" });
      // Loaded on demand so the Supabase client isn't in the page bundle for everyone.
      const { createClient } = await import("@supabase/supabase-js");
      const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).storage;
      const up = await storage.from("resumes").uploadToSignedUrl(path, token, file, { contentType: "application/pdf", upsert: true });
      if (up.error) throw new Error("The upload didn't go through. Try again.");
      const data = await send("/api/details/resume", { method: "POST", body: JSON.stringify({ name: file.name }) });
      const found: string[] = data.resumeSkills ?? [];
      setResume({ name: data.name, size: data.size, uploadedAt: data.uploadedAt, skills: found });
      const newOnes = found.filter((s) => !known.has(s));
      if (newOnes.length) {
        setKnown(new Set([...known, ...newOnes]));
        show(`Found ${newOnes.length} skill${newOnes.length === 1 ? "" : "s"} in your resume. Check them below, then update your plan.`);
      } else {
        show("Resume saved.");
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't upload your resume.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeResume() {
    setRemoving(true);
    try {
      await send("/api/details/resume", { method: "DELETE" });
      setResume(null);
      show("Resume deleted.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't delete your resume.");
    } finally {
      setRemoving(false);
    }
  }

  const resumeSkills = new Set(resume?.skills ?? []);

  return (
    <>
      <PageHeader title="Profile" description="Your details, your skills and your resume." />

      <div className="space-y-5">
        <section className="panel flex items-center gap-4 p-5 sm:p-6">
          {identity.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={identity.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-full bg-surface object-cover" />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-full bg-surface" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{identity.name ?? "Your account"}</p>
            {identity.email && <p className="truncate text-[14.5px] text-muted">{identity.email}</p>}
            <p className="mt-1 text-[13px] text-faint">Change your name, email or photo from the account menu.</p>
          </div>
        </section>

        <form onSubmit={saveAbout} className="panel p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">About you</h2>
          <p className="mt-1 text-[14.5px] text-muted">A line about yourself and where people can see your work.</p>

          <label className="mt-5 block">
            <span className="text-[14px] font-medium">Headline</span>
            <input className={clsx(field, "mt-1.5")} value={headline} maxLength={120} placeholder={`Aspiring ${roleTitle}`} onChange={(e) => setHeadline(e.target.value)} />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {LINK_FIELDS.map((l) => (
              <label key={l.key} className="block min-w-0">
                <span className="text-[14px] font-medium">{l.label}</span>
                <input
                  className={clsx(field, "mt-1.5")}
                  value={links[l.key] ?? ""}
                  maxLength={300}
                  inputMode="url"
                  placeholder={l.placeholder}
                  onChange={(e) => setLinks({ ...links, [l.key]: e.target.value })}
                />
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label htmlFor="skill-input" className="text-[14px] font-medium">
              Other skills
            </label>
            {skills.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <li key={s} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface pl-3 pr-1.5 text-[14px]">
                    {s}
                    <button type="button" aria-label={`Remove ${s}`} onClick={() => setSkills(skills.filter((x) => x !== s))} className="grid h-6 w-6 place-items-center rounded-full text-faint hover:bg-surface-sunk hover:text-ink">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <input
                id="skill-input"
                className={field}
                value={skillDraft}
                maxLength={40}
                placeholder="Type a skill and press Enter"
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <button type="button" className="btn-outline h-11 shrink-0 text-[14px]" onClick={addSkill}>
                Add
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary mt-6 h-10 text-[14px]" disabled={savingAbout}>
            {savingAbout ? "Saving" : "Save profile"}
          </button>
        </form>

        <section className="panel p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold">Proof of work</h2>
              <p className="mt-1 max-w-xl text-[14.5px] text-muted">Links to what you've built. Add them here, or from any build task when you finish it.</p>
            </div>
            <button type="button" className="btn-outline h-10 shrink-0 text-[14px]" onClick={() => setEditing({ taskKey: null, title: "", proof: null })}>
              <Plus className="h-4 w-4" /> Add a project
            </button>
          </div>
          {proofs.length === 0 ? (
            <p className="mt-5 rounded-xl bg-surface px-4 py-5 text-[14.5px] text-muted">Nothing yet. Your first build task is a good place to start.</p>
          ) : (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {proofs.map((p) => (
                <li key={p.id} className="flex items-start gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-[15px] font-medium hover:text-accent">
                      {p.title}
                    </a>
                    <p className="truncate text-[13px] text-faint">
                      {hostOf(p.url)} · {dateLabel(p.created_at)}
                    </p>
                    {p.note && <p className="mt-1 text-[14px] text-muted">{p.note}</p>}
                  </div>
                  <button type="button" className="btn-quiet h-9 shrink-0 px-3 text-[14px]" onClick={() => setEditing({ taskKey: p.task_key, title: p.title, proof: p })}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold">
            <Globe className="h-[18px] w-[18px] text-muted" /> Public profile
          </h2>
          <p className="mt-1 max-w-xl text-[14.5px] text-muted">
            A page you can send to recruiters or clients: your headline, links, skills, progress and proof of work. Your email and resume are never shown.
          </p>
          <label className="mt-5 block max-w-md">
            <span className="text-[14px] font-medium">Username</span>
            <div className="mt-1.5 flex h-11 items-center overflow-hidden rounded-xl border border-line bg-white transition-colors focus-within:border-accent">
              <span className="shrink-0 pl-3.5 text-[15px] text-faint">/u/</span>
              <input
                className="h-full min-w-0 flex-1 bg-transparent pr-3.5 text-[15px] outline-none"
                value={username}
                maxLength={30}
                autoCapitalize="none"
                spellCheck={false}
                placeholder="yourname"
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              />
            </div>
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            {isPublic ? (
              <>
                {username !== savedUsername && (
                  <button type="button" className="btn-primary h-10 text-[14px]" disabled={publishing || username.length < 3} onClick={() => setPublic(true)}>
                    Save username
                  </button>
                )}
                {publicPath && (
                  <>
                    <a href={publicPath} target="_blank" rel="noopener" className="btn-outline h-10 text-[14px]">
                      <ExternalLink className="h-4 w-4" /> View
                    </a>
                    <button type="button" className="btn-outline h-10 text-[14px]" onClick={copyLink}>
                      <Copy className="h-4 w-4" /> Copy link
                    </button>
                  </>
                )}
                <button type="button" className="btn-quiet h-10 text-[14px]" disabled={publishing} onClick={() => setPublic(false)}>
                  Make private
                </button>
              </>
            ) : (
              <button type="button" className="btn-primary h-10 text-[14px]" disabled={publishing || username.length < 3} onClick={() => setPublic(true)}>
                {publishing ? "Publishing" : "Make my profile public"}
              </button>
            )}
          </div>
          {isPublic && (
            <p className="mt-3 text-[13px] text-faint">
              Changed your name or photo?{" "}
              <button type="button" className="font-medium text-accent hover:underline" disabled={publishing} onClick={() => setPublic(true)}>
                Refresh the public page
              </button>
            </p>
          )}

          <form onSubmit={saveContact} className="mt-6 border-t border-line pt-5">
            <h3 className="text-[15px] font-semibold">Contact details</h3>
            <p className="mt-1 max-w-xl text-[14px] text-muted">
              Shown on your public page and in the downloadable PDF card only if you switch them on. Anyone with your link can see them.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block">
                  <span className="text-[14px] font-medium">Email</span>
                  <input
                    className={clsx(field, "mt-1.5")}
                    type="email"
                    value={contact.email}
                    maxLength={254}
                    placeholder="you@example.com"
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  />
                </label>
                <Switch label="Show email" on={contact.showEmail} disabled={!contact.email.trim()} onChange={(v) => setContact({ ...contact, showEmail: v })} />
              </div>
              <div>
                <label className="block">
                  <span className="text-[14px] font-medium">Phone</span>
                  <input
                    className={clsx(field, "mt-1.5")}
                    type="tel"
                    value={contact.phone}
                    maxLength={24}
                    placeholder="+91 98765 43210"
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  />
                </label>
                <Switch label="Show phone" on={contact.showPhone} disabled={!contact.phone.trim()} onChange={(v) => setContact({ ...contact, showPhone: v })} />
              </div>
            </div>
            <Switch
              label={resume ? "Let visitors download my resume" : "Let visitors download my resume (upload one below first)"}
              on={contact.showResume && !!resume}
              disabled={!resume}
              onChange={(v) => setContact({ ...contact, showResume: v })}
            />
            <button type="submit" className="btn-primary mt-5 h-10 text-[14px]" disabled={savingContact || !contactDirty}>
              {savingContact ? "Saving" : "Save contact details"}
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              PDF card design {!pro && <ProBadge />}
            </h3>
            <div role="radiogroup" aria-label="PDF card design" className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
              {THEMES.map((t) => {
                const active = premium.cardTheme === t.id;
                const locked = t.pro && !pro;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={locked}
                    onClick={() => !active && savePremium({ cardTheme: t.id })}
                    className={clsx(
                      "overflow-hidden rounded-xl border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      active ? "border-accent ring-2 ring-accent-soft" : "border-line hover:border-line-strong"
                    )}
                  >
                    <ThemePreview theme={t.id} />
                    <span className="block px-2.5 py-1.5 text-[13px] font-medium">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Switch
                label="Hide “Made with Pathwise” on my page and card"
                on={premium.hideBranding}
                disabled={!pro}
                onChange={(v) => savePremium({ hideBranding: v })}
              />
              {!pro && <ProBadge className="mt-3" />}
            </div>
            {!pro && <p className="mt-3 text-[13px] text-faint">Short usernames (3 to 5 characters) are also part of Pro.</p>}
          </div>
        </section>

        <ProfileAnalytics stats={stats} pro={pro} isPublic={isPublic} proofTitles={Object.fromEntries(proofs.map((x) => [x.id, x.title]))} />

        {roleSkills.length > 0 && (
        <section className="panel p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">What you already know</h2>
          <p className="mt-1 max-w-xl text-[14.5px] text-muted">
            Tick the {roleTitle} skills you're already comfortable with. We'll skip their learn and practice tasks and keep the projects.
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {roleSkills.map((s) => {
              const on = known.has(s);
              const toggle = () => {
                const n = new Set(known);
                if (on) n.delete(s);
                else n.add(s);
                setKnown(n);
              };
              return (
                <li key={s} className="flex items-center gap-3.5 py-3">
                  <CheckCircle checked={on} onToggle={toggle} label={s} disabled={savingKnown} />
                  <button type="button" onClick={toggle} disabled={savingKnown} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left text-[15px]">
                    <span>{s}</span>
                    {resumeSkills.has(s) && <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[12.5px] font-medium text-accent">In your resume</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn-primary mt-5 h-10 text-[14px]" onClick={saveKnown} disabled={savingKnown || !knownDirty}>
            {savingKnown ? "Updating" : "Update my plan"}
          </button>
        </section>
        )}

        <section className="panel p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">Resume</h2>
          <p className="mt-1 max-w-xl text-[14.5px] text-muted">
            A PDF up to 5 MB. We look for your {roleTitle} skills in it and suggest ticks above. Only you can open the file, and we don't keep its text.
          </p>

          {resume ? (
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
              <FileText className="h-6 w-6 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{resume.name}</p>
                <p className="text-[13px] text-faint">
                  {sizeLabel(resume.size)}
                  {resume.uploadedAt && ` · Uploaded ${dateLabel(resume.uploadedAt)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/api/details/resume" target="_blank" rel="noopener" className="btn-outline h-9 px-4 text-[14px]">
                  Open
                </a>
                <button type="button" className="btn-outline h-9 px-4 text-[14px]" disabled={uploading || removing} onClick={() => fileRef.current?.click()}>
                  {uploading ? "Uploading" : "Replace"}
                </button>
                <button type="button" className="btn h-9 border border-line bg-white px-4 text-[14px] text-red-600 hover:border-red-200 hover:bg-red-50" disabled={uploading || removing} onClick={removeResume}>
                  {removing ? "Deleting" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="mt-5 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center transition-colors hover:bg-surface disabled:opacity-60"
            >
              <Upload className="h-5 w-5 text-muted" />
              <span className="text-[15px] font-medium">{uploading ? "Uploading and reading" : "Upload your resume"}</span>
              <span className="text-[13px] text-faint">PDF, up to 5 MB</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </section>
      </div>

      <ProofDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setProofs((all) => (all.some((x) => x.id === saved.id) ? all.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...all]));
          setEditing(null);
          show("Proof saved.");
        }}
        onRemoved={() => {
          const id = editing?.proof?.id;
          setProofs((all) => all.filter((x) => x.id !== id));
          setEditing(null);
          show("Proof removed.");
        }}
      />
      <Toast message={toast} />
    </>
  );
}

function Switch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="mt-3 flex items-center gap-2.5 text-left text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={clsx("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-surface-sunk")}>
        <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]", on ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

/** A tiny sketch of each PDF card design. */
function ThemePreview({ theme }: { theme: CardTheme }) {
  const dark = theme === "midnight";
  const serif = theme === "minimal";
  return (
    <span className="block h-16 bg-white p-2" aria-hidden="true">
      <span className={clsx("-mx-2 -mt-2 mb-1.5 block", dark ? "h-6 bg-ink px-2 pt-1.5" : theme === "classic" ? "h-1 bg-accent" : "h-0")}>
        {dark && <span className="block h-1.5 w-10 rounded-full bg-white" />}
      </span>
      {!dark && <span className={clsx("block h-1.5 w-10 rounded-full", serif ? "bg-ink" : "bg-ink")} />}
      <span className="mt-1.5 block h-1 w-14 rounded-full bg-line-strong" />
      <span className={clsx("mt-1 block h-1 w-8 rounded-full", serif ? "bg-ink/60" : "bg-accent/70")} />
      <span className="mt-1 block h-1 w-12 rounded-full bg-line" />
    </span>
  );
}
