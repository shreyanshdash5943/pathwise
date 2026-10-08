"use client";
import { BarChart3 } from "lucide-react";
import { ProBadge } from "./pro-badge";

type Stats = {
  days: number;
  views: number;
  cards: number;
  resumes: number;
  links: { target: string; n: number }[];
  daily: { date: string; views: number }[];
};

const LINK_LABEL: Record<string, string> = { github: "GitHub", linkedin: "LinkedIn", portfolio: "Portfolio" };

/** Analytics for the public profile. Free shows the headline number; Pro shows everything. */
export function ProfileAnalytics({ stats, pro, isPublic, proofTitles }: { stats: Stats | null; pro: boolean; isPublic: boolean; proofTitles: Record<string, string> }) {
  const label = (target: string) => LINK_LABEL[target] ?? (target.startsWith("proof-") ? proofTitles[target.slice(6)] ?? "A project" : target);

  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold">
          <BarChart3 className="h-[18px] w-[18px] text-muted" /> Profile analytics
        </h2>
        {!pro && <ProBadge />}
      </div>

      {!isPublic ? (
        <p className="mt-2 text-[14.5px] text-muted">Make your profile public to start seeing who visits it.</p>
      ) : !stats ? (
        <p className="mt-2 text-[14.5px] text-muted">Analytics aren&apos;t set up on this server yet.</p>
      ) : !pro ? (
        <>
          <p className="mt-3 text-[15px]">
            <span className="tabular text-[28px] font-semibold tracking-[-0.02em]">{stats.views}</span>{" "}
            <span className="text-muted">
              {stats.views === 1 ? "view" : "views"} of your public page in the last {stats.days} days
            </span>
          </p>
          <p className="mt-2 text-[14px] text-muted">
            With Pro, see the daily trend, how many people downloaded your card and resume, and which links they clicked.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-[14px] text-muted">Last {stats.days} days. Each visitor counts once a day; your own visits don&apos;t count.</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Views", stats.views],
              ["Card downloads", stats.cards],
              ["Resume downloads", stats.resumes],
              ["Link clicks", stats.links.reduce((a, l) => a + l.n, 0)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface px-4 py-3">
                <dt className="text-[12.5px] text-muted">{k}</dt>
                <dd className="tabular mt-0.5 text-[22px] font-semibold tracking-[-0.02em]">{v}</dd>
              </div>
            ))}
          </dl>

          <Sparkbars daily={stats.daily} />

          {stats.links.length > 0 && (
            <div className="mt-5">
              <h3 className="text-[13px] font-medium text-muted">Most clicked</h3>
              <ul className="mt-2 space-y-1.5">
                {stats.links.slice(0, 6).map((l) => {
                  const max = stats.links[0].n || 1;
                  return (
                    <li key={l.target} className="flex items-center gap-3 text-[14px]">
                      <span className="w-40 shrink-0 truncate sm:w-56">{label(l.target)}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunk">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${(l.n / max) * 100}%` }} />
                      </span>
                      <span className="tabular w-8 shrink-0 text-right text-muted">{l.n}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Sparkbars({ daily }: { daily: { date: string; views: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div className="mt-5">
      <div className="flex h-20 items-end gap-[3px]" role="img" aria-label="Views per day">
        {daily.map((d) => (
          <span
            key={d.date}
            title={`${d.views} ${d.views === 1 ? "view" : "views"} on ${fmt(d.date)}`}
            className={d.views ? "flex-1 rounded-t-[3px] bg-accent/80" : "flex-1 rounded-t-[3px] bg-surface-sunk"}
            style={{ height: d.views ? `${Math.max(8, (d.views / max) * 100)}%` : "6%" }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-faint">
        <span>{fmt(daily[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
