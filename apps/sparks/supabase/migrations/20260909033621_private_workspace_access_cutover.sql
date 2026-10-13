-- Requires the matching application and Edge Functions release. Unknown owners stay quarantined.
begin;
create function private.owns_student_membership(p_student_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_teacher() and exists(select 1 from public.class_memberships m join public.teaching_classes c on c.id=m.class_id
 where m.student_id=p_student_id and m.active and c.owner_id=auth.uid());
$$;
create function private.can_read_student_assignment(p_assignment_id uuid,p_student_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_assignments a where a.id=p_assignment_id and
 ((a.owner_id=auth.uid() and private.is_teacher()) or (p_student_id=auth.uid() and private.can_read_class_assignment(a.id))));
$$;
revoke all on function private.owns_student_membership(uuid), private.can_read_student_assignment(uuid,uuid) from public,anon;
grant execute on function private.owns_student_membership(uuid), private.can_read_student_assignment(uuid,uuid) to authenticated;
create table public.teacher_settings (
 owner_id uuid not null default auth.uid() references public.profiles(user_id),
 key text not null check(length(key) between 1 and 200), value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(), primary key(owner_id,key)
);
alter table public.teacher_settings enable row level security;
revoke all on public.teacher_settings from public,anon,authenticated;
grant select,insert,update,delete on public.teacher_settings to authenticated;
create policy teacher_settings_owned on public.teacher_settings to authenticated
 using(owner_id=(select auth.uid()) and (select private.is_teacher())) with check(owner_id=(select auth.uid()) and (select private.is_teacher()));

alter table public.teacher_subjects add column color text not null default '#2563eb' check(color ~ '^#[0-9a-fA-F]{6}$');
alter table public.teacher_subjects add column sort_order integer not null default 0;
grant update(color,sort_order) on public.teacher_subjects to authenticated;
-- Existing owned materials acquire an owned subject. Null owners are not inferred.
create function private.prepare_owned_material() returns trigger language plpgsql security definer set search_path='' as $$
declare subject_key uuid; subject_name text;
begin
 if auth.uid() is not null then
   if not private.is_teacher() then raise exception 'Teacher access required.' using errcode='42501'; end if;
   if tg_op='INSERT' and new.owner_id is null then new.owner_id:=auth.uid(); end if;
   if new.owner_id is distinct from auth.uid() or (tg_op='UPDATE' and old.owner_id is distinct from new.owner_id) then
     raise exception 'Material belongs to another workspace.' using errcode='42501'; end if;
 end if;
 if new.owner_id is null then return new; end if;
 if new.teacher_subject_id is null then
   select name into subject_name from public.subjects where slug=new.subject_slug;
   subject_name:=coalesce(subject_name,'Technology');
   perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text || subject_name,0));
   select id into subject_key from public.teacher_subjects where owner_id=new.owner_id and lower(name)=lower(subject_name) order by created_at limit 1;
   if subject_key is null then
     insert into public.teacher_subjects(owner_id,name) values(new.owner_id,subject_name) returning id into subject_key;
   end if;
   new.teacher_subject_id:=subject_key;
 end if;
 if not exists(select 1 from public.teacher_subjects where id=new.teacher_subject_id and owner_id=new.owner_id) then
   raise exception 'Subject belongs to another workspace.' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function private.prepare_owned_material() from public,anon,authenticated;
