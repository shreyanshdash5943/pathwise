import "server-only";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  author: string | null;
  publishedAt: string;
  tags: string[];
  meta: string | null;
};

export type NewsTopic = "for-you" | "top" | "careers";

const FIELD_TAGS: Record<string, string[]> = {
  software: ["webdev", "javascript", "programming"],
  "data-ai": ["ai", "machinelearning", "datascience"],
  design: ["design", "ux", "ui"],
  product: ["productivity", "startup", "management"],
  security: ["security", "cybersecurity", "infosec"],
  cloud: ["devops", "cloud", "kubernetes"],
};

const REVALIDATE = 60 * 30;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
      headers: { Accept: "application/json", "User-Agent": "Pathwise/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type DevArticle = {
  id: number;
  title: string;
  url: string;
  published_at: string;
  tag_list: string[];
  reading_time_minutes?: number;
  user?: { name?: string };
};

async function fromDev(tag: string, perPage = 12): Promise<NewsItem[]> {
  const data = await getJson<DevArticle[]>(
    `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=7&per_page=${perPage}`
  );
  if (!Array.isArray(data)) return [];
  return data
    .filter((a) => a && a.title && a.url)
    .map((a) => ({
      id: `dev-${a.id}`,
      title: a.title,
      url: a.url,
      source: "DEV",
      author: a.user?.name ?? null,
      publishedAt: a.published_at,
      tags: (a.tag_list ?? []).slice(0, 3),
      meta: a.reading_time_minutes ? `${a.reading_time_minutes} min read` : null,
    }));
}

type HnHit = {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  created_at: string;
  points: number | null;
  num_comments: number | null;
};

async function fromHackerNews(query?: string): Promise<NewsItem[]> {
  const url = query
    ? `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 14},points>20&hitsPerPage=15`
    : "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30";
  const data = await getJson<{ hits: HnHit[] }>(url);
  if (!data?.hits) return [];
  return data.hits
    .filter((h) => h.title)
    .map((h) => ({
      id: `hn-${h.objectID}`,
      title: h.title as string,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: h.url ? safeHost(h.url) : "Hacker News",
      author: h.author,
      publishedAt: h.created_at,
      tags: [],
      meta: h.points != null ? `${h.points} points, ${h.num_comments ?? 0} comments` : null,
    }));
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Hacker News";
  }
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.title.toLowerCase().replace(/\W+/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function byDate(a: NewsItem, b: NewsItem) {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

export async function getNews(topic: NewsTopic, field: string | null): Promise<NewsItem[]> {
  if (topic === "top") return dedupe(await fromHackerNews());
  if (topic === "careers") {
    const lists = await Promise.all([fromDev("career"), fromDev("interview", 8), fromHackerNews("hiring career")]);
    return dedupe(lists.flat()).sort(byDate).slice(0, 30);
  }
  const tags = FIELD_TAGS[field ?? ""] ?? FIELD_TAGS.software;
  const lists = await Promise.all(tags.map((t) => fromDev(t, 10)));
  return dedupe(lists.flat()).sort(byDate).slice(0, 30);
}
