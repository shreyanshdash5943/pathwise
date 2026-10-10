import { requireProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, plan } = await requireProfile();
  return (
    <AppShell roleTitle={profile.role_title} hasPlan={!!plan}>
      {children}
    </AppShell>
  );
}
