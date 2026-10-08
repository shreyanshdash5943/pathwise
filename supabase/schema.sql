-- Pathwise schema
-- Run this once in Supabase → SQL Editor.
-- Auth comes from Clerk via Supabase's native third-party auth integration,
-- so the user id is the Clerk user id found in auth.jwt()->>'sub'.

create extension if not exists pgcrypto;

-- Profiles: one row per user, written at the end of onboarding
create table if not exists public.profiles (
  user_id       text primary key default (auth.jwt() ->> 'sub'),
  answers       jsonb not null,
  role_id       text not null,
  role_title    text not null,
  field         text not null,
  daily_minutes integer not null default 60 check (daily_minutes between 15 and 480),
  timezone      text not null default 'UTC',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Roadmaps: the outline (phases and milestones). Only one is active per user.
create table if not exists public.roadmaps (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default (auth.jwt() ->> 'sub'),
  title      text not null,
  summary    text not null default '',
  outline    jsonb not null,
  source     text not null default 'template' check (source in ('ai', 'template')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists roadmaps_user_active_idx on public.roadmaps (user_id, is_active);
create unique index if not exists roadmaps_one_active_per_user on public.roadmaps (user_id) where is_active;

-- Tasks: every actionable item in a roadmap, in order
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null default (auth.jwt() ->> 'sub'),
  roadmap_id      uuid not null references public.roadmaps (id) on delete cascade,
  seq             integer not null,
  phase_index     integer not null,
  milestone_index integer not null,
  title           text not null,
  description     text not null default '',
  type            text not null check (type in ('learn', 'build', 'practice', 'reflect', 'connect')),
  minutes         integer not null check (minutes between 5 and 180),
  scheduled_for   date,
  completed_on    date,
  created_at      timestamptz not null default now(),
  unique (roadmap_id, seq)
);
create index if not exists tasks_roadmap_schedule_idx on public.tasks (roadmap_id, scheduled_for);
create index if not exists tasks_roadmap_open_idx on public.tasks (roadmap_id, seq) where completed_on is null;

-- Keep profiles.updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- Row Level Security: every user can only see and change their own rows
alter table public.profiles enable row level security;
alter table public.roadmaps enable row level security;
alter table public.tasks    enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "own roadmaps" on public.roadmaps;
create policy "own roadmaps" on public.roadmaps
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check (
    (select auth.jwt() ->> 'sub') = user_id
    and exists (
      select 1 from public.roadmaps r
      where r.id = roadmap_id and r.user_id = (select auth.jwt() ->> 'sub')
    )
  );

-- ── Hardening ────────────────────────────────────────────────────────────────
-- The anon key is public, so a signed-in user can call the database directly with
-- their own token and skip the API's validation. RLS keeps them inside their own rows;
-- these limits keep what they can put there sane. Safe to re-run.

alter table public.profiles drop constraint if exists profiles_sizes;
alter table public.profiles add constraint profiles_sizes check (
  length(answers::text) <= 4000 and length(role_id) <= 64 and length(role_title) <= 120
  and length(field) <= 32 and length(timezone) <= 64
);

alter table public.roadmaps drop constraint if exists roadmaps_sizes;
alter table public.roadmaps add constraint roadmaps_sizes check (
  length(title) <= 200 and length(summary) <= 1000 and length(outline::text) <= 40000
);

alter table public.tasks drop constraint if exists tasks_sizes;
alter table public.tasks add constraint tasks_sizes check (
  length(title) <= 200 and length(description) <= 1000
  and seq between 0 and 999 and phase_index between 0 and 9 and milestone_index between 0 and 9
);

-- At most 10 roadmaps per user (the app keeps one, plus one briefly while making a new plan).
create or replace function public.limit_roadmaps() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.roadmaps where user_id = new.user_id) >= 10 then
    raise exception 'roadmap limit reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists roadmaps_limit on public.roadmaps;
create trigger roadmaps_limit before insert on public.roadmaps
for each row execute function public.limit_roadmaps();

-- Only let users change the columns the app actually updates.
revoke update on public.roadmaps from authenticated, anon;
grant update (is_active) on public.roadmaps to authenticated;
revoke update on public.tasks from authenticated, anon;
grant update (scheduled_for, completed_on) on public.tasks to authenticated;

-- ══ Plans v2: shared templates + per-user progress ═════════════════════════════
-- Roadmap text now lives in versioned template files shipped with the app
-- (data/templates). A user's plan stores only which template it uses and the answers
-- that personalise it; task_progress holds a row only for tasks the user has touched.
-- The legacy roadmaps/tasks tables above are kept until every user has been moved
-- over (lib/plans.ts does it on their next visit), then they can be dropped.

create table if not exists public.plans (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null unique default (auth.jwt() ->> 'sub'),
  template_id      text not null,
  template_version integer not null,
  inputs           jsonb not null,
  created_at       timestamptz not null default now()
);

create table if not exists public.task_progress (
  plan_id       uuid not null references public.plans (id) on delete cascade,
  user_id       text not null default (auth.jwt() ->> 'sub'),
  task_key      text not null,
  scheduled_for date,
  completed_on  date,
  skipped       boolean not null default false,
  primary key (plan_id, task_key)
);

alter table public.plans         enable row level security;
alter table public.task_progress enable row level security;

drop policy if exists "own plan" on public.plans;
create policy "own plan" on public.plans
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "own progress" on public.task_progress;
create policy "own progress" on public.task_progress
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check (
    (select auth.jwt() ->> 'sub') = user_id
    and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.jwt() ->> 'sub'))
  );

alter table public.plans drop constraint if exists plans_sizes;
alter table public.plans add constraint plans_sizes check (
  template_id ~ '^[a-z0-9-]{1,48}\.[a-z]{1,24}$' and template_version between 0 and 9999
  and length(inputs::text) <= 2000
);
alter table public.task_progress drop constraint if exists task_progress_sizes;
alter table public.task_progress add constraint task_progress_sizes check (task_key ~ '^[a-z0-9.\-]{1,64}$');

