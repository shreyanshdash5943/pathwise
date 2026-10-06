import Link from "next/link";
import clsx from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={clsx("h-7 w-7", className)} aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#101216" />
      <path d="M7 19.5c3.2 0 4.2-2.4 5.6-5.3C14 11.3 15.3 8.5 21 8.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="21" cy="8.5" r="2.4" fill="#1F5EEA" stroke="#fff" strokeWidth="1.4" />
      <circle cx="7" cy="19.5" r="1.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-2.5 rounded-lg", className)} aria-label="Pathwise home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">Pathwise</span>
    </Link>
  );
}
