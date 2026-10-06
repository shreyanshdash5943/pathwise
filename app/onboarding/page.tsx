import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getSupabase } from "@/lib/supabase";
import { getProfile } from "@/lib/data";
import { Onboarding } from "@/components/onboarding";

export const metadata = { title: "Build your plan" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ retake?: string }> }) {
  const { retake } = await searchParams;
  const { supabase } = await getSupabase();
  const [profile, user] = await Promise.all([getProfile(supabase), currentUser()]);
  if (profile && retake !== "1") redirect("/dashboard");
  return <Onboarding firstName={user?.firstName ?? null} />;
}
