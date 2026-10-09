-- Pathwise v8: accountability pods. Small invite-only groups (friends, classmates) who
-- see each other's streaks and weekly activity and cheer each other on. The research is
-- clear that external accountability and not being alone is what makes people finish.
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once. Requires 001-007.
--
-- Privacy model: the tables below are locked (RLS on, no direct grants). Everything goes
-- through the SECURITY DEFINER functions here, each of which checks pod membership first.
-- A pod view shows a member's name, role, streak and weekly activity only -- never their
-- email, phone, resume, onboarding answers, or the contents of their habit notes.

create table if not exists public.pods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_by  text not null default (auth.jwt() ->> 'sub'),
  created_at  timestamptz not null default now()
);

create table if not exists public.pod_members (
  pod_id       uuid not null references public.pods (id) on delete cascade,
  user_id      text not null,
  display_name text not null default '',
  avatar_url   text,
  joined_at    timestamptz not null default now(),
  primary key (pod_id, user_id)
);
create index if not exists pod_members_user on public.pod_members (user_id);

create table if not exists public.pod_posts (
  id         uuid primary key default gen_random_uuid(),
  pod_id     uuid not null references public.pods (id) on delete cascade,
  user_id    text not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists pod_posts_pod on public.pod_posts (pod_id, created_at desc);

create table if not exists public.pod_cheers (
  pod_id    uuid not null references public.pods (id) on delete cascade,
  from_user text not null,
  to_user   text not null,
  day       date not null,
  primary key (pod_id, from_user, to_user, day)
);

-- Locked down: all access is through the functions below.
alter table public.pods         enable row level security;
alter table public.pod_members  enable row level security;
alter table public.pod_posts    enable row level security;
alter table public.pod_cheers   enable row level security;
revoke all on public.pods, public.pod_members, public.pod_posts, public.pod_cheers from authenticated, anon;

alter table public.pods drop constraint if exists pods_name_len;
alter table public.pods add constraint pods_name_len check (length(name) between 2 and 40);
alter table public.pod_members drop constraint if exists pod_members_sizes;
alter table public.pod_members add constraint pod_members_sizes check (
  length(display_name) <= 80 and (avatar_url is null or (avatar_url like 'https://%' and length(avatar_url) <= 500))
);
alter table public.pod_posts drop constraint if exists pod_posts_len;
alter table public.pod_posts add constraint pod_posts_len check (length(body) between 1 and 500);

create or replace function public.is_pod_member(p_pod_id uuid, p_user text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pod_members where pod_id = p_pod_id and user_id = p_user)
$$;
revoke execute on function public.is_pod_member(uuid, text) from public, anon, authenticated;

-- 7-char code from an unambiguous alphabet (no 0/O/1/I).
create or replace function public.gen_pod_code() returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 7)
$$;

