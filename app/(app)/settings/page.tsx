import { requirePlan } from "@/lib/session";
import { QUESTIONS, labelFor } from "@/lib/questions";
import { SettingsView } from "@/components/settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile } = await requirePlan();
  const summary = QUESTIONS.map((q) => ({
    question: q.prompt,
    answer: (profile.answers[q.id] ?? []).map((a) => labelFor(q.id, a)).join(", "),
  }));
  return <SettingsView dailyMinutes={profile.daily_minutes} roleTitle={profile.role_title} summary={summary} />;
}
