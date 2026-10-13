-- School conversion is additive. Legacy rows remain quarantined until explicitly mapped.
begin;
alter table public.teacher_subjects add column school_id uuid references public.schools(id);
create index on public.teacher_subjects(school_id);
alter table public.teacher_subjects add unique(id,school_id);
alter table public.teaching_classes add column school_id uuid references public.schools(id);
create index on public.teaching_classes(school_id);
alter table public.teaching_classes add unique(id,school_id);
alter table public.vocabularies add column school_id uuid references public.schools(id);
create index on public.vocabularies(school_id);
alter table public.vocabularies add unique(id,school_id);
alter table public.weekly_sparks add column school_id uuid references public.schools(id);
create index on public.weekly_sparks(school_id);
alter table public.weekly_sparks add unique(id,school_id);
alter table private.class_material_versions add column school_id uuid references public.schools(id);
create index on private.class_material_versions(school_id);
alter table private.class_material_versions add unique(id,school_id);
alter table public.class_assignments add column school_id uuid references public.schools(id);
create index on public.class_assignments(school_id);
alter table public.class_assignments add unique(id,school_id);
do $$ declare r record; begin
 for r in select conrelid::regclass as tbl,conname from pg_constraint
 where contype='f' and conrelid in ('public.teaching_classes'::regclass,'public.class_assignments'::regclass,'public.vocabularies'::regclass,'public.weekly_sparks'::regclass)
 and pg_get_constraintdef(oid) like '%owner_id)%' and array_length(conkey,1)>1
 loop execute format('alter table %s drop constraint %I',r.tbl,r.conname); end loop;
