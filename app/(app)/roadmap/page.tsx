import { requirePlan } from "@/lib/session";
import { getAllTasks } from "@/lib/data";
import { RoadmapView } from "@/components/roadmap-view";

export const metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  const { supabase, roadmap, profile } = await requirePlan();
  const tasks = await getAllTasks(supabase, roadmap.id);
  return <RoadmapView outline={roadmap.outline} initialTasks={tasks} roleTitle={profile.role_title} />;
}
