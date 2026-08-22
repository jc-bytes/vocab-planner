insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'classroom-activity-scenes',
    'classroom-activity-scenes',
    false,
    1048576,
    array['application/json']
)
on conflict (id) do update
set public = false,
    file_size_limit = 1048576,
    allowed_mime_types = array['application/json'];

alter table public.classroom_activity_submissions
    add column if not exists response_data_storage_path text,
    add column if not exists response_data_storage_size_bytes integer,
    add column if not exists response_data_storage_updated_at timestamptz;

alter table public.classroom_activity_submissions
    drop constraint if exists classroom_activity_submissions_storage_size_check;

alter table public.classroom_activity_submissions
    add constraint classroom_activity_submissions_storage_size_check
    check (
        response_data_storage_size_bytes is null
        or (
            response_data_storage_size_bytes >= 0
            and response_data_storage_size_bytes <= 1048576
        )
    );

create index if not exists classroom_activity_submissions_storage_path_idx
    on public.classroom_activity_submissions(response_data_storage_path)
    where response_data_storage_path is not null;

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
            or new.response_data_storage_path is distinct from old.response_data_storage_path
            or new.response_data_storage_size_bytes is distinct from old.response_data_storage_size_bytes
            or new.response_data_storage_updated_at is distinct from old.response_data_storage_updated_at
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

drop policy if exists "classroom_activity_scenes_select_own_or_teacher" on storage.objects;
create policy "classroom_activity_scenes_select_own_or_teacher"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'classroom-activity-scenes'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or private.is_teacher()
    )
);

drop policy if exists "classroom_activity_scenes_insert_own" on storage.objects;
create policy "classroom_activity_scenes_insert_own"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'classroom-activity-scenes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "classroom_activity_scenes_update_own" on storage.objects;
create policy "classroom_activity_scenes_update_own"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'classroom-activity-scenes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'classroom-activity-scenes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "classroom_activity_scenes_delete_own_or_teacher" on storage.objects;
create policy "classroom_activity_scenes_delete_own_or_teacher"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'classroom-activity-scenes'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or private.is_teacher()
    )
);
