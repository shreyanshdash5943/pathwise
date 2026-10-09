"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Flame, HeartHandshake, LogOut, Send, Trash2, UserMinus } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import type { Pod, PodMember, PodPost } from "@/lib/pods";
import { timeAgo } from "@/lib/dates";
import { Toast, useToast } from "./toast";

async function send(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

function Avatar({ name, url, size = 40 }: { name: string | null; url: string | null; size?: number }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full bg-surface object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function PodRoom({ pod }: { pod: Pod }) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [members, setMembers] = useState(pod.members);
  const [posts, setPosts] = useState(pod.posts);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const me = members.find((m) => m.is_me);

  async function cheer(target: PodMember) {
    if (target.is_me) return;
    const was = target.cheered_by_me;
    setMembers((ms) => ms.map((m) => (m.user_id === target.user_id ? { ...m, cheered_by_me: !was, cheers: m.cheers + (was ? -1 : 1) } : m)));
    try {
      await send(`/api/pods/${pod.id}/cheer`, { to: target.user_id });
    } catch (err) {
      setMembers((ms) => ms.map((m) => (m.user_id === target.user_id ? { ...m, cheered_by_me: was, cheers: m.cheers + (was ? 1 : -1) } : m)));
      show(err instanceof Error ? err.message : "Couldn't send that cheer.");
    }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      const data = await send(`/api/pods/${pod.id}/post`, { body: text });
      setPosts(data.posts as PodPost[]);
      setDraft("");
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't post that.");
    } finally {
      setPosting(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pods?code=${pod.invite_code}`);
      show("Invite link copied. Send it to your friends.");
    } catch {
      show(`Invite code: ${pod.invite_code}`);
    }
  }

  async function leave() {
    try {
      await send(`/api/pods/${pod.id}`, { action: pod.is_owner ? "delete" : "leave" });
      router.push("/pods");
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Couldn't do that.");
    }
  }

  async function remove(target: PodMember) {
    setMembers((ms) => ms.filter((m) => m.user_id !== target.user_id));
    try {
      await send(`/api/pods/${pod.id}/members/${encodeURIComponent(target.user_id)}`, undefined, "DELETE");
      show(`${target.name ?? "They"} were removed.`);
    } catch (err) {
      setMembers(pod.members);
      show(err instanceof Error ? err.message : "Couldn't remove them.");
    }
  }

  return (
    <>
      <Link href="/pods" className="btn-quiet -ml-3 mb-4 h-9 px-3 text-[14px]">
        <ArrowLeft className="h-4 w-4" /> All pods
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[30px]">{pod.name}</h1>
          <p className="mt-1 text-[14.5px] text-muted">
            {members.length} of 6 {members.length === 1 ? "member" : "members"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyInvite} className="btn-outline h-10 text-[14px]">
            <Copy className="h-4 w-4 text-muted" /> Invite &middot; <span className="tabular tracking-[0.1em]">{pod.invite_code}</span>
          </button>
          <button type="button" onClick={() => setConfirm(true)} className="btn-quiet h-10 text-[14px] text-muted">
            {pod.is_owner ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            {pod.is_owner ? "Delete" : "Leave"}
          </button>
        </div>
      </div>

      {members.length === 1 && (
        <div className="panel mb-6 bg-accent-soft/50 p-5 text-[14.5px] text-ink-soft">
          It&apos;s just you so far. Share your invite code <span className="tabular font-semibold tracking-[0.1em]">{pod.invite_code}</span> with a few friends on the same path &mdash; people who keep each other accountable are far more likely to stick with it.
        </div>
      )}

      <section aria-label="Members" className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <div key={m.user_id} className="panel p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Avatar name={m.name} url={m.avatar} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[15.5px] font-semibold">
                  {m.name ?? "A member"}
                  {m.is_me && <span className="shrink-0 text-[12.5px] font-normal text-faint">you</span>}
                  {m.active_today && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Active today" />}
                </p>
                <p className="truncate text-[13px] text-muted">{m.role ?? "Setting up their plan"}</p>
              </div>
              {pod.is_owner && !m.is_me && (
                <button type="button" aria-label={`Remove ${m.name ?? "member"}`} onClick={() => remove(m)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-surface hover:text-red-600">
                  <UserMinus className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-4 text-[13.5px]">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Flame className={clsx("h-4 w-4", m.streak > 0 ? "text-orange-500" : "text-faint")} />
                {m.streak} day{m.streak === 1 ? "" : "s"}
              </span>
              <span className="text-muted">
                active {m.active_week}/7 this week
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              {m.username ? (
                <a href={`/u/${m.username}`} target="_blank" rel="noopener" className="text-[13.5px] font-medium text-accent hover:underline">
                  View profile
                </a>
              ) : (
                <span className="text-[13px] text-faint">No public profile</span>
              )}
              {m.is_me ? (
                <span className="text-[13px] text-faint">{m.cheers} cheer{m.cheers === 1 ? "" : "s"} today</span>
              ) : (
                <button
                  type="button"
                  onClick={() => cheer(m)}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors",
                    m.cheered_by_me ? "bg-accent text-white" : "bg-surface text-ink hover:bg-accent-soft"
                  )}
                >
                  <HeartHandshake className="h-4 w-4" />
                  {m.cheered_by_me ? "Cheered" : "Cheer"}
                  {m.cheers > 0 && <span className="tabular">{m.cheers}</span>}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="pod-feed" className="mt-8">
        <h2 id="pod-feed" className="text-[18px] font-semibold tracking-[-0.01em]">
          Check-ins
        </h2>
        <p className="mt-1 text-[14px] text-muted">Share what you did this week, or what you&apos;re stuck on. Your pod can see it.</p>

        <form onSubmit={post} className="mt-4 flex gap-2">
          <input
            className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent"
            value={draft}
            maxLength={500}
            placeholder={me ? "Finished the API milestone this week" : ""}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn-primary h-11 shrink-0 px-4 text-[14px]" disabled={posting || !draft.trim()}>
            <Send className="h-4 w-4" /> Post
          </button>
        </form>

        {posts.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="flex gap-3">
                <Avatar name={p.name} url={p.avatar} size={34} />
                <div className="min-w-0 flex-1 rounded-xl bg-surface px-4 py-3">
                  <p className="flex items-baseline gap-2 text-[13.5px]">
                    <span className="font-semibold">{p.name ?? "A member"}</span>
                    <span className="text-faint">{timeAgo(p.created_at)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-soft">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl bg-surface px-4 py-5 text-[14.5px] text-muted">No check-ins yet. Be the first to say how your week is going.</p>
        )}
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setConfirm(false)} />
          <div role="alertdialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-lift">
            <h2 className="text-[18px] font-semibold">{pod.is_owner ? "Delete this pod?" : "Leave this pod?"}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
              {pod.is_owner
                ? "The pod and its check-ins are removed for everyone. This can't be undone."
                : "You'll stop seeing this pod. You can rejoin later with the invite code."}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-quiet h-10 text-[14px]" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="btn h-10 bg-red-600 px-4 text-[14px] text-white hover:bg-red-700" onClick={leave}>
                {pod.is_owner ? "Delete pod" : "Leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </>
  );
}
