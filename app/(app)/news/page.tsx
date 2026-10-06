import { requirePlan } from "@/lib/session";
import { getNews } from "@/lib/news";
import { FIELD_LABELS } from "@/lib/roles";
import { NewsFeed } from "@/components/news-feed";

export const metadata = { title: "News" };

export default async function NewsPage() {
  const { profile } = await requirePlan();
  const initial = await getNews("for-you", profile.field).catch(() => []);
  return <NewsFeed initial={initial} fieldLabel={FIELD_LABELS[profile.field] ?? "your field"} />;
}