-- Plans are replaced, never edited; progress rows only change their state columns.
revoke update on public.plans from authenticated, anon;
revoke update on public.task_progress from authenticated, anon;
grant update (scheduled_for, completed_on, skipped) on public.task_progress to authenticated;

-- At most 300 progress rows per plan (a plan has well under 100 tasks).
create or replace function public.limit_task_progress() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.task_progress where plan_id = new.plan_id) >= 300 then
    raise exception 'progress limit reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists task_progress_limit on public.task_progress;
create trigger task_progress_limit before insert on public.task_progress
for each row execute function public.limit_task_progress();

-- Swaps the caller's plan in one transaction. Runs as the caller, so RLS still applies.
create or replace function public.replace_plan(
  p_template_id text, p_template_version integer, p_inputs jsonb, p_skip_keys text[], p_today date
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  new_id uuid;
begin
  delete from public.plans where user_id = (select auth.jwt() ->> 'sub');
  insert into public.plans (template_id, template_version, inputs)
    values (p_template_id, p_template_version, p_inputs) returning id into new_id;
  insert into public.task_progress (plan_id, task_key, completed_on, skipped)
    select new_id, k, p_today, true from unnest(coalesce(p_skip_keys, '{}')) as k;
  return new_id;
end $$;
revoke execute on function public.replace_plan(text, integer, jsonb, text[], date) from public, anon;
grant execute on function public.replace_plan(text, integer, jsonb, text[], date) to authenticated;

-- ══ User details (profile page) ═══════════════════════════════════════════════
-- Separate from profiles so starting a new plan doesn't wipe someone's details.
-- Name, email and photo stay in Clerk. Resume text is never stored, only the skills
-- found in it and a hash so the same file isn't processed twice.

create table if not exists public.user_details (
  user_id            text primary key default (auth.jwt() ->> 'sub'),
  headline           text not null default '',
  links              jsonb not null default '{}'::jsonb,
  skills             text[] not null default '{}',
  known_skills       text[] not null default '{}',
  resume_name        text,
  resume_size        integer,
  resume_hash        text,
  resume_skills      text[] not null default '{}',
  resume_ai_hash     text,
  resume_uploaded_at timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.user_details enable row level security;
drop policy if exists "own details" on public.user_details;
create policy "own details" on public.user_details
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- One named check per field, so a failure names the field.
alter table public.user_details drop constraint if exists user_details_sizes;

alter table public.user_details drop constraint if exists ud_headline_len;
alter table public.user_details add constraint ud_headline_len check (length(headline) <= 120);

alter table public.user_details drop constraint if exists ud_links_len;
alter table public.user_details add constraint ud_links_len check (length(links::text) <= 1200);

alter table public.user_details drop constraint if exists ud_skills_len;
alter table public.user_details add constraint ud_skills_len check (
  cardinality(skills) <= 30 and length(array_to_string(skills, ',')) <= 1300
);

alter table public.user_details drop constraint if exists ud_known_skills_len;
alter table public.user_details add constraint ud_known_skills_len check (
  cardinality(known_skills) <= 12 and length(array_to_string(known_skills, ',')) <= 600
);

alter table public.user_details drop constraint if exists ud_resume_skills_len;
alter table public.user_details add constraint ud_resume_skills_len check (
  cardinality(resume_skills) <= 12 and length(array_to_string(resume_skills, ',')) <= 600
);

alter table public.user_details drop constraint if exists ud_resume_name_len;
alter table public.user_details add constraint ud_resume_name_len check (resume_name is null or length(resume_name) <= 200);

alter table public.user_details drop constraint if exists ud_resume_size_range;
alter table public.user_details add constraint ud_resume_size_range check (resume_size is null or resume_size between 1 and 5242880);

alter table public.user_details drop constraint if exists ud_resume_hash_format;
alter table public.user_details add constraint ud_resume_hash_format check (resume_hash is null or resume_hash ~ '^[0-9a-f]{64}$');

alter table public.user_details drop constraint if exists ud_resume_ai_hash_format;
alter table public.user_details add constraint ud_resume_ai_hash_format check (resume_ai_hash is null or resume_ai_hash ~ '^[0-9a-f]{64}$');

drop trigger if exists user_details_touch on public.user_details;
create trigger user_details_touch before update on public.user_details
for each row execute function public.touch_updated_at();

-- ══ Resume storage ════════════════════════════════════════════════════════════
-- Private bucket, PDF only, 5 MB. Each user can only touch "<their id>/resume.pdf".
-- The browser uploads straight to Storage with a signed URL, so files never pass
-- through the app servers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

drop policy if exists "own resume read" on storage.objects;
create policy "own resume read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and name = (select auth.jwt() ->> 'sub') || '/resume.pdf');
drop policy if exists "own resume write" on storage.objects;
create policy "own resume write" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and name = (select auth.jwt() ->> 'sub') || '/resume.pdf');
drop policy if exists "own resume update" on storage.objects;
create policy "own resume update" on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and name = (select auth.jwt() ->> 'sub') || '/resume.pdf')
  with check (bucket_id = 'resumes' and name = (select auth.jwt() ->> 'sub') || '/resume.pdf');
drop policy if exists "own resume delete" on storage.objects;
create policy "own resume delete" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and name = (select auth.jwt() ->> 'sub') || '/resume.pdf');

