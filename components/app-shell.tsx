"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Briefcase, CalendarCheck2, Map, Newspaper, Settings2, Sparkles, Users, UserRound } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Today", icon: CalendarCheck2, mobile: true },
  { href: "/roadmap", label: "Roadmap", icon: Map, mobile: true },
  { href: "/pods", label: "Pods", icon: Users, mobile: true },
  { href: "/jobs", label: "Jobs", icon: Briefcase, mobile: true },
  { href: "/news", label: "News", icon: Newspaper, mobile: false },
  { href: "/profile", label: "Profile", icon: UserRound, mobile: true },
  { href: "/settings", label: "Settings", icon: Settings2, mobile: true },
];
const MOBILE_NAV = NAV.filter((n) => n.mobile);

export function AppShell({ children, roleTitle, hasPlan }: { children: React.ReactNode; roleTitle: string | null; hasPlan: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r border-line bg-white px-4 py-5 lg:flex">
        <Logo href="/dashboard" className="px-2" />
        {hasPlan && roleTitle ? (
          <div className="mt-6 rounded-xl bg-surface px-3 py-2.5">
            <p className="text-[12.5px] text-muted">Working towards</p>
            <p className="mt-0.5 truncate text-[14.5px] font-semibold">{roleTitle}</p>
          </div>
        ) : (
          <Link href="/onboarding?build=1" className="mt-6 block rounded-xl bg-accent-soft px-3 py-2.5 transition-colors hover:bg-accent-line/50">
            <p className="text-[12.5px] text-accent">Tracking habits</p>
            <p className="mt-0.5 text-[14px] font-semibold text-accent">Build a career plan →</p>
          </Link>
        )}
        <nav className="mt-6 flex flex-col gap-0.5" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex h-10 items-center gap-3 rounded-full px-3.5 text-[14.5px] font-medium transition-colors duration-200",
                  active ? "text-accent" : "text-ink-soft hover:bg-surface"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-accent-soft"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  />
                )}
                <Icon className="relative h-[18px] w-[18px]" strokeWidth={2} />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          href="/pro"
          className={clsx(
            "mt-auto mb-4 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition-colors",
            isActive("/pro") ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface"
          )}
        >
          <Sparkles className="h-[18px] w-[18px] text-accent" /> Pathwise Pro
        </Link>
        <div className="flex items-center gap-3 px-2">
          <UserButton appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }} />
          <span className="text-[13.5px] text-muted">Account</span>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <Logo href="/dashboard" />
        <UserButton />
      </header>

      <main className="pb-24 lg:pb-0 lg:pl-[248px]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx("flex flex-col items-center gap-1 py-2.5 text-[11.5px] font-medium", active ? "text-accent" : "text-muted")}
            >
              <span className="relative grid h-7 w-10 place-items-center">
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-accent-soft"
                    transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  />
                )}
                <Icon className="relative h-[19px] w-[19px]" />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
