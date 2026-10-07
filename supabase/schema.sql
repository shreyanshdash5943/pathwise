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


-- Make the API see the new tables right away.
notify pgrst, 'reload schema';
