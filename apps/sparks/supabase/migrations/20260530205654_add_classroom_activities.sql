create table if not exists public.classroom_activities (
    id text primary key,
    title text not null default '',
    description text not null default '',
    activity_type text not null default 'map-diagram',
    subject_slug text not null default 'technology',
    grades text[] not null default '{}',
    teacher_instructions text not null default '',
    student_instructions text not null default '',
    materials text not null default '',
    estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 300),
    student_output text not null default '',
    makeup_instructions text not null default '',
    assessment_purpose text not null default 'formative',
    activity_data jsonb not null default '{}'::jsonb,
    owner_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint classroom_activities_type_check check (activity_type in ('map-diagram')),
    constraint classroom_activities_assessment_purpose_check check (assessment_purpose in ('formative', 'formal')),
    constraint classroom_activities_subject_slug_fkey foreign key (subject_slug)
        references public.subjects(slug)
        on update cascade
        on delete restrict
);

drop trigger if exists set_classroom_activities_updated_at on public.classroom_activities;
create trigger set_classroom_activities_updated_at
before update on public.classroom_activities
for each row execute function public.set_updated_at();

create index if not exists classroom_activities_subject_grade_idx
    on public.classroom_activities (subject_slug);

create index if not exists classroom_activities_grades_idx
    on public.classroom_activities using gin(grades);

create index if not exists classroom_activities_type_idx
    on public.classroom_activities (activity_type);

alter table public.classroom_activities enable row level security;

drop policy if exists "classroom_activities_select_authenticated" on public.classroom_activities;
create policy "classroom_activities_select_authenticated"
on public.classroom_activities
for select
to authenticated
using (true);

drop policy if exists "classroom_activities_insert_teachers" on public.classroom_activities;
create policy "classroom_activities_insert_teachers"
on public.classroom_activities
for insert
to authenticated
with check (private.is_teacher());

drop policy if exists "classroom_activities_update_teachers" on public.classroom_activities;
create policy "classroom_activities_update_teachers"
on public.classroom_activities
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());

drop policy if exists "classroom_activities_delete_teachers" on public.classroom_activities;
create policy "classroom_activities_delete_teachers"
on public.classroom_activities
for delete
to authenticated
using (private.is_teacher());

grant select, insert, update, delete on public.classroom_activities to authenticated;
grant all on public.classroom_activities to service_role;
