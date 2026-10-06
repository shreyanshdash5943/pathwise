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
