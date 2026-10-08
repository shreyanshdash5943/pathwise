-- Pathwise v5: daily habits with notes, and contact details on the public profile.
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once.
-- Requires 001-004.

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

notify pgrst, 'reload schema';
