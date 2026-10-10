"use client";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  // Lock scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-[14.5px] font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
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
        </div>

        <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-ink md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-3 sm:px-8" aria-label="Sections">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-[16px] font-medium text-ink-soft hover:bg-surface">
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              <SignedOut>
                <Link href="/sign-up" className="btn-dark h-11 text-[15px]" onClick={() => setOpen(false)}>
                  Get started
                </Link>
                <Link href="/sign-in" className="btn-outline h-11 text-[15px]" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard" className="btn-dark h-11 text-[15px]" onClick={() => setOpen(false)}>
                  Open Pathwise
                </Link>
              </SignedIn>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
