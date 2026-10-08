import Link from "next/link";
import { Sparkles } from "lucide-react";

/** Small "Pro" chip that explains what Pro is when clicked. */
export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/pro"
      className={`inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-accent hover:bg-accent-line/60 ${className}`}
    >
      <Sparkles className="h-3 w-3" /> Pro
    </Link>
  );
}
