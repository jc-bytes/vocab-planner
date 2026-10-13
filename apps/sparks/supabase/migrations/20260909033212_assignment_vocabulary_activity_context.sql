begin;
-- Class/assignment locks serialize writes with enrollment removal and withdrawal.
create function private.assert_assignment_work_access(p_unit_key text)
returns public.class_assignments language plpgsql security definer set search_path='' as $$
declare a public.class_assignments; class_key uuid; assignment_key uuid;
begin
    if p_unit_key !~ '^assignment:[0-9a-f-]{36}$' then raise exception 'Open this work from My classes.' using errcode='42501'; end if;
    assignment_key := substring(p_unit_key from 12)::uuid;
    select class_id into class_key from public.class_assignments where id=assignment_key;
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
revoke all on function private.assert_assignment_work_access(text) from public,anon,authenticated;

-- Explicit foreign keys keep attempts, progress and state attached to assignments.
alter table public.student_unit_progress add column assignment_id uuid references public.class_assignments(id);
create index on public.student_unit_progress(assignment_id);
alter table public.student_activity_progress add column assignment_id uuid references public.class_assignments(id);
create index on public.student_activity_progress(assignment_id);
alter table public.student_activity_state add column assignment_id uuid references public.class_assignments(id);
create index on public.student_activity_state(assignment_id);
alter table private.student_activity_attempts add column assignment_id uuid references public.class_assignments(id);
create index on private.student_activity_attempts(assignment_id);
create function private.attach_activity_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
    if new.unit_key like 'assignment:%' then
        new.assignment_id := substring(new.unit_key from 12)::uuid;
    elsif new.assignment_id is not null then
        raise exception 'Assignment context does not match the unit key.';
    end if;
    if tg_op='UPDATE' and (new.assignment_id is distinct from old.assignment_id or new.unit_key<>old.unit_key or new.user_id<>old.user_id) then
        raise exception 'Work cannot be moved to another assignment or student.';
    end if;
    return new;
end;
$$;
revoke all on function private.attach_activity_assignment() from public,anon,authenticated;
create trigger attach_activity_assignment before insert or update on public.student_unit_progress for each row execute function private.attach_activity_assignment();
create trigger attach_activity_assignment before insert or update on public.student_activity_progress for each row execute function private.attach_activity_assignment();
create trigger attach_activity_assignment before insert or update on public.student_activity_state for each row execute function private.attach_activity_assignment();
create trigger attach_activity_assignment before insert or update on private.student_activity_attempts for each row execute function private.attach_activity_assignment();
CREATE OR REPLACE FUNCTION private.assert_student_activity_access(p_user_id uuid, p_unit_key text, p_vocabulary_id text, p_activity_type text)
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
    if not exists (
        select 1 from public.profiles
        where user_id = p_user_id and role = 'student'
    ) then
        raise exception 'Only students can start vocabulary activities.';
    end if;

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
        select * into vocabulary_row from public.vocabularies where id = p_vocabulary_id;
        if vocabulary_row.id is null then raise exception 'Unknown vocabulary unit.'; end if;
        if p_unit_key <> vocabulary_row.subject_slug || ':' || vocabulary_row.id then
            raise exception 'The vocabulary unit key does not match the server catalog.';
        end if;
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

