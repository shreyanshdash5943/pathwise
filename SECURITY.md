# Security and abuse hardening

Pathwise runs on serverless (Vercel) + Supabase. The real risk isn't a classic
bandwidth flood — Vercel absorbs that at the edge — it's **cost and quota exhaustion**:
someone hammering an endpoint that does real work until your bill spikes or Supabase's
limits trip and the app goes down for everyone. This file lists what the code does and
what you must set by hand.

## In the code

- **Rate limiting** (`middleware.ts`, `lib/rate-limit.ts`). Per-window caps on every
  request. Authenticated API routes are limited **per user** so a whole campus behind
  one NAT'd IP isn't throttled together; public and heavy routes are limited per IP.
  Over the limit returns `429` with `Retry-After`. The limiter **fails open** — if it
  errors, requests are allowed, so it can never take the site down itself.
  - Shared across instances when Upstash is configured (below); otherwise best-effort
    per-instance, which still blunts a single-source flood.
  - Tune the caps with `RL_HEAVY`, `RL_PUBLIC`, `RL_API` (requests per 60s).
- **PDF card is CDN-cached** (`/u/[username]/card`, `s-maxage=300`). A burst of
  downloads is served from the edge instead of rebuilding the PDF each time. The PDF is
  also bounded: max 8 proofs, fixed fonts, one data lookup (itself cached 5 min).
- **The cron route** (`/api/cron/reminders`) requires `Authorization: Bearer
  $CRON_SECRET` and is never rate limited. Confirm `CRON_SECRET` is set (below).
- **Analytics can't be used as an open redirect** (`/u/[username]/go`): the destination
  always comes from the profile, never the query string.
- **No service-role key** is used anywhere. Every query runs as the signed-in user (or
  anon) under Supabase Row Level Security; the public read path is one SECURITY DEFINER
  function that returns only safe fields. The anon key is public by design.
- **Security headers** are set for all routes in `next.config.mjs` (CSP frame-ancestors
  none, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy).

## Set these by hand (most important first)

1. **Spending caps / budget alerts.** The single most important control — it turns a
   flood into a scare, not a bill.
   - Vercel: Settings → Billing → set a Spend Management limit with an action (pause
     the project at the cap on Pro).
   - Supabase: Organization → Billing → set a spend cap / cost-control.
2. **Confirm `CRON_SECRET` is set** in Vercel env (Production). Without it the reminders
   route refuses to run — which is safe — but reminders won't send. It must match the
   hash stored in `private.app_config` (see `supabase/migrations/004_reminders.sql`).
3. **Add Upstash Redis** for distributed rate limiting (free tier is plenty):
   create a database at upstash.com and set `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` in Vercel. Without it, limiting is per-instance only.
4. **Vercel WAF / Attack Challenge Mode.** Vercel → Firewall. Turn on the managed
   ruleset; enable Attack Challenge Mode if you're actively being hit. Add a custom
   rate-limit rule on `/u/*/card` and `/api/*` as a second layer in front of the app.
5. **Clerk production instance.** Use live keys and lock allowed origins to your domain
   (not a preview URL). Clerk handles sign-in abuse (bot protection, rate limits) itself
   — keep its bot protection on.
6. **Set `ANALYTICS_SALT`** (any long random string) in Vercel. Visitor hashes fall back
   to `CRON_SECRET` otherwise; a dedicated salt keeps the two concerns separate.

## Known gaps (fix before a big launch)

- **Analytics are self-inflatable.** Someone can call `/u/<name>/go` or the view counter
  to inflate *their own* numbers. It fools no one else, but add a per-IP cap on the
  counter (the middleware `heavy` bucket already covers `/go`).
- **Public progress ignores a Pro user's roadmap edits** — cosmetic, not a security
  issue.
- **No automated abuse tests.** Run the built-in `/security-review` on each branch, and
  review this file before launch.

## Do not

- Do not run load-flood ("stress test") tools against the deployed site. On shared
  serverless infra that's an actual DoS against Vercel and its other tenants, and it
  tells you less than reading the code and the limits above. Validate capacity with
  Vercel's own analytics and a budget cap, not by attacking yourself.
