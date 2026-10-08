/**
 * Edge-safe rate limiting for middleware. No npm dependency.
 *
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, counts are shared
 * across every serverless instance (a real distributed limit). Otherwise it falls back
 * to a per-instance in-memory counter, which still blunts a flood hitting one instance.
 *
 * It always fails OPEN: if the limiter errors or times out, the request is allowed. A
 * limiter outage must never take the site down, which would be a self-inflicted DoS.
 */

export type RateResult = { ok: boolean; limit: number; remaining: number; reset: number };

const hasUpstash = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Fixed-window counters per instance. Bounded so it can't grow without limit.
const mem = new Map<string, { count: number; reset: number }>();
const MEM_MAX = 20_000;

function memHit(key: string, limit: number, windowSec: number): RateResult {
  const now = Date.now();
  const reset = Math.ceil(now / 1000 / windowSec) * windowSec; // window boundary, in epoch seconds
  const existing = mem.get(key);
  if (!existing || existing.reset !== reset) {
    if (mem.size > MEM_MAX) {
      for (const [k, v] of mem) if (v.reset * 1000 < now) mem.delete(k);
      if (mem.size > MEM_MAX) mem.clear();
    }
    mem.set(key, { count: 1, reset });
    return { ok: true, limit, remaining: limit - 1, reset };
  }
  existing.count++;
  return { ok: existing.count <= limit, limit, remaining: Math.max(0, limit - existing.count), reset };
}

async function upstashHit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  const reset = Math.ceil(Date.now() / 1000 / windowSec) * windowSec;
  const redisKey = `rl:${key}:${reset}`;
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
    // INCR the window counter, then set it to expire so old windows are cleaned up.
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, windowSec + 5, "NX"],
    ]),
    signal: AbortSignal.timeout(1500),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const [incr] = (await res.json()) as { result: number }[];
  const count = Number(incr?.result ?? 0);
  return { ok: count <= limit, limit, remaining: Math.max(0, limit - count), reset };
}

/** One hit against `key`. Returns ok:true (allowed) on any limiter failure. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  try {
    return hasUpstash() ? await upstashHit(key, limit, windowSec) : memHit(key, limit, windowSec);
  } catch {
    return { ok: true, limit, remaining: limit, reset: Math.ceil(Date.now() / 1000 / windowSec) * windowSec };
  }
}

/** The client IP from Vercel's forwarding headers, or a fixed fallback. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
