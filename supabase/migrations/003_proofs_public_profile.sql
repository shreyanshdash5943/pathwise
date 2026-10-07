-- Pathwise v3: proof of work + public profiles.
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once.
-- Requires 001 and 002.

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

notify pgrst, 'reload schema';
