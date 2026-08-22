create table if not exists private.student_activity_attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    vocabulary_id text not null references public.vocabularies(id) on delete cascade,
    unit_key text not null,
    activity_type text not null,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists student_activity_attempts_user_started_idx
    on private.student_activity_attempts (user_id, started_at desc);

alter table private.student_activity_attempts enable row level security;
revoke all on table private.student_activity_attempts from public, anon, authenticated;

create or replace function private.required_vocabulary_activities(vocabulary_row public.vocabularies)
returns text[]
language plpgsql
stable
set search_path = public, private, extensions
as $$
declare
    configured jsonb := vocabulary_row.activity_settings -> 'requiredActivities';
    second_activity text;
    required_list text[];
begin
    if jsonb_typeof(configured) = 'array' then
        select coalesce(array_agg(value order by ordinal), '{}'::text[])
        into required_list
        from jsonb_array_elements_text(configured) with ordinality item(value, ordinal)
        where value = any(array[
            'flashcards', 'matching', 'quiz', 'synonym-antonym', 'word-search',
            'crossword', 'hangman', 'scramble', 'wordle', 'speed-match',
            'fill-in-blank', 'illustration'
        ]);
        if array_length(required_list, 1) is not null then
            if not ('flashcards' = any(required_list)) then
                required_list := array_prepend('flashcards', required_list);
            end if;
            return required_list;
        end if;
    end if;

    if lower(vocabulary_row.id || ' ' || vocabulary_row.name) like '%summative%' then
        return array['flashcards', 'illustration'];
    end if;

    second_activity := case mod(greatest(coalesce(vocabulary_row.week, 1), 1) - 1, 10)
        when 0 then 'matching'
        when 1 then 'fill-in-blank'
        when 2 then 'word-search'
        when 3 then 'quiz'
        when 4 then 'speed-match'
        when 5 then 'wordle'
        when 6 then 'crossword'
        when 7 then 'hangman'
        when 8 then 'scramble'
        else 'word-search'
    end;
    return array['flashcards', second_activity];
end;
$$;

revoke all on function private.required_vocabulary_activities(public.vocabularies) from public, anon, authenticated;

create or replace function private.assert_student_activity_access(
    p_user_id uuid,
    p_unit_key text,
    p_vocabulary_id text,
    p_activity_type text
)
returns public.vocabularies
language plpgsql
stable
security definer
set search_path = public, private, extensions
as $$
declare
    vocabulary_row public.vocabularies;
    student_grade integer;
    required_list text[];
    activity_index integer;
    progress_units jsonb;
    prior_activity text;
    prior_score jsonb;
begin
    if not exists (
        select 1 from public.profiles
        where user_id = p_user_id and role = 'student'
    ) then
        raise exception 'Only students can start vocabulary activities.';
    end if;

    select * into vocabulary_row
    from public.vocabularies
    where id = p_vocabulary_id;
    if vocabulary_row.id is null then
        raise exception 'Unknown vocabulary unit.';
    end if;
    if p_unit_key <> vocabulary_row.subject_slug || ':' || vocabulary_row.id then
        raise exception 'The vocabulary unit key does not match the server catalog.';
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
    select coalesce(units, '{}'::jsonb) into progress_units
    from public.student_progress where user_id = p_user_id;
    progress_units := coalesce(progress_units, '{}'::jsonb);

    if activity_index is not null and activity_index > 1 then
        foreach prior_activity in array required_list[1:activity_index - 1] loop
            prior_score := progress_units -> p_unit_key -> 'scores' -> prior_activity;
            if not coalesce((prior_score ->> 'isComplete')::boolean, false)
               or not coalesce((prior_score ->> 'verified')::boolean, false) then
                raise exception 'Complete the required activity % first.', prior_activity;
            end if;
        end loop;
    elsif activity_index is null then
        foreach prior_activity in array required_list loop
            prior_score := progress_units -> p_unit_key -> 'scores' -> prior_activity;
            if not coalesce((prior_score ->> 'isComplete')::boolean, false)
               or not coalesce((prior_score ->> 'verified')::boolean, false) then
                raise exception 'Complete all required activities before optional practice.';
            end if;
        end loop;
    end if;

    return vocabulary_row;
end;
$$;

revoke all on function private.assert_student_activity_access(uuid, text, text, text) from public, anon, authenticated;

