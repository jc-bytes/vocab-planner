begin;
create function private.assignment_results_v1(p_assignment_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.class_assignments where id=p_assignment_id and owner_id=auth.uid() and private.is_teacher()) then
 raise exception 'Assignment unavailable.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('studentId',p.user_id,'name',trim(concat_ws(' ',p.first_name,p.last_name)),
 'activity',r.activity_type,'score',r.score,'complete',r.is_complete,'accuracy',r.accuracy,'updatedAt',r.updated_at)
 order by p.last_name,p.first_name,r.activity_type),'[]'::jsonb) into result
 from public.student_activity_progress r join public.profiles p on p.user_id=r.user_id where r.assignment_id=p_assignment_id;
 return result;
end;
$$;
create function private.list_class_invitations_v1(p_class_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.owns_teaching_class(p_class_id) then raise exception 'Class unavailable.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'expiresAt',expires_at,
 'acceptedAt',accepted_at,'revokedAt',revoked_at) order by email),'[]'::jsonb) into result
 from private.class_invitations where class_id=p_class_id;
 return result;
end;
$$;
create function private.revoke_class_invitation_v1(p_invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare class_key uuid;
begin
 select class_id into class_key from private.class_invitations where id=p_invitation_id;
 perform 1 from public.teaching_classes where id=class_key and owner_id=auth.uid() and private.is_teacher() for update;
 if not found then raise exception 'Invitation unavailable.' using errcode='42501'; end if;
 update private.class_invitations set revoked_at=now() where id=p_invitation_id and accepted_at is null;
end;
$$;
create function private.invite_class_students_v1(p_class_id uuid,p_emails text[]) returns integer language plpgsql security definer set search_path='' as $$
declare email text; total integer:=0;
begin
 if coalesce(cardinality(p_emails),0) not between 1 and 300 then raise exception 'Enter between 1 and 300 student emails.'; end if;
 foreach email in array p_emails loop perform private.invite_class_student_v1(p_class_id,email); total:=total+1; end loop;
 return total;
end;
$$;
create function public.assignment_results_v1(p_assignment_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.assignment_results_v1(p_assignment_id);$$;
create function public.list_class_invitations_v1(p_class_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.list_class_invitations_v1(p_class_id);$$;
create function public.revoke_class_invitation_v1(p_invitation_id uuid) returns void language sql security invoker set search_path='' as $$select private.revoke_class_invitation_v1(p_invitation_id);$$;
create function public.invite_class_students_v1(p_class_id uuid,p_emails text[]) returns integer language sql security invoker set search_path='' as $$select private.invite_class_students_v1(p_class_id,p_emails);$$;
do $$ declare sig text; schema_name text; begin
 foreach sig in array array['assignment_results_v1(uuid)','list_class_invitations_v1(uuid)','revoke_class_invitation_v1(uuid)','invite_class_students_v1(uuid,text[])'] loop
 foreach schema_name in array array['public','private'] loop
 execute format('revoke all on function %s.%s from public,anon',schema_name,sig);
 execute format('grant execute on function %s.%s to authenticated',schema_name,sig);
 end loop; end loop;
end $$;
-- Avoid re-reading the caller's token for every allowlist row.
drop policy allowlist_read_self on public.teacher_allowlist;
create policy allowlist_read_self on public.teacher_allowlist for select to authenticated using(lower(email::text)=(select lower(auth.jwt()->>'email')));
notify pgrst,'reload schema';
commit;
