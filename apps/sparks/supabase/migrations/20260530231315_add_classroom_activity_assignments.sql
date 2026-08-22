create or replace function private.user_section_letter(check_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
    select section_letter
    from public.profiles
    where user_id = check_user_id
    limit 1;
$$;

grant execute on function private.user_section_letter(uuid) to authenticated;

create table if not exists public.classroom_activity_assignments (
    id text primary key,
    source_activity_id text,
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
    target_grades text[] not null default '{}',
    target_sections text[] not null default '{}',
    due_date date,
    status text not null default 'active',
    assigned_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint classroom_activity_assignments_type_check check (activity_type in ('map-diagram')),
    constraint classroom_activity_assignments_assessment_purpose_check check (assessment_purpose in ('formative', 'formal')),
    constraint classroom_activity_assignments_status_check check (status in ('active', 'archived')),
    constraint classroom_activity_assignments_targets_check check (cardinality(target_grades) > 0),
    constraint classroom_activity_assignments_subject_slug_fkey foreign key (subject_slug)
        references public.subjects(slug)
        on update cascade
        on delete restrict
);

create table if not exists public.classroom_activity_submissions (
    id text primary key,
    assignment_id text not null references public.classroom_activity_assignments(id) on delete cascade,
    student_id uuid not null references auth.users(id) on delete cascade,
    student_profile jsonb not null default '{}'::jsonb,
    status text not null default 'draft',
    response_data jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default now(),
    submitted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint classroom_activity_submissions_status_check check (status in ('draft', 'submitted')),
    constraint classroom_activity_submissions_student_unique unique (assignment_id, student_id)
);

create or replace function private.classroom_activity_assignment_matches_student(
    check_assignment_id text,
    check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
    select exists (
        select 1
        from public.classroom_activity_assignments assignment
        join public.profiles profile
          on profile.user_id = check_user_id
        where assignment.id = check_assignment_id
          and assignment.status = 'active'
          and profile.role = 'student'
          and profile.grade_level::text = any(assignment.target_grades)
          and (
              cardinality(assignment.target_sections) = 0
              or coalesce(profile.section_letter, '') = any(assignment.target_sections)
          )
    );
$$;

grant execute on function private.classroom_activity_assignment_matches_student(text, uuid) to authenticated;

drop trigger if exists set_classroom_activity_assignments_updated_at on public.classroom_activity_assignments;
create trigger set_classroom_activity_assignments_updated_at
before update on public.classroom_activity_assignments
for each row execute function public.set_updated_at();

drop trigger if exists set_classroom_activity_submissions_updated_at on public.classroom_activity_submissions;
create trigger set_classroom_activity_submissions_updated_at
before update on public.classroom_activity_submissions
for each row execute function public.set_updated_at();

create index if not exists classroom_activity_assignments_status_idx
    on public.classroom_activity_assignments(status);

create index if not exists classroom_activity_assignments_subject_idx
    on public.classroom_activity_assignments(subject_slug);

create index if not exists classroom_activity_assignments_target_grades_idx
    on public.classroom_activity_assignments using gin(target_grades);

create index if not exists classroom_activity_assignments_target_sections_idx
    on public.classroom_activity_assignments using gin(target_sections);

create index if not exists classroom_activity_assignments_due_date_idx
    on public.classroom_activity_assignments(due_date);

create index if not exists classroom_activity_submissions_assignment_idx
    on public.classroom_activity_submissions(assignment_id);

create index if not exists classroom_activity_submissions_student_idx
    on public.classroom_activity_submissions(student_id);

create index if not exists classroom_activity_submissions_status_idx
    on public.classroom_activity_submissions(status);

alter table public.classroom_activity_assignments enable row level security;
alter table public.classroom_activity_submissions enable row level security;

drop policy if exists "classroom_activity_assignments_select_teacher_or_target" on public.classroom_activity_assignments;
create policy "classroom_activity_assignments_select_teacher_or_target"
on public.classroom_activity_assignments
for select
to authenticated
using (
    private.is_teacher()
    or private.classroom_activity_assignment_matches_student(id)
);

drop policy if exists "classroom_activity_assignments_insert_teachers" on public.classroom_activity_assignments;
create policy "classroom_activity_assignments_insert_teachers"
on public.classroom_activity_assignments
for insert
to authenticated
with check (private.is_teacher());

drop policy if exists "classroom_activity_assignments_update_teachers" on public.classroom_activity_assignments;
create policy "classroom_activity_assignments_update_teachers"
on public.classroom_activity_assignments
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());

drop policy if exists "classroom_activity_assignments_delete_teachers" on public.classroom_activity_assignments;
create policy "classroom_activity_assignments_delete_teachers"
on public.classroom_activity_assignments
for delete
to authenticated
using (private.is_teacher());

drop policy if exists "classroom_activity_submissions_select_teacher_or_owner" on public.classroom_activity_submissions;
create policy "classroom_activity_submissions_select_teacher_or_owner"
on public.classroom_activity_submissions
for select
to authenticated
using (
    private.is_teacher()
    or student_id = (select auth.uid())
);

drop policy if exists "classroom_activity_submissions_insert_owner" on public.classroom_activity_submissions;
create policy "classroom_activity_submissions_insert_owner"
on public.classroom_activity_submissions
for insert
to authenticated
with check (
    student_id = (select auth.uid())
    and private.classroom_activity_assignment_matches_student(assignment_id)
);

drop policy if exists "classroom_activity_submissions_update_owner" on public.classroom_activity_submissions;
create policy "classroom_activity_submissions_update_owner"
on public.classroom_activity_submissions
for update
to authenticated
using (
    student_id = (select auth.uid())
)
with check (
    student_id = (select auth.uid())
    and private.classroom_activity_assignment_matches_student(assignment_id)
);

drop policy if exists "classroom_activity_submissions_delete_teachers" on public.classroom_activity_submissions;

grant select, insert, update, delete on public.classroom_activity_assignments to authenticated;
grant select, insert, update on public.classroom_activity_submissions to authenticated;
grant all on public.classroom_activity_assignments to service_role;
grant all on public.classroom_activity_submissions to service_role;