alter table public.vocabularies add column teacher_subject_id uuid;
alter table public.vocabularies add foreign key(teacher_subject_id,owner_id) references public.teacher_subjects(id,owner_id);
create index on public.vocabularies(teacher_subject_id,owner_id);
create trigger prepare_owned_material before insert or update on public.vocabularies for each row execute function private.prepare_owned_material();
update public.vocabularies set teacher_subject_id=null where owner_id in (select user_id from public.profiles where role='teacher');
alter table public.weekly_sparks add column teacher_subject_id uuid;
alter table public.weekly_sparks add foreign key(teacher_subject_id,owner_id) references public.teacher_subjects(id,owner_id);
create index on public.weekly_sparks(teacher_subject_id,owner_id);
create trigger prepare_owned_material before insert or update on public.weekly_sparks for each row execute function private.prepare_owned_material();
update public.weekly_sparks set teacher_subject_id=null where owner_id in (select user_id from public.profiles where role='teacher');
alter table public.classroom_activities add column teacher_subject_id uuid;
alter table public.classroom_activities add foreign key(teacher_subject_id,owner_id) references public.teacher_subjects(id,owner_id);
create index on public.classroom_activities(teacher_subject_id,owner_id);
create trigger prepare_owned_material before insert or update on public.classroom_activities for each row execute function private.prepare_owned_material();
update public.classroom_activities set teacher_subject_id=null where owner_id in (select user_id from public.profiles where role='teacher');
do $$ declare r record; begin for r in select * from pg_policies where schemaname='public' and tablename=any(array['vocabularies','weekly_sparks','classroom_activities','classroom_activity_assignments','classroom_activity_submissions','app_settings','subjects','profiles','teacher_allowlist','export_logs','scores','student_activity_progress','student_activity_state','student_unit_progress','student_arcade_time','student_arcade_time_ledger','student_coin_ledger','student_progress_summary','student_spark_responses','student_xp_events']) loop execute format('drop policy %I on public.%I',r.policyname,r.tablename); end loop; end $$;
create policy vocabularies_owned on public.vocabularies to authenticated using(owner_id=(select auth.uid()) and (select private.is_teacher())) with check(owner_id=(select auth.uid()) and (select private.is_teacher()));
create policy weekly_sparks_owned on public.weekly_sparks to authenticated using(owner_id=(select auth.uid()) and (select private.is_teacher())) with check(owner_id=(select auth.uid()) and (select private.is_teacher()));
create policy classroom_activities_owned on public.classroom_activities to authenticated using(owner_id=(select auth.uid()) and (select private.is_teacher())) with check(owner_id=(select auth.uid()) and (select private.is_teacher()));
-- Older grade-based classroom assignment APIs are retired; historical rows are retained for migration.
revoke all on public.classroom_activity_assignments, public.classroom_activity_submissions, public.app_settings,public.subjects from anon,authenticated;
create policy profiles_read_self on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy allowlist_read_self on public.teacher_allowlist for select to authenticated using(lower(email::text)=lower((select auth.jwt()->>'email')));
create policy export_logs_owned on public.export_logs to authenticated using(teacher_id=(select auth.uid()) and (select private.is_teacher())) with check(teacher_id=(select auth.uid()) and (select private.is_teacher()));
create policy scores_read_self on public.scores for select to authenticated using(user_id=(select auth.uid()));
create policy student_activity_progress_assignment_read on public.student_activity_progress for select to authenticated using(private.can_read_student_assignment(assignment_id,user_id));
create policy student_activity_state_assignment_read on public.student_activity_state for select to authenticated using(private.can_read_student_assignment(assignment_id,user_id));
create policy student_unit_progress_assignment_read on public.student_unit_progress for select to authenticated using(private.can_read_student_assignment(assignment_id,user_id));
create policy student_arcade_time_self on public.student_arcade_time for select to authenticated using(user_id=(select auth.uid()));
create policy student_arcade_time_ledger_self on public.student_arcade_time_ledger for select to authenticated using(user_id=(select auth.uid()));
create policy student_coin_ledger_self on public.student_coin_ledger for select to authenticated using(user_id=(select auth.uid()));
create policy student_progress_summary_self on public.student_progress_summary for select to authenticated using(user_id=(select auth.uid()));
create policy student_spark_responses_self on public.student_spark_responses for select to authenticated using(user_id=(select auth.uid()));
create policy student_xp_events_self on public.student_xp_events for select to authenticated using(user_id=(select auth.uid()));
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
    perform private.assert_assignment_work_access(p_unit_key);
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
    perform private.assert_assignment_work_access(p_unit_key);
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

