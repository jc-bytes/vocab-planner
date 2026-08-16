create table if not exists public.student_spark_responses (
    user_id uuid not null references auth.users(id) on delete cascade,
    spark_id text not null references public.weekly_sparks(id) on update cascade on delete restrict,
    answers jsonb not null default '{}'::jsonb,
    question_snapshot jsonb not null default '[]'::jsonb,
    evaluation jsonb not null default '{}'::jsonb,
    is_complete boolean not null default false,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, spark_id),
    constraint student_spark_responses_answers_object
        check (jsonb_typeof(answers) = 'object'),
    constraint student_spark_responses_questions_array
        check (jsonb_typeof(question_snapshot) = 'array'),
    constraint student_spark_responses_evaluation_object
        check (jsonb_typeof(evaluation) = 'object'),
    constraint student_spark_responses_answers_size
        check (octet_length(answers::text) <= 16384),
    constraint student_spark_responses_questions_size
        check (octet_length(question_snapshot::text) <= 32768),
    constraint student_spark_responses_evaluation_size
        check (octet_length(evaluation::text) <= 16384),
    constraint student_spark_responses_completion_timestamp
        check (is_complete = (completed_at is not null))
);

drop trigger if exists set_student_spark_responses_updated_at
on public.student_spark_responses;
create trigger set_student_spark_responses_updated_at
before update on public.student_spark_responses
for each row execute function public.set_updated_at();

-- The primary key starts with user_id. This separate index supports teacher
-- review by Spark and makes the spark_id foreign key efficient on deletes.
create index if not exists student_spark_responses_spark_updated_idx
    on public.student_spark_responses (spark_id, updated_at desc);

alter table public.student_spark_responses enable row level security;

drop policy if exists "student_spark_responses_select_self_or_teacher"
on public.student_spark_responses;
create policy "student_spark_responses_select_self_or_teacher"
on public.student_spark_responses
for select
to authenticated
using (
    (select auth.uid()) = user_id
    or (select private.is_teacher())
);

revoke all on public.student_spark_responses from public, anon, authenticated;
grant select on public.student_spark_responses to authenticated;
grant all on public.student_spark_responses to service_role;