end $$;
alter table public.teaching_classes add foreign key(subject_id,school_id) references public.teacher_subjects(id,school_id);
alter table public.vocabularies add foreign key(teacher_subject_id,school_id) references public.teacher_subjects(id,school_id);
alter table public.weekly_sparks add foreign key(teacher_subject_id,school_id) references public.teacher_subjects(id,school_id);
alter table private.class_material_versions add foreign key(vocabulary_id,school_id) references public.vocabularies(id,school_id);
alter table private.class_material_versions add foreign key(spark_id,school_id) references public.weekly_sparks(id,school_id);
alter table public.class_assignments add foreign key(class_id,school_id) references public.teaching_classes(id,school_id);
alter table public.class_assignments add foreign key(version_id,school_id) references private.class_material_versions(id,school_id);
create table public.school_academic_years (
 school_id uuid not null references public.schools(id), year integer not null check(year between 2020 and 2200),
 label text not null check(length(trim(label)) between 1 and 100), archived boolean not null default false,
 primary key(school_id,year)
);
alter table public.school_academic_years enable row level security;
revoke all on public.school_academic_years from public,anon,authenticated;
grant select on public.school_academic_years to authenticated;
create policy school_years_read on public.school_academic_years for select to authenticated using(private.is_school_member(school_id));
alter table public.teaching_classes add foreign key(school_id,school_year) references public.school_academic_years(school_id,year);
create function private.list_school_years_v1(p_school_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_school_member(p_school_id) then raise exception 'School unavailable.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(y) order by y.year desc),'[]'::jsonb) from public.school_academic_years y where y.school_id=p_school_id);
end;
$$;
create function public.list_school_years_v1(p_school_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.list_school_years_v1(p_school_id);$$;
create function private.set_school_year_v1(p_school_id uuid,p_year integer,p_label text,p_archived boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.school_academic_years;
begin
 perform 1 from public.schools where id=p_school_id for update;
 if not private.has_school_role(p_school_id,'school_admin') then raise exception 'School administrator required.' using errcode='42501'; end if;
 insert into public.school_academic_years(school_id,year,label,archived) values(p_school_id,p_year,trim(p_label),p_archived)
 on conflict(school_id,year) do update set label=excluded.label,archived=excluded.archived returning * into result;
 insert into private.school_admin_events(school_id,actor_id,action,details) values(p_school_id,auth.uid(),'year.changed',to_jsonb(result)-'school_id');
 return to_jsonb(result);
end;
$$;
create function public.set_school_year_v1(p_school_id uuid,p_year integer,p_label text,p_archived boolean default false) returns jsonb language sql security invoker set search_path='' as $$select private.set_school_year_v1(p_school_id,p_year,p_label,p_archived);$$;
revoke all on function private.list_school_years_v1(uuid),public.list_school_years_v1(uuid),private.set_school_year_v1(uuid,integer,text,boolean),public.set_school_year_v1(uuid,integer,text,boolean) from public,anon;
grant execute on function private.list_school_years_v1(uuid),public.list_school_years_v1(uuid),private.set_school_year_v1(uuid,integer,text,boolean),public.set_school_year_v1(uuid,integer,text,boolean) to authenticated;

create table public.class_teachers (
 class_id uuid not null, school_id uuid not null, teacher_id uuid not null,
 active boolean not null default true, assigned_at timestamptz not null default now(),
 assigned_by uuid references public.profiles(user_id), removed_at timestamptz,
 primary key(class_id,teacher_id),
 foreign key(class_id,school_id) references public.teaching_classes(id,school_id),
 foreign key(school_id,teacher_id) references public.school_memberships(school_id,user_id),
 check(active=(removed_at is null))
);
create index on public.class_teachers(school_id,teacher_id,active);
alter table public.class_teachers enable row level security;
revoke all on public.class_teachers from public,anon,authenticated;
grant select on public.class_teachers to authenticated;

create function private.can_teach_class(p_class_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_teachers t where t.class_id=p_class_id and t.teacher_id=auth.uid() and t.active
 and private.has_school_role(t.school_id,'teacher'));
$$;
-- Compatibility name means educational-record access, not creator ownership.
create or replace function private.owns_teaching_class(p_class_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.teaching_classes c where c.id=p_class_id and
 (private.has_school_role(c.school_id,'school_admin') or private.can_teach_class(c.id)));
$$;
create or replace function private.is_class_member(p_class_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_memberships m join public.teaching_classes c on c.id=m.class_id
 where m.class_id=p_class_id and m.student_id=auth.uid() and m.active and private.has_school_role(c.school_id,'student'));
$$;
create or replace function private.can_read_class_assignment(p_assignment_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_assignments a where a.id=p_assignment_id and
 (private.owns_teaching_class(a.class_id) or (not a.withdrawn and a.release_at<=now() and private.is_class_member(a.class_id))));
$$;
create or replace function private.can_read_student_assignment(p_assignment_id uuid,p_student_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_assignments a where a.id=p_assignment_id and
 (private.owns_teaching_class(a.class_id) or (p_student_id=auth.uid() and private.can_read_class_assignment(a.id))));
$$;
create or replace function private.owns_student_membership(p_student_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_memberships m where m.student_id=p_student_id and private.owns_teaching_class(m.class_id));
$$;
create function private.can_edit_school_library(p_school_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_school_role(p_school_id,'teacher') or private.has_school_role(p_school_id,'school_admin');
$$;
revoke all on function private.can_teach_class(uuid),private.can_edit_school_library(uuid) from public,anon;
grant execute on function private.can_teach_class(uuid),private.can_edit_school_library(uuid) to authenticated;

-- Replace every permissive policy on converted tables, so old owner access cannot survive.
do $$ declare r record; begin for r in select * from pg_policies where schemaname='public' and tablename in
 ('teacher_subjects','teaching_classes','class_memberships','vocabularies','weekly_sparks','class_assignment_responses')
 loop execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop; end $$;
create policy subjects_school_read on public.teacher_subjects for select to authenticated using(private.can_edit_school_library(school_id));
create policy subjects_school_insert on public.teacher_subjects for insert to authenticated with check(owner_id=auth.uid() and private.can_edit_school_library(school_id));
create policy subjects_school_update on public.teacher_subjects for update to authenticated using(private.can_edit_school_library(school_id)) with check(private.can_edit_school_library(school_id));
create policy classes_school_read on public.teaching_classes for select to authenticated using(private.owns_teaching_class(id));
create policy classes_school_insert on public.teaching_classes for insert to authenticated with check(owner_id=auth.uid() and private.can_edit_school_library(school_id));
create policy classes_school_update on public.teaching_classes for update to authenticated using(private.owns_teaching_class(id)) with check(private.owns_teaching_class(id));
create policy class_members_school_read on public.class_memberships for select to authenticated using(private.owns_teaching_class(class_id) or (student_id=auth.uid() and private.is_class_member(class_id)));
create policy class_teachers_school_read on public.class_teachers for select to authenticated using(private.owns_teaching_class(class_id));
create policy vocabularies_school on public.vocabularies to authenticated using(private.can_edit_school_library(school_id)) with check(private.can_edit_school_library(school_id));
create policy sparks_school on public.weekly_sparks to authenticated using(private.can_edit_school_library(school_id)) with check(private.can_edit_school_library(school_id));
create policy responses_school_read on public.class_assignment_responses for select to authenticated using(private.can_read_student_assignment(assignment_id,student_id));
-- Legacy classroom activity content has no migration mapping and remains inaccessible.
drop policy if exists classroom_activities_owned on public.classroom_activities;
-- This quarantined legacy table has no school_id; it must not run the converted
-- library trigger. RLS has no client policies; trusted maintenance retains access.
drop trigger prepare_owned_material on public.classroom_activities;

create or replace function private.prepare_owned_material() returns trigger language plpgsql security definer set search_path='' as $$
declare original_owner uuid;
begin
 if auth.uid() is not null then
  if not private.can_edit_school_library(new.school_id) then raise exception 'School library unavailable.' using errcode='42501'; end if;
  if tg_op='INSERT' then
   execute format('select owner_id from %I.%I where id=$1 and school_id=$2',tg_table_schema,tg_table_name) into original_owner using new.id,new.school_id;
   new.owner_id:=coalesce(original_owner,auth.uid());
  elsif new.owner_id is distinct from old.owner_id or new.school_id is distinct from old.school_id then
   raise exception 'School and authorship cannot be changed.' using errcode='42501';
  end if;
 end if;
 if new.school_id is not null and (new.teacher_subject_id is null or not exists(select 1 from public.teacher_subjects where id=new.teacher_subject_id and school_id=new.school_id and not archived)) then
  raise exception 'Choose an active subject in this school.' using errcode='42501';
 end if;
 return new;
end;
$$;
create function private.prepare_school_class() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then
  if tg_op='INSERT' and (new.owner_id is distinct from auth.uid() or not private.can_edit_school_library(new.school_id)) then
   raise exception 'School unavailable.' using errcode='42501';
  elsif tg_op='UPDATE' then
   if new.owner_id is distinct from old.owner_id or new.school_id is distinct from old.school_id then raise exception 'School and creator cannot change.'; end if;
   if new.archived is distinct from old.archived and not private.has_school_role(new.school_id,'school_admin') then raise exception 'School administrator required.' using errcode='42501'; end if;
  end if;
 end if;
 if new.school_id is not null and (tg_op='INSERT' or new.subject_id is distinct from old.subject_id or new.school_id is distinct from old.school_id) and not exists(select 1 from public.teacher_subjects where id=new.subject_id and school_id=new.school_id and not archived) then raise exception 'Subject unavailable.'; end if;
 if new.school_id is not null and (tg_op='INSERT' or new.school_year is distinct from old.school_year or new.school_id is distinct from old.school_id) and not exists(select 1 from public.school_academic_years where school_id=new.school_id and year=new.school_year and not archived) then raise exception 'Choose an active academic year in this school.'; end if;
 return new;
end;
$$;
create trigger prepare_school_class before insert or update on public.teaching_classes for each row execute function private.prepare_school_class();
create function private.assign_class_creator() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.has_school_role(new.school_id,'teacher',new.owner_id) then
  insert into public.class_teachers(class_id,school_id,teacher_id,assigned_by) values(new.id,new.school_id,new.owner_id,auth.uid());
 end if;
 return new;
end;
$$;
create trigger assign_class_creator after insert on public.teaching_classes for each row execute function private.assign_class_creator();
create function private.check_class_enrollment() returns trigger language plpgsql security definer set search_path='' as $$
declare school_key uuid;
begin
 select school_id into school_key from public.teaching_classes where id=new.class_id;
 if new.active and school_key is not null and not private.has_school_role(school_key,'student',new.student_id) then raise exception 'Active school student membership required.' using errcode='42501'; end if;
 return new;
end;
$$;
create trigger check_class_enrollment before insert or update on public.class_memberships for each row execute function private.check_class_enrollment();
revoke all on function private.prepare_school_class(),private.assign_class_creator(),private.check_class_enrollment() from public,anon,authenticated;

create function private.set_class_teacher_v1(p_class_id uuid,p_teacher_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare school_key uuid;
begin
 select school_id into school_key from public.teaching_classes where id=p_class_id;
 perform 1 from public.schools where id=school_key for update;
 if not private.has_school_role(school_key,'school_admin') then raise exception 'School administrator required.' using errcode='42501'; end if;
 perform 1 from public.teaching_classes where id=p_class_id for update;
 if p_active and not private.has_school_role(school_key,'teacher',p_teacher_id) then raise exception 'Active school teacher required.' using errcode='42501'; end if;
 insert into public.class_teachers(class_id,school_id,teacher_id,active,assigned_by,removed_at)
 values(p_class_id,school_key,p_teacher_id,p_active,auth.uid(),case when not p_active then now() end)
 on conflict(class_id,teacher_id) do update set active=excluded.active,assigned_at=now(),assigned_by=auth.uid(),removed_at=excluded.removed_at;
end;
$$;
create function public.set_class_teacher_v1(p_class_id uuid,p_teacher_id uuid,p_active boolean) returns void language sql security invoker set search_path='' as $$select private.set_class_teacher_v1(p_class_id,p_teacher_id,p_active);$$;
create function private.get_class_teachers_v1(p_class_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.owns_teaching_class(p_class_id) then raise exception 'Class unavailable.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',t.teacher_id,'display_name',trim(concat_ws(' ',p.first_name,p.last_name)),'active',t.active) order by p.last_name,p.first_name),'[]'::jsonb)
 from public.class_teachers t join public.profiles p on p.user_id=t.teacher_id where t.class_id=p_class_id);
end;
$$;
create function public.get_class_teachers_v1(p_class_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.get_class_teachers_v1(p_class_id);$$;
revoke all on function public.set_class_teacher_v1(uuid,uuid,boolean),private.set_class_teacher_v1(uuid,uuid,boolean),public.get_class_teachers_v1(uuid),private.get_class_teachers_v1(uuid) from public,anon;
grant execute on function public.set_class_teacher_v1(uuid,uuid,boolean),private.set_class_teacher_v1(uuid,uuid,boolean),public.get_class_teachers_v1(uuid),private.get_class_teachers_v1(uuid) to authenticated;

create or replace function private.publish_class_material_v1(p_class_ids uuid[], p_kind text, p_material_id text, p_release_at timestamp with time zone, p_publication_key uuid, p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_close_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    school_key uuid; version_id uuid; content jsonb; answer_key jsonb := '{}'::jsonb;
    material_title text; owned_id text; result jsonb; existing_count integer;
begin

    if p_publication_key is null or p_release_at is null or coalesce(cardinality(p_class_ids),0) not between 1 and 50
       or exists(select 1 from unnest(p_class_ids) id where id is null)
       or cardinality(p_class_ids) <> (select count(distinct id) from unnest(p_class_ids) id) then
        raise exception 'Choose distinct classes, a release date and a publication key.';
    end if;
    if p_kind is null or p_kind not in ('vocabulary','spark') then raise exception 'Unsupported material type.'; end if;
    if p_material_id is null or length(trim(p_material_id)) = 0 then raise exception 'Choose a material.'; end if;
    -- Stable lock serializes retried requests with the same teacher/key.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_publication_key::text, 0));
    -- Match school administration's lock order, including FK locks on new versions.
    -- Authority is checked again only after the school and class locks are held.
    perform 1 from public.schools where id in (select school_id from public.teaching_classes where id=any(p_class_ids)) order by id for share;
    perform 1 from public.teaching_classes where id = any(p_class_ids) order by id for update;
    if (select count(*) from public.teaching_classes where id = any(p_class_ids)
        and private.can_teach_class(id) and not archived) <> cardinality(p_class_ids) then
        raise exception 'One or more classes are unavailable.' using errcode = '42501';
    end if;
    select school_id into school_key from public.teaching_classes where id=p_class_ids[1];
    if exists(select 1 from public.teaching_classes where id=any(p_class_ids) and school_id is distinct from school_key) then raise exception 'All classes must belong to one school.' using errcode='42501'; end if;
    select count(*) into existing_count from public.class_assignments
      where owner_id = auth.uid() and publication_key = p_publication_key;
    if existing_count > 0 then
        if existing_count <> cardinality(p_class_ids) or exists(
            select 1 from public.class_assignments a join private.class_material_versions v on v.id=a.version_id
            where a.owner_id=auth.uid() and a.publication_key=p_publication_key and
             (not(a.class_id=any(p_class_ids)) or a.kind<>p_kind or coalesce(v.vocabulary_id,v.spark_id)<>p_material_id
               or a.release_at<>p_release_at or a.due_at is distinct from p_due_at or a.close_at is distinct from p_close_at)
        ) then raise exception 'Publication key was already used for a different assignment.'; end if;
    else
        if p_kind = 'vocabulary' then
            select v.id, v.name, jsonb_build_object('kind','vocabulary','name',v.name,
                'description',v.description,'words',v.words,'week',v.week,'activitySettings',coalesce(v.activity_settings,'{}'::jsonb) || jsonb_build_object('requiredActivities',private.required_vocabulary_activities(v)))
            into owned_id,material_title,content from public.vocabularies v
            where v.id=p_material_id and v.school_id=school_key for share;
        else
            select s.id,s.title,jsonb_build_object('kind','spark','title',s.title,'sparkText',s.spark_text,
                'whyItMatters',s.why_it_matters,'question',s.question,'gradeQuestions',s.grade_questions,
                'sourceTitle',s.source_title,'sourceUrl',s.source_url,'checkMode',s.check_mode,
                'questions',coalesce((select jsonb_agg(q - 'correctOption') from jsonb_array_elements(s.questions) q),'[]'::jsonb)),
                jsonb_build_object('questions',s.questions)
            into owned_id,material_title,content,answer_key from public.weekly_sparks s
            where s.id=p_material_id and s.school_id=school_key for share;
        end if;
        if owned_id is null then raise exception 'Material unavailable. Only owned materials can be assigned.' using errcode='42501'; end if;
        insert into private.class_material_versions(school_id,owner_id,vocabulary_id,spark_id,student_content,assessment_key)
        values(school_key,auth.uid(),case when p_kind='vocabulary' then owned_id end,case when p_kind='spark' then owned_id end,content,answer_key)
        returning id into version_id;
        insert into public.class_assignments(school_id,owner_id,class_id,version_id,title,kind,release_at,due_at,close_at,publication_key)
        select school_key,auth.uid(),id,version_id,material_title,p_kind,p_release_at,p_due_at,p_close_at,p_publication_key from unnest(p_class_ids) id;
    end if;
    select jsonb_agg(to_jsonb(a) order by a.class_id) into result from public.class_assignments a
      where a.owner_id=auth.uid() and a.publication_key=p_publication_key;
    return result;
end;
$function$;
create or replace function private.withdraw_class_assignment_v1(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
    update public.class_assignments set withdrawn=true where id=p_assignment_id and private.can_teach_class(class_id);
    if not found then raise exception 'Assignment unavailable.' using errcode='42501'; end if;
end;
$$;
create or replace function private.assignment_results_v1(p_assignment_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.class_assignments where id=p_assignment_id and private.owns_teaching_class(class_id)) then
 raise exception 'Assignment unavailable.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('studentId',p.user_id,'name',trim(concat_ws(' ',p.first_name,p.last_name)),
 'activity',r.activity_type,'score',r.score,'complete',r.is_complete,'accuracy',r.accuracy,'updatedAt',r.updated_at)
 order by p.last_name,p.first_name,r.activity_type),'[]'::jsonb) into result
 from public.student_activity_progress r join public.profiles p on p.user_id=r.user_id where r.assignment_id=p_assignment_id;
 return result;
