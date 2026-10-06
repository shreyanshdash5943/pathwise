# Pathwise

A career planning web app. Users answer 10 multiple-choice questions, pick a recommended role, and get a personal roadmap that turns into a short daily checklist, plus a news feed for their field.

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, Clerk (auth), Supabase (Postgres + Row Level Security), any OpenAI-compatible LLM (Groq by default).

---

## 1. Install

```bash
npm install
cp .env.example .env.local
```

Requires Node 18.18 or newer (Node 20+ recommended).

## 2. Clerk

1. Create an application at https://dashboard.clerk.com.
2. Copy the **Publishable key** and **Secret key** into `.env.local`.
3. Turn on the Supabase integration so Clerk session tokens work with Supabase:
   Clerk dashboard → **Integrations** → **Supabase** → **Activate**. Copy the **Clerk domain** it shows you.

## 3. Supabase

1. Create a project at https://supabase.com.
2. Add Clerk as an auth provider:
   **Authentication** → **Sign In / Providers** → **Third-party auth** → **Add provider** → **Clerk**, and paste the Clerk domain from step 2.3.
3. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
4. Copy the **Project URL** and **anon public key** (Project settings → API) into `.env.local`.

> The app only uses the anon key. Every query runs as the signed-in Clerk user, and RLS policies restrict each user to their own rows. Never put the service-role key in this app.

## 4. AI roadmap generation (optional but recommended)

Put a Groq API key in `AI_API_KEY` (https://console.groq.com). To use another OpenAI-compatible provider, change `AI_BASE_URL` and `AI_MODEL`.

If `AI_API_KEY` is empty, or the AI returns something malformed, the app falls back to a built-in roadmap generator. Onboarding never fails because of the AI.

## 5. Run

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # TypeScript only
```

## 6. Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Add every variable from `.env.local` in **Project settings → Environment Variables**.
3. Before launch, switch Clerk to a **production instance** (live keys + your domain) and add your production URL to Clerk's allowed origins.
4. Roadmap generation can take 10 to 20 seconds. The route sets `maxDuration = 60`; on Vercel's Hobby plan the limit is lower, so use Pro or a fast model.

---

## How it works

| Area | Where |
| --- | --- |
| Onboarding questions | `lib/questions.ts` |
| Role catalog and fit scoring | `lib/roles.ts` |
| AI prompt and validation | `lib/ai.ts`, `lib/roadmap-schema.ts` |
| Fallback roadmap generator | `lib/fallback-roadmap.ts` |
| Daily scheduling, streaks, stats | `lib/data.ts` |
| News sources (DEV + Hacker News, no keys) | `lib/news.ts` |
| Database schema and RLS | `supabase/schema.sql` |

**Daily checklist logic.** Each day, unfinished tasks from earlier days roll forward, then the list is topped up with the next roadmap tasks until it fills the user's daily time. Every step is idempotent, so double requests don't double-schedule. "Today" is computed in the user's own time zone, captured at onboarding.

**Streaks.** Consecutive days with at least one completed task. Today counts once you finish something; until then, the streak carries over from yesterday.

## Adding roles or fields

Add entries to `ROLES` in `lib/roles.ts` (each needs 6 skills and 3 projects). To add a field, also add it to the `field` question in `lib/questions.ts`, `FIELD_LABELS` in `lib/roles.ts`, and `FIELD_TAGS` in `lib/news.ts`.

## Not included yet

- Push or email reminders (Firebase Cloud Messaging or a cron + email service would fit here)
- Weekly AI check-ins that re-plan the roadmap
- Payments
