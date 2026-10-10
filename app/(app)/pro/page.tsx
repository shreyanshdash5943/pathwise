import { BarChart3, Check, Palette, Snowflake, SquarePen } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { FREEZES_PER_MONTH, PRO_PRICE, getEntitlement } from "@/lib/pro";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Pathwise Pro" };

const FEATURES = [
  {
    icon: BarChart3,
    title: "Profile analytics",
    body: "See who's looking: daily views of your public page, PDF and resume downloads, and which of your links people clicked.",
  },
  {
    icon: SquarePen,
    title: "Edit your roadmap",
    body: "Add your own tasks, remove ones that don't fit, and change the order. Your plan, your way.",
  },
  {
    icon: Snowflake,
    title: "Streak freezes",
    body: `Miss a day and your streak survives. ${FREEZES_PER_MONTH} freezes a month, used automatically.`,
  },
  {
    icon: Palette,
    title: "Premium profile",
    body: "A short username like /u/sam, two extra PDF card designs, and no Pathwise footer on your page or card.",
  },
];

export default async function ProPage() {
  const { supabase } = await requireProfile();
  const ent = await getEntitlement(supabase);
  const until = ent.until ? new Date(ent.until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

  return (
    <>
      <PageHeader title="Pathwise Pro" description="Everything in the free plan stays free. Pro adds tools for when you're getting serious." />

      {ent.pro ? (
        <div className="panel mb-5 flex items-center gap-3 border-accent-line bg-accent-soft/50 p-5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-white">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <p className="text-[15px]">
            You&apos;re on Pro{until && <span className="text-muted"> until {until}</span>}. Thanks for supporting Pathwise.
          </p>
        </div>
      ) : (
        <div className="panel mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-[24px] font-semibold tracking-[-0.02em]">
              {PRO_PRICE.monthly}
              <span className="text-[15px] font-normal text-muted"> a month, or {PRO_PRICE.yearly} a year</span>
            </p>
            <p className="mt-1 text-[14px] text-muted">Payments open soon. Pro features are already built and waiting.</p>
          </div>
          <button type="button" disabled className="btn-primary h-11 shrink-0 cursor-not-allowed text-[15px] opacity-60">
            Coming soon
          </button>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.title} className="panel p-5 sm:p-6">
            <f.icon className="h-5 w-5 text-accent" />
            <h2 className="mt-3 text-[16.5px] font-semibold">{f.title}</h2>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{f.body}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
