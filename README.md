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
| Daily habits with notes (`/habits`) | `lib/habits.ts`, `app/api/habits/`, `components/habits-panel.tsx`, `components/habits-view.tsx` |
| PDF profile card, public resume | `lib/profile-card.ts`, `app/u/[username]/card/`, `app/u/[username]/resume/` |
| Pro status and gating | `lib/pro.ts`, `app/(app)/pro/`, `supabase/migrations/007_pro.sql` |
| Profile analytics | `lib/analytics.ts`, `components/profile-analytics.tsx`, `app/u/[username]/go/` |
| Roadmap editing | `lib/plan-edits.ts`, `lib/plan-edit-api.ts`, `app/api/plan/` |
| Accountability pods | `lib/pods.ts`, `app/api/pods/`, `app/(app)/pods/`, `components/pod-room.tsx` |
| Getting hired (tracker + interview prep) | `lib/prep.ts`, `lib/interview-questions.ts`, `app/api/applications/`, `app/api/interview/`, `app/(app)/jobs/` |
| Reminders (web push) | `lib/push.ts`, `lib/reminders.ts`, `app/api/cron/reminders/`, `public/sw.js`, `components/reminders-panel.tsx` |
| News sources (DEV + Hacker News, no keys) | `lib/news.ts` |
| Database schema and RLS | `supabase/schema.sql` |

**A plan is optional.** Onboarding opens with a choice: build a career plan, or just track habits. A habits-only user has a `profiles` row with only a timezone (the plan columns are nullable) and no `plans` row; the dashboard, reminders and pods all work from their habits alone, and every plan-only page offers a "Build my plan" button. They can build a plan any time from `/onboarding?build=1`.

**Plans.** A plan row stores only the template id, version and the answers that personalise it. The task list is rebuilt in memory from the template on each request (cached per server). `task_progress` holds a row only for tasks the user has scheduled, finished or skipped, so storage per user stays small at any scale.

**Profile.** Name, email and photo come from Clerk. `user_details` holds the headline, links, skills, and which of the role's skills the user already knows; ticking those skips their learn and practice tasks. Resumes go straight from the browser to a private Storage bucket via a signed URL. Only the matched skill names and a file hash are stored, not the text.

**Proof of work and public profiles.** Finishing a build task prompts for a link to what was made; proofs belong to the person, so they survive starting a new plan. Making a profile public gives it a page at `/u/<username>`. Visitors read it through `get_public_profile()`, which returns only safe fields (never email, resume or answers), and the page is cached for 5 minutes and refreshed straight away when its owner edits anything.

**Reminders.** Web push only, so it's free at any scale. People turn it on per device in Settings and pick an hour (in their time zone); they get a daily nudge only on days they haven't started, and a Sunday summary instead of the nudge that day. An hourly job (`.github/workflows/reminders.yml`, or Vercel Cron) calls `/api/cron/reminders`, which claims due rows through an index, so each run's cost tracks how many are due, not total users. The job authenticates to the database with `CRON_SECRET` (its hash is stored in `private.app_config`), so the service-role key is still never used. Dead browser subscriptions are removed automatically. On iPhone, notifications need Pathwise added to the Home Screen first.

**Habits.** People add their own daily items (for example "LeetCode daily") under the plan's checklist, tick them off, and keep a note per day: what they worked on, a link, their approach and their code. `/habits` shows each habit's history and streak.

**Contact card.** On the public profile, email, phone and a resume download are each off until the owner switches them on. `/u/<username>/card` returns a one-page PDF with clickable links (built with pdf-lib, no external service). Public resume downloads go through a storage policy that checks the profile is public and the resume is shared, so the service-role key is still never used.

**Getting hired.** An application tracker (company, stage, next step, notes) with a supportive reframe when a role closes, plus an interview-prep bank. The standout: behavioural answers are built in STAR form from the user's own proof-of-work projects — linked by `proof_id`, so the prep is grounded in real work, not generic advice. The question bank is hand-written (`lib/interview-questions.ts`), 8 behavioural + 6 technical per field; no AI. Both tables are private per user; a saved answer survives its linked project being deleted (the link just clears).

**Accountability pods.** Small invite-only groups (friends, classmates) who see each other's streak and weekly activity and send cheers, with a check-in feed. The research is clear that external accountability is what makes people finish, so this is free, not Pro. The tables are locked down; every read and write goes through a membership-checked `SECURITY DEFINER` function (`supabase/migrations/008_pods.sql`), and a pod view exposes only name, role, streak and weekly activity — never email, phone, resume, answers, or habit-note contents. Pods: up to 6 people; a person is in at most 3.

**Pro.** `entitlements` says who has Pro; only the database owner can write it (SQL Editor now, a payment webhook later). Every Pro-only write is checked by a database trigger calling `is_pro()`, so the API can't be bypassed. Pro includes profile analytics (each visitor counted once a day, bots and the owner ignored, no IPs stored), roadmap editing (your own tasks, removed tasks and order, layered over the shared template), streak freezes (3 a month, applied automatically) and a premium profile (short usernames, two more PDF card designs, no Pathwise footer). If Pro lapses, nothing is deleted; the public page just falls back to the free look.

**Daily checklist logic.** Each day, unfinished tasks from earlier days roll forward, then the list is topped up with the next roadmap tasks until it fills the user's daily time. Every step is idempotent, so double requests don't double-schedule. "Today" is computed in the user's own time zone, captured at onboarding.

**Streaks.** Consecutive days with at least one completed task. Today counts once you finish something; until then, the streak carries over from yesterday.

## Adding roles or fields

Add entries to `ROLES` in `lib/roles.ts` (each needs 6 skills and 3 projects). To add a field, also add it to the `field` question in `lib/questions.ts`, `FIELD_LABELS` in `lib/roles.ts`, and `FIELD_TAGS` in `lib/news.ts`.

## Not included yet

- Email reminders (web push covers it for free; email would add cost at scale)
- Weekly AI check-ins that re-plan the roadmap
- Payments
