import { loadSession } from "@/lib/session";
import { getMyPods } from "@/lib/pods";
import { PodsHome } from "@/components/pods-home";

export const metadata = { title: "Pods" };

export default async function PodsPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const { supabase } = await loadSession();
  const pods = await getMyPods(supabase);
  const prefill = typeof code === "string" ? code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) : "";
  return <PodsHome initial={pods} prefillCode={prefill} />;
}
