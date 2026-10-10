import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/u/(.*)", "/api/cron/(.*)", "/manifest.webmanifest", "/privacy", "/terms", "/robots.txt", "/sitemap.xml", "/opengraph-image"]);

// Expensive or abusable public routes: a PDF build, a signed-URL mint, a counted redirect.
const isHeavy = createRouteMatcher(["/u/(.*)/card", "/u/(.*)/resume", "/u/(.*)/go"]);
const isApi = createRouteMatcher(["/api/(.*)"]);
const isCron = createRouteMatcher(["/api/cron/(.*)"]);

// Per-window caps. Generous enough for real use (incl. shared campus wifi), low enough
// to stop a single-source flood. Tune via the env vars if needed.
const num = (name: string, fallback: number) => Number(process.env[name]) || fallback;
const LIMITS = {
  heavy: { limit: num("RL_HEAVY", 40), window: 60 },
  public: { limit: num("RL_PUBLIC", 240), window: 60 },
  api: { limit: num("RL_API", 240), window: 60 },
};

function tooMany(result: { limit: number; reset: number }) {
  const retry = Math.max(1, result.reset - Math.floor(Date.now() / 1000));
  return new NextResponse(JSON.stringify({ error: "Too many requests. Slow down and try again in a moment." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retry), "Cache-Control": "no-store" },
  });
}

export default clerkMiddleware(async (auth, req) => {
  // The cron route proves itself with a secret and must never be rate limited.
  if (!isCron(req)) {
    const ip = clientIp(req.headers);
    let result;
    if (isHeavy(req)) {
      result = await rateLimit(`heavy:${ip}`, LIMITS.heavy.limit, LIMITS.heavy.window);
    } else if (isApi(req)) {
      // Per user when signed in, so one NAT'd campus doesn't share a limit; per IP otherwise.
      const { userId } = await auth();
      result = await rateLimit(`api:${userId ?? `ip:${ip}`}`, LIMITS.api.limit, LIMITS.api.window);
    } else if (isPublic(req)) {
      result = await rateLimit(`pub:${ip}`, LIMITS.public.limit, LIMITS.public.window);
    }
    if (result && !result.ok) return tooMany(result);
  }

  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