create or replace function private.start_student_activity_attempt(
    p_unit_key text,
    p_vocabulary_id text,
    p_activity_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    vocabulary_row public.vocabularies;
    attempt_row private.student_activity_attempts;
    word_count integer;
    minimum_seconds integer;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    vocabulary_row := private.assert_student_activity_access(
        current_user_id, trim(p_unit_key), trim(p_vocabulary_id), trim(p_activity_type)
    );
    if (
        select count(*) from private.student_activity_attempts
        where user_id = current_user_id and started_at >= now() - interval '1 minute'
    ) >= 30 then
        raise exception 'Too many activity attempts. Wait a moment and try again.';
    end if;
    word_count := jsonb_array_length(coalesce(vocabulary_row.words, '[]'::jsonb));
    minimum_seconds := greatest(5, least(60, word_count * 2));
    if p_activity_type = 'speed-match' then minimum_seconds := greatest(15, minimum_seconds); end if;

    insert into private.student_activity_attempts (user_id, vocabulary_id, unit_key, activity_type)
    values (current_user_id, vocabulary_row.id, trim(p_unit_key), trim(p_activity_type))
    returning * into attempt_row;

    delete from private.student_activity_attempts
    where user_id = current_user_id and started_at < now() - interval '7 days';

    return jsonb_build_object(
        'attemptId', attempt_row.id,
        'startedAt', attempt_row.started_at,
        'minimumSeconds', minimum_seconds
    );
end;
$$;

create or replace function public.start_student_activity_attempt(
    p_unit_key text,
    p_vocabulary_id text,
    p_activity_type text
)
returns jsonb
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.start_student_activity_attempt(p_unit_key, p_vocabulary_id, p_activity_type);
$$;

revoke all on function private.start_student_activity_attempt(text, text, text) from public, anon;
grant execute on function private.start_student_activity_attempt(text, text, text) to authenticated;
revoke all on function public.start_student_activity_attempt(text, text, text) from public, anon;
grant execute on function public.start_student_activity_attempt(text, text, text) to authenticated;

alter function private.submit_student_activity_progress(
    text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text
) rename to apply_student_activity_progress_legacy;

revoke all on function private.apply_student_activity_progress_legacy(
    text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text
) from public, anon, authenticated;

create or replace function private.submit_student_activity_progress(
    p_unit_key text,
    p_unit_context jsonb,
    p_activity_type text,
    p_score numeric,
    p_is_complete boolean default false,
    p_details jsonb default '{}'::jsonb,
    p_activity_settings jsonb default '{}'::jsonb,
    p_client_id text default null,
    p_is_required boolean default false,
    p_attempt_id text default null
)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    attempt_row private.student_activity_attempts;
    vocabulary_row public.vocabularies;
    required_list text[];
    server_required boolean;
    minimum_score numeric;
    minimum_seconds integer;
    word_count integer;
    sanitized_score numeric := least(100, greatest(0, coalesce(p_score, 0)));
    sanitized_settings jsonb;
    sanitized_context jsonb;
    progress_row public.student_progress;
    evidence jsonb := case
        when jsonb_typeof(p_details -> 'evidence') = 'object' then p_details -> 'evidence'
        else '{}'::jsonb
    end;
    evidence_correct numeric;
    evidence_total numeric;
    evidence_answered numeric;
    evidence_accuracy numeric;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    if coalesce(p_attempt_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'A server-issued activity attempt is required.';
    end if;

    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id::uuid and user_id = current_user_id
    for update;
    if attempt_row.id is null
       or attempt_row.unit_key <> trim(p_unit_key)
       or attempt_row.activity_type <> trim(p_activity_type) then
        raise exception 'This activity attempt is invalid.';
    end if;
    if attempt_row.started_at < now() - interval '4 hours' then
        raise exception 'This activity attempt expired. Start the activity again.';
    end if;

    vocabulary_row := private.assert_student_activity_access(
        current_user_id, attempt_row.unit_key, attempt_row.vocabulary_id, attempt_row.activity_type
    );
    required_list := private.required_vocabulary_activities(vocabulary_row);
    server_required := attempt_row.activity_type = any(required_list);
    word_count := jsonb_array_length(coalesce(vocabulary_row.words, '[]'::jsonb));
    minimum_seconds := greatest(5, least(60, word_count * 2));
    if attempt_row.activity_type = 'speed-match' then minimum_seconds := greatest(15, minimum_seconds); end if;
    minimum_score := case when attempt_row.activity_type in ('quiz', 'synonym-antonym') then 80 else 100 end;

    if p_is_complete then
        if attempt_row.completed_at is not null then
            raise exception 'This activity attempt was already completed.';
        end if;
        if sanitized_score < minimum_score then
            raise exception 'The mastery score for this activity was not reached.';
        end if;
        if now() < attempt_row.started_at + make_interval(secs => minimum_seconds) then
            raise exception 'The activity was completed too quickly to verify.';
        end if;

        begin
            evidence_correct := coalesce((evidence ->> 'correctCount')::numeric, 0);
            evidence_total := coalesce((evidence ->> 'totalCount')::numeric, 0);
            evidence_answered := coalesce((evidence ->> 'answeredCount')::numeric, evidence_total);
            evidence_accuracy := coalesce((evidence ->> 'accuracy')::numeric, 0);
        exception when invalid_text_representation then
            raise exception 'Activity evidence is invalid.';
        end;

        if evidence_total < least(4, word_count) then
            raise exception 'Not enough activity items were completed.';
        end if;
        if attempt_row.activity_type in ('quiz', 'synonym-antonym') then
            if evidence_answered <> evidence_total
               or evidence_accuracy < 80
               or evidence_correct < ceil(evidence_total * 0.8) then
                raise exception 'Quiz mastery evidence is incomplete.';
            end if;
        elsif attempt_row.activity_type = 'speed-match' then
            if evidence_correct < 10 then
                raise exception 'Match at least 10 correct words to complete Speed Match.';
            end if;
        elsif attempt_row.activity_type = 'matching' then
            if coalesce((evidence ->> 'completedRounds')::integer, 0)
               < coalesce((evidence ->> 'targetRounds')::integer, 1)
               or evidence_correct < evidence_total then
                raise exception 'Matching activity evidence is incomplete.';
            end if;
        elsif evidence_correct < evidence_total then
            raise exception 'All required activity items must be completed correctly.';
        end if;
    else
        sanitized_score := least(sanitized_score, 99);
    end if;

    sanitized_settings := jsonb_build_object(
        'progressReward', least(10, greatest(0, floor(private.jsonb_number(vocabulary_row.activity_settings, 'progressReward', 1)))),
        'completionBonus', least(200, greatest(0, floor(private.jsonb_number(vocabulary_row.activity_settings, 'completionBonus', 50))))
    );
    sanitized_context := jsonb_build_object(
        'unitId', vocabulary_row.id,
        'unitName', vocabulary_row.name,
        'subjectSlug', vocabulary_row.subject_slug,
        'trimester', coalesce(vocabulary_row.trimester, ''),
        'grade', (select grade_level::text from public.profiles where user_id = current_user_id)
    );

    progress_row := private.apply_student_activity_progress_legacy(
        attempt_row.unit_key, sanitized_context, attempt_row.activity_type,
        sanitized_score, p_is_complete, p_details, sanitized_settings,
        p_client_id, server_required, attempt_row.id::text
    );

    if p_is_complete then
        update private.student_activity_attempts set completed_at = now() where id = attempt_row.id;
        update public.student_progress
        set units = jsonb_set(
            units,
            array[attempt_row.unit_key, 'scores', attempt_row.activity_type, 'verified'],
            'true'::jsonb,
            true
        )
        where user_id = current_user_id
        returning * into progress_row;
    end if;
    return progress_row;
end;
$$;

create or replace function public.submit_student_activity_progress(
    p_unit_key text,
    p_unit_context jsonb,
    p_activity_type text,
    p_score numeric,
    p_is_complete boolean default false,
    p_details jsonb default '{}'::jsonb,
    p_activity_settings jsonb default '{}'::jsonb,
    p_client_id text default null,
    p_is_required boolean default false,
    p_attempt_id text default null
)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.submit_student_activity_progress(
        p_unit_key, p_unit_context, p_activity_type, p_score, p_is_complete,
        p_details, p_activity_settings, p_client_id, p_is_required, p_attempt_id
    );
$$;

revoke all on function private.submit_student_activity_progress(
    text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text
) from public, anon;
grant execute on function private.submit_student_activity_progress(
    text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text
) to authenticated;
revoke all on function public.submit_student_activity_progress(
    text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text
) from public, anon;
grant execute on function public.submit_student_activity_progress(
    text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text
) to authenticated;

do $$
declare
    progress_record record;
    unit_record record;
    score_record record;
    next_scores jsonb;
    next_units jsonb;
begin
    for progress_record in select user_id, units from public.student_progress loop
        next_units := coalesce(progress_record.units, '{}'::jsonb);
        for unit_record in select * from jsonb_each(coalesce(progress_record.units, '{}'::jsonb)) loop
            next_scores := coalesce(unit_record.value -> 'scores', '{}'::jsonb);
            for score_record in select * from jsonb_each(next_scores) loop
                if coalesce((score_record.value ->> 'isComplete')::boolean, false)
                   or coalesce((score_record.value ->> 'score')::numeric, 0) >= 100 then
                    next_scores := jsonb_set(next_scores, array[score_record.key, 'verified'], 'true'::jsonb, true);
                end if;
            end loop;
            next_units := jsonb_set(next_units, array[unit_record.key, 'scores'], next_scores, true);
        end loop;
        update public.student_progress set units = next_units where user_id = progress_record.user_id;
    end loop;
end;
$$;
