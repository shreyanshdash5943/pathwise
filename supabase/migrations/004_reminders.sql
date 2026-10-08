-- Pathwise v4: reminders (web push).
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once.
-- Requires 001-003.
--
-- After running it, set the cron secret once (same value as CRON_SECRET in your env):
--   insert into private.app_config (key, value)
--   values ('cron_secret_sha256', encode(sha256(convert_to('<your CRON_SECRET>', 'UTF8')), 'hex'))
--   on conflict (key) do update set value = excluded.value;
--
-- How sending works: an hourly job calls /api/cron/reminders, which calls
-- claim_due_reminders(). That function only looks at rows whose next_*_at time has
-- passed (an index scan, so cost tracks who is due, not total users), moves their next
-- time forward, and returns what to send. The app never needs the service-role key:
-- the job proves itself with the secret above instead.

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

notify pgrst, 'reload schema';
