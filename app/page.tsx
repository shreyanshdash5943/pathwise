import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { BarChart3, Check, Instagram, ListChecks, Map, MessagesSquare, Users } from "lucide-react";
import { LandingNav } from "@/components/landing-nav";
import { Logo } from "@/components/logo";
import { HeroDemo } from "@/components/hero-demo";
import { PRO_PRICE } from "@/lib/pro";

const FEATURES = [
  { icon: Map, title: "A plan that adapts", body: "Answer a few questions and get a roadmap that turns into a short daily checklist, sized to the time you actually have." },
  { icon: ListChecks, title: "Or just track habits", body: "Not ready for a plan? Start in two taps. Add daily habits like “LeetCode daily”, keep notes, and build streaks." },
  { icon: BarChart3, title: "Proof of work", body: "Turn finished projects into a shareable public profile and a downloadable PDF card recruiters can open." },
  { icon: Users, title: "Accountability pods", body: "Join a small group of friends or classmates, see each other’s streaks, and cheer each other on." },
  { icon: MessagesSquare, title: "Interview prep", body: "Track your applications and build STAR answers from the projects you actually shipped." },
  { icon: Check, title: "Reminders & streaks", body: "A gentle daily nudge and a streak that quietly keeps you consistent, in your own timezone." },
];

const STEPS = [
  { title: "Start in two taps", body: "Build a career plan from a few quick questions, or skip it and just start tracking habits. You can switch any time." },
  { title: "Do today's list", body: "Each day you get a short, realistic checklist. Miss a day and it moves with you instead of piling up." },
  { title: "Build proof, get hired", body: "Finish real projects, collect them on a public profile, and walk into interviews with answers ready." },
];

const FREE = ["A full career plan and daily checklist", "Unlimited habits with notes", "Proof of work and a public profile", "Accountability pods", "Application tracker and interview prep", "Reminders and streaks"];
const PRO = ["Everything in Free", "See who viewed your profile", "Edit your own roadmap", "Streak freezes for missed days", "A short username and premium profile", "Extra PDF card designs"];