-- ══ AI budget ═════════════════════════════════════════════════════════════════
-- The only runtime AI call left is the optional resume skill tagger. claim_ai_call()
-- enforces a per-user and a global daily cap atomically. Users can't read or write
-- the table; only the function touches it.
create table if not exists public.ai_usage (
  day     date not null,
  user_id text not null,
  calls   integer not null default 0,
  primary key (day, user_id)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from authenticated, anon;

create or replace function public.claim_ai_call() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
  today date := (now() at time zone 'utc')::date;
  mine integer;
  everyone integer;
begin
  if uid is null then return false; end if;
  insert into public.ai_usage (day, user_id, calls) values (today, '*', 0) on conflict do nothing;
  -- Lock the global row so concurrent claims are counted one at a time.
  select calls into everyone from public.ai_usage where day = today and user_id = '*' for update;
  select calls into mine from public.ai_usage where day = today and user_id = uid;
  if coalesce(mine, 0) >= 3 or everyone >= 5000 then return false; end if;
  insert into public.ai_usage (day, user_id, calls) values (today, uid, 1)
    on conflict (day, user_id) do update set calls = public.ai_usage.calls + 1;
  update public.ai_usage set calls = calls + 1 where day = today and user_id = '*';
  return true;
end $$;
revoke execute on function public.claim_ai_call() from public, anon;
grant execute on function public.claim_ai_call() to authenticated;

-- ══ Public profile fields ═════════════════════════════════════════════════════
-- display_name and avatar_url are copied from Clerk when someone publishes, so public
-- pages never call Clerk (no per-view API calls, no rate limits).
alter table public.user_details add column if not exists username     text;
alter table public.user_details add column if not exists is_public    boolean not null default false;
alter table public.user_details add column if not exists display_name text;
alter table public.user_details add column if not exists avatar_url   text;

create unique index if not exists user_details_username_key on public.user_details (lower(username));

alter table public.user_details drop constraint if exists ud_username_format;
alter table public.user_details add constraint ud_username_format check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$');
alter table public.user_details drop constraint if exists ud_public_needs_username;
alter table public.user_details add constraint ud_public_needs_username check (not is_public or username is not null);
alter table public.user_details drop constraint if exists ud_display_name_len;
alter table public.user_details add constraint ud_display_name_len check (display_name is null or length(display_name) <= 80);
alter table public.user_details drop constraint if exists ud_avatar_url_format;
alter table public.user_details add constraint ud_avatar_url_format check (avatar_url is null or (length(avatar_url) <= 500 and avatar_url like 'https://%'));

-- ══ Proof of work ═════════════════════════════════════════════════════════════
-- A link to something the person made, usually attached to a build task. Proofs belong
-- to the person, not the plan: starting a new plan keeps them (plan_id becomes null).
create table if not exists public.proofs (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default (auth.jwt() ->> 'sub'),
  plan_id    uuid references public.plans (id) on delete set null,
  task_key   text,
  title      text not null,
  url        text not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists proofs_one_per_task on public.proofs (plan_id, task_key) where plan_id is not null and task_key is not null;
create index if not exists proofs_user_recent on public.proofs (user_id, created_at desc);

alter table public.proofs enable row level security;
drop policy if exists "own proofs" on public.proofs;
create policy "own proofs" on public.proofs
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check (
    (select auth.jwt() ->> 'sub') = user_id
    and (plan_id is null or exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.jwt() ->> 'sub')))
  );

alter table public.proofs drop constraint if exists proofs_sizes;
alter table public.proofs add constraint proofs_sizes check (
  length(title) between 1 and 160 and length(note) <= 280
  and length(url) <= 300 and url like 'https://%'
  and (task_key is null or task_key ~ '^[a-z0-9.\-]{1,64}$')
);

revoke update on public.proofs from authenticated, anon;
grant update (title, url, note) on public.proofs to authenticated;

-- At most 100 proofs per person.
create or replace function public.limit_proofs() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.proofs where user_id = new.user_id) >= 100 then
    raise exception 'proof limit reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists proofs_limit on public.proofs;
create trigger proofs_limit before insert on public.proofs
for each row execute function public.limit_proofs();

-- ══ Public profile read ═══════════════════════════════════════════════════════
-- The only way anonymous visitors can read anything. Returns a fixed set of safe
-- fields for a profile its owner made public, or null. Never returns user ids, the
-- resume, or onboarding answers.
create or replace function public.get_public_profile(p_username text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username',     d.username,
    'display_name', d.display_name,
    'avatar_url',   d.avatar_url,
    'headline',     d.headline,
    'links',        d.links,
    'skills',       d.skills,
    'known_skills', d.known_skills,
    'role_id',      p.role_id,
    'role_title',   p.role_title,
    'plan', case when pl.id is null then null else jsonb_build_object(
      'template_id',      pl.template_id,
      'template_version', pl.template_version,
      'inputs',           pl.inputs,
      'created_at',       pl.created_at,
      'done', coalesce((select jsonb_agg(tp.task_key) from public.task_progress tp
                        where tp.plan_id = pl.id and tp.completed_on is not null), '[]'::jsonb)
    ) end,
    'proofs', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'url', x.url, 'note', x.note, 'created_at', x.created_at) order by x.created_at desc)
                        from (select * from public.proofs pr where pr.user_id = d.user_id order by pr.created_at desc limit 50) x), '[]'::jsonb)
  )
  from public.user_details d
  left join public.profiles p on p.user_id = d.user_id
  left join public.plans pl on pl.user_id = d.user_id
  where lower(d.username) = lower(p_username) and d.is_public
$$;
revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;


-- ══ Reminders: see supabase/migrations/004_reminders.sql for setup notes.
-- ══ Private config (not reachable through the API) ════════════════════════════
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_config (key text primary key, value text not null);
revoke all on private.app_config from public, anon, authenticated;

create or replace function private.check_cron_secret(p_secret text) returns void
language plpgsql security definer set search_path = private, public as $$
begin
  if p_secret is null or length(p_secret) < 32 or not exists (
    select 1 from private.app_config
    where key = 'cron_secret_sha256' and value = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;
revoke execute on function private.check_cron_secret(text) from public, anon, authenticated;

-- ══ Push subscriptions ════════════════════════════════════════════════════════
-- One row per browser. A browser belongs to whoever subscribed it last, so a shared
-- computer never gets someone else's reminders.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default (auth.jwt() ->> 'sub'),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own subscriptions read" on public.push_subscriptions;
create policy "own subscriptions read" on public.push_subscriptions for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
drop policy if exists "own subscriptions delete" on public.push_subscriptions;
create policy "own subscriptions delete" on public.push_subscriptions for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
-- Inserts go through save_push_subscription() so ownership moves cleanly between accounts.
revoke insert, update on public.push_subscriptions from authenticated, anon;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint) > 1000
     or p_p256dh is null or length(p_p256dh) not between 20 and 200
     or p_auth is null or length(p_auth) not between 8 and 100 then
    raise exception 'invalid subscription' using errcode = '22023';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (uid, p_endpoint, p_p256dh, p_auth);
  -- Keep each person's 5 newest browsers.
  delete from public.push_subscriptions
  where user_id = uid and id not in (
    select id from public.push_subscriptions where user_id = uid order by created_at desc limit 5
  );
