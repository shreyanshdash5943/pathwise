import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getProfile } from "@/lib/data";
import { getNews, type NewsTopic } from "@/lib/news";
import { handleRouteError } from "@/lib/http";

const TOPICS: NewsTopic[] = ["for-you", "top", "careers"];

export async function GET(req: Request) {
  try {
    const param = new URL(req.url).searchParams.get("topic");
    const topic: NewsTopic = TOPICS.includes(param as NewsTopic) ? (param as NewsTopic) : "for-you";
    const { supabase } = await getSupabase();
    const profile = await getProfile(supabase);
    const items = await getNews(topic, profile?.field ?? null);
    return NextResponse.json({ topic, items }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    return handleRouteError(err);
  }
}
