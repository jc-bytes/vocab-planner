create table if not exists public.weekly_sparks (
    id text primary key,
    spark_type text not null default 'cool_fact',
    title text not null default '',
    spark_text text not null default '',
    why_it_matters text not null default '',
    question text not null default '',
    source_title text not null default '',
    source_url text not null default '',
    subject_slug text not null default 'technology' references public.subjects(slug) on update cascade on delete restrict,
    scheduled_date date,
    status text not null default 'draft',
    owner_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint weekly_sparks_type_check check (spark_type in ('cool_fact', 'trivia', 'good_news', 'reflection', 'debate')),
    constraint weekly_sparks_status_check check (status in ('draft', 'scheduled', 'archived')),
    constraint weekly_sparks_scheduled_date_required check (status <> 'scheduled' or scheduled_date is not null)
);

drop trigger if exists set_weekly_sparks_updated_at on public.weekly_sparks;
create trigger set_weekly_sparks_updated_at
before update on public.weekly_sparks
for each row execute function public.set_updated_at();

create index if not exists weekly_sparks_status_schedule_idx
    on public.weekly_sparks (status, scheduled_date desc);

create unique index if not exists weekly_sparks_unique_subject_scheduled_date_idx
    on public.weekly_sparks (subject_slug, scheduled_date)
    where status = 'scheduled';

alter table public.weekly_sparks enable row level security;

drop policy if exists "weekly_sparks_select_teacher_or_current" on public.weekly_sparks;
create policy "weekly_sparks_select_teacher_or_current"
on public.weekly_sparks
for select
to authenticated
using (
    private.is_teacher()
    or (
        status = 'scheduled'
        and scheduled_date <= ((now() at time zone 'America/Panama')::date)
    )
);

drop policy if exists "weekly_sparks_insert_teachers" on public.weekly_sparks;
create policy "weekly_sparks_insert_teachers"
on public.weekly_sparks
for insert
to authenticated
with check (private.is_teacher());

drop policy if exists "weekly_sparks_update_teachers" on public.weekly_sparks;
create policy "weekly_sparks_update_teachers"
on public.weekly_sparks
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());

drop policy if exists "weekly_sparks_delete_teachers" on public.weekly_sparks;
create policy "weekly_sparks_delete_teachers"
on public.weekly_sparks
for delete
to authenticated
using (private.is_teacher());

grant select, insert, update, delete on public.weekly_sparks to authenticated;
grant all on public.weekly_sparks to service_role;
