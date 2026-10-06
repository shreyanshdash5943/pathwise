"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6">
      <div className="max-w-md text-center">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">This page didn't load</h1>
        <p className="mt-2 text-[15.5px] text-muted">Something went wrong while loading your data. Try again, and if it keeps happening, sign out and back in.</p>
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/" className="btn-outline">
            Go home
          </Link>
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
