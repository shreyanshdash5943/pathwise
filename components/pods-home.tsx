"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "./page-header";
import { Toast, useToast } from "./toast";

type PodSummary = { id: string; name: string; members: number; is_owner: boolean };
const field = "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent";

async function send(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

export function PodsHome({ initial, prefillCode }: { initial: PodSummary[]; prefillCode: string }) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState(prefillCode);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await send("/api/pods", { name });
      router.push(`/pods/${id}`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't create the pod.");
      setBusy(false);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await send("/api/pods/join", { code });
      router.push(`/pods/${id}`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't join that pod.");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Pods"
        description="A small group who keep each other going. Share a plan with friends or classmates, see each other's streaks, and cheer each other on."
      />

      {initial.length > 0 && (
        <ul className="mb-6 space-y-2.5">
          {initial.map((p) => (
            <li key={p.id}>
              <Link href={`/pods/${p.id}`} className="panel flex items-center gap-4 p-4 transition-colors hover:border-accent-line sm:p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Users className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{p.name}</span>
                  <span className="text-[13.5px] text-muted">
                    {p.members} {p.members === 1 ? "member" : "members"}
                    {p.is_owner && " · you created this"}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {initial.length < 3 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <form onSubmit={join} className="panel p-5 sm:p-6">
            <h2 className="text-[16.5px] font-semibold">Join a pod</h2>
            <p className="mt-1 text-[14px] text-muted">Got an invite code from a friend? Enter it here.</p>
            <input
              className={`${field} mt-4 uppercase tracking-[0.1em]`}
              value={code}
              maxLength={10}
              placeholder="ABC1234"
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            <button type="submit" className="btn-outline mt-4 h-10 w-full text-[14px]" disabled={busy || code.length < 5}>
              Join pod
            </button>
          </form>

          <form onSubmit={create} className="panel p-5 sm:p-6">
            <h2 className="text-[16.5px] font-semibold">Start a pod</h2>
            <p className="mt-1 text-[14px] text-muted">Create one and share the invite code. Up to 6 people.</p>
            <input className={`${field} mt-4`} value={name} maxLength={40} placeholder="Frontend crew" onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="btn-primary mt-4 h-10 w-full text-[14px]" disabled={busy || name.trim().length < 2}>
              Create pod
            </button>
          </form>
        </div>
      ) : (
        <p className="panel p-5 text-[14.5px] text-muted">You&apos;re in the maximum of 3 pods. Leave one to join or start another.</p>
      )}

      <Toast message={toast} />
    </>
  );
}