CREATE OR REPLACE FUNCTION private.report_student_activity_time_v1(p_attempt_id uuid, p_active_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    current_user_id uuid := auth.uid();
    attempt_row private.student_activity_attempts;
    maximum_possible_seconds integer;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    if p_attempt_id is null or p_active_seconds is null or p_active_seconds < 0 then
        raise exception 'Active time is invalid.';
    end if;

    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id and user_id = current_user_id
    for update;
    if attempt_row.id is null then raise exception 'This activity attempt is invalid.'; end if;
    if attempt_row.unit_key like 'assignment:%' then perform private.assert_assignment_work_access(attempt_row.unit_key); end if;
    if attempt_row.finished_at is not null then
        return private.student_activity_attempt_json(attempt_row);
    end if;

    maximum_possible_seconds := least(
        43200,
        greatest(0, floor(extract(epoch from (now() - attempt_row.started_at)))::integer + 5)
    );
    if p_active_seconds > maximum_possible_seconds then
        raise exception 'Active time exceeds the possible activity duration.';
    end if;

    update private.student_activity_attempts
    set active_seconds = greatest(active_seconds, p_active_seconds),
        late_at = case
            when late_at is not null then late_at
            when time_limit_seconds is not null
             and greatest(active_seconds, p_active_seconds) > time_limit_seconds then now()
            else null
        end
    where id = attempt_row.id
    returning * into attempt_row;

    return private.student_activity_attempt_json(attempt_row);
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_student_activity_progress_v3(p_event_id text, p_unit_key text, p_unit_context jsonb, p_activity_type text, p_score numeric, p_is_complete boolean DEFAULT false, p_is_finished boolean DEFAULT false, p_details jsonb DEFAULT '{}'::jsonb, p_metrics jsonb DEFAULT '{}'::jsonb, p_state_snapshot jsonb DEFAULT NULL::jsonb, p_activity_settings jsonb DEFAULT '{}'::jsonb, p_client_id text DEFAULT NULL::text, p_is_required boolean DEFAULT false, p_attempt_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    sanitized_details jsonb := coalesce(p_details, '{}'::jsonb);
    evidence jsonb := case
        when jsonb_typeof(sanitized_details -> 'evidence') = 'object'
            then sanitized_details -> 'evidence'
        else '{}'::jsonb
    end;
    correct_count integer;
    attempted_count integer;
    valid_accuracy_counts boolean := false;
begin
    if p_unit_key like 'assignment:%' then perform private.assert_assignment_work_access(p_unit_key); end if;
    if trim(coalesce(p_activity_type, '')) in (
        'quiz', 'synonym-antonym', 'flashcards', 'matching', 'scramble', 'wordle'
    ) then
        begin
            if p_activity_type in ('quiz', 'synonym-antonym') then
                correct_count := nullif(evidence ->> 'correctCount', '')::integer;
                attempted_count := nullif(evidence ->> 'answeredCount', '')::integer;
            elsif p_activity_type = 'flashcards' then
                correct_count := nullif(evidence ->> 'firstAttemptCorrectCount', '')::integer;
                attempted_count := nullif(evidence ->> 'attemptedCount', '')::integer;
            elsif p_activity_type in ('matching', 'scramble') then
                correct_count := nullif(evidence ->> 'correctCount', '')::integer;
                attempted_count := nullif(evidence ->> 'attemptedCount', '')::integer;
            elsif p_activity_type = 'wordle' then
                correct_count := nullif(evidence ->> 'correctCount', '')::integer;
                attempted_count := correct_count
                    + coalesce(nullif(evidence ->> 'failedCount', '')::integer, 0);
            end if;
            valid_accuracy_counts := correct_count is not null
                and attempted_count is not null
                and correct_count >= 0
                and attempted_count > 0
                and correct_count <= attempted_count;
        exception when invalid_text_representation or numeric_value_out_of_range then
            valid_accuracy_counts := false;
        end;

        if not valid_accuracy_counts then
            if p_activity_type = 'flashcards' then
                evidence := evidence - 'firstAttemptCorrectCount' - 'attemptedCount';
            elsif not coalesce(p_is_complete, false) and not coalesce(p_is_finished, false) then
                evidence := case
                    when p_activity_type in ('quiz', 'synonym-antonym')
                        then evidence - 'correctCount' - 'answeredCount'
                    when p_activity_type in ('matching', 'scramble')
                        then evidence - 'correctCount' - 'attemptedCount'
                    when p_activity_type = 'wordle'
                        then evidence - 'correctCount' - 'failedCount'
                    else evidence
                end;
            end if;
            sanitized_details := jsonb_set(sanitized_details, '{evidence}', evidence, true);
        end if;
    end if;

    return private.submit_student_activity_progress_v3_strict_legacy(
        p_event_id, p_unit_key, p_unit_context, p_activity_type, p_score,
        p_is_complete, p_is_finished, sanitized_details, p_metrics,
        p_state_snapshot, p_activity_settings, p_client_id, p_is_required,
        p_attempt_id
    );
end;
$function$;

CREATE OR REPLACE FUNCTION private.sync_student_unit_work_v2(p_event_id text, p_unit_key text, p_unit_context jsonb, p_work_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    v_unit_key text := left(trim(coalesce(p_unit_key, '')), 200);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
begin
    if p_unit_key like 'assignment:%' then perform private.assert_assignment_work_access(p_unit_key); end if;
    if current_user_id is null then raise exception 'You must be signed in to sync work.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    request_data := jsonb_build_object(
        'unitKey', v_unit_key,
        'unitContext', coalesce(p_unit_context, '{}'::jsonb),
        'workPatch', coalesce(p_work_patch, '{}'::jsonb)
    );
    request_hash := private.student_progress_event_hash('unit-work-v2', request_data);
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'unit-work-v2', request_hash
    );
    if cached_response is not null then return cached_response; end if;

    perform private.ensure_student_progress_summary_v3(current_user_id);
    perform private.upsert_student_unit_work_v3(
        current_user_id, v_unit_key, p_unit_context, p_work_patch
    );
    update public.student_progress_summary
    set version = version + 1, updated_at = now()
    where user_id = current_user_id;

    response_data := private.student_unit_delta_v3(current_user_id, v_unit_key);
    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'unit-work-v2', request_hash, response_data
    );
