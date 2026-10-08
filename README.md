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

## 4. Roadmap templates (one-off AI step)

Roadmaps are **not** written by AI per user. Each (role, level) pair has a shared template in `data/templates/` (18 roles × 4 levels = 72), which is generated once offline and reviewed like code. Onboarding assembles a plan from the template and the user's answers in memory, so it's instant and has no AI cost.

```bash
# needs AI_API_KEY (+ optional AI_BASE_URL, AI_MODEL) in .env.local
npm run templates:generate                                   # generate any missing templates
npm run templates:generate -- --role frontend --level beginner --force   # new version of one
npm run templates:check                                      # validate files (good for CI)
```

Any template that hasn't been generated yet uses the built-in one in `lib/templates/builtin.ts`, so the app works without running this.

**Versioning rule:** plans remember the template version they were built from, and progress is stored by task position. `--force` writes a new version file and points `manifest.json` at it, so only new plans use it. Never edit the task list of a version file that's in use, and don't delete old version files while plans still use them. Fixing a typo in a title or description is fine.

## 5. Resume reading (optional AI)

Resumes are matched against the role's skills by keyword (`lib/resume.ts`), with no AI. To also use a small model for resumes where keywords find fewer than two skills, set `RESUME_AI=on`. It's capped at 3 calls per user per day and 5,000 per day overall (`claim_ai_call` in `supabase/schema.sql`), and runs at most once per file.

## 6. Run

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # TypeScript only
```

## 7. Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Add every variable from `.env.local` in **Project settings → Environment Variables**.
3. Before launch, switch Clerk to a **production instance** (live keys + your domain) and add your production URL to Clerk's allowed origins.

---

## How it works

| Area | Where |
| --- | --- |
| Onboarding questions | `lib/questions.ts` |
| Role catalog and fit scoring | `lib/roles.ts` |
| Roadmap templates (files, loader, built-in) | `data/templates/`, `lib/templates/` |
| Personalising a template from answers | `lib/templates/personalize.ts` |
| Template generator (offline, AI) | `scripts/generate-templates.mts` |
| Plan creation, move-over of old roadmaps | `lib/plans.ts` |
| Daily scheduling, streaks, stats | `lib/data.ts` |
| Profile details, resume upload and matching | `lib/details.ts`, `lib/resume.ts`, `app/api/details/` |
| Optional resume AI tagger | `lib/ai.ts` |
| Proof of work | `lib/proofs.ts`, `app/api/proofs/`, `components/proof-dialog.tsx` |
| Public profiles (`/u/<username>`) | `lib/public-profile.ts`, `app/u/[username]/` |
| Reminders (web push) | `lib/push.ts`, `lib/reminders.ts`, `app/api/cron/reminders/`, `public/sw.js`, `components/reminders-panel.tsx` |
| News sources (DEV + Hacker News, no keys) | `lib/news.ts` |
| Database schema and RLS | `supabase/schema.sql` |

**Plans.** A plan row stores only the template id, version and the answers that personalise it. The task list is rebuilt in memory from the template on each request (cached per server). `task_progress` holds a row only for tasks the user has scheduled, finished or skipped, so storage per user stays small at any scale.

**Profile.** Name, email and photo come from Clerk. `user_details` holds the headline, links, skills, and which of the role's skills the user already knows; ticking those skips their learn and practice tasks. Resumes go straight from the browser to a private Storage bucket via a signed URL. Only the matched skill names and a file hash are stored, not the text.

**Proof of work and public profiles.** Finishing a build task prompts for a link to what was made; proofs belong to the person, so they survive starting a new plan. Making a profile public gives it a page at `/u/<username>`. Visitors read it through `get_public_profile()`, which returns only safe fields (never email, resume or answers), and the page is cached for 5 minutes and refreshed straight away when its owner edits anything.

**Reminders.** Web push only, so it's free at any scale. People turn it on per device in Settings and pick an hour (in their time zone); they get a daily nudge only on days they haven't started, and a Sunday summary instead of the nudge that day. An hourly job (`.github/workflows/reminders.yml`, or Vercel Cron) calls `/api/cron/reminders`, which claims due rows through an index, so each run's cost tracks how many are due, not total users. The job authenticates to the database with `CRON_SECRET` (its hash is stored in `private.app_config`), so the service-role key is still never used. Dead browser subscriptions are removed automatically. On iPhone, notifications need Pathwise added to the Home Screen first.

**Daily checklist logic.** Each day, unfinished tasks from earlier days roll forward, then the list is topped up with the next roadmap tasks until it fills the user's daily time. Every step is idempotent, so double requests don't double-schedule. "Today" is computed in the user's own time zone, captured at onboarding.

**Streaks.** Consecutive days with at least one completed task. Today counts once you finish something; until then, the streak carries over from yesterday.

## Adding roles or fields

Add entries to `ROLES` in `lib/roles.ts` (each needs 6 skills and 3 projects). To add a field, also add it to the `field` question in `lib/questions.ts`, `FIELD_LABELS` in `lib/roles.ts`, and `FIELD_TAGS` in `lib/news.ts`.

## Not included yet

- Email reminders (web push covers it for free; email would add cost at scale)
- Weekly AI check-ins that re-plan the roadmap
- Payments
