begin;
set transaction isolation level repeatable read;
create temporary table vocabulary_preservation_receipt(table_name text primary key, row_count bigint, digest text) on commit drop;
do $$ declare t record; n bigint; h text; begin
 for t in select table_schema,table_name from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE' loop
 execute format($q$select count(*),md5(coalesce(string_agg(md5((to_jsonb(t)-array['content_version_id','content_revision','vocabulary_placement','library_revision','policy_version','archived_at','import_provenance'])::text),'' order by md5((to_jsonb(t)-array['content_version_id','content_revision','vocabulary_placement','library_revision','policy_version','archived_at','import_provenance'])::text)),'')) from %I.%I t$q$,t.table_schema,t.table_name) into n,h;
 insert into vocabulary_preservation_receipt values(t.table_schema||'.'||t.table_name,n,h);
 end loop;
end $$;
-- Additive lifecycle metadata. No student rows, assignment IDs or versions are replaced.
alter table public.vocabularies add column content_revision integer not null default 1,
 add column archived_at timestamptz,
 add column import_provenance jsonb not null default '{}'::jsonb;
alter table public.class_assignments add column content_revision integer not null default 1,
 add column vocabulary_placement jsonb;
alter table private.class_material_versions add column library_revision integer,
 add column policy_version integer;
-- Freeze exactly the placement currently read by students, including nulls.
update public.class_assignments a set vocabulary_placement=jsonb_build_object(
 'assignedDate',v.assigned_date,'trimester',v.trimester,'month',v.month,'week',v.week)
from private.class_material_versions m join public.vocabularies v on v.id=m.vocabulary_id and v.school_id=m.school_id
where a.version_id=m.id and a.kind='vocabulary';
alter table private.student_activity_attempts add column content_version_id uuid references private.class_material_versions(id);
create index student_activity_attempts_content_version_idx on private.student_activity_attempts(content_version_id);
-- Historical attempts deliberately remain null: do not invent their original version.
alter table private.vocabulary_grade_publications add column content_version_id uuid references private.class_material_versions(id);
create index vocabulary_grade_publications_content_version_idx on private.vocabulary_grade_publications(content_version_id);
create function private.capture_grade_content_version_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin select version_id into new.content_version_id from public.class_assignments where id=new.assignment_id for share; return new; end; $$;
revoke all on function private.capture_grade_content_version_v1() from public,anon,authenticated;
create trigger capture_grade_content_version before insert on private.vocabulary_grade_publications for each row execute function private.capture_grade_content_version_v1();
create table private.vocabulary_change_receipts (
 actor_id uuid not null, request_key uuid not null,
 school_id uuid not null references public.schools(id), request jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(actor_id,request_key)
);
create index vocabulary_change_receipts_school_idx on private.vocabulary_change_receipts(school_id);
alter table private.vocabulary_change_receipts enable row level security;
revoke all on private.vocabulary_change_receipts from public,anon,authenticated;