CREATE OR REPLACE FUNCTION private.get_student_progress_v3(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    if auth.uid() is null then raise exception 'You must be signed in.'; end if;
    if auth.uid() <> p_user_id and not private.owns_student_membership(p_user_id) then
        raise exception 'You are not allowed to read this student progress.';
    end if;
    return private.student_progress_snapshot_v2(p_user_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_students_progress_by_ids_v1(p_user_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    requested_ids uuid[] := coalesce(p_user_ids, '{}'::uuid[]);
    result_data jsonb;
begin
    if not private.is_teacher() then
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
    from public.profiles profile
    cross join lateral (
        select private.student_progress_snapshot_v2(profile.user_id) as value
    ) snapshot
    where profile.role = 'student' and private.owns_student_membership(profile.user_id)
      and profile.user_id = any(requested_ids)
      and snapshot.value is not null;

    return result_data;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_students_progress_v3()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.is_teacher() then raise exception 'Only teachers can list student progress.'; end if;
    select coalesce(jsonb_agg(private.student_progress_snapshot_v2(profile.user_id)
        order by profile.grade_level, profile.section_letter, profile.last_name), '[]'::jsonb)
    into result_data
    from public.profiles profile
    where profile.role = 'student' and private.owns_student_membership(profile.user_id);
    return result_data;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_teacher_dashboard_analytics_v1(p_grade integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.is_teacher() then
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
        from public.profiles profile
        left join lateral (
            select coalesce(sum(p.total_earned),0)::bigint as coins, 0::bigint as total_xp,
              '{}'::jsonb as coin_data, 0::bigint as version, min(p.updated_at) as created_at, max(p.updated_at) as updated_at
            from public.student_activity_progress p where p.user_id=profile.user_id
              and private.can_read_student_assignment(p.assignment_id,p.user_id)
          ) summary on true
        where profile.role = 'student' and private.owns_student_membership(profile.user_id)
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
        and private.can_read_student_assignment(activity.assignment_id,activity.user_id)
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
        and private.can_read_student_assignment(activity.assignment_id,activity.user_id)
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
                from public.profiles profile
                where profile.role = 'student' and private.owns_student_membership(profile.user_id) and profile.grade_level is not null
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

CREATE OR REPLACE FUNCTION private.list_student_identity_roster_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.is_teacher() then
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
    from public.profiles profile
    where profile.role = 'student' and private.owns_student_membership(profile.user_id);

    return result_data;
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_student_progress_summaries_v1(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_grade integer DEFAULT NULL::integer, p_section text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
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
    if not private.is_teacher() then
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
        from public.profiles profile
        left join lateral (
            select coalesce(sum(p.total_earned),0)::bigint as coins, 0::bigint as total_xp,
              '{}'::jsonb as coin_data, 0::bigint as version, min(p.updated_at) as created_at, max(p.updated_at) as updated_at
            from public.student_activity_progress p where p.user_id=profile.user_id
              and private.can_read_student_assignment(p.assignment_id,p.user_id)
          ) summary on true
        where profile.role = 'student' and private.owns_student_membership(profile.user_id)
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

CREATE OR REPLACE FUNCTION private.list_student_roster_filters_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.is_teacher() then
        raise exception 'Only teachers can list roster filters.';
    end if;

    select jsonb_build_object(
        'grades', coalesce((
            select jsonb_agg(grades.grade order by grades.grade)
            from (
                select distinct profile.grade_level as grade
                from public.profiles profile
                where profile.role = 'student' and private.owns_student_membership(profile.user_id) and profile.grade_level is not null
            ) grades
        ), '[]'::jsonb),
        'classes', coalesce((
            select jsonb_agg(jsonb_build_object(
                'grade', classes.grade_level::text,
                'section', classes.section_letter
            ) order by classes.grade_level, classes.section_letter)
            from (
                select distinct profile.grade_level, profile.section_letter
                from public.profiles profile
                where profile.role = 'student' and private.owns_student_membership(profile.user_id)
                  and profile.grade_level is not null
                  and profile.section_letter is not null
            ) classes
        ), '[]'::jsonb)
    ) into result_data;

    return result_data;
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_word_hunt_reviews_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.is_teacher() then
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
        where private.can_read_student_assignment(unit.assignment_id,unit.user_id) and jsonb_typeof(unit.work_data -> 'wordHunt') = 'object'
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
        from public.profiles profile
        join word_hunt_units unit on unit.user_id = profile.user_id
        where profile.role = 'student' and private.owns_student_membership(profile.user_id)
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

CREATE OR REPLACE FUNCTION private.update_vocabulary_placements_v1(p_updates jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    requested_count integer;
    updated_count integer;
begin
    if not private.is_teacher() then
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
    where vocabulary.id = patch.id and vocabulary.owner_id=auth.uid();

    get diagnostics updated_count = row_count;
    return jsonb_build_object(
        'requested', requested_count,
        'updated', updated_count
    );
end;
$function$;

CREATE OR REPLACE FUNCTION private.student_progress_snapshot_v2(p_user_id uuid)
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
        where progress.user_id = p_user_id and private.can_read_student_assignment(progress.assignment_id,progress.user_id)
        group by progress.user_id, progress.unit_key
    ), state_groups as (
        select state.user_id, state.unit_key,
            jsonb_object_agg(state.activity_type, state.state_data order by state.activity_type) as states
        from public.student_activity_state state
        where state.user_id = p_user_id and private.can_read_student_assignment(state.assignment_id,state.user_id)
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
        where unit.user_id = p_user_id and private.can_read_student_assignment(unit.assignment_id,unit.user_id)
    )
    select (jsonb_build_object(
        'userId', summary.user_id,
        'studentProfile', private.student_profile_json(summary.user_id),
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
    ) - case when auth.uid()=p_user_id then array[]::text[] else array['coins','coinData','coinHistory','totalXp','version','updatedAt'] end)
    from public.student_progress_summary summary
    cross join unit_snapshot
    where summary.user_id = p_user_id and (auth.uid()=p_user_id or private.owns_student_membership(p_user_id));
$function$;

CREATE OR REPLACE FUNCTION private.set_student_activity_late_override_v1(p_attempt_id uuid, p_excused boolean, p_reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    attempt_row private.student_activity_attempts;
    cleaned_reason text := left(trim(coalesce(p_reason, '')), 500);
begin
    if auth.uid() is null or not private.is_teacher(auth.uid()) then
        raise exception 'Teacher access is required.' using errcode = '42501';
    end if;
    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id
    for update;
    if not exists(select 1 from public.class_assignments where id=attempt_row.assignment_id and owner_id=auth.uid()) then raise exception 'Assignment unavailable.' using errcode='42501'; end if;
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

do $$ declare r record; begin for r in select oid::regprocedure as signature from pg_proc
 where pronamespace in ('public'::regnamespace,'private'::regnamespace) and proname in
 ('submit_student_activity_progress_v2','submit_student_spark_response','submit_student_spark_response_owned_v1','gift_student_coins_v2')
 loop execute format('revoke execute on function %s from public,anon,authenticated',r.signature); end loop; end $$;
CREATE OR REPLACE FUNCTION public.list_vocabulary_metadata_v1()
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
    from public.vocabularies vocabulary;
$function$;

notify pgrst,'reload schema';
commit;
