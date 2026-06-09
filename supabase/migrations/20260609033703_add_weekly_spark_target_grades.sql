alter table public.weekly_sparks
    add column if not exists target_grades text[] default array['6','7','8','9']::text[];

alter table public.weekly_sparks
    alter column target_grades set default array['6','7','8','9']::text[];

update public.weekly_sparks
set target_grades = array['6','7','8','9']::text[]
where target_grades is null
   or cardinality(target_grades) = 0;

alter table public.weekly_sparks
    alter column target_grades set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'weekly_sparks_target_grades_nonempty_check'
          and conrelid = 'public.weekly_sparks'::regclass
    ) then
        alter table public.weekly_sparks
            add constraint weekly_sparks_target_grades_nonempty_check
            check (cardinality(target_grades) > 0);
    end if;
end
$$;

drop index if exists public.weekly_sparks_unique_scheduled_date_idx;
drop index if exists public.weekly_sparks_unique_subject_scheduled_date_idx;

create index if not exists weekly_sparks_subject_status_schedule_idx
    on public.weekly_sparks (subject_slug, status, scheduled_date desc);

create index if not exists weekly_sparks_target_grades_idx
    on public.weekly_sparks using gin (target_grades);
