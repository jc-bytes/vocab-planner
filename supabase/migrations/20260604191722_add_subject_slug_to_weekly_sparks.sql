alter table public.weekly_sparks
    add column if not exists subject_slug text not null default 'technology';

update public.weekly_sparks
set subject_slug = 'technology'
where subject_slug is null or subject_slug = '';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'weekly_sparks_subject_slug_fkey'
          and conrelid = 'public.weekly_sparks'::regclass
    ) then
        alter table public.weekly_sparks
            add constraint weekly_sparks_subject_slug_fkey
            foreign key (subject_slug)
            references public.subjects(slug)
            on update cascade
            on delete restrict;
    end if;
end $$;

drop index if exists public.weekly_sparks_unique_scheduled_date_idx;

create unique index if not exists weekly_sparks_unique_subject_scheduled_date_idx
    on public.weekly_sparks (subject_slug, scheduled_date)
    where status = 'scheduled';

create index if not exists weekly_sparks_subject_status_schedule_idx
    on public.weekly_sparks (subject_slug, status, scheduled_date desc);
