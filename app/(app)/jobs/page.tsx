import { requirePlan } from "@/lib/session";
import { listApplications, listAnswers } from "@/lib/prep";
import { listProofs } from "@/lib/proofs";
import { JobsView } from "@/components/jobs-view";

export const metadata = { title: "Getting hired" };

export default async function JobsPage() {
  const { supabase, profile, plan } = await requirePlan();
  const [applications, answers, proofs] = await Promise.all([listApplications(supabase), listAnswers(supabase), listProofs(supabase)]);
  return (
    <JobsView
      field={profile.field}
      roleTitle={plan.role.title}
      applications={applications}
      answers={answers}
      proofs={proofs.map((p) => ({ id: p.id, title: p.title, note: p.note }))}
    />
  );
}
