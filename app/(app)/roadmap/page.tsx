import { requireProfile } from "@/lib/session";
import { getTasks } from "@/lib/data";
import { RoadmapView } from "@/components/roadmap-view";
import { getEntitlement } from "@/lib/pro";
import { proofsByTask } from "@/lib/proofs";
import { NoPlanCTA } from "@/components/no-plan-cta";

export const metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  const { supabase, plan, profile } = await requireProfile();
  if (!plan) return <NoPlanCTA title="Roadmap" line="Your roadmap appears here once you build a plan. It becomes your daily checklist, step by step." />;
  const [tasks, proofs, ent] = await Promise.all([getTasks(supabase, plan), proofsByTask(supabase, plan.id), getEntitlement(supabase)]);
  return (
    <RoadmapView
      outline={plan.outline}
      initialTasks={tasks}
      roleTitle={profile.role_title ?? undefined}
      proofs={proofs}
      pro={ent.pro}
      hiddenCount={plan.hiddenCount}
      edited={plan.edited}
    />
  );
}
