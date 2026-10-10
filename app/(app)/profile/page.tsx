import { currentUser } from "@clerk/nextjs/server";
import { requireProfile } from "@/lib/session";
import { getDetails } from "@/lib/details";
import { listProofs } from "@/lib/proofs";
import { getEntitlement } from "@/lib/pro";
import { getProfileStats } from "@/lib/analytics";
import { profileToday } from "@/lib/data";
import { ProfileView } from "@/components/profile-view";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { supabase, plan, profile } = await requireProfile();
  const [details, user, proofs, ent, stats] = await Promise.all([
    getDetails(supabase),
    currentUser(),
    listProofs(supabase),
    getEntitlement(supabase),
    getProfileStats(supabase, profileToday(profile)),
  ]);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const suggested = (user?.username || name || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 30);

  return (
    <ProfileView
      identity={{ name: name || null, email: user?.primaryEmailAddress?.emailAddress ?? null, imageUrl: user?.imageUrl ?? null }}
      roleTitle={profile.role_title ?? ""}
      roleSkills={plan?.role.skills ?? []}
      initial={{
        headline: details?.headline ?? "",
        links: details?.links ?? {},
        skills: details?.skills ?? [],
        knownSkills: (details?.known_skills ?? []).filter((s) => (plan?.role.skills ?? []).includes(s)),
        resume: details?.resume_hash
          ? { name: details.resume_name ?? "resume.pdf", size: details.resume_size ?? 0, uploadedAt: details.resume_uploaded_at, skills: details.resume_skills }
          : null,
        username: details?.username ?? (suggested.length >= 3 ? suggested : ""),
        isPublic: details?.is_public ?? false,
        contact: {
          email: details?.contact_email ?? user?.primaryEmailAddress?.emailAddress ?? "",
          phone: details?.phone ?? "",
          showEmail: details?.show_email ?? false,
          showPhone: details?.show_phone ?? false,
          showResume: details?.show_resume ?? false,
        },
        proofs,
        premium: { hideBranding: details?.hide_branding ?? false, cardTheme: details?.card_theme ?? "classic" },
      }}
      pro={ent.pro}
      stats={stats}
    />
  );
}
