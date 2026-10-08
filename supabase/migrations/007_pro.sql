-- Pathwise v7: Pro features. Profile analytics, premium profile, streak freezes and
-- roadmap editing, all gated on an entitlement the database itself checks, so calling
-- the API directly can't unlock anything.
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once. Requires 001-006.
--
-- Until payments are wired up, grant Pro by hand, e.g. for a username:
--   insert into public.entitlements (user_id, pro_until, source)
--   select user_id, now() + interval '1 year', 'manual' from public.user_details where username = 'yourname'
--   on conflict (user_id) do update set pro_until = excluded.pro_until, source = excluded.source;

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

notify pgrst, 'reload schema';