end $$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ══ Reminder preferences ══════════════════════════════════════════════════════
create table if not exists public.reminder_prefs (
  user_id        text primary key default (auth.jwt() ->> 'sub'),
  daily_enabled  boolean not null default true,
  daily_hour     smallint not null default 18,
  weekly_enabled boolean not null default true,
  next_daily_at  timestamptz,
  next_weekly_at timestamptz,
  last_test_at   timestamptz,
  updated_at     timestamptz not null default now()
);
alter table public.reminder_prefs drop constraint if exists reminder_prefs_hour;
alter table public.reminder_prefs add constraint reminder_prefs_hour check (daily_hour between 0 and 23);
create index if not exists reminder_prefs_daily_due on public.reminder_prefs (next_daily_at) where daily_enabled;
create index if not exists reminder_prefs_weekly_due on public.reminder_prefs (next_weekly_at) where weekly_enabled;

alter table public.reminder_prefs enable row level security;
drop policy if exists "own reminder prefs" on public.reminder_prefs;
create policy "own reminder prefs" on public.reminder_prefs
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
-- Users set their choices; the next_* times are worked out by the trigger below.
revoke insert, update on public.reminder_prefs from authenticated, anon;
grant insert (user_id, daily_enabled, daily_hour, weekly_enabled, last_test_at) on public.reminder_prefs to authenticated;
grant update (daily_enabled, daily_hour, weekly_enabled, last_test_at) on public.reminder_prefs to authenticated;

-- Next time it will be <hour>:00 in the time zone (on weekday dow if given, 0 = Sunday).
create or replace function public.next_local_time(p_tz text, p_hour integer, p_dow integer default null) returns timestamptz
language plpgsql stable set search_path = public as $$
declare
  tz text := coalesce(nullif(p_tz, ''), 'UTC');
  local_now timestamp;
  candidate timestamp;
begin
  begin
    local_now := now() at time zone tz;
  exception when others then
    tz := 'UTC';
    local_now := now() at time zone tz;
  end;
  candidate := date_trunc('day', local_now) + make_interval(hours => p_hour);
  if p_dow is not null then
    candidate := candidate + make_interval(days => ((p_dow - extract(dow from candidate)::integer + 7) % 7));
  end if;
  if candidate <= local_now then
    candidate := candidate + make_interval(days => case when p_dow is null then 1 else 7 end);
  end if;
  return candidate at time zone tz;
end $$;

create or replace function public.reminder_prefs_schedule() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text := coalesce((select timezone from public.profiles where user_id = new.user_id), 'UTC');
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.daily_hour is distinct from old.daily_hour or new.daily_enabled is distinct from old.daily_enabled then
    new.next_daily_at := public.next_local_time(tz, new.daily_hour);
  end if;
  if tg_op = 'INSERT' or new.daily_hour is distinct from old.daily_hour or new.weekly_enabled is distinct from old.weekly_enabled then
    new.next_weekly_at := public.next_local_time(tz, new.daily_hour, 0);
  end if;
  return new;
end $$;
drop trigger if exists reminder_prefs_schedule on public.reminder_prefs;
create trigger reminder_prefs_schedule before insert or update on public.reminder_prefs
for each row execute function public.reminder_prefs_schedule();

-- Consecutive days ending today or yesterday with at least one finished (not skipped) task.
create or replace function public.plan_streak(p_plan_id uuid, p_today date) returns integer
language sql stable set search_path = public as $$
  with d as (
    select distinct completed_on as day from public.task_progress
    where plan_id = p_plan_id and completed_on is not null and not skipped and completed_on <= p_today
  ), g as (
    select day, day + (row_number() over (order by day desc))::integer as grp from d
  )
  select case
    when (select max(day) from d) >= p_today - 1
      then (select count(*)::integer from g where grp = (select grp from g order by day desc limit 1))
    else 0
  end
$$;
revoke execute on function public.plan_streak(uuid, date) from public, anon, authenticated;

-- ══ The sending job's entry points ════════════════════════════════════════════
-- Claims up to p_limit reminders of one kind that are due, moves their next time
-- forward (so retries and parallel runs never double-send), and returns one row per
-- claimed person. send is false when there's nothing to send (no plan, no browser, or
-- a Sunday where the weekly summary replaces the daily nudge); the job uses the row
-- count to know whether more are waiting.
drop function if exists public.claim_due_reminders(text, text, integer);
create function public.claim_due_reminders(p_secret text, p_kind text, p_limit integer)
returns table (send boolean, subscriptions jsonb, daily_minutes integer, streak integer, done_today boolean, week_done integer, role_title text)
language plpgsql security definer set search_path = public as $$
begin
  perform private.check_cron_secret(p_secret);
  if p_kind not in ('daily', 'weekly') then raise exception 'bad kind'; end if;

  return query
  with due as (
    select r.user_id, r.daily_hour, r.weekly_enabled from public.reminder_prefs r
    where case when p_kind = 'daily' then r.daily_enabled and r.next_daily_at <= now()
               else r.weekly_enabled and r.next_weekly_at <= now() end
    order by case when p_kind = 'daily' then r.next_daily_at else r.next_weekly_at end
    limit least(greatest(p_limit, 1), 1000)
    for update of r skip locked
  ), info as (
    select d.user_id, d.weekly_enabled, coalesce(pf.timezone, 'UTC') as tz,
           pf.daily_minutes, pf.role_title, pl.id as plan_id
    from due d
    left join public.profiles pf on pf.user_id = d.user_id
    left join public.plans pl on pl.user_id = d.user_id
  ), advanced as (
    -- Data-changing CTEs always run, even though nothing below reads this one.
    update public.reminder_prefs r set
      next_daily_at  = case when p_kind = 'daily'  then public.next_local_time(i.tz, r.daily_hour) else r.next_daily_at end,
      next_weekly_at = case when p_kind = 'weekly' then public.next_local_time(i.tz, r.daily_hour, 0) else r.next_weekly_at end
    from info i
    where r.user_id = i.user_id
    returning r.user_id
  ), t as (
    select i.*, (now() at time zone i.tz)::date as local_day,
           (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
              from public.push_subscriptions s where s.user_id = i.user_id) as subs
    from info i
  )
  select
    t.plan_id is not null and t.subs is not null
      and not (p_kind = 'daily' and t.weekly_enabled and extract(dow from (now() at time zone t.tz)) = 0),
    t.subs,
    t.daily_minutes,
    case when t.plan_id is null then 0 else public.plan_streak(t.plan_id, t.local_day) end,
    exists (select 1 from public.task_progress tp where tp.plan_id = t.plan_id and tp.completed_on = t.local_day and not tp.skipped),
    (select count(*)::integer from public.task_progress tp where tp.plan_id = t.plan_id and tp.completed_on > t.local_day - 7 and not tp.skipped),
    t.role_title
  from t;
