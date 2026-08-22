alter table public.classroom_activity_assignments
    add column if not exists available_from date,
    add column if not exists week_label text not null default '';

alter table public.classroom_activity_submissions
    add column if not exists late_override boolean not null default false,
    add column if not exists late_override_reason text not null default '',
    add column if not exists late_override_by uuid references auth.users(id) on delete set null,
    add column if not exists late_override_at timestamptz;

create index if not exists classroom_activity_assignments_available_from_idx
    on public.classroom_activity_assignments(available_from);

create index if not exists classroom_activity_assignments_week_label_idx
    on public.classroom_activity_assignments(week_label);

create index if not exists classroom_activity_submissions_late_override_idx
    on public.classroom_activity_submissions(late_override);

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
          and (
              assignment.available_from is null
              or assignment.available_from <= current_date
          )
          and profile.role = 'student'
          and profile.grade_level::text = any(assignment.target_grades)
          and (
              cardinality(assignment.target_sections) = 0
              or coalesce(profile.section_letter, '') = any(assignment.target_sections)
          )
    );
$$;

grant execute on function private.classroom_activity_assignment_matches_student(text, uuid) to authenticated;

create or replace function private.enforce_classroom_activity_submission_late_fields()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    if tg_op = 'INSERT' and not private.is_teacher() then
        if coalesce(new.late_override, false)
            or coalesce(new.late_override_reason, '') <> ''
            or new.late_override_by is not null
            or new.late_override_at is not null then
            raise exception 'Students cannot set late override fields';
        end if;
        return new;
    end if;

    if tg_op <> 'UPDATE' then
        return new;
    end if;

    if (select auth.uid()) = old.student_id and not private.is_teacher() then
        if new.late_override is distinct from old.late_override
            or new.late_override_reason is distinct from old.late_override_reason
            or new.late_override_by is distinct from old.late_override_by
            or new.late_override_at is distinct from old.late_override_at then
            raise exception 'Students cannot update late override fields';
        end if;
        return new;
    end if;

    if private.is_teacher() and (select auth.uid()) is distinct from old.student_id then
        if new.assignment_id is distinct from old.assignment_id
            or new.student_id is distinct from old.student_id
            or new.student_profile is distinct from old.student_profile
            or new.status is distinct from old.status
            or new.response_data is distinct from old.response_data
            or new.started_at is distinct from old.started_at
            or new.submitted_at is distinct from old.submitted_at
            or new.created_at is distinct from old.created_at then
            raise exception 'Teachers may only update late override fields on classroom activity submissions';
        end if;

        if new.late_override then
            new.late_override_by := coalesce(new.late_override_by, (select auth.uid()));
            new.late_override_at := coalesce(new.late_override_at, now());
            new.late_override_reason := coalesce(nullif(trim(new.late_override_reason), ''), 'Excused by teacher');
        else
            new.late_override_by := null;
            new.late_override_at := null;
            new.late_override_reason := '';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists enforce_classroom_activity_submission_late_fields
on public.classroom_activity_submissions;

create trigger enforce_classroom_activity_submission_late_fields
before insert or update on public.classroom_activity_submissions
for each row execute function private.enforce_classroom_activity_submission_late_fields();

drop policy if exists "classroom_activity_submissions_update_teachers_late_fields"
on public.classroom_activity_submissions;

create policy "classroom_activity_submissions_update_teachers_late_fields"
on public.classroom_activity_submissions
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());
