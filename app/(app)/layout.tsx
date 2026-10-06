import { requirePlan } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePlan();
  return <AppShell roleTitle={profile.role_title}>{children}</AppShell>;
}