end $$;
revoke execute on function public.claim_due_reminders(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(text, text, integer) to anon;

-- Browsers that told the push service they've unsubscribed (HTTP 404/410).
create or replace function public.remove_push_subscriptions(p_secret text, p_endpoints text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  perform private.check_cron_secret(p_secret);
  delete from public.push_subscriptions where endpoint = any (p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.remove_push_subscriptions(text, text[]) from public, anon, authenticated;
grant execute on function public.remove_push_subscriptions(text, text[]) to anon;


-- ══ Habits ════════════════════════════════════════════════════════════════════
-- Things people want to do every day on top of their plan, like "LeetCode daily".
-- Each day gets one log row, with an optional note: what they worked on, a link,
-- their approach and their code.
create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default (auth.jwt() ->> 'sub'),
  title      text not null,
  position   smallint not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists habits_user on public.habits (user_id, position);

alter table public.habits enable row level security;
drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

alter table public.habits drop constraint if exists habits_sizes;
alter table public.habits add constraint habits_sizes check (length(title) between 1 and 80 and position between 0 and 100);
revoke update on public.habits from authenticated, anon;
grant update (title, position, archived) on public.habits to authenticated;

-- At most 20 habits per person (archived ones included).
create or replace function public.limit_habits() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.habits where user_id = new.user_id) >= 20 then
    raise exception 'habit limit reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists habits_limit on public.habits;
create trigger habits_limit before insert on public.habits
for each row execute function public.limit_habits();

create table if not exists public.habit_logs (
  habit_id   uuid not null references public.habits (id) on delete cascade,
  user_id    text not null default (auth.jwt() ->> 'sub'),
  day        date not null,
  done       boolean not null default false,
  title      text not null default '',
  url        text not null default '',
  notes      text not null default '',
  code       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (habit_id, day)
);
create index if not exists habit_logs_user_day on public.habit_logs (user_id, day desc);

alter table public.habit_logs enable row level security;
drop policy if exists "own habit logs" on public.habit_logs;
create policy "own habit logs" on public.habit_logs
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check (
    (select auth.jwt() ->> 'sub') = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.jwt() ->> 'sub'))
  );

alter table public.habit_logs drop constraint if exists habit_logs_sizes;
alter table public.habit_logs add constraint habit_logs_sizes check (
  length(title) <= 200 and length(notes) <= 5000 and length(code) <= 20000
  and (url = '' or (length(url) <= 500 and url like 'https://%'))
);
revoke update on public.habit_logs from authenticated, anon;
grant update (done, title, url, notes, code) on public.habit_logs to authenticated;

drop trigger if exists habit_logs_touch on public.habit_logs;
create trigger habit_logs_touch before update on public.habit_logs
for each row execute function public.touch_updated_at();

-- ══ Contact details on the public profile ═════════════════════════════════════
-- Each one is off until the person switches it on.
alter table public.user_details add column if not exists contact_email text;
alter table public.user_details add column if not exists phone         text;
alter table public.user_details add column if not exists show_email    boolean not null default false;
alter table public.user_details add column if not exists show_phone    boolean not null default false;
alter table public.user_details add column if not exists show_resume   boolean not null default false;

alter table public.user_details drop constraint if exists ud_contact_email_format;
alter table public.user_details add constraint ud_contact_email_format check (
  contact_email is null or (length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
alter table public.user_details drop constraint if exists ud_phone_format;
alter table public.user_details add constraint ud_phone_format check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{5,22}$');

-- Same as before, plus email, phone and whether a resume can be downloaded.
create or replace function public.get_public_profile(p_username text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username',     d.username,
    'display_name', d.display_name,
    'avatar_url',   d.avatar_url,
    'headline',     d.headline,
    'links',        d.links,
    'skills',       d.skills,
    'known_skills', d.known_skills,
    'email',        case when d.show_email then d.contact_email end,
    'phone',        case when d.show_phone then d.phone end,
    'has_resume',   d.show_resume and d.resume_hash is not null,
    'role_id',      p.role_id,
    'role_title',   p.role_title,
    'plan', case when pl.id is null then null else jsonb_build_object(
      'template_id',      pl.template_id,
      'template_version', pl.template_version,
      'inputs',           pl.inputs,
      'created_at',       pl.created_at,
      'done', coalesce((select jsonb_agg(tp.task_key) from public.task_progress tp
                        where tp.plan_id = pl.id and tp.completed_on is not null), '[]'::jsonb)
    ) end,
    'proofs', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'url', x.url, 'note', x.note, 'created_at', x.created_at) order by x.created_at desc)
                        from (select * from public.proofs pr where pr.user_id = d.user_id order by pr.created_at desc limit 50) x), '[]'::jsonb)
  )
  from public.user_details d
  left join public.profiles p on p.user_id = d.user_id
  left join public.plans pl on pl.user_id = d.user_id
  where lower(d.username) = lower(p_username) and d.is_public