create or replace function private.submit_student_spark_response(
    p_spark_id text,
    p_answers jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    student_grade integer;
    spark_row public.weekly_sparks;
    source_question jsonb;
    question_row jsonb;
    question_snapshot jsonb := '[]'::jsonb;
    normalized_answers jsonb := '{}'::jsonb;
    result_rows jsonb := '[]'::jsonb;
    seen_ids text[] := '{}'::text[];
    question_id text;
    question_type text;
    question_prompt text;
    question_options jsonb;
    question_index integer := 0;
    selected_option integer;
    correct_option integer;
    short_answer text;
    answered boolean;
    correct boolean;
    total_count integer := 0;
    answered_count integer := 0;
    correct_count integer := 0;
    response_complete boolean := false;
    saved_row public.student_spark_responses;
begin
    if current_user_id is null then
        raise exception 'You must be signed in.';
    end if;
    if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
        raise exception 'Spark answers must be an object.';
    end if;
    if octet_length(coalesce(p_answers, '{}'::jsonb)::text) > 16384 then
        raise exception 'Spark answers are too large.';
    end if;

    select profile.grade_level
    into student_grade
    from public.profiles profile
    where profile.user_id = current_user_id
      and profile.role = 'student';

    if student_grade is null then
        raise exception 'Only students can submit Spark responses.';
    end if;

    select spark.*
    into spark_row
    from public.weekly_sparks spark
    where spark.id = trim(coalesce(p_spark_id, ''))
      and spark.status = 'scheduled'
      and spark.scheduled_date <= ((now() at time zone 'America/Panama')::date)
      and (
          coalesce(array_length(spark.target_grades, 1), 0) = 0
          or spark.target_grades @> array[student_grade::text]
      );

    if spark_row.id is null then
        raise exception 'This Spark is not available to this student.';
    end if;
    if spark_row.check_mode = 'reading_only' then
        raise exception 'This Spark does not accept responses.';
    end if;

    if jsonb_array_length(spark_row.questions) > 0 then
        for source_question in
            select entry.value
            from jsonb_array_elements(spark_row.questions) with ordinality entry(value, position)
            order by entry.position
            limit 3
        loop
            question_index := question_index + 1;
            question_id := regexp_replace(trim(coalesce(source_question ->> 'id', '')), '[^a-zA-Z0-9_-]', '-', 'g');
            if question_id = '' or question_id = any(seen_ids) then
                question_id := 'q' || question_index::text;
            end if;
            seen_ids := array_append(seen_ids, question_id);
            question_type := case
                when source_question ->> 'type' = 'multiple_choice' then 'multiple_choice'
                else 'short_text'
            end;
            question_prompt := trim(coalesce(source_question ->> 'prompt', ''));
            if question_prompt = '' then
                continue;
            end if;

            if question_type = 'multiple_choice' then
                select coalesce(jsonb_agg(to_jsonb(option_text) order by position), '[]'::jsonb)
                into question_options
                from (
                    select left(trim(option.value #>> '{}'), 240) as option_text, option.position
                    from jsonb_array_elements(
                        case when jsonb_typeof(source_question -> 'options') = 'array'
                            then source_question -> 'options' else '[]'::jsonb end
                    ) with ordinality option(value, position)
                    where trim(option.value #>> '{}') <> ''
                    order by option.position
                    limit 4
                ) normalized_options;
                begin
                    correct_option := coalesce((source_question ->> 'correctOption')::integer, 0);
                exception when invalid_text_representation or numeric_value_out_of_range then
                    correct_option := 0;
                end;
                if correct_option < 0 or correct_option >= jsonb_array_length(question_options) then
                    correct_option := 0;
                end if;
            else
                question_options := '[]'::jsonb;
                correct_option := 0;
            end if;

            question_snapshot := question_snapshot || jsonb_build_array(jsonb_build_object(
                'id', question_id,
                'type', question_type,
                'prompt', left(question_prompt, 1000),
                'options', question_options,
                'correctOption', correct_option
            ));
        end loop;
    else
        question_prompt := trim(coalesce(
            spark_row.grade_questions ->> student_grade::text,
            spark_row.question,
            ''
        ));
        if question_prompt <> '' then
            question_snapshot := jsonb_build_array(jsonb_build_object(
                'id', 'legacy-question',
                'type', 'short_text',
                'prompt', left(question_prompt, 1000),
                'options', '[]'::jsonb,
                'correctOption', 0
            ));
        end if;
    end if;

    if jsonb_array_length(question_snapshot) = 0 then
        raise exception 'This Spark has no questions for this student.';
    end if;

    for question_row in
        select entry.value
        from jsonb_array_elements(question_snapshot) with ordinality entry(value, position)
        order by entry.position
    loop
        question_id := question_row ->> 'id';
        question_type := question_row ->> 'type';
        answered := false;
        correct := false;

        if question_type = 'multiple_choice' then
            selected_option := null;
            if p_answers ? question_id and (p_answers ->> question_id) ~ '^-?[0-9]+$' then
                begin
                    selected_option := (p_answers ->> question_id)::integer;
                exception when invalid_text_representation or numeric_value_out_of_range then
                    selected_option := null;
                end;
            end if;
            answered := selected_option is not null
                and selected_option >= 0
                and selected_option < jsonb_array_length(question_row -> 'options');
            correct_option := coalesce((question_row ->> 'correctOption')::integer, 0);
            correct := answered and selected_option = correct_option;
            if answered then
                normalized_answers := normalized_answers || jsonb_build_object(question_id, selected_option);
            end if;
        else
            short_answer := left(trim(coalesce(p_answers ->> question_id, '')), 240);
            answered := char_length(short_answer) >= 12;
            correct := answered;
            if p_answers ? question_id then
                normalized_answers := normalized_answers || jsonb_build_object(question_id, short_answer);
            end if;
        end if;

        total_count := total_count + 1;
        answered_count := answered_count + case when answered then 1 else 0 end;
        correct_count := correct_count + case when correct then 1 else 0 end;
        result_rows := result_rows || jsonb_build_array(jsonb_build_object(
            'id', question_id,
            'answered', answered,
            'correct', correct
        ));
    end loop;

    response_complete := total_count > 0 and correct_count = total_count;

    insert into public.student_spark_responses (
        user_id, spark_id, answers, question_snapshot, evaluation,
        is_complete, completed_at, updated_at
    ) values (
        current_user_id,
        spark_row.id,
        normalized_answers,
        question_snapshot,
        jsonb_build_object(
            'total', total_count,
            'answered', answered_count,
            'correct', correct_count,
            'isComplete', response_complete,
            'results', result_rows
        ),
        response_complete,
        case when response_complete then now() else null end,
        now()
    )
    on conflict (user_id, spark_id) do update set
        answers = excluded.answers,
        question_snapshot = excluded.question_snapshot,
        evaluation = excluded.evaluation,
        is_complete = excluded.is_complete,
        completed_at = case
            when excluded.is_complete then coalesce(public.student_spark_responses.completed_at, now())
            else null
        end,
        updated_at = now()
    returning * into saved_row;

    return jsonb_build_object(
        'version', 2,
        'sparkId', saved_row.spark_id,
        'answers', saved_row.answers,
        'questionSnapshot', saved_row.question_snapshot,
        'evaluation', saved_row.evaluation,
        'isComplete', saved_row.is_complete,
        'completedAt', saved_row.completed_at,
        'createdAt', saved_row.created_at,
        'updatedAt', saved_row.updated_at
    );
end;
$$;

create or replace function public.submit_student_spark_response(
    p_spark_id text,
    p_answers jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.submit_student_spark_response(p_spark_id, p_answers);
$$;

revoke all on function private.submit_student_spark_response(text, jsonb)
from public, anon, authenticated;
grant execute on function private.submit_student_spark_response(text, jsonb)
to authenticated;

revoke all on function public.submit_student_spark_response(text, jsonb)
from public, anon;
grant execute on function public.submit_student_spark_response(text, jsonb)
to authenticated;
