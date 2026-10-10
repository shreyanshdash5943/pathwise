import { requireProfile } from "@/lib/session";
import { getNews } from "@/lib/news";
import { FIELD_LABELS } from "@/lib/roles";
import { NewsFeed } from "@/components/news-feed";

export const metadata = { title: "News" };

export default async function NewsPage() {
  const { profile } = await requireProfile();
  const topic = profile.field ? "for-you" : "top";
  const initial = await getNews(topic, profile.field ?? "software").catch(() => []);
  return <NewsFeed initial={initial} fieldLabel={profile.field ? (FIELD_LABELS[profile.field] ?? "your field") : "tech"} />;
}