create function private.vocabulary_publication_errors_v1(p_content jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare req jsonb:=p_content#>'{activitySettings,requiredActivities}';
 extras jsonb:=coalesce(p_content#>'{activitySettings,additionalActivities}','[]'::jsonb);
 errors jsonb:='[]'::jsonb; activity text;
 ids text[]:=array['flashcards','matching','quiz','synonym-antonym','word-search','crossword','hangman','scramble','wordle','speed-match','fill-in-blank','illustration'];
begin
 if jsonb_typeof(req) is distinct from 'array' then return '["Choose Flashcards and at least one other required activity."]'::jsonb; end if;
 if jsonb_array_length(req)<2 or req->>0 is distinct from 'flashcards' then
 errors:=errors||jsonb_build_array('Require Flashcards first and at least one other activity.'); end if;
 if (select count(distinct value) from jsonb_array_elements(req))<>jsonb_array_length(req) then errors:=errors||jsonb_build_array('Required activities must be distinct.'); end if;
 if jsonb_typeof(extras)<>'array' then errors:=errors||jsonb_build_array('Optional activities must be a list.'); extras:='[]'::jsonb; end if;
 if (select count(distinct value) from jsonb_array_elements(extras))<>jsonb_array_length(extras) then errors:=errors||jsonb_build_array('Optional activities must be distinct.'); end if;
 for activity in select jsonb_array_elements_text(req) loop
  if activity is null or not(activity=any(ids)) then errors:=errors||jsonb_build_array('Unknown required activity.');
  elsif not private.vocabulary_grade_activity_playable_v1(p_content,activity) then errors:=errors||jsonb_build_array('Not enough playable words for '||activity||'.'); end if;
  if extras ? activity then errors:=errors||jsonb_build_array('An activity cannot be both required and optional.'); end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(extras) x where x is null or not(x=any(ids))) then errors:=errors||jsonb_build_array('Unknown optional activity.'); end if;
 if p_content#>'{activitySettings,retiredWeeklySet}'='true'::jsonb then errors:=errors||jsonb_build_array('Retired vocabulary cannot be published.'); end if;
 return errors;
end; $$;
revoke all on function private.vocabulary_publication_errors_v1(jsonb) from public,anon,authenticated;

create function private.vocabulary_content_v1(v public.vocabularies) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('kind','vocabulary','name',v.name,'description',v.description,'words',v.words,'week',v.week,'activitySettings',v.activity_settings);
$$;
revoke all on function private.vocabulary_content_v1(public.vocabularies) from public,anon,authenticated;

create function private.vocabulary_revision_v1() returns trigger language plpgsql set search_path='' as $$
begin new.content_revision:=old.content_revision+1; return new; end; $$;
revoke all on function private.vocabulary_revision_v1() from public,anon,authenticated;
create trigger vocabulary_revision before update on public.vocabularies for each row execute function private.vocabulary_revision_v1();
create trigger assignment_content_revision before update on public.class_assignments for each row execute function private.vocabulary_revision_v1();

create function private.capture_vocabulary_publication_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare v public.vocabularies; errors jsonb;
begin
 if new.vocabulary_id is not null then
  select * into v from public.vocabularies where id=new.vocabulary_id for share;
  if v.archived_at is not null then raise exception 'Archived vocabulary cannot be assigned.' using errcode='22023'; end if;
  errors:=private.vocabulary_publication_errors_v1(new.student_content);
  if auth.uid() is not null and jsonb_array_length(errors)>0 then raise exception '%',errors->>0 using errcode='22023'; end if;
  new.library_revision:=v.content_revision; new.policy_version:=1;
 end if;
 return new;
end; $$;
revoke all on function private.capture_vocabulary_publication_v1() from public,anon,authenticated;
create trigger capture_vocabulary_publication before insert on private.class_material_versions for each row execute function private.capture_vocabulary_publication_v1();

create function private.capture_assignment_placement_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='vocabulary' and new.vocabulary_placement is null then
 select jsonb_build_object('assignedDate',v.assigned_date,'trimester',v.trimester,'month',v.month,'week',v.week)
 into new.vocabulary_placement from private.class_material_versions m join public.vocabularies v on v.id=m.vocabulary_id where m.id=new.version_id;
 end if; return new;
end; $$;
revoke all on function private.capture_assignment_placement_v1() from public,anon,authenticated;
create trigger capture_assignment_placement before insert on public.class_assignments for each row execute function private.capture_assignment_placement_v1();

create function private.capture_attempt_content_version_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.unit_key ~ '^assignment:[0-9a-f-]{36}$' then
  select version_id into new.content_version_id from public.class_assignments where id=substring(new.unit_key from 12)::uuid for share;
 end if; return new;
end; $$;
revoke all on function private.capture_attempt_content_version_v1() from public,anon,authenticated;
create trigger capture_attempt_content_version before insert on private.student_activity_attempts for each row execute function private.capture_attempt_content_version_v1();

-- Preserve access checks and content; placement now belongs to the assignment.
create or replace function private.read_class_assignment_v1(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
    if not private.can_read_class_assignment(p_assignment_id) then
        raise exception 'Assignment unavailable.' using errcode = '42501';
    end if;
    select to_jsonb(a) || jsonb_build_object(
        'content', v.student_content,
        'materialId', coalesce(v.vocabulary_id, v.spark_id),
        'className', c.name, 'subjectName', s.name,
        'vocabularyPlacement', a.vocabulary_placement
    ) into result
    from public.class_assignments a
    join private.class_material_versions v on v.id = a.version_id
    join public.teaching_classes c on c.id = a.class_id
    join public.teacher_subjects s on s.id = c.subject_id
    where a.id = p_assignment_id;
    return result;
end;
$$;

create function private.save_vocabulary_revision_v1(p_school_id uuid,p_id text,p_payload jsonb,p_expected_revision integer,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.vocabularies; v public.vocabularies; receipt private.vocabulary_change_receipts; req jsonb; result jsonb;
begin
 perform 1 from public.schools where id=p_school_id for share;
 if not private.can_edit_school_library(p_school_id) then raise exception 'School library unavailable.' using errcode='42501'; end if;
 if p_request_key is null or p_expected_revision is null or p_expected_revision<0 or nullif(trim(p_id),'') is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid vocabulary save.' using errcode='22023'; end if;
 req:=jsonb_build_object('operation','save','id',p_id,'payload',p_payload,'revision',p_expected_revision);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_key::text,0));
 select * into receipt from private.vocabulary_change_receipts where actor_id=auth.uid() and request_key=p_request_key;
 if found then
  if receipt.school_id<>p_school_id or receipt.request<>req then raise exception 'Save request key already used.' using errcode='22023'; end if;
  return receipt.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_id,0));
 select * into old from public.vocabularies where id=p_id for update;
 if found and (old.school_id<>p_school_id or old.archived_at is not null) then raise exception 'Vocabulary unavailable.' using errcode='42501'; end if;
 if coalesce(old.content_revision,0)<>p_expected_revision then raise exception 'This vocabulary changed elsewhere. Your draft is kept on this device. Reopen the saved version before merging your changes.' using errcode='40001'; end if;
 v:=jsonb_populate_record(old,p_payload - array['id','owner_id','school_id','created_at','content_revision','archived_at']);
 if old.id is null then
  insert into public.vocabularies(id,school_id,owner_id,name,description,subject_slug,teacher_subject_id,grades,assigned_date,trimester,month,week,activity_settings,words,import_provenance)
  values(p_id,p_school_id,auth.uid(),coalesce(v.name,''),coalesce(v.description,''),'technology',v.teacher_subject_id,coalesce(v.grades,'{}'),v.assigned_date,coalesce(v.trimester,''),coalesce(v.month,''),v.week,coalesce(v.activity_settings,'{}'),coalesce(v.words,'[]'),coalesce(v.import_provenance,'{}')) returning * into v;
 else
  update public.vocabularies set name=v.name,description=v.description,teacher_subject_id=v.teacher_subject_id,grades=v.grades,
   assigned_date=v.assigned_date,trimester=v.trimester,month=v.month,week=v.week,activity_settings=v.activity_settings,words=v.words,import_provenance=v.import_provenance,updated_at=now()
   where id=p_id returning * into v;
 end if;
 result:=to_jsonb(v);
 insert into private.vocabulary_change_receipts(actor_id,request_key,school_id,request,result) values(auth.uid(),p_request_key,p_school_id,req,result);
 return result;
