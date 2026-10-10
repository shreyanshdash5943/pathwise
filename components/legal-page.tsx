import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./logo";

/** Simple wrapper for the static legal pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <Link href="/" className="btn-quiet h-9 px-3 text-[14px]">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] sm:text-[36px]">{title}</h1>
        <p className="mt-2 text-[14px] text-faint">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[15.5px] leading-relaxed text-ink-soft [&_h2]:mt-8 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:text-ink [&_a]:font-medium [&_a]:text-accent [&_a]:hover:underline [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-8 text-[13.5px] text-faint sm:px-8">© {new Date().getFullYear()} Pathwise</div>
      </footer>
    </div>
  );
}