end;
$$;
create or replace function private.revoke_class_invitation_v1(p_invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare class_key uuid;
begin
 select class_id into class_key from private.class_invitations where id=p_invitation_id;
 perform 1 from public.teaching_classes where id=class_key and private.owns_teaching_class(id) for update;
 if not found then raise exception 'Invitation unavailable.' using errcode='42501'; end if;
 update private.class_invitations set revoked_at=now() where id=p_invitation_id and accepted_at is null;
end;
$$;
create or replace function private.can_access_assignment_file(p_name text,p_write boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare parts text[]:=string_to_array(p_name,'/'); assignment_key uuid; student_key uuid; a public.class_assignments;
begin
 if cardinality(parts)<>3 or parts[1] !~ '^[0-9a-f-]{36}$' or parts[2] !~ '^[0-9a-f-]{36}$'
   or parts[3] !~ '^[a-z0-9_-]+\.webp$' then return false; end if;
 begin assignment_key:=parts[1]::uuid; student_key:=parts[2]::uuid;
 exception when invalid_text_representation then return false; end;
 select * into a from public.class_assignments where id=assignment_key and kind='vocabulary';
 if a.id is null then return false; end if;
 if not p_write and private.owns_teaching_class(a.class_id) then return true; end if;
 if student_key is distinct from auth.uid() or not private.can_read_class_assignment(a.id) then return false; end if;
 if p_write then perform private.assert_assignment_work_access('assignment:' || a.id::text); end if;
 return true;
end;
$$;
create or replace function private.set_student_activity_late_override_v1(p_attempt_id uuid, p_excused boolean, p_reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    attempt_row private.student_activity_attempts;
    cleaned_reason text := left(trim(coalesce(p_reason, '')), 500);
begin
    if auth.uid() is null then
        raise exception 'Teacher access is required.' using errcode = '42501';
    end if;
    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id
    for update;
    if not exists(select 1 from public.class_assignments where id=attempt_row.assignment_id and private.can_teach_class(class_id)) then raise exception 'Assignment unavailable.' using errcode='42501'; end if;
    if attempt_row.id is null then raise exception 'Activity attempt not found.'; end if;
    if attempt_row.late_at is null then raise exception 'This activity was not late.'; end if;
    if coalesce(p_excused, false) and cleaned_reason = '' then
        raise exception 'A reason is required to excuse late work.';
    end if;

    update private.student_activity_attempts
    set late_override = coalesce(p_excused, false),
        late_override_reason = case when coalesce(p_excused, false) then cleaned_reason else '' end,
        late_override_by = case when coalesce(p_excused, false) then auth.uid() else null end,
        late_override_at = case when coalesce(p_excused, false) then now() else null end
    where id = p_attempt_id
    returning * into attempt_row;

    return private.student_activity_attempt_json(attempt_row);
end;
$function$;
create or replace function private.my_teaching_classes_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'schoolId',c.school_id, 'name', c.name, 'schoolYear', c.school_year, 'archived', c.archived,
        'subjectId', s.id, 'subjectName', s.name,
        'teacherName', (select string_agg(trim(concat_ws(' ',tp.first_name,tp.last_name)), ', ' order by tp.last_name,tp.first_name) from public.class_teachers ct join public.profiles tp on tp.user_id=ct.teacher_id where ct.class_id=c.id and ct.active and private.has_school_role(c.school_id,'teacher',ct.teacher_id))
    ) order by c.school_year desc, s.name, c.name), '[]'::jsonb)
    from public.class_memberships m
    join public.teaching_classes c on c.id = m.class_id
    join public.teacher_subjects s on s.id = c.subject_id
    join public.profiles p on p.user_id = c.owner_id
    where m.student_id = auth.uid() and private.is_class_member(c.id);
$$;
create or replace function private.my_class_invitations_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'schoolId',c.school_id, 'className', c.name, 'subjectName', s.name, 'schoolYear', c.school_year,
        'teacherName', (select string_agg(trim(concat_ws(' ',tp.first_name,tp.last_name)), ', ' order by tp.last_name,tp.first_name) from public.class_teachers ct join public.profiles tp on tp.user_id=ct.teacher_id where ct.class_id=c.id and ct.active and private.has_school_role(c.school_id,'teacher',ct.teacher_id)), 'expiresAt', i.expires_at
    ) order by i.created_at desc), '[]'::jsonb)
    from private.class_invitations i
    join public.teaching_classes c on c.id = i.class_id and not c.archived
    join public.teacher_subjects s on s.id = c.subject_id
    join public.profiles p on p.user_id = c.owner_id
    join auth.users u on u.id = auth.uid() and u.email_confirmed_at is not null
    join public.profiles me on me.user_id = u.id and private.has_school_role(c.school_id,'student')
    where i.email = u.email::extensions.citext and i.expires_at > now()
      and i.revoked_at is null and i.accepted_at is null;