const FAQ = [
  { q: "Is it really free?", a: "Yes. The whole core — plan, daily checklist, habits, proof of work, public profile, pods, interview prep and reminders — is free, forever. Pro is an optional upgrade for a few extras." },
  { q: "Do I have to pick a career?", a: "No. You can skip the plan entirely and just track habits like a daily coding problem. Build a plan later whenever you're ready — it's one button." },
  { q: "What fields does it cover?", a: "Eighteen roles across software, data & AI, design, product management, cybersecurity, and cloud & DevOps — with honest notes on demand, difficulty and time to get ready." },
  { q: "How much time does it take a day?", a: "You tell Pathwise how much time you have, and the daily list is sized to fit. As little as 15 minutes still moves you forward." },
  { q: "Can I use it with friends?", a: "Yes. Pods are small invite-only groups where you see each other's progress and keep each other going — the single biggest thing that helps people stick with it." },
  { q: "What about my data?", a: "Your profile is private by default. Nothing is public unless you turn on a public profile, and even then your email, phone and resume stay hidden unless you choose to show them." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-white">
      <LandingNav />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pt-16">
          <div className="max-w-xl">
            <h1 className="text-display font-semibold text-ink">A career plan that tells you what to do today.</h1>
            <p className="mt-6 max-w-[34rem] text-[18px] leading-relaxed text-muted">
              Answer a few quick questions. Pathwise maps a route to the role you want, then turns it into a short checklist each day
              that adjusts when life gets busy. Or skip the plan and just track your habits.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <SignedOut>
                <Link href="/sign-up" className="btn-primary h-12 px-6 text-[16px]">
                  Get started free
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

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="max-w-xl text-title font-semibold">Everything you need to go from “where do I start” to hired.</h2>
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted">One place for the plan, the daily habit, the proof, and the people who keep you going.</p>
            <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-accent shadow-sm ring-1 ring-line">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                  <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-muted">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="max-w-lg text-title font-semibold">From not sure where to start, to knowing your next step.</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="tabular grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-white text-[14px] font-semibold">{i + 1}</span>
                  <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                  <p className="mt-2 max-w-sm text-[15.5px] leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
            <div className="text-center">
              <h2 className="text-title font-semibold">Simple pricing</h2>
              <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-muted">The core is free forever. Upgrade only if you want the extras.</p>
            </div>
            <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
              <div className="panel flex flex-col p-6 sm:p-8">
                <h3 className="text-[17px] font-semibold">Free</h3>
                <p className="mt-2 text-[32px] font-semibold tracking-[-0.02em]">₹0</p>
                <p className="text-[14px] text-muted">Everything you need to get moving.</p>
                <ul className="mt-6 space-y-2.5">
                  {FREE.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14.5px]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} /> {f}
                    </li>
                  ))}
                </ul>
                <SignedOut>
                  <Link href="/sign-up" className="btn-outline mt-7 h-11">
                    Get started
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link href="/dashboard" className="btn-outline mt-7 h-11">
                    Open Pathwise
                  </Link>
                </SignedIn>
              </div>
              <div className="panel relative flex flex-col border-accent-line bg-white p-6 ring-1 ring-accent-line sm:p-8">
                <span className="absolute right-5 top-5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-accent">Pro</span>
                <h3 className="text-[17px] font-semibold">Pro</h3>
                <p className="mt-2 text-[32px] font-semibold tracking-[-0.02em]">
                  {PRO_PRICE.monthly}
                  <span className="text-[15px] font-normal text-muted"> /month</span>
                </p>
                <p className="text-[14px] text-muted">or {PRO_PRICE.yearly} a year. Cancel any time.</p>
                <ul className="mt-6 space-y-2.5">
                  {PRO.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14.5px]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} /> {f}
                    </li>
                  ))}
                </ul>
                <SignedOut>
                  <Link href="/sign-up" className="btn-primary mt-7 h-11">
                    Start free, upgrade later
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link href="/pro" className="btn-primary mt-7 h-11">
                    See Pro
                  </Link>
                </SignedIn>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ — native details, no JS needed */}
        <section id="faq" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
            <h2 className="text-center text-title font-semibold">Questions, answered</h2>
            <div className="mt-10 divide-y divide-line border-y border-line">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="pb-4 pr-10 text-[15px] leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 pb-20 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[28px] bg-ink px-8 py-12 text-white sm:px-12 md:flex-row md:items-center">
            <div>
              <h2 className="text-title font-semibold">Your first step is two minutes away.</h2>
              <p className="mt-2 text-[16px] text-white/60">No credit card. Build a plan, or just start a habit.</p>
            </div>
            <SignedOut>
              <Link href="/sign-up" className="btn h-12 shrink-0 bg-white px-6 text-[16px] text-ink hover:bg-white/90">
                Get started free
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="btn h-12 shrink-0 bg-white px-6 text-[16px] text-ink hover:bg-white/90">
                Go to today
              </Link>
            </SignedIn>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-3 text-[14px] leading-relaxed text-muted">A career plan you can actually follow — one short checklist at a time.</p>
              <a
                href="https://www.instagram.com/pathwise_101"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pathwise on Instagram"
                className="mt-4 grid h-10 w-10 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:border-accent-line hover:text-accent"
              >
                <Instagram className="h-[18px] w-[18px]" />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-14">
              <FooterCol title="Product" links={[["Features", "#features"], ["How it works", "#how"], ["Pricing", "#pricing"], ["FAQ", "#faq"]]} />
              <FooterCol title="Account" links={[["Sign in", "/sign-in"], ["Get started", "/sign-up"]]} />
              <FooterCol title="Legal" links={[["Privacy", "/privacy"], ["Terms", "/terms"]]} />
            </div>
          </div>
          <div className="mt-10 flex flex-col justify-between gap-2 border-t border-line pt-6 text-[13.5px] text-faint sm:flex-row">
            <span>© {new Date().getFullYear()} Pathwise</span>
            <span>Plan the route. Walk it daily.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-faint">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[14.5px] text-ink-soft hover:text-accent">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
