import { requirePlan } from "@/lib/session";
import { getTasks } from "@/lib/data";
import { RoadmapView } from "@/components/roadmap-view";
import { proofsByTask } from "@/lib/proofs";

export const metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  const { supabase, plan, profile } = await requirePlan();
  const [tasks, proofs] = await Promise.all([getTasks(supabase, plan), proofsByTask(supabase, plan.id)]);
  return <RoadmapView outline={plan.outline} initialTasks={tasks} roleTitle={profile.role_title} proofs={proofs} />;
}
