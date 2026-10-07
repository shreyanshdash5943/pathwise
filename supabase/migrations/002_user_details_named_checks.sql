-- Splits user_details' single size check into one named check per field, so a
-- failure says exactly which field is wrong. Same limits as before. Safe to re-run.

alter table public.user_details drop constraint if exists user_details_sizes;

alter table public.user_details drop constraint if exists ud_headline_len;
alter table public.user_details add constraint ud_headline_len check (length(headline) <= 120);

alter table public.user_details drop constraint if exists ud_links_len;
alter table public.user_details add constraint ud_links_len check (length(links::text) <= 1200);

alter table public.user_details drop constraint if exists ud_skills_len;
alter table public.user_details add constraint ud_skills_len check (
  cardinality(skills) <= 30 and length(array_to_string(skills, ',')) <= 1300
);

alter table public.user_details drop constraint if exists ud_known_skills_len;
alter table public.user_details add constraint ud_known_skills_len check (
  cardinality(known_skills) <= 12 and length(array_to_string(known_skills, ',')) <= 600
);

alter table public.user_details drop constraint if exists ud_resume_skills_len;
alter table public.user_details add constraint ud_resume_skills_len check (
  cardinality(resume_skills) <= 12 and length(array_to_string(resume_skills, ',')) <= 600
);

alter table public.user_details drop constraint if exists ud_resume_name_len;
alter table public.user_details add constraint ud_resume_name_len check (resume_name is null or length(resume_name) <= 200);

alter table public.user_details drop constraint if exists ud_resume_size_range;
alter table public.user_details add constraint ud_resume_size_range check (resume_size is null or resume_size between 1 and 5242880);

alter table public.user_details drop constraint if exists ud_resume_hash_format;
alter table public.user_details add constraint ud_resume_hash_format check (resume_hash is null or resume_hash ~ '^[0-9a-f]{64}$');

alter table public.user_details drop constraint if exists ud_resume_ai_hash_format;
alter table public.user_details add constraint ud_resume_ai_hash_format check (resume_ai_hash is null or resume_ai_hash ~ '^[0-9a-f]{64}$');

notify pgrst, 'reload schema';