$$;
revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ══ Public resume download ════════════════════════════════════════════════════
-- Visitors can download a resume only when its owner made the profile public AND
-- switched on "show resume". The storage policy below checks that on every request,
-- so the app still needs no service-role key.
create or replace function public.resume_is_public(p_object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_details d
    where p_object_name = d.user_id || '/resume.pdf'
      and d.is_public and d.show_resume and d.resume_hash is not null
  )
$$;
revoke execute on function public.resume_is_public(text) from public;
grant execute on function public.resume_is_public(text) to anon, authenticated;

create or replace function public.public_resume_path(p_username text) returns text
language sql stable security definer set search_path = public as $$
  select d.user_id || '/resume.pdf' from public.user_details d
  where lower(d.username) = lower(p_username) and d.is_public and d.show_resume and d.resume_hash is not null
$$;
revoke execute on function public.public_resume_path(text) from public;
grant execute on function public.public_resume_path(text) to anon, authenticated;

drop policy if exists "public resume read" on storage.objects;
create policy "public resume read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'resumes' and public.resume_is_public(name));


-- ══ Activity streak (plan tasks + habits), used by reminders
create or replace function public.active_days(p_user_id text, p_plan_id uuid, p_from date, p_to date)
returns table (day date)
language sql stable set search_path = public as $$
  select distinct completed_on from public.task_progress
  where plan_id = p_plan_id and completed_on between p_from and p_to and not skipped
  union
  select distinct hl.day from public.habit_logs hl
  where hl.user_id = p_user_id and hl.done and hl.day between p_from and p_to
$$;
revoke execute on function public.active_days(text, uuid, date, date) from public, anon, authenticated;

create or replace function public.active_on(p_user_id text, p_plan_id uuid, p_day date) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from public.active_days(p_user_id, p_plan_id, p_day, p_day))
$$;
revoke execute on function public.active_on(text, uuid, date) from public, anon, authenticated;

-- Consecutive active days ending today or yesterday.
create or replace function public.activity_streak(p_user_id text, p_plan_id uuid, p_today date) returns integer
language sql stable set search_path = public as $$
  with d as (
    select day from public.active_days(p_user_id, p_plan_id, p_today - 400, p_today)
  ), g as (
    select day, day + (row_number() over (order by day desc))::integer as grp from d
  )
  select case
    when (select max(day) from d) >= p_today - 1
      then (select count(*)::integer from g where grp = (select grp from g order by day desc limit 1))
    else 0
  end
$$;
revoke execute on function public.activity_streak(text, uuid, date) from public, anon, authenticated;

drop function if exists public.claim_due_reminders(text, text, integer);
create function public.claim_due_reminders(p_secret text, p_kind text, p_limit integer)
returns table (send boolean, subscriptions jsonb, daily_minutes integer, streak integer, done_today boolean, week_done integer, role_title text)
language plpgsql security definer set search_path = public as $$
begin
  perform private.check_cron_secret(p_secret);
  if p_kind not in ('daily', 'weekly') then raise exception 'bad kind'; end if;

  return query
  with due as (
    select r.user_id, r.daily_hour, r.weekly_enabled from public.reminder_prefs r
    where case when p_kind = 'daily' then r.daily_enabled and r.next_daily_at <= now()
               else r.weekly_enabled and r.next_weekly_at <= now() end
    order by case when p_kind = 'daily' then r.next_daily_at else r.next_weekly_at end
    limit least(greatest(p_limit, 1), 1000)
    for update of r skip locked
  ), info as (
    select d.user_id, d.weekly_enabled, coalesce(pf.timezone, 'UTC') as tz,
           pf.daily_minutes, pf.role_title, pl.id as plan_id
    from due d
    left join public.profiles pf on pf.user_id = d.user_id
    left join public.plans pl on pl.user_id = d.user_id
  ), advanced as (
    -- Data-changing CTEs always run, even though nothing below reads this one.
    update public.reminder_prefs r set
      next_daily_at  = case when p_kind = 'daily'  then public.next_local_time(i.tz, r.daily_hour) else r.next_daily_at end,
      next_weekly_at = case when p_kind = 'weekly' then public.next_local_time(i.tz, r.daily_hour, 0) else r.next_weekly_at end
    from info i
    where r.user_id = i.user_id
    returning r.user_id
  ), t as (
    select i.*, (now() at time zone i.tz)::date as local_day,
           (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
              from public.push_subscriptions s where s.user_id = i.user_id) as subs
    from info i
  )
  select
    t.plan_id is not null and t.subs is not null
      and not (p_kind = 'daily' and t.weekly_enabled and extract(dow from (now() at time zone t.tz)) = 0),
    t.subs,
    t.daily_minutes,
    public.activity_streak(t.user_id, t.plan_id, t.local_day),
    public.active_on(t.user_id, t.plan_id, t.local_day),
    (select count(*)::integer from public.task_progress tp where tp.plan_id = t.plan_id and tp.completed_on > t.local_day - 7 and not tp.skipped),
    t.role_title
  from t;
