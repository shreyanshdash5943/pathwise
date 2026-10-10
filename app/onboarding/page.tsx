import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { loadProfileAndPlan } from "@/lib/plans";
import { Onboarding } from "@/components/onboarding";

export const metadata = { title: "Get started" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ retake?: string; build?: string }> }) {
  const { retake, build } = await searchParams;
  const { supabase } = await getSupabase();
  const [{ plan }, user] = await Promise.all([loadProfileAndPlan(supabase), currentUser()]);
  // Someone who already has a plan only lands here to deliberately rebuild it.
  if (plan && retake !== "1" && build !== "1") redirect("/dashboard");
  // Intro choice for new or habits-only users; skip straight to questions when building.
  const showIntro = retake !== "1" && build !== "1";
  return <Onboarding firstName={user?.firstName ?? null} showIntro={showIntro} />;
}
