-- Pathwise v9: the "getting hired" phase. An application tracker and an interview
-- answer bank whose standout is that answers are built from the user's own proof of
-- work. Both tables are private per user (simple own-row RLS, no sharing).
-- Paste into Supabase -> SQL Editor and run. Safe to run more than once. Requires 001-008.

-- ══ Application tracker ═══════════════════════════════════════════════════════
create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null default (auth.jwt() ->> 'sub'),
  company      text not null,
  role_title   text not null default '',
  url          text not null default '',
  location     text not null default '',
  status       text not null default 'saved',
  notes        text not null default '',
  next_step    text not null default '',
  next_step_on date,
  applied_on   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists applications_user on public.applications (user_id, created_at desc);

alter table public.applications enable row level security;
drop policy if exists "own applications" on public.applications;
create policy "own applications" on public.applications
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

alter table public.applications drop constraint if exists applications_shape;
alter table public.applications add constraint applications_shape check (
  length(company) between 1 and 120 and length(role_title) <= 120 and length(location) <= 80
  and (url = '' or (url like 'https://%' and length(url) <= 500))
  and status in ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')
  and length(notes) <= 2000 and length(next_step) <= 160
);
revoke update on public.applications from authenticated, anon;
grant update (company, role_title, url, location, status, notes, next_step, next_step_on, applied_on) on public.applications to authenticated;

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications
for each row execute function public.touch_updated_at();

-- At most 300 applications per user.
create or replace function public.limit_applications() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.applications where user_id = new.user_id) >= 300 then
    raise exception 'application limit reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists applications_limit on public.applications;
create trigger applications_limit before insert on public.applications
for each row execute function public.limit_applications();

-- ══ Interview answer bank ═════════════════════════════════════════════════════
-- One saved STAR answer per question. proof_id links the answer to the project it's
-- built from -- the feature that makes this grounded in real work, not generic advice.
create table if not exists public.interview_answers (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default (auth.jwt() ->> 'sub'),
  question_key  text not null,
  question_text text not null default '',
  situation     text not null default '',
  task          text not null default '',
  action        text not null default '',
  result        text not null default '',
  proof_id      uuid references public.proofs (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, question_key)
);
create index if not exists interview_answers_user on public.interview_answers (user_id);

alter table public.interview_answers enable row level security;
drop policy if exists "own answers" on public.interview_answers;
create policy "own answers" on public.interview_answers
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

alter table public.interview_answers drop constraint if exists interview_answers_shape;
alter table public.interview_answers add constraint interview_answers_shape check (
  question_key ~ '^[a-z0-9._-]{1,64}$' and length(question_text) <= 300
  and length(situation) <= 1500 and length(task) <= 1500 and length(action) <= 2000 and length(result) <= 1500
);
revoke update on public.interview_answers from authenticated, anon;
grant update (question_text, situation, task, action, result, proof_id) on public.interview_answers to authenticated;

drop trigger if exists interview_answers_touch on public.interview_answers;
create trigger interview_answers_touch before update on public.interview_answers
for each row execute function public.touch_updated_at();

-- A linked proof must belong to the same user (defence in depth; the API checks too).
create or replace function public.check_answer_proof() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.proof_id is not null and not exists (
    select 1 from public.proofs p where p.id = new.proof_id and p.user_id = new.user_id
  ) then
    raise exception 'proof not found' using errcode = '23503';
  end if;
  return new;
end $$;
drop trigger if exists interview_answers_proof on public.interview_answers;
create trigger interview_answers_proof before insert or update on public.interview_answers
for each row execute function public.check_answer_proof();

-- At most 100 saved answers per user.
create or replace function public.limit_interview_answers() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.interview_answers where user_id = new.user_id) >= 100 then
    raise exception 'answer limit reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists interview_answers_limit on public.interview_answers;
create trigger interview_answers_limit before insert on public.interview_answers
for each row execute function public.limit_interview_answers();

notify pgrst, 'reload schema';
