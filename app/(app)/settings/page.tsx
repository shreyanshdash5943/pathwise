import { requireProfile } from "@/lib/session";
import { QUESTIONS, labelFor } from "@/lib/questions";
import { SettingsView } from "@/components/settings-view";
import { getReminderPrefs } from "@/lib/reminders";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, plan, supabase } = await requireProfile();
  const reminders = await getReminderPrefs(supabase).catch(() => null);
  const summary =
    plan && profile.answers
      ? QUESTIONS.map((q) => ({ question: q.prompt, answer: (profile.answers?.[q.id] ?? []).map((a) => labelFor(q.id, a)).join(", ") }))
      : [];
  return (
    <SettingsView
      hasPlan={!!plan}
      dailyMinutes={profile.daily_minutes}
      roleTitle={profile.role_title ?? ""}
      summary={summary}
      reminders={reminders}
    />
  );
}
