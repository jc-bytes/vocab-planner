insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'classroom-activity-artifacts',
    'classroom-activity-artifacts',
    false,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

alter table public.classroom_activities
    drop constraint if exists classroom_activities_activity_type_check;

alter table public.classroom_activities
    drop constraint if exists classroom_activities_type_check;

alter table public.classroom_activities
    add constraint classroom_activities_type_check
    check (activity_type in (
        'map-diagram',
        'structured-response',
        'card-sort',
        'spreadsheet-table',
        'image-hotspot',
        'external-artifact'
    ));

alter table public.classroom_activity_assignments
    drop constraint if exists classroom_activity_assignments_activity_type_check;

alter table public.classroom_activity_assignments
    drop constraint if exists classroom_activity_assignments_type_check;

alter table public.classroom_activity_assignments
    add constraint classroom_activity_assignments_type_check
    check (activity_type in (
        'map-diagram',
        'structured-response',
        'card-sort',
        'spreadsheet-table',
        'image-hotspot',
        'external-artifact'
    ));

drop policy if exists "classroom_activity_artifacts_select_own_or_teacher" on storage.objects;
create policy "classroom_activity_artifacts_select_own_or_teacher"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'classroom-activity-artifacts'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or private.is_teacher()
    )
);

drop policy if exists "classroom_activity_artifacts_insert_own" on storage.objects;
create policy "classroom_activity_artifacts_insert_own"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'classroom-activity-artifacts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "classroom_activity_artifacts_update_own" on storage.objects;
create policy "classroom_activity_artifacts_update_own"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'classroom-activity-artifacts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'classroom-activity-artifacts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "classroom_activity_artifacts_delete_own_or_teacher" on storage.objects;
create policy "classroom_activity_artifacts_delete_own_or_teacher"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'classroom-activity-artifacts'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or private.is_teacher()
    )
);