$$;
create or replace function private.accept_class_invitation_v1(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target private.class_invitations; caller_email text; school_key uuid;
begin
    select u.email into caller_email from auth.users u join public.profiles p on p.user_id = u.id
      where u.id = auth.uid() and u.email_confirmed_at is not null ;
    if caller_email is null then raise exception 'A verified student account is required.' using errcode = '42501'; end if;
    select * into target from private.class_invitations where id = p_invitation_id
        and email = caller_email::extensions.citext;
    if target.id is null or target.revoked_at is not null or target.expires_at <= now() then
        raise exception 'Invitation unavailable.' using errcode = '42501';
    end if;
    select school_id into school_key from public.teaching_classes where id=target.class_id;
    perform 1 from public.schools where id=school_key for update;
    if not private.has_school_role(school_key,'student') then raise exception 'Join this school before accepting its class invitation.' using errcode='42501'; end if;
    perform 1 from public.teaching_classes where id = target.class_id and not archived for update;
    if not found then raise exception 'Class unavailable.' using errcode = '42501'; end if;
    select * into target from private.class_invitations where id = p_invitation_id
        and email = caller_email::extensions.citext for update;
    if target.id is null or target.revoked_at is not null or target.expires_at <= now() then
        raise exception 'Invitation unavailable.' using errcode = '42501';
    end if;
    if target.accepted_at is not null then
        if private.is_class_member(target.class_id) then return target.class_id; end if;
        raise exception 'Invitation unavailable.' using errcode = '42501';
    end if;
    insert into public.class_memberships(class_id, student_id) values(target.class_id, auth.uid())
    on conflict(class_id, student_id) do update set active = true, joined_at = now(), removed_at = null;
    update private.class_invitations set accepted_at = now() where id = target.id;
    return target.class_id;
end;
$$;
create or replace function private.assert_student_activity_access(p_user_id uuid, p_unit_key text, p_vocabulary_id text, p_activity_type text)
 RETURNS vocabularies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    vocabulary_row public.vocabularies;
    student_grade integer;
    assignment_row public.class_assignments;
    version_row private.class_material_versions;
    required_list text[];
    activity_index integer;
    prior_activity text;
    prior_complete boolean;
    prior_verified boolean;
begin


    if p_unit_key like 'assignment:%' then
        if p_user_id is distinct from auth.uid() then raise exception 'Student identity mismatch.'; end if;
        assignment_row := private.assert_assignment_work_access(p_unit_key);
        select * into version_row from private.class_material_versions where id=assignment_row.version_id;
        if assignment_row.kind<>'vocabulary' or version_row.vocabulary_id is distinct from p_vocabulary_id then
            raise exception 'Vocabulary does not belong to this assignment.' using errcode='42501';
        end if;
        vocabulary_row.id := version_row.vocabulary_id;
        vocabulary_row.name := assignment_row.title;
        vocabulary_row.subject_slug := 'assignment';
        vocabulary_row.words := version_row.student_content->'words';
        vocabulary_row.activity_settings := version_row.student_content->'activitySettings';
        vocabulary_row.week := (version_row.student_content->>'week')::integer;
        vocabulary_row.owner_id := assignment_row.owner_id;
    else
        raise exception 'Open this activity from My classes.' using errcode='42501';
    end if;
    if p_activity_type <> all(array[
        'flashcards', 'matching', 'quiz', 'synonym-antonym', 'word-search',
        'crossword', 'hangman', 'scramble', 'wordle', 'speed-match',
        'fill-in-blank', 'illustration'
    ]) then
        raise exception 'Unsupported activity type.';
    end if;

    select grade_level into student_grade from public.profiles where user_id = p_user_id;
    if cardinality(vocabulary_row.grades) > 0
       and not (student_grade::text = any(vocabulary_row.grades)) then
        raise exception 'This vocabulary unit is not assigned to your grade.';
    end if;
    if vocabulary_row.assigned_date is not null and vocabulary_row.assigned_date > current_date then
        raise exception 'This vocabulary unit is not available yet.';
    end if;

    required_list := private.required_vocabulary_activities(vocabulary_row);
    activity_index := array_position(required_list, p_activity_type);

    if activity_index is not null and activity_index > 1 then
        foreach prior_activity in array required_list[1:activity_index - 1] loop
            select is_complete, verified into prior_complete, prior_verified
            from public.student_activity_progress
            where user_id = p_user_id and unit_key = p_unit_key and activity_type = prior_activity;
            if not coalesce(prior_complete, false) or not coalesce(prior_verified, false) then
                raise exception 'Complete the required activity % first.', prior_activity;
            end if;
        end loop;
    elsif activity_index is null then
        foreach prior_activity in array required_list loop
            select is_complete, verified into prior_complete, prior_verified
            from public.student_activity_progress
            where user_id = p_user_id and unit_key = p_unit_key and activity_type = prior_activity;
            if not coalesce(prior_complete, false) or not coalesce(prior_verified, false) then
                raise exception 'Complete all required activities before optional practice.';
            end if;
        end loop;
    end if;
    return vocabulary_row;
end;
$function$;
create or replace function private.assert_assignment_work_access(p_unit_key text)
returns public.class_assignments language plpgsql security definer set search_path='' as $$
declare a public.class_assignments; class_key uuid; assignment_key uuid;
begin
    if p_unit_key !~ '^assignment:[0-9a-f-]{36}$' then raise exception 'Open this work from My classes.' using errcode='42501'; end if;
    assignment_key := substring(p_unit_key from 12)::uuid;
    select class_id into class_key from public.class_assignments where id=assignment_key;
    perform 1 from public.schools where id=(select school_id from public.class_assignments where id=assignment_key) for share;
    perform 1 from public.teaching_classes where id=class_key and not archived for share;
    if not found then raise exception 'Class is unavailable.' using errcode='42501'; end if;
    select * into a from public.class_assignments where id=assignment_key for share;
    if not private.is_class_member(a.class_id) or a.withdrawn or a.release_at>now()
       or (a.close_at is not null and a.close_at<=now()) then
        raise exception 'Assignment is not accepting work.' using errcode='42501';
    end if;
    return a;
end;
$$;
create or replace function private.save_class_response_v1(p_assignment_id uuid,p_response text,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.class_assignments; r public.class_assignment_responses; class_key uuid;
begin
    -- Same lock order as enrollment: class first, then assignment and response.
    select class_id into class_key from public.class_assignments where id=p_assignment_id;
    perform 1 from public.schools where id=(select school_id from public.class_assignments where id=p_assignment_id) for share;
    perform 1 from public.teaching_classes where id=class_key and not archived for share;
    if not found then raise exception 'Assignment unavailable.' using errcode='42501'; end if;
    select * into a from public.class_assignments where id=p_assignment_id for share;
    if not private.is_class_member(a.class_id) or a.withdrawn or a.release_at>now()
       or (a.close_at is not null and a.close_at<=now()) or a.kind<>'spark' then
        raise exception 'Assignment is not accepting responses.' using errcode='42501';
    end if;
    if p_expected_revision is null or p_expected_revision<0 or p_response is null
       or length(trim(p_response)) not between 1 and 10000 then raise exception 'Enter a response and its revision.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_assignment_id::text || auth.uid()::text, 0));
    select * into r from public.class_assignment_responses where assignment_id=p_assignment_id and student_id=auth.uid() for update;
    -- An exact retry succeeds, but an older edit cannot overwrite a newer response.
    if r.revision is not null and r.response=trim(p_response) then return to_jsonb(r); end if;
    if coalesce(r.revision,0)<>p_expected_revision then raise exception 'This response changed. Reopen the assignment before saving.' using errcode='P0001'; end if;
    insert into public.class_assignment_responses(assignment_id,student_id,response)
    values(p_assignment_id,auth.uid(),trim(p_response))
    on conflict(assignment_id,student_id) do update set response=excluded.response,
        revision=class_assignment_responses.revision+1,submitted_at=now()
    returning * into r;
    return to_jsonb(r);
end;
$$;
create or replace function private.check_class_spark_v1(p_assignment_id uuid,p_answers jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.class_assignments; v private.class_material_versions; q jsonb; value jsonb; selected integer;
 normalized jsonb:='{}'::jsonb; checks jsonb:='[]'::jsonb; question_id text; response_text text:=''; answer_text text;
 correct_count integer:=0; auto_count integer:=0; answered_count integer:=0; total integer:=0;
 answered boolean; correct boolean; r public.class_assignment_responses;
begin
 perform private.assert_assignment_work_access('assignment:'||p_assignment_id::text);
 select * into a from public.class_assignments where id=p_assignment_id;
 if a.kind<>'spark' then raise exception 'This assignment is not a Spark.'; end if;
 select * into v from private.class_material_versions where id=a.version_id;
 if v.student_content->>'checkMode'='reading_only' then raise exception 'This Spark is reading only.'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>10000 then
 raise exception 'Enter valid Spark answers.'; end if;
 for q in select item from jsonb_array_elements(v.assessment_key->'questions') as questions(item) loop
   total:=total+1; question_id:=q->>'id'; value:=p_answers->question_id;
   if question_id is null or question_id='' then raise exception 'The published question needs a valid ID.'; end if;
   correct:=false; answered:=false;
   if q->>'type'='multiple_choice' then
     auto_count:=auto_count+1;
     if value is null or jsonb_typeof(value)<>'number' or (value::text)!~'^[0-9]+$' then raise exception 'Choose an answer for each question.'; end if;
     selected:=(value::text)::integer;
     if selected<0 or selected>=jsonb_array_length(q->'options') then raise exception 'Choose an available answer.'; end if;
     answered:=true; correct:=selected=(q->>'correctOption')::integer;
     answer_text:=(selected+1)::text||'. '||(q->'options'->>selected);
   else
     if value is null or jsonb_typeof(value)<>'string' then raise exception 'Write an answer for each question.'; end if;
     answer_text:=trim(value #>> '{}');
     if length(answer_text) not between 12 and 3000 then raise exception 'Written answers must contain between 12 and 3000 characters.'; end if;
     value:=to_jsonb(answer_text); answered:=true;
   end if;
   normalized:=normalized||jsonb_build_object(question_id,value);
   checks:=checks||jsonb_build_array(jsonb_build_object('id',question_id,'answered',answered,
       'correct',case when q->>'type'='multiple_choice' then correct else null end));
   answered_count:=answered_count+case when answered then 1 else 0 end;
   correct_count:=correct_count+case when correct then 1 else 0 end;
   response_text:=response_text||case when total>1 then E'\n\n' else '' end||'['||question_id||'] '||(q->>'prompt')||E'\n'||answer_text;
 end loop;
 if total=0 then raise exception 'This Spark accepts a written response instead.'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>total then raise exception 'Answers do not match the published questions.'; end if;
 perform private.save_class_response_v1(p_assignment_id,response_text,p_expected_revision);
 update public.class_assignment_responses set answers=normalized,
 evaluation=jsonb_build_object('answered',answered_count,'total',total,'correct',correct_count,'automaticTotal',auto_count,
 'needsTeacherReview',auto_count<total,'isComplete',answered_count=total and correct_count=auto_count,'results',checks)
 where assignment_id=p_assignment_id and student_id=auth.uid() returning * into r;
 return to_jsonb(r);
end; $$;
create function private.school_has_student(p_school_id uuid,p_student_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_edit_school_library(p_school_id) and exists(select 1 from public.class_memberships m join public.teaching_classes c on c.id=m.class_id
 where c.school_id=p_school_id and m.student_id=p_student_id and private.owns_teaching_class(c.id));
$$;
create function private.can_read_school_student_assignment(p_school_id uuid,p_assignment_id uuid,p_student_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_assignments a where a.id=p_assignment_id and a.school_id=p_school_id and private.owns_teaching_class(a.class_id));
$$;
revoke all on function private.school_has_student(uuid,uuid),private.can_read_school_student_assignment(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.list_student_progress_summaries_school_v1(p_school_id uuid,p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_grade integer DEFAULT NULL::integer, p_section text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    page_size integer := least(greatest(coalesce(p_limit, 100), 1), 200);
    page_offset integer := greatest(coalesce(p_offset, 0), 0);
    section_filter text := nullif(upper(trim(coalesce(p_section, ''))), '');
    search_filter text := nullif(trim(coalesce(p_search, '')), '');
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can list student progress.';
    end if;
    if p_grade is not null and p_grade not between 6 and 9 then
        raise exception 'Grade must be between 6 and 9.';
    end if;
    if section_filter is not null and section_filter !~ '^[A-Z]$' then
        raise exception 'Section must be one letter.';
    end if;

    with filtered as materialized (
        select
            profile.user_id,
            profile.role,
            profile.first_name,
            profile.last_name,
            profile.email,
            profile.grade_level,
            profile.section_letter,
            profile.must_change_password,
            profile.created_at as profile_created_at,
            profile.updated_at as profile_updated_at,
            summary.total_xp,
            summary.coins,
            summary.coin_data,
            summary.version,
            summary.created_at as progress_created_at,
            summary.updated_at as progress_updated_at
        from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
        left join lateral (
            select coalesce(sum(p.total_earned),0)::bigint as coins, (select coalesce(sum(x.xp_amount),0) from public.student_xp_events x join public.class_assignments a on x.unit_key='assignment:'||a.id::text where x.user_id=profile.user_id and a.school_id=p_school_id and private.owns_teaching_class(a.class_id)) as total_xp,
              '{}'::jsonb as coin_data, 0::bigint as version, min(p.updated_at) as created_at, max(p.updated_at) as updated_at
            from public.student_activity_progress p where p.user_id=profile.user_id
              and private.can_read_school_student_assignment(p_school_id,p.assignment_id,p.user_id)
          ) summary on true
        where private.school_has_student(p_school_id,profile.user_id)
          and (p_grade is null or profile.grade_level = p_grade)
          and (section_filter is null or profile.section_letter = section_filter)
          and (
              search_filter is null
              or concat_ws(' ', profile.first_name, profile.last_name, profile.email::text)
                  ilike '%' || search_filter || '%'
          )
    ), paged as (
        select *
        from filtered
        order by grade_level nulls last,
                 section_letter nulls last,
                 last_name,
                 first_name,
                 user_id
        limit page_size
        offset page_offset
    )
    select jsonb_build_object(
        'items', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', item.user_id,
                'userId', item.user_id,
                'email', item.email,
                'role', item.role,
                'mustChangePassword', item.must_change_password,
                'studentProfile', jsonb_build_object(
                    'firstName', item.first_name,
                    'lastName', item.last_name,
                    'name', trim(concat_ws(' ', item.first_name, item.last_name)),
                    'email', item.email,
                    'grade', coalesce(item.grade_level::text, ''),
                    'group', coalesce(item.section_letter, '')
                ),
                'coins', coalesce(item.coins, 0),
                'coinData', coalesce(
                    item.coin_data,
                    '{"balance":0,"giftCoins":0,"totalEarned":0,"totalSpent":0,"totalGifted":0}'::jsonb
                ),
                'totalXp', coalesce(item.total_xp, 0),
                'version', coalesce(item.version, 0),
                'createdAt', coalesce(item.progress_created_at, item.profile_created_at),
                'updatedAt', greatest(item.progress_updated_at, item.profile_updated_at)
            ) order by item.grade_level nulls last,
                       item.section_letter nulls last,
                       item.last_name,
                       item.first_name,
                       item.user_id)
            from paged item
        ), '[]'::jsonb),
        'total', (select count(*) from filtered),
        'limit', page_size,
        'offset', page_offset
    ) into result_data;

    return result_data;
end;
$function$;
create function public.list_student_progress_summaries_school_v1(p_school_id uuid,p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_grade integer DEFAULT NULL::integer, p_section text DEFAULT NULL::text, p_search text DEFAULT NULL::text) returns jsonb language sql security invoker set search_path='' as $$select private.list_student_progress_summaries_school_v1(p_school_id,p_limit,p_offset,p_grade,p_section,p_search);$$;
revoke all on function public.list_student_progress_summaries_school_v1(uuid,integer,integer,integer,text,text),private.list_student_progress_summaries_school_v1(uuid,integer,integer,integer,text,text) from public,anon;
grant execute on function public.list_student_progress_summaries_school_v1(uuid,integer,integer,integer,text,text),private.list_student_progress_summaries_school_v1(uuid,integer,integer,integer,text,text) to authenticated;
revoke execute on function public.list_student_progress_summaries_v1(integer,integer,integer,text,text) from public,anon,authenticated;
revoke execute on function private.list_student_progress_summaries_v1(integer,integer,integer,text,text) from public,anon,authenticated;
create or replace function private.list_word_hunt_reviews_school_v1(p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can review Word Hunt work.';
    end if;

    with word_hunt_units as (
        select
            unit.user_id,
            unit.unit_key,
            unit.unit_id,
            unit.unit_name,
            unit.subject_slug,
            unit.trimester,
            unit.school_year,
            unit.grade,
            unit.work_data -> 'wordHunt' as word_hunt,
            unit.updated_at,
            activity.score
        from public.student_unit_progress unit
        left join public.student_activity_progress activity
          on activity.user_id = unit.user_id
         and activity.unit_key = unit.unit_key
         and activity.activity_type = 'illustration'
        where private.can_read_school_student_assignment(p_school_id,unit.assignment_id,unit.user_id) and jsonb_typeof(unit.work_data -> 'wordHunt') = 'object'
          and unit.work_data -> 'wordHunt' <> '{}'::jsonb
    ), student_reviews as (
        select
            profile.user_id,
            profile.email,
            profile.first_name,
            profile.last_name,
            profile.grade_level,
            profile.section_letter,
            profile.updated_at as profile_updated_at,
            max(unit.updated_at) as work_updated_at,
            jsonb_object_agg(
                unit.unit_key,
                jsonb_strip_nulls(jsonb_build_object(
                    'unitId', unit.unit_id,
                    'unitName', unit.unit_name,
                    'subjectSlug', unit.subject_slug,
                    'trimester', unit.trimester,
                    'schoolYear', unit.school_year,
                    'grade', unit.grade,
                    'wordHunt', unit.word_hunt,
                    'scores', case when unit.score is null then '{}'::jsonb else jsonb_build_object(
                        'illustration', jsonb_build_object('score', unit.score)
                    ) end,
                    'updatedAt', unit.updated_at
                ))
                order by unit.unit_key
            ) as units
        from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
        join word_hunt_units unit on unit.user_id = profile.user_id
        where private.school_has_student(p_school_id,profile.user_id)
        group by
            profile.user_id,
            profile.email,
            profile.first_name,
            profile.last_name,
            profile.grade_level,
            profile.section_letter,
            profile.updated_at
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', review.user_id,
        'userId', review.user_id,
        'email', review.email,
        'role', 'student',
        'studentProfile', jsonb_build_object(
            'firstName', review.first_name,
            'lastName', review.last_name,
            'name', trim(concat_ws(' ', review.first_name, review.last_name)),
            'email', review.email,
            'grade', coalesce(review.grade_level::text, ''),
            'group', coalesce(review.section_letter, '')
        ),
        'units', review.units,
        'updatedAt', greatest(review.work_updated_at, review.profile_updated_at)
    ) order by
        review.grade_level nulls last,
        review.section_letter nulls last,
        review.last_name,
        review.first_name,
        review.user_id), '[]'::jsonb)
    into result_data
    from student_reviews review;

    return result_data;
end;
$function$;
create function public.list_word_hunt_reviews_school_v1(p_school_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.list_word_hunt_reviews_school_v1(p_school_id);$$;
revoke all on function public.list_word_hunt_reviews_school_v1(uuid),private.list_word_hunt_reviews_school_v1(uuid) from public,anon;
grant execute on function public.list_word_hunt_reviews_school_v1(uuid),private.list_word_hunt_reviews_school_v1(uuid) to authenticated;
revoke execute on function public.list_word_hunt_reviews_v1() from public,anon,authenticated;
revoke execute on function private.list_word_hunt_reviews_v1() from public,anon,authenticated;
create or replace function private.list_student_identity_roster_school_v1(p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can list the student roster.';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'id', profile.user_id,
        'userId', profile.user_id,
        'email', profile.email,
        'role', profile.role,
        'mustChangePassword', profile.must_change_password,
        'studentProfile', jsonb_build_object(
            'firstName', profile.first_name,
            'lastName', profile.last_name,
            'name', trim(concat_ws(' ', profile.first_name, profile.last_name)),
            'email', profile.email,
            'grade', coalesce(profile.grade_level::text, ''),
            'group', coalesce(profile.section_letter, '')
        ),
        'createdAt', profile.created_at,
        'updatedAt', profile.updated_at
    ) order by
        profile.grade_level nulls last,
        profile.section_letter nulls last,
        profile.last_name,
        profile.first_name,
        profile.user_id), '[]'::jsonb)
    into result_data
    from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
    where private.school_has_student(p_school_id,profile.user_id);

    return result_data;
end;
$function$;
create function public.list_student_identity_roster_school_v1(p_school_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.list_student_identity_roster_school_v1(p_school_id);$$;
revoke all on function public.list_student_identity_roster_school_v1(uuid),private.list_student_identity_roster_school_v1(uuid) from public,anon;
grant execute on function public.list_student_identity_roster_school_v1(uuid),private.list_student_identity_roster_school_v1(uuid) to authenticated;
revoke execute on function public.list_student_identity_roster_v1() from public,anon,authenticated;
revoke execute on function private.list_student_identity_roster_v1() from public,anon,authenticated;
create or replace function private.list_student_roster_filters_school_v1(p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can list roster filters.';
    end if;

    select jsonb_build_object(
        'grades', coalesce((
            select jsonb_agg(grades.grade order by grades.grade)
            from (
                select distinct profile.grade_level as grade
                from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
                where private.school_has_student(p_school_id,profile.user_id) and profile.grade_level is not null
            ) grades
        ), '[]'::jsonb),
        'classes', coalesce((
            select jsonb_agg(jsonb_build_object(
                'grade', classes.grade_level::text,
                'section', classes.section_letter
            ) order by classes.grade_level, classes.section_letter)
            from (
                select distinct profile.grade_level, profile.section_letter
                from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
                where private.school_has_student(p_school_id,profile.user_id)
                  and profile.grade_level is not null
                  and profile.section_letter is not null
            ) classes
        ), '[]'::jsonb)
    ) into result_data;

    return result_data;
end;
$function$;
create function public.list_student_roster_filters_school_v1(p_school_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.list_student_roster_filters_school_v1(p_school_id);$$;
revoke all on function public.list_student_roster_filters_school_v1(uuid),private.list_student_roster_filters_school_v1(uuid) from public,anon;
grant execute on function public.list_student_roster_filters_school_v1(uuid),private.list_student_roster_filters_school_v1(uuid) to authenticated;
revoke execute on function public.list_student_roster_filters_v1() from public,anon,authenticated;
revoke execute on function private.list_student_roster_filters_v1() from public,anon,authenticated;
create or replace function private.get_teacher_dashboard_analytics_school_v1(p_school_id uuid,p_grade integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can read dashboard analytics.';
    end if;
    if p_grade is not null and p_grade not between 6 and 9 then
        raise exception 'Grade must be between 6 and 9.';
    end if;

    with filtered_students as materialized (
        select
            profile.user_id,
            profile.first_name,
            profile.last_name,
            profile.email,
            profile.grade_level,
            profile.updated_at as profile_updated_at,
            coalesce(summary.coins, 0) as coins,
            summary.updated_at as progress_updated_at
        from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
        left join lateral (
            select coalesce(sum(p.total_earned),0)::bigint as coins, 0::bigint as total_xp,
              '{}'::jsonb as coin_data, 0::bigint as version, min(p.updated_at) as created_at, max(p.updated_at) as updated_at
            from public.student_activity_progress p where p.user_id=profile.user_id
              and private.can_read_school_student_assignment(p_school_id,p.assignment_id,p.user_id)
          ) summary on true
        where private.school_has_student(p_school_id,profile.user_id)
          and (p_grade is null or profile.grade_level = p_grade)
    ), activities as materialized (
        select
            activity.user_id,
            activity.assignment_id,
            activity.unit_key,
            activity.activity_type,
            activity.score,
            activity.is_complete,
            coalesce(activity.last_played, activity.updated_at) as occurred_at
        from public.student_activity_progress activity
        join filtered_students student on student.user_id = activity.user_id
        and private.can_read_school_student_assignment(p_school_id,activity.assignment_id,activity.user_id)
    ), activity_metrics as (
        select
            activity.activity_type,
            count(*) as attempted,
            count(*) filter (where activity.is_complete or activity.score > 0) as completed
        from activities activity
        group by activity.activity_type
    ), recent as (
        select
            trim(concat_ws(' ', student.first_name, student.last_name)) as student_name,
            activity.unit_key,
            activity.activity_type,
            activity.score,
            activity.is_complete,
            activity.occurred_at
        from activities activity
        join filtered_students student on student.user_id = activity.user_id
        and private.can_read_school_student_assignment(p_school_id,activity.assignment_id,activity.user_id)
        where activity.is_complete or activity.score > 0
        order by activity.occurred_at desc nulls last
        limit 30
    )
    select jsonb_build_object(
        'totalStudents', (select count(*) from filtered_students),
        'activeStudents', (
            select count(*)
            from filtered_students student
            where greatest(
                coalesce(student.progress_updated_at, '-infinity'::timestamptz),
                coalesce(student.profile_updated_at, '-infinity'::timestamptz)
            ) >= now() - interval '7 days'
        ),
        'averageCoins', coalesce((select round(avg(student.coins)) from filtered_students student), 0),
        'availableGrades', coalesce((
            select jsonb_agg(grades.grade order by grades.grade)
            from (
                select distinct profile.grade_level::text as grade
                from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
                where private.school_has_student(p_school_id,profile.user_id) and profile.grade_level is not null
            ) grades
        ), '[]'::jsonb),
        'gradeCounts', coalesce((
            select jsonb_object_agg(counts.grade, counts.student_count order by counts.grade)
            from (
                select coalesce(student.grade_level::text, 'Unknown') as grade,
                       count(*) as student_count
                from filtered_students student
                group by coalesce(student.grade_level::text, 'Unknown')
            ) counts
        ), '{}'::jsonb),
        'coinDistribution', jsonb_build_array(
            (select count(*) from filtered_students where coins between 0 and 100),
            (select count(*) from filtered_students where coins between 101 and 500),
            (select count(*) from filtered_students where coins between 501 and 1000),
            (select count(*) from filtered_students where coins between 1001 and 5000),
            (select count(*) from filtered_students where coins >= 5001)
        ),
        'activities', coalesce((
            select jsonb_object_agg(metric.activity_type, jsonb_build_object(
                'attempted', metric.attempted,
                'completed', metric.completed,
                'completionRate', case when metric.attempted = 0 then 0
                    else round((metric.completed::numeric / metric.attempted) * 100) end
            ))
            from activity_metrics metric
        ), '{}'::jsonb),
        'recentActivities', coalesce((
            select jsonb_agg(jsonb_build_object(
                'student', nullif(recent.student_name, ''),
                'unit', recent.unit_key,
                'activityType', recent.activity_type,
                'score', recent.score,
                'completed', recent.is_complete,
                'occurredAt', recent.occurred_at
            ) order by recent.occurred_at desc nulls last)
            from recent
        ), '[]'::jsonb)
    ) into result_data;

    return result_data;
end;
$function$;
create function public.get_teacher_dashboard_analytics_school_v1(p_school_id uuid,p_grade integer DEFAULT NULL::integer) returns jsonb language sql security invoker set search_path='' as $$select private.get_teacher_dashboard_analytics_school_v1(p_school_id,p_grade);$$;
revoke all on function public.get_teacher_dashboard_analytics_school_v1(uuid,integer),private.get_teacher_dashboard_analytics_school_v1(uuid,integer) from public,anon;
grant execute on function public.get_teacher_dashboard_analytics_school_v1(uuid,integer),private.get_teacher_dashboard_analytics_school_v1(uuid,integer) to authenticated;
revoke execute on function public.get_teacher_dashboard_analytics_v1(integer) from public,anon,authenticated;
revoke execute on function private.get_teacher_dashboard_analytics_v1(integer) from public,anon,authenticated;
create or replace function private.get_student_progress_school_v3(p_school_id uuid,p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    if auth.uid() is null then raise exception 'You must be signed in.'; end if;
    if not private.school_has_student(p_school_id,p_user_id) then
        raise exception 'You are not allowed to read this student progress.';
    end if;
    return private.student_progress_snapshot_school_v2(p_school_id,p_user_id);
end;
$function$;
create function public.get_student_progress_school_v3(p_school_id uuid,p_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_student_progress_school_v3(p_school_id,p_user_id);$$;
revoke all on function public.get_student_progress_school_v3(uuid,uuid),private.get_student_progress_school_v3(uuid,uuid) from public,anon;
grant execute on function public.get_student_progress_school_v3(uuid,uuid),private.get_student_progress_school_v3(uuid,uuid) to authenticated;
create or replace function private.get_students_progress_by_ids_school_v1(p_school_id uuid,p_user_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    requested_ids uuid[] := coalesce(p_user_ids, '{}'::uuid[]);
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can read student progress.';
    end if;
    if cardinality(requested_ids) > 200 then
        raise exception 'A maximum of 200 students can be requested at once.';
    end if;

    select coalesce(jsonb_agg(snapshot.value
        order by profile.grade_level nulls last,
                 profile.section_letter nulls last,
                 profile.last_name,
                 profile.first_name,
                 profile.user_id), '[]'::jsonb)
    into result_data
    from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
    cross join lateral (
        select private.student_progress_snapshot_school_v2(p_school_id,profile.user_id) as value
    ) snapshot
    where private.school_has_student(p_school_id,profile.user_id)
      and profile.user_id = any(requested_ids)
      and snapshot.value is not null;

    return result_data;
end;
$function$;
create function public.get_students_progress_by_ids_school_v1(p_school_id uuid,p_user_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$select private.get_students_progress_by_ids_school_v1(p_school_id,p_user_ids);$$;
revoke all on function public.get_students_progress_by_ids_school_v1(uuid,uuid[]),private.get_students_progress_by_ids_school_v1(uuid,uuid[]) from public,anon;
grant execute on function public.get_students_progress_by_ids_school_v1(uuid,uuid[]),private.get_students_progress_by_ids_school_v1(uuid,uuid[]) to authenticated;
revoke execute on function public.get_students_progress_by_ids_v1(uuid[]) from public,anon,authenticated;
revoke execute on function private.get_students_progress_by_ids_v1(uuid[]) from public,anon,authenticated;
create or replace function private.update_vocabulary_placements_school_v1(p_school_id uuid,p_updates jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    requested_count integer;
    updated_count integer;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can update vocabulary placements.';
    end if;
    if jsonb_typeof(coalesce(p_updates, '[]'::jsonb)) <> 'array' then
        raise exception 'Vocabulary placement updates must be an array.';
    end if;

    requested_count := jsonb_array_length(coalesce(p_updates, '[]'::jsonb));
    if requested_count > 500 then
        raise exception 'A maximum of 500 vocabulary placements can be updated at once.';
    end if;

    update public.vocabularies vocabulary
    set
        assigned_date = nullif(trim(patch.assigned_date), '')::date,
        trimester = coalesce(patch.trimester, ''),
        month = coalesce(patch.month, ''),
        week = patch.week,
        updated_at = coalesce(patch.updated_at, now())
    from jsonb_to_recordset(coalesce(p_updates, '[]'::jsonb)) as patch(
        id text,
        assigned_date text,
        trimester text,
        month text,
        week integer,
        updated_at timestamptz
    )
    where vocabulary.id = patch.id and vocabulary.school_id=p_school_id;

    get diagnostics updated_count = row_count;
    return jsonb_build_object(
        'requested', requested_count,
        'updated', updated_count
    );
end;
$function$;
create function public.update_vocabulary_placements_school_v1(p_school_id uuid,p_updates jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.update_vocabulary_placements_school_v1(p_school_id,p_updates);$$;
revoke all on function public.update_vocabulary_placements_school_v1(uuid,jsonb),private.update_vocabulary_placements_school_v1(uuid,jsonb) from public,anon;
grant execute on function public.update_vocabulary_placements_school_v1(uuid,jsonb),private.update_vocabulary_placements_school_v1(uuid,jsonb) to authenticated;
revoke execute on function public.update_vocabulary_placements_v1(jsonb) from public,anon,authenticated;
revoke execute on function private.update_vocabulary_placements_v1(jsonb) from public,anon,authenticated;
create or replace function private.list_vocabulary_metadata_school_v1(p_school_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', vocabulary.id,
        'name', vocabulary.name,
        'description', vocabulary.description,
        'grades', vocabulary.grades,
        'subjectSlug', coalesce(vocabulary.teacher_subject_id::text,vocabulary.subject_slug),
        'assignedDate', vocabulary.assigned_date,
        'trimester', vocabulary.trimester,
        'month', vocabulary.month,
        'week', vocabulary.week,
        'activitySettings', vocabulary.activity_settings,
        'wordCount', jsonb_array_length(vocabulary.words),
        'ownerId', vocabulary.owner_id,
        'createdAt', vocabulary.created_at,
        'updatedAt', vocabulary.updated_at
    ) order by vocabulary.assigned_date nulls last, vocabulary.name, vocabulary.id), '[]'::jsonb)
    from public.vocabularies vocabulary where vocabulary.school_id=p_school_id and private.can_edit_school_library(p_school_id);
$function$;
create function public.list_vocabulary_metadata_school_v1(p_school_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.list_vocabulary_metadata_school_v1(p_school_id);$$;
revoke all on function public.list_vocabulary_metadata_school_v1(uuid),private.list_vocabulary_metadata_school_v1(uuid) from public,anon;
grant execute on function public.list_vocabulary_metadata_school_v1(uuid),private.list_vocabulary_metadata_school_v1(uuid) to authenticated;
revoke execute on function public.list_vocabulary_metadata_v1() from public,anon,authenticated;
create or replace function private.student_progress_snapshot_school_v2(p_school_id uuid,p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    with activity_groups as (
        select progress.user_id, progress.unit_key,
            jsonb_object_agg(progress.activity_type, jsonb_strip_nulls(jsonb_build_object(
                'score', progress.score,
                'details', progress.details,
                'isComplete', progress.is_complete,
                'plays', progress.plays,
                'totalEarned', progress.total_earned,
                'accuracy', progress.accuracy,
                'bestAccuracy', progress.best_accuracy,
                'lifetimeCorrect', progress.lifetime_correct,
                'lifetimeAttempted', progress.lifetime_attempted,
                'lifetimeAccuracy', case when progress.lifetime_attempted > 0
                    then round(100 * progress.lifetime_correct::numeric / progress.lifetime_attempted, 2) end,
                'finishedRuns', progress.finished_runs,
                'masteredRuns', progress.mastered_runs,
                'verified', progress.verified,
                'attemptId', progress.attempt_id,
                'bestAttemptId', progress.best_attempt_id,
                'latestAttemptId', progress.latest_attempt_id,
                'bestAttempt', private.student_activity_attempt_json(best_attempt),
                'latestAttempt', private.student_activity_attempt_json(latest_attempt),
                'lastPlayed', progress.last_played,
                'updatedAt', progress.updated_at
            )) order by progress.activity_type) as scores
        from public.student_activity_progress progress
        left join private.student_activity_attempts best_attempt on best_attempt.id = progress.best_attempt_id
        left join private.student_activity_attempts latest_attempt on latest_attempt.id = progress.latest_attempt_id
        where progress.user_id = p_user_id and private.can_read_school_student_assignment(p_school_id,progress.assignment_id,progress.user_id)
        group by progress.user_id, progress.unit_key
    ), state_groups as (
        select state.user_id, state.unit_key,
            jsonb_object_agg(state.activity_type, state.state_data order by state.activity_type) as states
        from public.student_activity_state state
        where state.user_id = p_user_id and private.can_read_school_student_assignment(p_school_id,state.assignment_id,state.user_id)
        group by state.user_id, state.unit_key
    ), unit_snapshot as (
        select coalesce(jsonb_object_agg(unit.unit_key,
            unit.work_data || jsonb_strip_nulls(jsonb_build_object(
                'unitId', unit.unit_id, 'unitName', unit.unit_name,
                'subjectSlug', unit.subject_slug, 'trimester', unit.trimester,
                'schoolYear', unit.school_year, 'grade', unit.grade,
                'scores', coalesce(activity.scores, '{}'::jsonb),
                'states', coalesce(state.states, '{}'::jsonb)
            )) order by unit.unit_key), '{}'::jsonb) as units
        from public.student_unit_progress unit
        left join activity_groups activity
          on activity.user_id = unit.user_id and activity.unit_key = unit.unit_key
        left join state_groups state
          on state.user_id = unit.user_id and state.unit_key = unit.unit_key
        where unit.user_id = p_user_id and private.can_read_school_student_assignment(p_school_id,unit.assignment_id,unit.user_id)
    )
    select (jsonb_build_object(
        'userId', summary.user_id,
        'studentProfile', private.student_profile_json(summary.user_id) || coalesce((select jsonb_build_object('grade',coalesce(m.grade,''),'group',coalesce(m.section,'')) from public.school_memberships m where m.school_id=p_school_id and m.user_id=summary.user_id),'{}'::jsonb),
        'units', unit_snapshot.units,
        'coins', summary.coins,
        'coinData', summary.coin_data,
        'coinHistory', coalesce((select jsonb_agg(jsonb_build_object(
            'id', ledger.event_key, 'type', ledger.event_type, 'amount', ledger.amount,
            'source', ledger.source, 'description', ledger.description,
            'timestamp', ledger.created_at
        ) order by ledger.created_at) from (select * from public.student_coin_ledger
            where user_id = summary.user_id order by created_at desc limit 100) ledger), '[]'::jsonb),
        'totalXp', summary.total_xp,
        'version', summary.version,
        'createdAt', summary.created_at,
        'updatedAt', summary.updated_at
    ) - array['coins','coinData','coinHistory','totalXp','version','updatedAt'])
    from public.student_progress_summary summary
    cross join unit_snapshot
    where summary.user_id = p_user_id and (private.school_has_student(p_school_id,p_user_id));
$function$;
revoke all on function private.student_progress_snapshot_school_v2(uuid,uuid) from public,anon,authenticated;
create or replace function private.get_student_progress_v3(p_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is distinct from p_user_id then raise exception 'Use a school-scoped report.' using errcode='42501'; end if;
 return private.student_progress_snapshot_v2(p_user_id);
end;
$$;
revoke execute on function public.get_students_progress_v3(),private.get_students_progress_v3() from public,anon,authenticated;

-- Explicit operator-only legacy manifest. No rows are guessed from an owner or email domain.
create function private.map_legacy_school_v1(p_school_id uuid,p_manifest jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row_id text; target_table text; manifest_key text; target_user uuid; changed_count integer;
begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'Trusted operator required.' using errcode='42501'; end if;
 perform 1 from public.schools where id=p_school_id and active for update;
 if not found then raise exception 'Active destination school required.'; end if;
 if jsonb_typeof(p_manifest)<>'object' or coalesce(p_manifest->>'approved', '') <> 'true' then raise exception 'An explicitly approved manifest is required.'; end if;
 foreach manifest_key in array array['subjects','classes','vocabularies','sparks','teachers','students'] loop
  if jsonb_typeof(p_manifest->manifest_key) is distinct from 'array' then raise exception 'Manifest must contain explicit arrays for subjects, classes, vocabularies, sparks, teachers, and students.'; end if;
 end loop;
 -- Explicit memberships first. Existing inactive memberships are not silently restored.
 foreach manifest_key in array array['teachers','students'] loop
  for row_id in select jsonb_array_elements_text(p_manifest->manifest_key) loop
   target_user:=row_id::uuid;
   insert into public.school_memberships(school_id,user_id,grade,section) select p_school_id,target_user,grade_level::text,section_letter from public.profiles where user_id=target_user on conflict do nothing;
   if not exists(select 1 from public.school_memberships where school_id=p_school_id and user_id=target_user and active) then raise exception 'Manifest includes inactive member %.',target_user; end if;
   insert into public.school_member_roles(school_id,user_id,role) values(p_school_id,target_user,case when manifest_key='teachers' then 'teacher' else 'student' end) on conflict do nothing;
  end loop;
 end loop;
 insert into public.school_academic_years(school_id,year,label)
 select distinct p_school_id,c.school_year,c.school_year::text from public.teaching_classes c where c.id::text in (select jsonb_array_elements_text(p_manifest->'classes')) and (c.school_id is null or c.school_id=p_school_id)
 on conflict do nothing;
 foreach manifest_key in array array['subjects','vocabularies','sparks','classes'] loop
  target_table:=case manifest_key when 'subjects' then 'teacher_subjects' when 'classes' then 'teaching_classes' when 'vocabularies' then 'vocabularies' else 'weekly_sparks' end;
  for row_id in select jsonb_array_elements_text(p_manifest->manifest_key) loop
   execute format('update public.%I set school_id=$1 where id::text=$2 and (school_id is null or school_id=$1)',target_table) using p_school_id,row_id;
   get diagnostics changed_count = row_count;
   if changed_count <> 1 then raise exception 'Manifest record unavailable or belongs to another school: % %.',target_table,row_id; end if;
  end loop;
 end loop;
 -- Versions and assignments are an inseparable closure of the explicitly selected classes.
 if exists(select 1 from public.class_assignments a join private.class_material_versions v on v.id=a.version_id
 join public.teaching_classes c on c.id=a.class_id where c.school_id=p_school_id and
 ((v.vocabulary_id is not null and not exists(select 1 from public.vocabularies where id=v.vocabulary_id and school_id=p_school_id)) or
 (v.spark_id is not null and not exists(select 1 from public.weekly_sparks where id=v.spark_id and school_id=p_school_id)))) then raise exception 'Manifest omits class assignment materials.'; end if;
 update private.class_material_versions v set school_id=p_school_id where (v.school_id is null or v.school_id=p_school_id)
 and exists(select 1 from public.class_assignments a join public.teaching_classes c on c.id=a.class_id where a.version_id=v.id and c.school_id=p_school_id);
 update public.class_assignments a set school_id=p_school_id from public.teaching_classes c where c.id=a.class_id and c.school_id=p_school_id and (a.school_id is null or a.school_id=p_school_id);
 if exists(select 1 from public.class_memberships m join public.teaching_classes c on c.id=m.class_id
 where c.school_id=p_school_id and m.active and not private.has_school_role(p_school_id,'student',m.student_id)) then raise exception 'Manifest omits active class students.'; end if;
 insert into public.class_teachers(class_id,school_id,teacher_id,assigned_by)
 select id,school_id,owner_id,auth.uid() from public.teaching_classes where school_id=p_school_id and private.has_school_role(p_school_id,'teacher',owner_id)
 on conflict do nothing;
 -- Pairing preferences are mapped only by explicitly approved IDs, never guessed.
 if p_manifest ? 'group_restrictions' then
  if jsonb_typeof(p_manifest->'group_restrictions') is distinct from 'array' then raise exception 'group_restrictions must be an explicit array.'; end if;
  for row_id in select jsonb_array_elements_text(p_manifest->'group_restrictions') loop
   update public.teacher_group_pair_restrictions set school_id=p_school_id where id=row_id::uuid and (school_id is null or school_id=p_school_id);
   get diagnostics changed_count = row_count;
   if changed_count <> 1 then raise exception 'Pairing preference unavailable or already mapped to another school: %.',row_id; end if;
  end loop;
 end if;
 return jsonb_build_object('schoolId',p_school_id,'classes',(select count(*) from public.teaching_classes where school_id=p_school_id),
 'assignments',(select count(*) from public.class_assignments where school_id=p_school_id),
 'versions',(select count(*) from private.class_material_versions where school_id=p_school_id));
end;
$$;
create function public.map_legacy_school_v1(p_school_id uuid,p_manifest jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.map_legacy_school_v1(p_school_id,p_manifest);$$;
revoke all on function private.map_legacy_school_v1(uuid,jsonb),public.map_legacy_school_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.map_legacy_school_v1(uuid,jsonb),public.map_legacy_school_v1(uuid,jsonb) to service_role;

-- A school student role is sufficient even when the account also teaches elsewhere.
create function private.has_any_student_membership(p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.school_member_roles r where r.user_id=p_user_id and r.role='student' and private.is_school_member(r.school_id,p_user_id));
$$;
revoke all on function private.has_any_student_membership(uuid) from public,anon,authenticated;
create or replace function private.ensure_student_progress_summary_v3(p_user_id uuid)
returns public.student_progress_summary
language plpgsql
security definer
set search_path = ''
as $$
declare
    summary_row public.student_progress_summary;
begin
    if p_user_id is null then raise exception 'A student ID is required.'; end if;
    if not exists (
        select 1 from public.profiles
        where user_id = p_user_id and (role = 'student' or private.has_any_student_membership(p_user_id))
    ) then
        raise exception 'Student profile was not found.';
    end if;

    insert into public.student_progress_summary (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select * into summary_row
    from public.student_progress_summary
    where user_id = p_user_id
    for update;

    if summary_row.user_id is null then
        raise exception 'Could not initialize student progress.';
    end if;
    return summary_row;
end;
$$;
create or replace function private.ensure_arcade_time_wallet_v1(p_user_id uuid)
returns public.student_arcade_time
language plpgsql
security definer
set search_path = ''
as $$
declare
    wallet public.student_arcade_time;
begin
    if p_user_id is null then raise exception 'A student ID is required.'; end if;
    if not exists (
        select 1 from public.profiles
        where user_id = p_user_id and (role = 'student' or private.has_any_student_membership(p_user_id))
    ) then
        raise exception 'Student profile was not found.';
    end if;

    insert into public.student_arcade_time (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select * into wallet
    from public.student_arcade_time
    where user_id = p_user_id
    for update;
    return wallet;
end;
$$;
create or replace function private.submit_student_game_score(
    p_game_id text,
    p_score numeric,
    p_metadata jsonb default '{}'::jsonb
)
returns public.scores
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    game_id text := left(trim(coalesce(p_game_id, '')), 80);
    allowed_games constant text[] := array[
        'galactic-breaker',
        'snake',
        'flappy-bird',
        'space-invaders',
        'target-shooter',
        'pong',
        'whack-a-mole',
        'trapdoor-trials',
        'tilt-maze',
        'basic-platformer',
        'tower-platformer',
        'radius-raid',
        'packabunchas',
        'spacepi'
    ];
    numeric_score numeric := coalesce(p_score, 0);
    lower_is_better boolean;
    profile_row public.profiles;
    existing_row public.scores;
    result_row public.scores;
    score_id text;
    safe_metadata jsonb := case
        when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then p_metadata
        else '{}'::jsonb
    end;
begin
    if current_user_id is null then
        raise exception 'You must be signed in to save a score.';
    end if;
    if game_id <> all(allowed_games) then
        raise exception 'Unsupported game id: %', game_id;
    end if;
    if numeric_score < 0 or numeric_score > 100000000 then
        raise exception 'Score is outside the accepted range.';
    end if;
    if length(safe_metadata::text) > 5000 then
        raise exception 'Score metadata is too large.';
    end if;

    select *
    into profile_row
    from public.profiles
    where user_id = current_user_id;

    if profile_row.user_id is null or (profile_row.role <> 'student' and not private.has_any_student_membership(current_user_id)) then
        raise exception 'Only students can submit leaderboard scores.';
    end if;

    lower_is_better := game_id = 'spacepi';
    score_id := current_user_id::text || '-' || game_id;

    select *
    into existing_row
    from public.scores
    where id = score_id
    for update;

    if existing_row.id is not null then
        if lower_is_better and numeric_score >= existing_row.score then
            return existing_row;
        end if;
        if not lower_is_better and numeric_score <= existing_row.score then
            return existing_row;
        end if;
    end if;

    insert into public.scores (
        id,
        user_id,
        name,
        grade_level,
        game_id,
        score,
        metadata,
        timestamp,
        updated_at
    )
    values (
        score_id,
        current_user_id,
        trim(concat_ws(' ', profile_row.first_name, profile_row.last_name)),
        profile_row.grade_level,
        game_id,
        numeric_score,
        safe_metadata || jsonb_build_object('submittedAt', now()),
        now(),
        now()
    )
    on conflict (id) do update
    set score = excluded.score,
        metadata = excluded.metadata,
        timestamp = excluded.timestamp,
        updated_at = now()
    returning * into result_row;

    return result_row;
end;
$$;
create function private.revoke_school_class_access() returns trigger language plpgsql security definer set search_path='' as $$
declare school_key uuid; user_key uuid; student_allowed boolean; teacher_allowed boolean;
begin
 school_key:=old.school_id; user_key:=old.user_id;
 -- Suspension temporarily blocks authorization; it must not erase class links.
 -- Inspect the final persisted membership/roles independently of school.active.
 select exists(select 1 from public.school_memberships m join public.school_member_roles r using(school_id,user_id)
  where m.school_id=school_key and m.user_id=user_key and m.active and r.role='student'),
  exists(select 1 from public.school_memberships m join public.school_member_roles r using(school_id,user_id)
  where m.school_id=school_key and m.user_id=user_key and m.active and r.role='teacher')
 into student_allowed,teacher_allowed;
 if not student_allowed then
  update public.class_memberships m set active=false,removed_at=now() from public.teaching_classes c
  where c.id=m.class_id and c.school_id=school_key and m.student_id=user_key and m.active;
  update private.class_invitations i set revoked_at=now() from public.teaching_classes c,auth.users u
  where c.id=i.class_id and c.school_id=school_key and u.id=user_key and i.email=u.email::extensions.citext and i.revoked_at is null;
 end if;
 if not teacher_allowed then update public.class_teachers set active=false,removed_at=now() where school_id=school_key and teacher_id=user_key and active; end if;
 return null;
end;
$$;
revoke all on function private.revoke_school_class_access() from public,anon,authenticated;
create trigger revoke_school_member_classes after update of active on public.school_memberships for each row when(old.active and not new.active) execute function private.revoke_school_class_access();
-- Role replacement deletes and reinserts a member's roles in one transaction.
-- Inspect the final role set at commit so retained roles keep their classes.
create constraint trigger revoke_removed_school_role after delete on public.school_member_roles deferrable initially deferred for each row execute function private.revoke_school_class_access();
create function private.audit_class_teacher_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.school_admin_events(school_id,actor_id,action,target_user_id,details)
 values(new.school_id,auth.uid(),'class.teacher.changed',new.teacher_id,jsonb_build_object('classId',new.class_id,'active',new.active));
 return null;
end;
$$;
create trigger audit_class_teacher_change after insert or update on public.class_teachers for each row execute function private.audit_class_teacher_change();
revoke all on function private.audit_class_teacher_change() from public,anon,authenticated;
-- INSERT RETURNING is evaluated before an AFTER trigger can establish teaching
-- access; return the completed class transaction through this guarded RPC.
revoke insert on public.teaching_classes from authenticated;
create function private.create_teaching_class_v1(p_school_id uuid,p_subject_id uuid,p_name text,p_school_year integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.teaching_classes;
begin
 perform 1 from public.schools where id=p_school_id for share;
 if not private.can_edit_school_library(p_school_id) then raise exception 'School teacher or administrator required.' using errcode='42501'; end if;
 insert into public.teaching_classes(school_id,subject_id,name,school_year) values(p_school_id,p_subject_id,trim(p_name),p_school_year) returning * into result;
 insert into private.school_admin_events(school_id,actor_id,action,details) values(p_school_id,auth.uid(),'class.created',jsonb_build_object('classId',result.id));
 return to_jsonb(result);
end;
$$;
create function public.create_teaching_class_v1(p_school_id uuid,p_subject_id uuid,p_name text,p_school_year integer) returns jsonb language sql security invoker set search_path='' as $$select private.create_teaching_class_v1(p_school_id,p_subject_id,p_name,p_school_year);$$;
revoke all on function private.create_teaching_class_v1(uuid,uuid,text,integer),public.create_teaching_class_v1(uuid,uuid,text,integer) from public,anon;
grant execute on function private.create_teaching_class_v1(uuid,uuid,text,integer),public.create_teaching_class_v1(uuid,uuid,text,integer) to authenticated;
-- Export history follows the same school boundary as the exported records.
alter table public.export_logs add column school_id uuid references public.schools(id);
create index on public.export_logs(school_id,teacher_id);
drop policy export_logs_owned on public.export_logs;
create policy export_logs_school on public.export_logs to authenticated
 using(teacher_id=auth.uid() and private.can_edit_school_library(school_id))
 with check(teacher_id=auth.uid() and private.can_edit_school_library(school_id));

-- Pairing preferences remain personal to a teacher within an explicit school.
-- Unmapped legacy rows have NULL school_id and are inaccessible to clients.
alter table public.teacher_group_pair_restrictions add column school_id uuid references public.schools(id);
alter table public.teacher_group_pair_restrictions drop constraint teacher_group_pair_unique;
alter table public.teacher_group_pair_restrictions add unique(school_id,teacher_id,student_a_id,student_b_id);
alter table public.teacher_group_pair_restrictions add foreign key(school_id,teacher_id) references public.school_memberships(school_id,user_id);
alter table public.teacher_group_pair_restrictions add foreign key(school_id,student_a_id) references public.school_memberships(school_id,user_id);
alter table public.teacher_group_pair_restrictions add foreign key(school_id,student_b_id) references public.school_memberships(school_id,user_id);
create index on public.teacher_group_pair_restrictions(school_id,teacher_id);
drop policy teacher_group_pair_restrictions_select_own on public.teacher_group_pair_restrictions;
drop policy teacher_group_pair_restrictions_insert_own on public.teacher_group_pair_restrictions;
drop policy teacher_group_pair_restrictions_delete_own on public.teacher_group_pair_restrictions;
create policy group_pairs_school_read on public.teacher_group_pair_restrictions for select to authenticated
 using(teacher_id=auth.uid() and private.has_school_role(school_id,'teacher'));
create policy group_pairs_school_insert on public.teacher_group_pair_restrictions for insert to authenticated
 with check(teacher_id=auth.uid() and private.has_school_role(school_id,'teacher'));
create policy group_pairs_school_delete on public.teacher_group_pair_restrictions for delete to authenticated
 using(teacher_id=auth.uid() and private.has_school_role(school_id,'teacher'));
create function private.validate_school_group_pair() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.school_id is null then
  if auth.uid() is not null then raise exception 'School scope required.' using errcode='42501'; end if;
  return new;
 end if;
 perform 1 from public.schools where id=new.school_id for share;
 if not private.has_school_role(new.school_id,'teacher',new.teacher_id)
 or not private.has_school_role(new.school_id,'student',new.student_a_id)
 or not private.has_school_role(new.school_id,'student',new.student_b_id) then
  raise exception 'Pairing preferences require an active school teacher and two active school students.' using errcode='42501';
 end if;
 if auth.uid() is not null and (new.teacher_id<>auth.uid()
 or not private.school_has_student(new.school_id,new.student_a_id)
 or not private.school_has_student(new.school_id,new.student_b_id)) then
  raise exception 'Students must belong to your teaching scope in this school.' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger validate_school_group_pair before insert or update on public.teacher_group_pair_restrictions for each row execute function private.validate_school_group_pair();
revoke all on function private.validate_school_group_pair() from public,anon,authenticated;

create function private.list_teaching_classes_v1(p_school_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_edit_school_library(p_school_id) then raise exception 'School teacher or administrator required.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('subject',jsonb_build_object('name',s.name),'canTeach',private.can_teach_class(c.id)) order by c.name,c.id)
 from public.teaching_classes c join public.teacher_subjects s on s.id=c.subject_id where c.school_id=p_school_id and private.owns_teaching_class(c.id)),'[]'::jsonb);
end;
$$;
create function public.list_teaching_classes_v1(p_school_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.list_teaching_classes_v1(p_school_id);$$;
revoke all on function private.list_teaching_classes_v1(uuid),public.list_teaching_classes_v1(uuid) from public,anon;
grant execute on function private.list_teaching_classes_v1(uuid),public.list_teaching_classes_v1(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
