import Link from "next/link";
import { Map } from "lucide-react";
import { PageHeader } from "./page-header";

/** Shown on plan-only pages when a habits-only user hasn't built a career plan yet. */
export function NoPlanCTA({ title, description, line }: { title: string; description?: string; line: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="panel flex flex-col items-center gap-4 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Map className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[17px] font-semibold">No career plan yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[14.5px] text-muted">{line}</p>
        </div>
        <Link href="/onboarding?build=1" className="btn-primary h-11">
          Build my plan
        </Link>
      </div>
    </>
  );
}