end $$;
revoke execute on function public.claim_due_reminders(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(text, text, integer) to anon;


-- ══ Pro (see supabase/migrations/007_pro.sql for how to grant it)
-- ══ Entitlements ══════════════════════════════════════════════════════════════
-- Written only by the database owner (SQL Editor now, a payment webhook later).
create table if not exists public.entitlements (
  user_id    text primary key,
  pro_until  timestamptz not null,
  source     text not null default 'manual',
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
drop policy if exists "own entitlement" on public.entitlements;
create policy "own entitlement" on public.entitlements for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
revoke insert, update, delete on public.entitlements from authenticated, anon;

create or replace function public.is_pro(p_user_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.entitlements where user_id = p_user_id and pro_until > now())
$$;
revoke execute on function public.is_pro(text) from public, anon;
grant execute on function public.is_pro(text) to authenticated;

-- ══ Premium profile ═══════════════════════════════════════════════════════════
alter table public.user_details add column if not exists hide_branding boolean not null default false;
alter table public.user_details add column if not exists card_theme    text not null default 'classic';
alter table public.user_details drop constraint if exists ud_card_theme;
alter table public.user_details add constraint ud_card_theme check (card_theme in ('classic', 'midnight', 'minimal'));

-- Pro-only choices are checked when they're made. If Pro lapses, the public page
-- quietly falls back (see get_public_profile) but nothing is deleted.
create or replace function public.user_details_pro_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.hide_branding and (tg_op = 'INSERT' or not old.hide_branding) and not public.is_pro(new.user_id) then
    raise exception 'pro required: hide branding' using errcode = '42501';
  end if;
  if new.card_theme <> 'classic' and (tg_op = 'INSERT' or new.card_theme is distinct from old.card_theme) and not public.is_pro(new.user_id) then
    raise exception 'pro required: card theme' using errcode = '42501';
  end if;
  if new.username is not null and length(new.username) < 6
     and (tg_op = 'INSERT' or new.username is distinct from old.username) and not public.is_pro(new.user_id) then
    raise exception 'pro required: short username' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists user_details_pro_check on public.user_details;
create trigger user_details_pro_check before insert or update on public.user_details
for each row execute function public.user_details_pro_check();

-- Same as v5, plus branding and card theme (honoured only while Pro is active).
create or replace function public.get_public_profile(p_username text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username',      d.username,
    'display_name',  d.display_name,
    'avatar_url',    d.avatar_url,
    'headline',      d.headline,
    'links',         d.links,
    'skills',        d.skills,
    'known_skills',  d.known_skills,
    'email',         case when d.show_email then d.contact_email end,
    'phone',         case when d.show_phone then d.phone end,
    'has_resume',    d.show_resume and d.resume_hash is not null,
    'hide_branding', d.hide_branding and public.is_pro(d.user_id),
    'card_theme',    case when public.is_pro(d.user_id) then d.card_theme else 'classic' end,
    'role_id',       p.role_id,
    'role_title',    p.role_title,
    'plan', case when pl.id is null then null else jsonb_build_object(
      'template_id',      pl.template_id,
      'template_version', pl.template_version,
      'inputs',           pl.inputs,
      'created_at',       pl.created_at,
      'done', coalesce((select jsonb_agg(tp.task_key) from public.task_progress tp
                        where tp.plan_id = pl.id and tp.completed_on is not null), '[]'::jsonb)
    ) end,
    'proofs', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'url', x.url, 'note', x.note, 'created_at', x.created_at) order by x.created_at desc)
                        from (select * from public.proofs pr where pr.user_id = d.user_id order by pr.created_at desc limit 50) x), '[]'::jsonb)
  )
  from public.user_details d
  left join public.profiles p on p.user_id = d.user_id
  left join public.plans pl on pl.user_id = d.user_id
  where lower(d.username) = lower(p_username) and d.is_public
$$;
revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ══ Profile analytics ═════════════════════════════════════════════════════════
-- One row per visitor per day per thing, so refreshes don't inflate counts. visitor is
-- a salted hash made by the app; no IP address or user agent is stored.
create table if not exists public.profile_events (
  id         bigint generated always as identity primary key,
  owner_id   text not null,
  kind       text not null,
  target     text not null default '',
  day        date not null default ((now() at time zone 'utc')::date),
  visitor    text not null,
  created_at timestamptz not null default now()
);
alter table public.profile_events drop constraint if exists profile_events_shape;
alter table public.profile_events add constraint profile_events_shape check (
  kind in ('view', 'card', 'resume', 'link') and length(target) <= 64 and visitor ~ '^[0-9a-f]{64}$'
);
create unique index if not exists profile_events_once_a_day on public.profile_events (owner_id, kind, target, day, visitor);
create index if not exists profile_events_owner_day on public.profile_events (owner_id, day);

alter table public.profile_events enable row level security;
drop policy if exists "own profile events" on public.profile_events;
create policy "own profile events" on public.profile_events for select to authenticated
  using ((select auth.jwt() ->> 'sub') = owner_id);
revoke insert, update, delete on public.profile_events from authenticated, anon;

