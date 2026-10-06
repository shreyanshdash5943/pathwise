"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import clsx from "clsx";
import type { NewsItem, NewsTopic } from "@/lib/news";
import { timeAgo } from "@/lib/dates";
import { PageHeader } from "./page-header";

const TABS: { id: NewsTopic; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "top", label: "Top in tech" },
  { id: "careers", label: "Careers" },
];

type Status = "idle" | "loading" | "error";

export function NewsFeed({ initial, fieldLabel }: { initial: NewsItem[]; fieldLabel: string }) {
  const [topic, setTopic] = useState<NewsTopic>("for-you");
  const [cache, setCache] = useState<Partial<Record<NewsTopic, NewsItem[]>>>({ "for-you": initial });
  const [status, setStatus] = useState<Status>("idle");
  const request = useRef(0);

  async function load(next: NewsTopic, force = false) {
    setTopic(next);
    if (cache[next] && !force) {
      setStatus("idle");
      return;
    }
    const id = ++request.current;
    setStatus("loading");
    try {
      const res = await fetch(`/api/news?topic=${next}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: NewsItem[] };
      if (id !== request.current) return;
      setCache((c) => ({ ...c, [next]: data.items }));
      setStatus("idle");
    } catch {
      if (id === request.current) setStatus("error");
    }
  }

  const items = cache[topic] ?? [];

  return (
    <>
      <PageHeader title="News" description={topic === "for-you" ? `Picked for ${fieldLabel}, refreshed through the day.` : "Refreshed through the day."} />

      <div role="tablist" aria-label="News topics" className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = topic === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => load(t.id)}
              className={clsx("relative px-4 pb-3 pt-1 text-[14.5px] font-medium transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}
            >
              {t.label}
              {active && (
                <motion.span layoutId="news-tab" className="absolute inset-x-2 -bottom-px h-[2.5px] rounded-full bg-accent" transition={{ type: "spring", stiffness: 480, damping: 38 }} />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {status === "loading" ? (
          <motion.ul key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="panel divide-y divide-line" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="px-5 py-5 sm:px-6">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton mt-3 h-5 w-[85%]" />
                <div className="skeleton mt-2 h-5 w-[55%]" />
              </li>
            ))}
          </motion.ul>
        ) : status === "error" ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="panel flex flex-col items-center px-6 py-14 text-center">
            <p className="text-[16px] font-semibold">The news didn't load</p>
            <p className="mt-1 text-[14.5px] text-muted">The sources may be slow right now. Try again in a moment.</p>
            <button type="button" className="btn-outline mt-5 h-10 text-[14px]" onClick={() => load(topic, true)}>
              <RotateCw className="h-4 w-4" /> Try again
            </button>
          </motion.div>
        ) : items.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="panel px-6 py-14 text-center">
            <p className="text-[16px] font-semibold">No stories right now</p>
            <p className="mt-1 text-[14.5px] text-muted">Check back later, or look at Top in tech.</p>
          </motion.div>
        ) : (
          <motion.ul
            key={topic}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
            className="panel divide-y divide-line overflow-hidden"
          >
            {items.map((n) => (
              <li key={n.id}>
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="group flex gap-4 px-5 py-5 transition-colors hover:bg-surface sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-faint">
                      <span className="font-medium text-muted">{n.source}</span> {timeAgo(n.publishedAt)}
                    </p>
                    <h2 className="mt-1.5 text-[16.5px] font-semibold leading-snug tracking-[-0.01em] group-hover:text-accent">{n.title}</h2>
                    {(n.meta || n.tags.length > 0) && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-faint">
                        {n.tags.map((t) => (
                          <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-muted">
                            {t}
                          </span>
                        ))}
                        {n.meta && <span>{n.meta}</span>}
                      </div>
                    )}
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-faint transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                </a>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </>
  );
}
