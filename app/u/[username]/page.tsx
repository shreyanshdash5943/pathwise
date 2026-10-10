import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Download, ExternalLink, FileText, Mail, Phone } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/logo";
import { cleanUsername, getPublicProfile } from "@/lib/public-profile";
import { recordProfileEvent } from "@/lib/analytics";

type Params = { params: Promise<{ username: string }> };

async function load(username: string) {
  const u = cleanUsername(username);
  if (!u.ok) return null;
  return getPublicProfile(u.value);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  const p = await load(username).catch(() => null);
  if (!p) return { title: "Profile not found", robots: { index: false } };
  const name = p.displayName ?? `@${p.username}`;
  const description = p.headline || (p.roleTitle ? `Working towards ${p.roleTitle}.` : "On Pathwise.");
  return {
    title: name,
    description,
    openGraph: { title: `${name} on Pathwise`, description, type: "profile", images: p.avatarUrl ? [{ url: p.avatarUrl }] : undefined },
    twitter: { card: "summary", title: `${name} on Pathwise`, description },
  };
}

const LINK_LABEL = { github: "GitHub", linkedin: "LinkedIn", portfolio: "Portfolio" } as const;

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

export default async function PublicProfilePage({ params }: Params) {
  const { username } = await params;
  const p = await load(username);
  if (!p) notFound();
  await recordProfileEvent(p.username, "view");

  const name = p.displayName ?? `@${p.username}`;
  const pct = p.progress && p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;
  const links = (Object.keys(LINK_LABEL) as (keyof typeof LINK_LABEL)[]).filter((k) => p.links[k]);
  const allSkills = Array.from(new Set([...p.knownSkills, ...p.skills]));

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link href="/" className="btn-outline h-9 px-4 text-[13.5px]">
            Make your own plan
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">
        <section className="panel p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {p.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatarUrl} alt={name} className="h-20 w-20 shrink-0 rounded-full bg-surface object-cover" />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-accent-soft text-[28px] font-semibold text-accent">
                {name.replace("@", "").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[30px]">{name}</h1>
              {p.headline && <p className="mt-1 text-[16px] text-ink-soft">{p.headline}</p>}
              {p.roleTitle && (
                <p className="mt-1.5 text-[14.5px] text-muted">
                  Working towards <span className="font-medium text-ink">{p.roleTitle}</span>
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {p.email && (
              <a href={`mailto:${p.email}`} className="btn-primary h-9 px-4 text-[14px]">
                <Mail className="h-4 w-4" /> {p.email}
              </a>
            )}
            {p.phone && (
              <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="btn-outline h-9 px-4 text-[14px]">
                <Phone className="h-4 w-4 text-muted" /> {p.phone}
              </a>
            )}
            {links.map((k) => (
              <a key={k} href={`/u/${p.username}/go?to=${k}`} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn-outline h-9 px-4 text-[14px]">
                {LINK_LABEL[k]} <ExternalLink className="h-3.5 w-3.5 text-faint" />
              </a>
            ))}
            {p.hasResume && (
              <a href={`/u/${p.username}/resume`} className="btn-outline h-9 px-4 text-[14px]" rel="nofollow">
                <FileText className="h-4 w-4 text-muted" /> Resume
              </a>
            )}
            <a href={`/u/${p.username}/card`} className="btn-outline h-9 px-4 text-[14px]" rel="nofollow" download>
              <Download className="h-4 w-4 text-muted" /> Download PDF
            </a>
          </div>
        </section>

        {p.progress && (
          <section className="panel p-6 sm:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-semibold">Progress</h2>
                <p className="mt-1 text-[14.5px] text-muted">
                  {p.progress.done} of {p.progress.total} tasks done since {monthYear(p.progress.startedAt)}
                </p>
              </div>
              <span className="tabular text-[28px] font-semibold tracking-[-0.02em]">{pct}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {p.progress.phases.map((ph, i) => {
                const complete = ph.total > 0 && ph.done === ph.total;
                return (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
                    <span
                      className={clsx(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold",
                        complete ? "bg-accent text-white" : "bg-white text-muted ring-1 ring-line"
                      )}
                    >
                      {complete ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{ph.title}</span>
                    <span className="tabular shrink-0 text-[13px] text-faint">
                      {ph.done}/{ph.total}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="panel p-6 sm:p-8">
          <h2 className="text-[17px] font-semibold">Proof of work</h2>
          {p.proofs.length === 0 ? (
            <p className="mt-2 text-[14.5px] text-muted">Nothing shared yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {p.proofs.map((pr) => (
                <li key={pr.id}>
                  <a
                    href={`/u/${p.username}/go?to=proof-${pr.id}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="flex h-full flex-col rounded-xl border border-line p-4 transition-colors hover:border-accent-line hover:bg-accent-soft/40"
                  >
                    <span className="text-[15px] font-semibold leading-snug">{pr.title}</span>
                    {pr.note && <span className="mt-1.5 text-[14px] leading-relaxed text-muted">{pr.note}</span>}
                    <span className="mt-auto flex items-center gap-1.5 pt-3 text-[13px] text-faint">
                      <ExternalLink className="h-3.5 w-3.5" /> {host(pr.url)} · {monthYear(pr.created_at)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {allSkills.length > 0 && (
          <section className="panel p-6 sm:p-8">
            <h2 className="text-[17px] font-semibold">Skills</h2>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {allSkills.map((s) => (
                <li key={s} className="rounded-full bg-surface px-3 py-1.5 text-[14px]">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!p.hideBranding && (
          <p className="pt-4 text-center text-[13.5px] text-faint">
            Built with{" "}
            <Link href="/" className="font-medium text-muted hover:text-accent">
              Pathwise
            </Link>
            , a daily plan for your next career step.
          </p>
        )}
      </main>
    </div>
  );
}
