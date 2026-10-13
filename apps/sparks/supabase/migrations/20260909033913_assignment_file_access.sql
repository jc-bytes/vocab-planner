begin;
-- Only the current assignment file layout is writable: assignment/student/filename.webp.
create function private.can_access_assignment_file(p_name text,p_write boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare parts text[]:=string_to_array(p_name,'/'); assignment_key uuid; student_key uuid; a public.class_assignments;
begin
 if cardinality(parts)<>3 or parts[1] !~ '^[0-9a-f-]{36}$' or parts[2] !~ '^[0-9a-f-]{36}$'
   or parts[3] !~ '^[a-z0-9_-]+\.webp$' then return false; end if;
 begin assignment_key:=parts[1]::uuid; student_key:=parts[2]::uuid;
 exception when invalid_text_representation then return false; end;
 select * into a from public.class_assignments where id=assignment_key and kind='vocabulary';
 if a.id is null then return false; end if;
 if not p_write and a.owner_id=auth.uid() and private.is_teacher() then return true; end if;
 if student_key is distinct from auth.uid() or not private.can_read_class_assignment(a.id) then return false; end if;
 if p_write then perform private.assert_assignment_work_access('assignment:' || a.id::text); end if;
 return true;
end;
$$;
revoke all on function private.can_access_assignment_file(text,boolean) from public,anon;
grant execute on function private.can_access_assignment_file(text,boolean) to authenticated;
do $$ declare r record; begin
 for r in select * from pg_policies where schemaname='storage' and tablename='objects'
 and (policyname like 'word_hunt_images_%' or policyname like 'classroom_activity_%') loop
 execute format('drop policy %I on storage.objects',r.policyname); end loop;
end $$;
update storage.buckets set public=false where id in ('word-hunt-images','classroom-activity-artifacts','classroom-activity-scenes','classroom-activity-images');
create policy assignment_images_read on storage.objects for select to authenticated
 using(bucket_id='word-hunt-images' and private.can_access_assignment_file(name,false));
create policy assignment_images_insert on storage.objects for insert to authenticated
 with check(bucket_id='word-hunt-images' and private.can_access_assignment_file(name,true));
create policy assignment_images_update on storage.objects for update to authenticated
 using(bucket_id='word-hunt-images' and private.can_access_assignment_file(name,true))
 with check(bucket_id='word-hunt-images' and private.can_access_assignment_file(name,true));
create policy assignment_images_delete on storage.objects for delete to authenticated
 using(bucket_id='word-hunt-images' and private.can_access_assignment_file(name,true));
notify pgrst,'reload schema';
commit;