end; $$;
create function public.save_vocabulary_revision_v1(p_school_id uuid,p_id text,p_payload jsonb,p_expected_revision integer,p_request_key uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.save_vocabulary_revision_v1(p_school_id,p_id,p_payload,p_expected_revision,p_request_key);$$;
revoke all on function private.save_vocabulary_revision_v1(uuid,text,jsonb,integer,uuid),public.save_vocabulary_revision_v1(uuid,text,jsonb,integer,uuid) from public,anon;
grant execute on function private.save_vocabulary_revision_v1(uuid,text,jsonb,integer,uuid),public.save_vocabulary_revision_v1(uuid,text,jsonb,integer,uuid) to authenticated;
-- Old browser writes fail visibly; they cannot bypass conflict detection or delete work.
revoke insert,update,delete on public.vocabularies from authenticated;

create function private.vocabulary_publication_state_v1(p_school_id uuid,p_material_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.vocabularies; assignments jsonb;
begin
 if not private.can_edit_school_library(p_school_id) then raise exception 'School library unavailable.' using errcode='42501'; end if;
 select * into v from public.vocabularies where id=p_material_id and school_id=p_school_id;
 if not found then raise exception 'Vocabulary unavailable.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'classId',a.class_id,'className',c.name,'title',a.title,
 'revision',a.content_revision,'versionId',a.version_id,'withdrawn',a.withdrawn,'releaseAt',a.release_at,'closeAt',a.close_at,
 'placement',a.vocabulary_placement,'requiredActivities',m.student_content#>'{activitySettings,requiredActivities}',
 'hasLibraryChanges',m.student_content is distinct from private.vocabulary_content_v1(v),
 'hasWork',exists(select 1 from private.student_activity_attempts t where t.assignment_id=a.id)
  or exists(select 1 from public.student_activity_progress t where t.assignment_id=a.id),
 'hasPublishedGrades',exists(select 1 from private.vocabulary_grade_publications g where g.assignment_id=a.id)
 ) order by c.name,a.release_at),'[]') into assignments
 from public.class_assignments a join private.class_material_versions m on m.id=a.version_id join public.teaching_classes c on c.id=a.class_id
 where a.school_id=p_school_id and m.vocabulary_id=p_material_id and private.can_teach_class(a.class_id);
 return jsonb_build_object('materialId',v.id,'name',v.name,'revision',v.content_revision,'archived',v.archived_at is not null,
 'requiredActivities',v.activity_settings->'requiredActivities','publicationErrors',private.vocabulary_publication_errors_v1(private.vocabulary_content_v1(v)),
 'assignments',assignments);
