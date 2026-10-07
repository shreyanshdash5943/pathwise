-- Pathwise v2: templates, profile details, resume storage, AI budget.
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once.
-- Requires the original schema (supabase/schema.sql up to the "Hardening" section) to be in place.
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

alter table public.user_details drop constraint if exists user_details_sizes;
alter table public.user_details add constraint user_details_sizes check (
  length(headline) <= 120 and length(links::text) <= 1200
  and cardinality(skills) <= 30 and length(array_to_string(skills, ',')) <= 1200
  and cardinality(known_skills) <= 12 and length(array_to_string(known_skills, ',')) <= 600
  and cardinality(resume_skills) <= 12 and length(array_to_string(resume_skills, ',')) <= 600
  and (resume_name is null or length(resume_name) <= 200)
  and (resume_size is null or resume_size between 1 and 5242880)
  and (resume_hash is null or resume_hash ~ '^[0-9a-f]{64}$')
  and (resume_ai_hash is null or resume_ai_hash ~ '^[0-9a-f]{64}$')
);

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

-- Make the API see the new tables right away (fixes PGRST205).
notify pgrst, 'reload schema';
