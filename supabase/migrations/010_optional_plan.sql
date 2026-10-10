-- Pathwise v10: make a career plan optional. A user can exist with just a profile and
-- track habits, then build a plan later. The plan-specific profile columns become
-- nullable, and reminders also go to habits-only users.
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once. Requires 001-009.

-- A habits-only profile has only a timezone; the plan columns fill in when they build one.
alter table public.profiles alter column answers    drop not null;
alter table public.profiles alter column role_id    drop not null;
alter table public.profiles alter column role_title drop not null;
alter table public.profiles alter column field      drop not null;

-- Reminders: send to anyone due who has a plan OR at least one active habit. The daily
-- streak, "done today" and weekly count all come from active_days, which already blends
-- plan tasks and habits, so habits-only users get a real streak. has_plan lets the app
-- word the message for plan users vs habit-only users.
drop function if exists public.claim_due_reminders(text, text, integer);
create function public.claim_due_reminders(p_secret text, p_kind text, p_limit integer)
returns table (send boolean, subscriptions jsonb, daily_minutes integer, streak integer, done_today boolean, week_done integer, role_title text, has_plan boolean)
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
           pf.daily_minutes, pf.role_title, pl.id as plan_id,
           exists (select 1 from public.habits h where h.user_id = d.user_id and not h.archived) as has_habits
    from due d
    left join public.profiles pf on pf.user_id = d.user_id
    left join public.plans pl on pl.user_id = d.user_id
  ), advanced as (
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
    t.subs is not null
      and (t.plan_id is not null or t.has_habits)
      and not (p_kind = 'daily' and t.weekly_enabled and extract(dow from (now() at time zone t.tz)) = 0),
    t.subs,
    t.daily_minutes,
    public.activity_streak(t.user_id, t.plan_id, t.local_day),
    public.active_on(t.user_id, t.plan_id, t.local_day),
    (select count(*)::integer from public.active_days(t.user_id, t.plan_id, t.local_day - 6, t.local_day)),
    t.role_title,
    t.plan_id is not null
  from t;
end $$;
revoke execute on function public.claim_due_reminders(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(text, text, integer) to anon;

-- Pods: a habits-only member (no plan) now shows a real streak from their habits.
create or replace function public.get_pod(p_pod_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
  pod public.pods;
begin
  if not public.is_pod_member(p_pod_id, uid) then return null; end if;
  select * into pod from public.pods where id = p_pod_id;
  return jsonb_build_object(
    'id', pod.id,
    'name', pod.name,
    'invite_code', pod.invite_code,
    'is_owner', pod.created_by = uid,
    'members', (
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'name', nullif(m.display_name, ''),
        'avatar', m.avatar_url,
        'is_me', m.user_id = uid,
        'is_owner', m.user_id = pod.created_by,
        'role', pf.role_title,
        'has_plan', pl.id is not null,
        'streak', public.activity_streak(m.user_id, pl.id, lt.d),
        'active_today', public.active_on(m.user_id, pl.id, lt.d),
        'active_week', (select count(*)::int from public.active_days(m.user_id, pl.id, lt.d - 6, lt.d)),
        'cheers', (select count(*)::int from public.pod_cheers c where c.pod_id = pod.id and c.to_user = m.user_id and c.day = (now() at time zone 'utc')::date),
        'cheered_by_me', exists (select 1 from public.pod_cheers c where c.pod_id = pod.id and c.from_user = uid and c.to_user = m.user_id and c.day = (now() at time zone 'utc')::date),
        'username', case when d.is_public then d.username end
      ) order by m.joined_at)
      from public.pod_members m
      left join public.profiles pf on pf.user_id = m.user_id
      left join public.plans pl on pl.user_id = m.user_id
      left join public.user_details d on d.user_id = m.user_id
      cross join lateral (select (now() at time zone coalesce(pf.timezone, 'UTC'))::date as d) lt
      where m.pod_id = pod.id
    ),
    'posts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'user_id', x.user_id, 'name', nullif(m.display_name, ''), 'avatar', m.avatar_url, 'body', x.body, 'created_at', x.created_at
      ) order by x.created_at desc), '[]'::jsonb)
      from (select * from public.pod_posts where pod_id = pod.id order by created_at desc limit 50) x
      left join public.pod_members m on m.pod_id = pod.id and m.user_id = x.user_id
    )
  );
end $$;
revoke execute on function public.get_pod(uuid) from public, anon;
grant execute on function public.get_pod(uuid) to authenticated;

notify pgrst, 'reload schema';