end; $$;
create function public.vocabulary_publication_state_v1(p_school_id uuid,p_material_id text) returns jsonb language sql security invoker set search_path='' as $$select private.vocabulary_publication_state_v1(p_school_id,p_material_id);$$;
revoke all on function private.vocabulary_publication_state_v1(uuid,text),public.vocabulary_publication_state_v1(uuid,text) from public,anon;
grant execute on function private.vocabulary_publication_state_v1(uuid,text),public.vocabulary_publication_state_v1(uuid,text) to authenticated;

-- Preview is recomputed under locks at commit; the token detects intervening edits.
create function private.preview_vocabulary_change_v1(p_school_id uuid,p_material_id text,p_request jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare state jsonb; selected jsonb; op text:=p_request->>'operation'; row jsonb; a public.class_assignments; m private.class_material_versions; v public.vocabularies; content jsonb; report jsonb;
begin
 state:=private.vocabulary_publication_state_v1(p_school_id,p_material_id);
 select * into v from public.vocabularies where id=p_material_id and school_id=p_school_id;
 if op is null or op not in ('requirements','replace','reschedule','retire','archive') then raise exception 'Choose an update operation.' using errcode='22023'; end if;
 if jsonb_typeof(p_request->'assignmentIds') is distinct from 'array' then raise exception 'Choose assignments.' using errcode='22023'; end if;
 if jsonb_array_length(p_request->'assignmentIds')>50 or (op<>'archive' and jsonb_array_length(p_request->'assignmentIds')=0)
 or (select count(distinct value) from jsonb_array_elements(p_request->'assignmentIds'))<>jsonb_array_length(p_request->'assignmentIds') then raise exception 'Choose up to 50 distinct assignments.' using errcode='22023'; end if;
 select coalesce(jsonb_agg(x order by x->>'id'),'[]') into selected from jsonb_array_elements(state->'assignments') x where p_request->'assignmentIds' ? (x->>'id');
 if jsonb_array_length(selected)<>jsonb_array_length(p_request->'assignmentIds') then raise exception 'One or more assignments are unavailable.' using errcode='42501'; end if;
 if op in ('requirements','replace') and (v.archived_at is not null or jsonb_array_length(state->'publicationErrors')>0) then raise exception '%',coalesce(state#>>'{publicationErrors,0}','Archived vocabulary cannot be assigned.') using errcode='22023'; end if;
 for row in select * from jsonb_array_elements(selected) loop
  select * into a from public.class_assignments where id=(row->>'id')::uuid;
  select * into m from private.class_material_versions where id=a.version_id;
  if op in ('requirements','replace','reschedule') and (a.withdrawn or (a.close_at is not null and a.close_at<=now())) then raise exception 'Closed or withdrawn assignments must keep their history. Publish new work instead.' using errcode='22023'; end if;
  if op='requirements' then
   -- Only path lists can change in place. Words, rewards, grading and all other settings stay frozen.
   if m.student_content->'words' is distinct from v.words then raise exception 'Words changed. Create replacement assignments to preserve completed work.' using errcode='22023'; end if;
   content:=jsonb_set(m.student_content,'{activitySettings}',coalesce(m.student_content->'activitySettings','{}')||jsonb_build_object(
     'requiredActivities',v.activity_settings->'requiredActivities','additionalActivities',coalesce(v.activity_settings->'additionalActivities','[]')));
   if jsonb_array_length(private.vocabulary_publication_errors_v1(content))>0 then raise exception 'The revised path is not playable with the published words.' using errcode='22023'; end if;
  end if;
 end loop;
 if op='reschedule' then
  if jsonb_typeof(p_request->'placement') is distinct from 'object' or (p_request->'placement') - array['assignedDate','trimester','month','week'] <> '{}'::jsonb then raise exception 'Invalid assignment placement.' using errcode='22023'; end if;
  perform (p_request#>>'{placement,assignedDate}')::date;
  if coalesce((p_request#>>'{placement,week}')::integer,1)<1 then raise exception 'Week must be positive.' using errcode='22023'; end if;
 end if;
 report:=jsonb_build_object('materialId',v.id,'libraryRevision',v.content_revision,'operation',op,'assignments',selected,
  'requiredActivities',v.activity_settings->'requiredActivities','request',p_request,
  'notice',case op when 'requirements' then 'Only required and optional paths change. Completed activities and published grades remain saved.'
   when 'replace' then 'New assignments start fresh. Original assignments, student work and grades remain in history.'
   when 'reschedule' then 'Only the selected assignments move. Activity work and grades stay saved.'
   when 'archive' then 'Library content is archived. Only selected assignments are withdrawn. All student work remains saved.'
   else 'Selected assignments stop accepting work. All student work and grades remain saved.' end);
 return report||jsonb_build_object('token',md5(report::text));
end; $$;
create function public.preview_vocabulary_change_v1(p_school_id uuid,p_material_id text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.preview_vocabulary_change_v1(p_school_id,p_material_id,p_request);$$;
revoke all on function private.preview_vocabulary_change_v1(uuid,text,jsonb),public.preview_vocabulary_change_v1(uuid,text,jsonb) from public,anon;
grant execute on function private.preview_vocabulary_change_v1(uuid,text,jsonb),public.preview_vocabulary_change_v1(uuid,text,jsonb) to authenticated;

create function private.apply_vocabulary_change_v1(p_school_id uuid,p_material_id text,p_request jsonb,p_preview_token text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt private.vocabulary_change_receipts; req jsonb; preview jsonb; v public.vocabularies; a public.class_assignments; m private.class_material_versions;
 version_key uuid; new_id uuid; ids uuid[]; content jsonb; changes jsonb:='[]'::jsonb; result jsonb; op text:=p_request->>'operation';
begin
 if not private.can_edit_school_library(p_school_id) then raise exception 'School library unavailable.' using errcode='42501'; end if;
 if p_request_key is null or nullif(p_preview_token,'') is null then raise exception 'Preview the change first.' using errcode='22023'; end if;
 req:=jsonb_build_object('materialId',p_material_id,'request',p_request,'token',p_preview_token);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_key::text,0));
 select * into receipt from private.vocabulary_change_receipts where actor_id=auth.uid() and request_key=p_request_key;
 if found then
  if receipt.school_id<>p_school_id or receipt.request<>req then raise exception 'Request key already used.' using errcode='22023'; end if;
  return receipt.result;
 end if;
 -- Match publication and student-work lock ordering: school, classes, library, assignments.
 perform 1 from public.schools where id=p_school_id for share;
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_request->'assignmentIds');
 perform 1 from public.teaching_classes where id in (select class_id from public.class_assignments where id=any(ids)) order by id for update;
 select * into v from public.vocabularies where id=p_material_id and school_id=p_school_id for update;
 perform 1 from public.class_assignments where id=any(ids) order by id for update;
 preview:=private.preview_vocabulary_change_v1(p_school_id,p_material_id,p_request);
 if preview->>'token'<>p_preview_token then raise exception 'The vocabulary, assignments or student work changed. Review a fresh preview.' using errcode='40001'; end if;
 for a in select * from public.class_assignments where id=any(ids) order by id loop
  select * into m from private.class_material_versions where id=a.version_id;
  new_id:=a.id;
  if op='requirements' then
   content:=jsonb_set(m.student_content,'{activitySettings}',coalesce(m.student_content->'activitySettings','{}')||jsonb_build_object(
    'requiredActivities',v.activity_settings->'requiredActivities','additionalActivities',coalesce(v.activity_settings->'additionalActivities','[]')));
   insert into private.class_material_versions(school_id,owner_id,vocabulary_id,student_content,assessment_key)
    values(a.school_id,a.owner_id,v.id,content,m.assessment_key) returning id into version_key;
   update public.class_assignments set version_id=version_key where id=a.id;
  elsif op='replace' then
   insert into private.class_material_versions(school_id,owner_id,vocabulary_id,student_content,assessment_key)
    values(a.school_id,a.owner_id,v.id,private.vocabulary_content_v1(v),m.assessment_key) returning id into version_key;
   insert into public.class_assignments(school_id,owner_id,class_id,version_id,title,kind,release_at,due_at,close_at,publication_key,vocabulary_placement)
    values(a.school_id,a.owner_id,a.class_id,version_key,v.name,a.kind,a.release_at,a.due_at,a.close_at,gen_random_uuid(),a.vocabulary_placement) returning id into new_id;
   update public.class_assignments set withdrawn=true where id=a.id;
  elsif op='reschedule' then update public.class_assignments set vocabulary_placement=p_request->'placement' where id=a.id;
  else update public.class_assignments set withdrawn=true where id=a.id;
  end if;
  changes:=changes||jsonb_build_array(jsonb_build_object('assignmentId',a.id,'previousVersionId',a.version_id,'resultAssignmentId',new_id));
 end loop;
 if op='archive' then update public.vocabularies set archived_at=now() where id=v.id; end if;
 result:=jsonb_build_object('requestKey',p_request_key,'operation',op,'changes',changes,'studentRecordsDeleted',0,'completedAt',now());
 insert into private.vocabulary_change_receipts(actor_id,request_key,school_id,request,result) values(auth.uid(),p_request_key,p_school_id,req,result);
 return result;
end; $$;
create function public.apply_vocabulary_change_v1(p_school_id uuid,p_material_id text,p_request jsonb,p_preview_token text,p_request_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.apply_vocabulary_change_v1(p_school_id,p_material_id,p_request,p_preview_token,p_request_key);$$;
revoke all on function private.apply_vocabulary_change_v1(uuid,text,jsonb,text,uuid),public.apply_vocabulary_change_v1(uuid,text,jsonb,text,uuid) from public,anon;
grant execute on function private.apply_vocabulary_change_v1(uuid,text,jsonb,text,uuid),public.apply_vocabulary_change_v1(uuid,text,jsonb,text,uuid) to authenticated;

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
        'updatedAt', vocabulary.updated_at, 'contentRevision', vocabulary.content_revision
    ) order by vocabulary.assigned_date nulls last, vocabulary.name, vocabulary.id), '[]'::jsonb)
    from public.vocabularies vocabulary where vocabulary.archived_at is null and vocabulary.school_id=p_school_id and private.can_edit_school_library(p_school_id);
$function$;

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
            select private.vocabulary_publication_errors_v1(private.vocabulary_content_v1(v)) into content
            from public.vocabularies v where v.id=p_material_id and v.school_id=school_key for share;
            if content is not null and jsonb_array_length(content)>0 then raise exception '%',content->>0 using errcode='22023'; end if;
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
    perform 1 from public.schools where id=p_school_id for share;
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

    if requested_count<>(select count(distinct x->>'id') from jsonb_array_elements(p_updates) x) then raise exception 'Choose distinct vocabularies.' using errcode='22023'; end if;
    perform 1 from public.vocabularies where school_id=p_school_id and id in(select x->>'id' from jsonb_array_elements(p_updates) x) order by id for update;
    if requested_count<>(select count(*) from jsonb_array_elements(p_updates) x join public.vocabularies v on v.id=x->>'id' and v.school_id=p_school_id and v.archived_at is null and v.content_revision=(x->>'expected_revision')::integer) then
        raise exception 'Vocabulary placement changed. Reload the library before recalculating.' using errcode='40001';
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
create function private.publish_class_material_v2(p_class_ids uuid[],p_kind text,p_material_id text,p_release_at timestamptz,p_publication_key uuid,p_expected_revision integer,p_due_at timestamptz default null,p_close_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.vocabularies;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_publication_key::text,0));
 perform 1 from public.schools where id in (select school_id from public.teaching_classes where id=any(p_class_ids)) order by id for share;
 perform 1 from public.teaching_classes where id=any(p_class_ids) order by id for update;
 if p_kind='vocabulary' and not exists(select 1 from public.class_assignments where owner_id=auth.uid() and publication_key=p_publication_key) then
  select * into v from public.vocabularies where id=p_material_id for share;
  if v.id is null or not private.can_edit_school_library(v.school_id) then raise exception 'Vocabulary unavailable.' using errcode='42501'; end if;
  if p_expected_revision is distinct from v.content_revision then raise exception 'The vocabulary changed. Reopen Assign material to review the saved version.' using errcode='40001'; end if;
 end if;
 return private.publish_class_material_v1(p_class_ids,p_kind,p_material_id,p_release_at,p_publication_key,p_due_at,p_close_at);
end; $$;
create function public.publish_class_material_v2(p_class_ids uuid[],p_kind text,p_material_id text,p_release_at timestamptz,p_publication_key uuid,p_expected_revision integer,p_due_at timestamptz default null,p_close_at timestamptz default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.publish_class_material_v2(p_class_ids,p_kind,p_material_id,p_release_at,p_publication_key,p_expected_revision,p_due_at,p_close_at); $$;
revoke all on function private.publish_class_material_v2(uuid[],text,text,timestamptz,uuid,integer,timestamptz,timestamptz),public.publish_class_material_v2(uuid[],text,text,timestamptz,uuid,integer,timestamptz,timestamptz) from public,anon;
grant execute on function private.publish_class_material_v2(uuid[],text,text,timestamptz,uuid,integer,timestamptz,timestamptz),public.publish_class_material_v2(uuid[],text,text,timestamptz,uuid,integer,timestamptz,timestamptz) to authenticated;

create function private.audit_vocabulary_publications_v1(p_school_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_edit_school_library(p_school_id) then raise exception 'School library unavailable.' using errcode='42501'; end if;
 select jsonb_build_object('checkedAt',now(),'assignments',count(*),'exceptions',coalesce(jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',a.title,'classId',a.class_id,'errors',private.vocabulary_publication_errors_v1(m.student_content))) filter(where private.vocabulary_publication_errors_v1(m.student_content)<>'[]'::jsonb),'[]')) into result
 from public.class_assignments a join private.class_material_versions m on m.id=a.version_id
 where a.school_id=p_school_id and a.kind='vocabulary' and not a.withdrawn and (a.close_at is null or a.close_at>now()) and private.can_teach_class(a.class_id);
 return result;
end; $$;
create function public.audit_vocabulary_publications_v1(p_school_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.audit_vocabulary_publications_v1(p_school_id);$$;
revoke all on function private.audit_vocabulary_publications_v1(uuid),public.audit_vocabulary_publications_v1(uuid) from public,anon;
grant execute on function private.audit_vocabulary_publications_v1(uuid),public.audit_vocabulary_publications_v1(uuid) to authenticated;
do $$ declare t record; n bigint; h text; begin
 for t in select * from vocabulary_preservation_receipt loop
 execute format($q$select count(*),md5(coalesce(string_agg(md5((to_jsonb(t)-array['content_version_id','content_revision','vocabulary_placement','library_revision','policy_version','archived_at','import_provenance'])::text),'' order by md5((to_jsonb(t)-array['content_version_id','content_revision','vocabulary_placement','library_revision','policy_version','archived_at','import_provenance'])::text)),'')) from %s t$q$,t.table_name) into n,h;
 if n<>t.row_count or h<>t.digest then raise exception 'Student data preservation failed for %',t.table_name; end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
