insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'word-hunt-images',
    'word-hunt-images',
    false,
    65536,
    array['image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 65536,
    allowed_mime_types = array['image/webp'];

drop policy if exists "word_hunt_images_select_own_or_teacher" on storage.objects;
create policy "word_hunt_images_select_own_or_teacher"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'word-hunt-images'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or private.is_teacher()
    )
);

drop policy if exists "word_hunt_images_insert_own" on storage.objects;
create policy "word_hunt_images_insert_own"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'word-hunt-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "word_hunt_images_update_own" on storage.objects;
create policy "word_hunt_images_update_own"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'word-hunt-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'word-hunt-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "word_hunt_images_delete_own_or_teacher" on storage.objects;
create policy "word_hunt_images_delete_own_or_teacher"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'word-hunt-images'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or private.is_teacher()
    )
);
