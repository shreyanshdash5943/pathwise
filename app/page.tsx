import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Logo } from "@/components/logo";
import { HeroDemo } from "@/components/hero-demo";

const STEPS = [
  {
    title: "Answer ten questions",
    body: "Tap through multiple-choice questions about where you are, what you enjoy and how much time you have. It takes about two minutes.",
  },
  {
    title: "Pick your route",
    body: "Pathwise suggests the roles that fit you best, with honest notes on demand, difficulty and time to get ready. You choose.",
  },
  {
    title: "Do today's list",
    body: "Each day you get a short checklist sized to the time you have. Miss a day and the plan moves with you instead of piling up.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1.5">
          <SignedOut>
            <Link href="/sign-in" className="btn-quiet h-10 px-4 text-[14px]">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn-dark h-10 px-4 text-[14px]">
              Get started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn-dark h-10 px-4 text-[14px]">
              Open Pathwise
            </Link>
          </SignedIn>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pt-16">
          <div className="max-w-xl">
            <h1 className="text-display font-semibold text-ink">A career plan that tells you what to do today.</h1>
            <p className="mt-6 max-w-[34rem] text-[18px] leading-relaxed text-muted">
              Answer a few quick questions. Pathwise maps a route to the role you want, then turns it into a short checklist each
              day that adjusts when life gets busy.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <SignedOut>
                <Link href="/sign-up" className="btn-primary h-12 px-6 text-[16px]">
                  Build my plan
                </Link>
                <Link href="/sign-in" className="btn-outline h-12 px-6 text-[16px]">
                  I have an account
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard" className="btn-primary h-12 px-6 text-[16px]">
                  Go to today
                </Link>
              </SignedIn>
            </div>
            <p className="mt-5 text-[14px] text-faint">Free to start. For students, early-career and experienced people alike.</p>
          </div>
          <HeroDemo />
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="max-w-lg text-title font-semibold">From not sure where to start, to knowing your next step.</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="tabular grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-white text-[14px] font-semibold">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                  <p className="mt-2 max-w-sm text-[15.5px] leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="text-title font-semibold">Built around how people actually stick with things.</h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">
              Small daily lists instead of a wall of goals. A streak that shows your consistency. Milestones that end in something
              you can show an employer.
            </p>
          </div>
          <dl className="grid gap-7 sm:grid-cols-2">
            {[
              ["Daily checklist", "Sized to the time you said you have, never more."],
              ["Roadmap", "Phases and milestones you can open up and look ahead on."],
              ["Field news", "A short daily feed of what's happening in your field."],
              ["Streaks", "A simple count of the days in a row you showed up."],
            ].map(([t, d]) => (
              <div key={t} className="border-l-2 border-line pl-4">
                <dt className="text-[15.5px] font-semibold">{t}</dt>
                <dd className="mt-1 text-[14.5px] leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="px-5 pb-20 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[28px] bg-ink px-8 py-12 text-white sm:px-12 md:flex-row md:items-center">
            <div>
              <h2 className="text-title font-semibold">Your first checklist is two minutes away.</h2>
              <p className="mt-2 text-[16px] text-white/60">No credit card. Change your path any time.</p>
            </div>
            <SignedOut>
              <Link href="/sign-up" className="btn h-12 bg-white px-6 text-[16px] text-ink hover:bg-white/90">
                Build my plan
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="btn h-12 bg-white px-6 text-[16px] text-ink hover:bg-white/90">
                Go to today
              </Link>
            </SignedIn>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-5 py-8 text-[13.5px] text-faint sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} Pathwise</span>
          <span>Plan the route. Walk it daily.</span>
        </div>
      </footer>
    </div>
  );
}
