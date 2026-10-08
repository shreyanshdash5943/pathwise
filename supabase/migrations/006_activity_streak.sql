-- Pathwise v6: habits count towards the streak in reminders too, matching the dashboard.
-- A day counts as active if the person finished a plan task (not skipped) or a habit.
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once. Requires 001-005.

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

notify pgrst, 'reload schema';