-- Called by the public page and its download/redirect routes. Ignores private
-- profiles and the owner viewing their own page.
create or replace function public.record_profile_event(p_username text, p_kind text, p_target text, p_visitor text, p_viewer text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner text;
begin
  select d.user_id into v_owner from public.user_details d where lower(d.username) = lower(p_username) and d.is_public;
  if v_owner is null or v_owner = coalesce(p_viewer, '') then return; end if;
  if p_kind not in ('view', 'card', 'resume', 'link') or length(coalesce(p_target, '')) > 64 or p_visitor !~ '^[0-9a-f]{64}$' then return; end if;
  insert into public.profile_events (owner_id, kind, target, visitor)
  values (v_owner, p_kind, coalesce(p_target, ''), p_visitor)
  on conflict do nothing;
end $$;
revoke execute on function public.record_profile_event(text, text, text, text, text) from public;
grant execute on function public.record_profile_event(text, text, text, text, text) to anon, authenticated;

-- The owner's counts per day, kind and target. Runs as the caller, so RLS limits it to
-- their own events; summing in the database keeps popular profiles cheap to report on.
create or replace function public.my_profile_stats(p_from date)
returns table (kind text, target text, day date, n integer)
language sql stable security invoker set search_path = public as $$
  select e.kind, e.target, e.day, count(*)::integer
  from public.profile_events e
  where e.owner_id = (select auth.jwt() ->> 'sub') and e.day >= p_from
  group by 1, 2, 3
$$;
revoke execute on function public.my_profile_stats(date) from public, anon;
grant execute on function public.my_profile_stats(date) to authenticated;

-- ══ Streak freezes ════════════════════════════════════════════════════════════
create table if not exists public.streak_freezes (
  user_id    text not null,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.streak_freezes enable row level security;
drop policy if exists "own freezes" on public.streak_freezes;
create policy "own freezes" on public.streak_freezes for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
revoke insert, update, delete on public.streak_freezes from authenticated, anon;

-- If the caller is Pro, missed the days just before p_today, had a streak going, and has
-- enough freezes left this month (3), fills the gap so the streak survives. Returns the
-- days it froze. p_today is the caller's local date, so it must be close to UTC today.
create or replace function public.apply_streak_freezes(p_today date) returns date[]
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
  plan uuid;
  last_day date;
  gap integer;
  used integer;
  frozen date[] := '{}';
begin
  if uid is null or not public.is_pro(uid) then return frozen; end if;
  if p_today not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then return frozen; end if;
  select id into plan from public.plans where user_id = uid;
  select max(day) into last_day from (
    select day from public.active_days(uid, plan, p_today - 60, p_today - 1)
    union select day from public.streak_freezes where user_id = uid and day between p_today - 60 and p_today - 1
  ) x;
  if last_day is null or last_day >= p_today - 1 then return frozen; end if;
  gap := (p_today - 1) - last_day;
  select count(*) into used from public.streak_freezes
    where user_id = uid and date_trunc('month', day) = date_trunc('month', p_today::timestamp);
  if gap > 3 - used then return frozen; end if;
  insert into public.streak_freezes (user_id, day)
    select uid, d::date from generate_series(last_day + 1, p_today - 1, interval '1 day') d
    on conflict do nothing;
  select array_agg(d::date order by d) into frozen from generate_series(last_day + 1, p_today - 1, interval '1 day') d;
  return frozen;
end $$;
revoke execute on function public.apply_streak_freezes(date) from public, anon;
grant execute on function public.apply_streak_freezes(date) to authenticated;

-- Reminders: frozen days keep the streak going too.
create or replace function public.activity_streak(p_user_id text, p_plan_id uuid, p_today date) returns integer
language sql stable set search_path = public as $$
  with d as (
    select day from public.active_days(p_user_id, p_plan_id, p_today - 400, p_today)
    union select day from public.streak_freezes where user_id = p_user_id and day between p_today - 400 and p_today
  ), g as (
    select day, day + (row_number() over (order by day desc))::integer as grp from d
  )
  select case
    when (select max(day) from d) >= p_today - 1
      then (select count(*)::integer from g where grp = (select grp from g order by day desc limit 1))
    else 0
  end
$$;
revoke execute on function public.activity_streak(text, uuid, date) from public, anon, authenticated;

-- ══ Roadmap editing ═══════════════════════════════════════════════════════════
-- Edits sit on top of the shared template: added tasks, plus per-task overrides that
-- hide a task or change its order within its milestone. Starting a new plan clears them.
create table if not exists public.plan_custom_tasks (
  plan_id         uuid not null references public.plans (id) on delete cascade,
  user_id         text not null default (auth.jwt() ->> 'sub'),
  task_key        text not null,
  phase_index     smallint not null,
  milestone_index smallint not null,
  sort            numeric not null,
  title           text not null,
  description     text not null default '',
  type            text not null,
  minutes         integer not null,
  created_at      timestamptz not null default now(),
  primary key (plan_id, task_key)
);
create table if not exists public.plan_task_overrides (
  plan_id  uuid not null references public.plans (id) on delete cascade,
  user_id  text not null default (auth.jwt() ->> 'sub'),
  task_key text not null,
  hidden   boolean not null default false,
  sort     numeric,
  primary key (plan_id, task_key)
);

alter table public.plan_custom_tasks drop constraint if exists plan_custom_tasks_shape;
alter table public.plan_custom_tasks add constraint plan_custom_tasks_shape check (
  task_key ~ '^c\.[a-z0-9]{6,20}$' and phase_index between 0 and 9 and milestone_index between 0 and 9
  and length(title) between 3 and 160 and length(description) <= 500
  and type in ('learn', 'build', 'practice', 'reflect', 'connect') and minutes between 5 and 180
);
alter table public.plan_task_overrides drop constraint if exists plan_task_overrides_shape;
alter table public.plan_task_overrides add constraint plan_task_overrides_shape check (task_key ~ '^[a-z0-9.\-]{1,64}$');

alter table public.plan_custom_tasks   enable row level security;
alter table public.plan_task_overrides enable row level security;
drop policy if exists "own custom tasks" on public.plan_custom_tasks;
create policy "own custom tasks" on public.plan_custom_tasks for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id
    and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.jwt() ->> 'sub')));
drop policy if exists "own overrides" on public.plan_task_overrides;
create policy "own overrides" on public.plan_task_overrides for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id
    and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.jwt() ->> 'sub')));

revoke update on public.plan_custom_tasks from authenticated, anon;
grant update (title, description, type, minutes, sort) on public.plan_custom_tasks to authenticated;
revoke update on public.plan_task_overrides from authenticated, anon;
grant update (hidden, sort) on public.plan_task_overrides to authenticated;

-- Editing is Pro. Deleting (undoing edits) is always allowed.
create or replace function public.plan_edit_pro_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pro(new.user_id) then
    raise exception 'pro required: edit roadmap' using errcode = '42501';
  end if;
  if tg_table_name = 'plan_custom_tasks' and tg_op = 'INSERT'
     and (select count(*) from public.plan_custom_tasks where plan_id = new.plan_id) >= 100 then
    raise exception 'custom task limit reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists plan_custom_tasks_pro on public.plan_custom_tasks;
create trigger plan_custom_tasks_pro before insert or update on public.plan_custom_tasks
for each row execute function public.plan_edit_pro_check();
drop trigger if exists plan_task_overrides_pro on public.plan_task_overrides;
create trigger plan_task_overrides_pro before insert or update on public.plan_task_overrides
for each row execute function public.plan_edit_pro_check();


-- Make the API see the new tables right away.
notify pgrst, 'reload schema';
