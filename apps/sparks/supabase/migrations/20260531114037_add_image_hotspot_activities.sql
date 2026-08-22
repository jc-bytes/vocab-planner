insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'classroom-activity-images',
    'classroom-activity-images',
    false,
    1048576,
    array['image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 1048576,
    allowed_mime_types = array['image/webp'];

alter table public.classroom_activity_assignments
    drop constraint if exists classroom_activity_assignments_activity_type_check;

alter table public.classroom_activity_assignments
    add constraint classroom_activity_assignments_activity_type_check
    check (activity_type in ('map-diagram', 'structured-response', 'card-sort', 'spreadsheet-table', 'image-hotspot'));

alter table public.classroom_activity_assignments
    drop constraint if exists classroom_activity_assignments_type_check;

alter table public.classroom_activity_assignments
    add constraint classroom_activity_assignments_type_check
    check (activity_type in ('map-diagram', 'structured-response', 'card-sort', 'spreadsheet-table', 'image-hotspot'));

drop policy if exists "classroom_activity_images_select_authenticated" on storage.objects;
create policy "classroom_activity_images_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'classroom-activity-images');

drop policy if exists "classroom_activity_images_insert_teachers" on storage.objects;
create policy "classroom_activity_images_insert_teachers"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'classroom-activity-images'
    and private.is_teacher()
);

drop policy if exists "classroom_activity_images_update_teachers" on storage.objects;
create policy "classroom_activity_images_update_teachers"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'classroom-activity-images'
    and private.is_teacher()
)
with check (
    bucket_id = 'classroom-activity-images'
    and private.is_teacher()
);

drop policy if exists "classroom_activity_images_delete_teachers" on storage.objects;
create policy "classroom_activity_images_delete_teachers"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'classroom-activity-images'
    and private.is_teacher()
);