end;
$function$;

CREATE OR REPLACE FUNCTION private.publish_class_material_v1(p_class_ids uuid[], p_kind text, p_material_id text, p_release_at timestamp with time zone, p_publication_key uuid, p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_close_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    version_id uuid; content jsonb; answer_key jsonb := '{}'::jsonb;
    material_title text; owned_id text; result jsonb; existing_count integer;
begin
    if not private.is_teacher() then raise exception 'Teacher access required.' using errcode = '42501'; end if;
    if p_publication_key is null or p_release_at is null or coalesce(cardinality(p_class_ids),0) not between 1 and 50
       or exists(select 1 from unnest(p_class_ids) id where id is null)
       or cardinality(p_class_ids) <> (select count(distinct id) from unnest(p_class_ids) id) then
        raise exception 'Choose distinct classes, a release date and a publication key.';
    end if;
    if p_kind is null or p_kind not in ('vocabulary','spark') then raise exception 'Unsupported material type.'; end if;
    if p_material_id is null or length(trim(p_material_id)) = 0 then raise exception 'Choose a material.'; end if;
    -- Stable lock serializes retried requests with the same teacher/key.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_publication_key::text, 0));
    perform 1 from public.teaching_classes where id = any(p_class_ids) order by id for update;
    if (select count(*) from public.teaching_classes where id = any(p_class_ids)
        and owner_id = auth.uid() and not archived) <> cardinality(p_class_ids) then
        raise exception 'One or more classes are unavailable.' using errcode = '42501';
    end if;
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
            where v.id=p_material_id and v.owner_id=auth.uid() for share;
        else
            select s.id,s.title,jsonb_build_object('kind','spark','title',s.title,'sparkText',s.spark_text,
                'whyItMatters',s.why_it_matters,'question',s.question,'gradeQuestions',s.grade_questions,
                'sourceTitle',s.source_title,'sourceUrl',s.source_url,'checkMode',s.check_mode,
                'questions',coalesce((select jsonb_agg(q - 'correctOption') from jsonb_array_elements(s.questions) q),'[]'::jsonb)),
                jsonb_build_object('questions',s.questions)
            into owned_id,material_title,content,answer_key from public.weekly_sparks s
            where s.id=p_material_id and s.owner_id=auth.uid() for share;
        end if;
        if owned_id is null then raise exception 'Material unavailable. Only owned materials can be assigned.' using errcode='42501'; end if;
        insert into private.class_material_versions(owner_id,vocabulary_id,spark_id,student_content,assessment_key)
        values(auth.uid(),case when p_kind='vocabulary' then owned_id end,case when p_kind='spark' then owned_id end,content,answer_key)
        returning id into version_id;
        insert into public.class_assignments(owner_id,class_id,version_id,title,kind,release_at,due_at,close_at,publication_key)
        select auth.uid(),id,version_id,material_title,p_kind,p_release_at,p_due_at,p_close_at,p_publication_key from unnest(p_class_ids) id;
    end if;
    select jsonb_agg(to_jsonb(a) order by a.class_id) into result from public.class_assignments a
      where a.owner_id=auth.uid() and a.publication_key=p_publication_key;
    return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_class_assignment_v1(p_assignment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
    if not private.can_read_class_assignment(p_assignment_id) then raise exception 'Assignment unavailable.' using errcode='42501'; end if;
    select to_jsonb(a) || jsonb_build_object('content',v.student_content,'materialId',coalesce(v.vocabulary_id,v.spark_id),'className',c.name,'subjectName',s.name)
    into result from public.class_assignments a join private.class_material_versions v on v.id=a.version_id
    join public.teaching_classes c on c.id=a.class_id join public.teacher_subjects s on s.id=c.subject_id
    where a.id=p_assignment_id;
    return result;
end;
$function$;

notify pgrst,'reload schema';
commit;
