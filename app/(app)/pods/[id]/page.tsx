import { notFound } from "next/navigation";
import { loadSession } from "@/lib/session";
import { getPod } from "@/lib/pods";
import { PodRoom } from "@/components/pod-room";

export const metadata = { title: "Pod" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await loadSession();
  const pod = await getPod(supabase, id);
  if (!pod) notFound();
  return <PodRoom pod={pod} />;
}