-- ── Membership actions ────────────────────────────────────────────────────────
create or replace function public.create_pod(p_name text, p_display_name text, p_avatar_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
  code text;
  new_id uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if length(coalesce(trim(p_name), '')) < 2 or length(p_name) > 40 then raise exception 'bad name' using errcode = '22023'; end if;
  if (select count(*) from public.pod_members where user_id = uid) >= 3 then
    raise exception 'pod limit reached' using errcode = 'check_violation';
  end if;
  for i in 1..10 loop
    code := public.gen_pod_code();
    exit when not exists (select 1 from public.pods where invite_code = code);
  end loop;
  insert into public.pods (name, invite_code, created_by) values (trim(p_name), code, uid) returning id into new_id;
  insert into public.pod_members (pod_id, user_id, display_name, avatar_url)
    values (new_id, uid, left(coalesce(p_display_name, ''), 80), case when p_avatar_url like 'https://%' then left(p_avatar_url, 500) end);
  return jsonb_build_object('id', new_id, 'invite_code', code);
end $$;
revoke execute on function public.create_pod(text, text, text) from public, anon;
grant execute on function public.create_pod(text, text, text) to authenticated;

create or replace function public.join_pod(p_code text, p_display_name text, p_avatar_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
  pod public.pods;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into pod from public.pods where invite_code = upper(trim(p_code));
  if pod.id is null then raise exception 'no such pod' using errcode = 'no_data_found'; end if;
  if exists (select 1 from public.pod_members where pod_id = pod.id and user_id = uid) then
    return jsonb_build_object('id', pod.id, 'already', true);
  end if;
  if (select count(*) from public.pod_members where pod_id = pod.id) >= 6 then
    raise exception 'pod full' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.pod_members where user_id = uid) >= 3 then
    raise exception 'pod limit reached' using errcode = 'check_violation';
  end if;
  insert into public.pod_members (pod_id, user_id, display_name, avatar_url)
    values (pod.id, uid, left(coalesce(p_display_name, ''), 80), case when p_avatar_url like 'https://%' then left(p_avatar_url, 500) end)
    on conflict do nothing;
  return jsonb_build_object('id', pod.id);
end $$;
revoke execute on function public.join_pod(text, text, text) from public, anon;
grant execute on function public.join_pod(text, text, text) to authenticated;

-- Leaving: if you were the last member the pod is deleted; if you created it and others
-- remain, the oldest remaining member becomes the creator.
create or replace function public.leave_pod(p_pod_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
  heir text;
begin
  delete from public.pod_members where pod_id = p_pod_id and user_id = uid;
  if not found then return; end if;
  if not exists (select 1 from public.pod_members where pod_id = p_pod_id) then
    delete from public.pods where id = p_pod_id;
    return;
  end if;
  if exists (select 1 from public.pods where id = p_pod_id and created_by = uid) then
    select user_id into heir from public.pod_members where pod_id = p_pod_id order by joined_at limit 1;
    update public.pods set created_by = heir where id = p_pod_id;
  end if;
end $$;
revoke execute on function public.leave_pod(uuid) from public, anon;
grant execute on function public.leave_pod(uuid) to authenticated;

create or replace function public.remove_pod_member(p_pod_id uuid, p_user_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
begin
  if not exists (select 1 from public.pods where id = p_pod_id and created_by = uid) then
    raise exception 'not the pod owner' using errcode = '42501';
  end if;
  if p_user_id = uid then raise exception 'use leave_pod' using errcode = '22023'; end if;
  delete from public.pod_members where pod_id = p_pod_id and user_id = p_user_id;
end $$;
revoke execute on function public.remove_pod_member(uuid, text) from public, anon;
grant execute on function public.remove_pod_member(uuid, text) to authenticated;

create or replace function public.delete_pod(p_pod_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.pods where id = p_pod_id and created_by = (auth.jwt() ->> 'sub');
end $$;
revoke execute on function public.delete_pod(uuid) from public, anon;
grant execute on function public.delete_pod(uuid) to authenticated;

-- ── Posts and cheers ──────────────────────────────────────────────────────────
create or replace function public.post_to_pod(p_pod_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
begin
  if not public.is_pod_member(p_pod_id, uid) then raise exception 'not a member' using errcode = '42501'; end if;
  if length(coalesce(trim(p_body), '')) < 1 or length(p_body) > 500 then raise exception 'bad post' using errcode = '22023'; end if;
  if (select count(*) from public.pod_posts where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many posts today' using errcode = 'check_violation';
  end if;
  insert into public.pod_posts (pod_id, user_id, body) values (p_pod_id, uid, trim(p_body));
end $$;
revoke execute on function public.post_to_pod(uuid, text) from public, anon;
grant execute on function public.post_to_pod(uuid, text) to authenticated;

-- A cheer is one per person per teammate per day; calling again takes it back (toggle).
create or replace function public.cheer_pod_member(p_pod_id uuid, p_to_user text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.jwt() ->> 'sub';
  today date := (now() at time zone 'utc')::date;
begin
  if not public.is_pod_member(p_pod_id, uid) then raise exception 'not a member' using errcode = '42501'; end if;
  if p_to_user = uid or not public.is_pod_member(p_pod_id, p_to_user) then raise exception 'bad target' using errcode = '22023'; end if;
  delete from public.pod_cheers where pod_id = p_pod_id and from_user = uid and to_user = p_to_user and day = today;
  if found then return false; end if;
  insert into public.pod_cheers (pod_id, from_user, to_user, day) values (p_pod_id, uid, p_to_user, today);
  return true;
end $$;
revoke execute on function public.cheer_pod_member(uuid, text) from public, anon;
grant execute on function public.cheer_pod_member(uuid, text) to authenticated;

-- ── Reads ─────────────────────────────────────────────────────────────────────
create or replace function public.get_my_pods() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'members', (select count(*) from public.pod_members m2 where m2.pod_id = p.id),
    'is_owner', p.created_by = (auth.jwt() ->> 'sub')
  ) order by p.created_at), '[]'::jsonb)
  from public.pods p
  where exists (select 1 from public.pod_members m where m.pod_id = p.id and m.user_id = (auth.jwt() ->> 'sub'))
$$;
revoke execute on function public.get_my_pods() from public, anon;
grant execute on function public.get_my_pods() to authenticated;

-- The full pod view: members with their progress summary, recent posts, today's cheers.
-- Returns null if the caller isn't a member. Exposes no contact details or note contents.
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
        'streak', case when pl.id is null then 0 else public.activity_streak(m.user_id, pl.id, lt.d) end,
        'active_today', case when pl.id is null then false else public.active_on(m.user_id, pl.id, lt.d) end,
        'active_week', case when pl.id is null then 0 else (select count(*)::int from public.active_days(m.user_id, pl.id, lt.d - 6, lt.d)) end,
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
