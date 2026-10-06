import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6">
      <div className="max-w-md text-center">
        <p className="tabular text-[14px] font-semibold text-faint">404</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">There's no page here</h1>
        <p className="mt-2 text-[15.5px] text-muted">The link may be old or mistyped.</p>
        <Link href="/dashboard" className="btn-primary mt-7">
          Go to today
        </Link>
      </div>
    </div>
  );
}
