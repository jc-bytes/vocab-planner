begin;
alter table public.class_assignment_responses add column answers jsonb;
alter table public.class_assignment_responses add column evaluation jsonb;
-- A later plain-text edit must never retain a previous automatic check result.
create function private.clear_class_response_check() returns trigger language plpgsql set search_path='' as $$
begin new.answers:=null; new.evaluation:=null; return new; end; $$;
revoke all on function private.clear_class_response_check() from public,anon,authenticated;
create trigger clear_class_response_check before update of response on public.class_assignment_responses
for each row when(old.response is distinct from new.response) execute function private.clear_class_response_check();

create function private.check_class_spark_v1(p_assignment_id uuid,p_answers jsonb,p_expected_revision integer)
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
create function public.check_class_spark_v1(p_assignment_id uuid,p_answers jsonb,p_expected_revision integer)
returns jsonb language sql security invoker set search_path='' as $$ select private.check_class_spark_v1(p_assignment_id,p_answers,p_expected_revision); $$;
revoke all on function public.check_class_spark_v1(uuid,jsonb,integer),private.check_class_spark_v1(uuid,jsonb,integer) from public,anon;
grant execute on function public.check_class_spark_v1(uuid,jsonb,integer),private.check_class_spark_v1(uuid,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
