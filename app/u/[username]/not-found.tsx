import Link from "next/link";
import { Logo } from "@/components/logo";

export default function ProfileNotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="text-center">
        <Logo className="justify-center" />
        <h1 className="mt-8 text-[24px] font-semibold tracking-[-0.02em]">This profile isn't available</h1>
        <p className="mt-2 text-[15.5px] text-muted">It may be private, or the link may be wrong.</p>
        <Link href="/" className="btn-primary mt-8 h-11">
          Make your own plan
        </Link>
      </div>
    </div>
  );
}
