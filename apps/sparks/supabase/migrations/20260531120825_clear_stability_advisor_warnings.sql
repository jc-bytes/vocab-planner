create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop policy if exists "profiles_update_own_student" on public.profiles;
drop policy if exists "profiles_update_students_by_teacher" on public.profiles;
drop policy if exists "profiles_update_own_teacher" on public.profiles;
drop policy if exists "profiles_update_self_or_teacher_students" on public.profiles;

create policy "profiles_update_self_or_teacher_students"
on public.profiles
for update
to authenticated
using (
    (
        (select auth.uid()) = user_id
        and role = 'student'
        and not private.is_teacher()
    )
    or (
        (select auth.uid()) = user_id
        and role = 'teacher'
        and private.is_teacher()
    )
    or (
        private.is_teacher()
        and role = 'student'
        and user_id <> (select auth.uid())
    )
)
with check (
    (
        (select auth.uid()) = user_id
        and role = 'student'
        and not private.is_teacher()
    )
    or (
        (select auth.uid()) = user_id
        and role = 'teacher'
        and private.is_teacher()
    )
    or (
        private.is_teacher()
        and role = 'student'
        and user_id <> (select auth.uid())
    )
);

drop policy if exists "classroom_activity_submissions_update_owner"
on public.classroom_activity_submissions;

drop policy if exists "classroom_activity_submissions_update_teachers_late_fields"
on public.classroom_activity_submissions;

drop policy if exists "classroom_activity_submissions_update_owner_or_teacher"
on public.classroom_activity_submissions;

create policy "classroom_activity_submissions_update_owner_or_teacher"
on public.classroom_activity_submissions
for update
to authenticated
using (
    student_id = (select auth.uid())
    or private.is_teacher()
)
with check (
    (
        student_id = (select auth.uid())
        and private.classroom_activity_assignment_matches_student(assignment_id)
    )
    or private.is_teacher()
);
