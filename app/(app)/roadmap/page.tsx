import { requirePlan } from "@/lib/session";
import { getTasks } from "@/lib/data";
import { RoadmapView } from "@/components/roadmap-view";
import { getEntitlement } from "@/lib/pro";
import { proofsByTask } from "@/lib/proofs";

export const metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  const { supabase, plan, profile } = await requirePlan();
  const [tasks, proofs, ent] = await Promise.all([getTasks(supabase, plan), proofsByTask(supabase, plan.id), getEntitlement(supabase)]);
  return (
    <RoadmapView
      outline={plan.outline}
      initialTasks={tasks}
      roleTitle={profile.role_title}
      proofs={proofs}
      pro={ent.pro}
      hiddenCount={plan.hiddenCount}
      edited={plan.edited}
    />
  );
}
