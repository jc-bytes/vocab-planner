-- Backfill the normalized model and keep it transactionally synchronized while
-- older clients continue to write the legacy student_progress document.

create or replace function private.safe_timestamptz(
    p_value text,
    p_fallback timestamptz default null
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
    if nullif(trim(coalesce(p_value, '')), '') is null then
        return p_fallback;
    end if;
    return p_value::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow then
    return p_fallback;
end;
$$;

create or replace function private.apply_legacy_student_progress_to_v2(
    p_progress public.student_progress
)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    normalized_coin_data jsonb := private.normalize_coin_data(p_progress.coin_data);
    unit_record record;
    unit_data jsonb;
    score_record record;
    score_data jsonb;
    score_details jsonb;
    state_record record;
    history_record record;
    history_entry jsonb;
    history_amount integer;
    history_key text;
begin
    if p_progress.user_id is null then
        raise exception 'A student progress user ID is required.';
    end if;

    for unit_record in
        select entry.key, entry.value
        from jsonb_each(coalesce(p_progress.units, '{}'::jsonb)) entry
    loop
        unit_data := case
            when jsonb_typeof(unit_record.value) = 'object' then unit_record.value
            else '{}'::jsonb
        end;

        insert into public.student_unit_progress (
            user_id, unit_key, unit_id, unit_name, subject_slug,
            trimester, school_year, grade, work_data, created_at, updated_at
        ) values (
            p_progress.user_id,
            left(unit_record.key, 200),
            nullif(left(coalesce(unit_data ->> 'unitId', ''), 160), ''),
            left(coalesce(unit_data ->> 'unitName', ''), 240),
            left(coalesce(unit_data ->> 'subjectSlug', ''), 80),
            left(coalesce(unit_data ->> 'trimester', ''), 80),
            left(coalesce(unit_data ->> 'schoolYear', ''), 20),
            left(coalesce(unit_data ->> 'grade', ''), 20),
            unit_data - 'scores' - 'states',
            p_progress.created_at,
            p_progress.updated_at
        )
        on conflict (user_id, unit_key) do update set
            unit_id = excluded.unit_id,
            unit_name = excluded.unit_name,
            subject_slug = excluded.subject_slug,
            trimester = excluded.trimester,
            school_year = excluded.school_year,
            grade = excluded.grade,
            work_data = excluded.work_data,
            updated_at = excluded.updated_at;

        for score_record in
            select entry.key, entry.value
            from jsonb_each(case
                when jsonb_typeof(unit_data -> 'scores') = 'object' then unit_data -> 'scores'
                else '{}'::jsonb
            end) entry
        loop
            score_data := case
                when jsonb_typeof(score_record.value) = 'object' then score_record.value
                else '{}'::jsonb
            end;
            score_details := case
                when jsonb_typeof(score_data -> 'details') = 'object' then score_data -> 'details'
                when nullif(score_data ->> 'details', '') is not null
                    then jsonb_build_object('summary', score_data ->> 'details')
                else '{}'::jsonb
            end;

            insert into public.student_activity_progress (
                user_id, unit_key, activity_type, score, is_complete, plays,
                total_earned, accuracy, details, verified, attempt_id,
                last_played, created_at, updated_at
            ) values (
                p_progress.user_id,
                left(unit_record.key, 200),
                left(score_record.key, 80),
                least(100, greatest(0, private.jsonb_number(score_data, 'score', 0))),
                private.jsonb_bool(score_data, 'isComplete', false),
                greatest(0, floor(private.jsonb_number(score_data, 'plays', 0))::integer),
                greatest(0, floor(private.jsonb_number(score_data, 'totalEarned', 0))::integer),
                case
                    when score_data ? 'accuracy' then least(100, greatest(0, private.jsonb_number(score_data, 'accuracy', 0)))
                    when score_details ? 'accuracy' then least(100, greatest(0, private.jsonb_number(score_details, 'accuracy', 0)))
                    else null
                end,
                score_details,
                private.jsonb_bool(score_data, 'verified', false),
                nullif(left(coalesce(score_data ->> 'attemptId', ''), 160), ''),
                private.safe_timestamptz(score_data ->> 'lastPlayed', null),
                p_progress.created_at,
                coalesce(private.safe_timestamptz(score_data ->> 'updatedAt', null), p_progress.updated_at)
            )
            on conflict (user_id, unit_key, activity_type) do update set
                score = excluded.score,
                is_complete = excluded.is_complete,
                plays = excluded.plays,
                total_earned = excluded.total_earned,
                accuracy = excluded.accuracy,
                details = excluded.details,
                verified = excluded.verified,
                attempt_id = excluded.attempt_id,
                last_played = excluded.last_played,
                updated_at = excluded.updated_at;
        end loop;

        delete from public.student_activity_progress activity
        where activity.user_id = p_progress.user_id
          and activity.unit_key = left(unit_record.key, 200)
          and not (case
              when jsonb_typeof(unit_data -> 'scores') = 'object' then unit_data -> 'scores'
              else '{}'::jsonb
          end ? activity.activity_type);

        for state_record in
            select entry.key, entry.value
            from jsonb_each(case
                when jsonb_typeof(unit_data -> 'states') = 'object' then unit_data -> 'states'
                else '{}'::jsonb
            end) entry
        loop
            if jsonb_typeof(state_record.value) in ('object', 'array')
               and octet_length(state_record.value::text) <= 51200 then
                insert into public.student_activity_state (
                    user_id, unit_key, activity_type, state_data, state_version,
                    created_at, updated_at
                ) values (
                    p_progress.user_id,
                    left(unit_record.key, 200),
                    left(state_record.key, 80),
                    state_record.value,
                    greatest(1, floor(private.jsonb_number(state_record.value, 'version', 1))::integer),
                    p_progress.created_at,
                    coalesce(private.safe_timestamptz(state_record.value ->> 'updatedAt', null), p_progress.updated_at)
                )
                on conflict (user_id, unit_key, activity_type) do update set
                    state_data = excluded.state_data,
                    state_version = excluded.state_version,
                    updated_at = excluded.updated_at;
            end if;
        end loop;

        delete from public.student_activity_state state
        where state.user_id = p_progress.user_id
          and state.unit_key = left(unit_record.key, 200)
          and not (case
              when jsonb_typeof(unit_data -> 'states') = 'object' then unit_data -> 'states'
              else '{}'::jsonb
          end ? state.activity_type);
    end loop;

    delete from public.student_unit_progress unit
    where unit.user_id = p_progress.user_id
      and not (coalesce(p_progress.units, '{}'::jsonb) ? unit.unit_key);

    for history_record in
        select entry.value, entry.ordinality
        from jsonb_array_elements(coalesce(p_progress.coin_history, '[]'::jsonb))
            with ordinality entry(value, ordinality)
    loop
        history_entry := history_record.value;
        history_amount := floor(abs(private.jsonb_number(history_entry, 'amount', 0)))::integer;
        if history_amount = 0 then continue; end if;
        history_key := left(coalesce(
            nullif(history_entry ->> 'id', ''),
            'legacy-' || encode(extensions.digest(
                convert_to(p_progress.user_id::text || ':' || history_record.ordinality::text || ':' || history_entry::text, 'UTF8'),
                'sha256'
            ), 'hex')
        ), 240);

        insert into public.student_coin_ledger (
            user_id, event_key, event_type, amount, source, description,
            metadata, created_at
        ) values (
            p_progress.user_id,
            history_key,
            case when history_entry ->> 'type' in ('earn', 'spend')
                then history_entry ->> 'type' else 'legacy' end,
            case when history_entry ->> 'type' = 'spend' then -history_amount else history_amount end,
            left(coalesce(history_entry ->> 'source', ''), 120),
            left(coalesce(history_entry ->> 'description', ''), 500),
            history_entry - 'id' - 'type' - 'amount' - 'source' - 'description' - 'timestamp',
            coalesce(private.safe_timestamptz(history_entry ->> 'timestamp', null), p_progress.updated_at)
        )
        on conflict (user_id, event_key) do nothing;
    end loop;

    insert into public.student_progress_summary (
        user_id, total_xp, coins, coin_data, version, legacy_updated_at,
        created_at, updated_at
    ) values (
        p_progress.user_id,
        greatest(0, coalesce(p_progress.total_xp, 0)),
        greatest(0, coalesce((normalized_coin_data ->> 'balance')::integer, p_progress.coins, 0)),
        normalized_coin_data,
        1,
        p_progress.updated_at,
        p_progress.created_at,
        p_progress.updated_at
    )
    on conflict (user_id) do update set
        total_xp = excluded.total_xp,
        coins = excluded.coins,
        coin_data = excluded.coin_data,
        version = public.student_progress_summary.version + 1,
        legacy_updated_at = excluded.legacy_updated_at,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function private.sync_legacy_student_progress_to_v2()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
    perform private.apply_legacy_student_progress_to_v2(new);
    return new;
end;
$$;

revoke all on function private.safe_timestamptz(text, timestamptz) from public, anon, authenticated;
revoke all on function private.apply_legacy_student_progress_to_v2(public.student_progress) from public, anon, authenticated;
revoke all on function private.sync_legacy_student_progress_to_v2() from public, anon, authenticated;

do $$
declare
    progress_row public.student_progress;
begin
    for progress_row in select * from public.student_progress order by user_id loop
        perform private.apply_legacy_student_progress_to_v2(progress_row);
    end loop;
end;
$$;

drop trigger if exists sync_legacy_student_progress_to_v2 on public.student_progress;
create trigger sync_legacy_student_progress_to_v2
after insert or update on public.student_progress
for each row execute function private.sync_legacy_student_progress_to_v2();

create or replace function private.student_progress_delta_v2(
    p_user_id uuid,
    p_unit_key text default null,
    p_activity_type text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_strip_nulls(jsonb_build_object(
        'userId', summary.user_id,
        'version', summary.version,
        'totalXp', summary.total_xp,
        'coins', summary.coins,
        'coinData', summary.coin_data,
        'updatedAt', summary.updated_at,
        'activity', case when activity.user_id is null then null else jsonb_build_object(
            'unitKey', activity.unit_key,
            'activityType', activity.activity_type,
            'score', activity.score,
            'isComplete', activity.is_complete,
            'plays', activity.plays,
            'totalEarned', activity.total_earned,
            'accuracy', activity.accuracy,
            'details', activity.details,
            'verified', activity.verified,
            'attemptId', activity.attempt_id,
            'lastPlayed', activity.last_played,
            'updatedAt', activity.updated_at
        ) end
    ))
    from public.student_progress_summary summary
    left join public.student_activity_progress activity
      on activity.user_id = summary.user_id
     and activity.unit_key = p_unit_key
     and activity.activity_type = p_activity_type
    where summary.user_id = p_user_id;
$$;

create or replace function private.submit_student_activity_progress_v2(
    p_event_id text,
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
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    progress_row public.student_progress;
    response_data jsonb;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;

    request_data := jsonb_build_object(
        'unitKey', p_unit_key,
        'unitContext', coalesce(p_unit_context, '{}'::jsonb),
        'activityType', p_activity_type,
        'score', p_score,
        'isComplete', coalesce(p_is_complete, false),
        'details', coalesce(p_details, '{}'::jsonb),
        'activitySettings', coalesce(p_activity_settings, '{}'::jsonb),
        'clientId', coalesce(p_client_id, ''),
        'isRequired', coalesce(p_is_required, false),
        'attemptId', coalesce(p_attempt_id, '')
    );
    request_hash := private.student_progress_event_hash('activity-progress-v2', request_data);

    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'activity-progress-v2', request_hash
    );
    if cached_response is not null then return cached_response; end if;

    progress_row := private.submit_student_activity_progress(
        p_unit_key, p_unit_context, p_activity_type, p_score, p_is_complete,
        p_details, p_activity_settings, p_client_id, p_is_required, p_attempt_id
    );
    response_data := private.student_progress_delta_v2(current_user_id, trim(p_unit_key), trim(p_activity_type));

    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'activity-progress-v2', request_hash, response_data
    );
end;
$$;

create or replace function public.submit_student_activity_progress_v2(
    p_event_id text,
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
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.submit_student_activity_progress_v2(
        p_event_id, p_unit_key, p_unit_context, p_activity_type, p_score,
        p_is_complete, p_details, p_activity_settings, p_client_id,
        p_is_required, p_attempt_id
    );
$$;

revoke all on function private.student_progress_delta_v2(uuid, text, text) from public, anon, authenticated;
revoke all on function private.submit_student_activity_progress_v2(text, text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text) from public, anon;
grant execute on function private.submit_student_activity_progress_v2(text, text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text) to authenticated;
revoke all on function public.submit_student_activity_progress_v2(text, text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text) from public, anon;
grant execute on function public.submit_student_activity_progress_v2(text, text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text) to authenticated;

create or replace function private.student_progress_v2_reconciliation()
returns table (
    user_id uuid,
    legacy_units bigint,
    normalized_units bigint,
    legacy_scores bigint,
    normalized_scores bigint,
    legacy_states bigint,
    normalized_states bigint,
    activity_mismatches bigint,
    state_mismatches bigint,
    legacy_total_xp integer,
    normalized_total_xp integer,
    legacy_coins integer,
    normalized_coins integer,
    is_consistent boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    with legacy as (
        select
            progress.user_id,
            progress.total_xp,
            coalesce((private.normalize_coin_data(progress.coin_data) ->> 'balance')::integer, 0) as coins,
            coalesce(progress.units, '{}'::jsonb) as units
        from public.student_progress progress
    ), counts as (
        select
            legacy.*,
            (select count(*) from jsonb_object_keys(legacy.units)) as legacy_unit_count,
            (select count(*) from jsonb_each(legacy.units) unit
                cross join lateral jsonb_each(case when jsonb_typeof(unit.value -> 'scores') = 'object' then unit.value -> 'scores' else '{}'::jsonb end)) as legacy_score_count,
            (select count(*) from jsonb_each(legacy.units) unit
                cross join lateral jsonb_each(case when jsonb_typeof(unit.value -> 'states') = 'object' then unit.value -> 'states' else '{}'::jsonb end)) as legacy_state_count
        from legacy
    )
    select
        counts.user_id,
        counts.legacy_unit_count::bigint,
        (select count(*) from public.student_unit_progress unit where unit.user_id = counts.user_id),
        counts.legacy_score_count,
        (select count(*) from public.student_activity_progress activity where activity.user_id = counts.user_id),
        counts.legacy_state_count,
        (select count(*) from public.student_activity_state state where state.user_id = counts.user_id),
        (select count(*)
         from jsonb_each(counts.units) unit
         cross join lateral jsonb_each(case when jsonb_typeof(unit.value -> 'scores') = 'object' then unit.value -> 'scores' else '{}'::jsonb end) score
         left join public.student_activity_progress normalized
           on normalized.user_id = counts.user_id
          and normalized.unit_key = unit.key
          and normalized.activity_type = score.key
         where normalized.user_id is null
            or normalized.score <> least(100, greatest(0, private.jsonb_number(score.value, 'score', 0)))
            or normalized.is_complete <> private.jsonb_bool(score.value, 'isComplete', false)
            or normalized.plays <> greatest(0, floor(private.jsonb_number(score.value, 'plays', 0))::integer)
            or normalized.total_earned <> greatest(0, floor(private.jsonb_number(score.value, 'totalEarned', 0))::integer)
            or normalized.verified <> private.jsonb_bool(score.value, 'verified', false)),
        (select count(*)
         from jsonb_each(counts.units) unit
         cross join lateral jsonb_each(case when jsonb_typeof(unit.value -> 'states') = 'object' then unit.value -> 'states' else '{}'::jsonb end) state
         left join public.student_activity_state normalized
           on normalized.user_id = counts.user_id
          and normalized.unit_key = unit.key
          and normalized.activity_type = state.key
         where normalized.user_id is null or normalized.state_data <> state.value),
        counts.total_xp,
        summary.total_xp,
        counts.coins,
        summary.coins,
        counts.legacy_unit_count = (select count(*) from public.student_unit_progress unit where unit.user_id = counts.user_id)
          and counts.legacy_score_count = (select count(*) from public.student_activity_progress activity where activity.user_id = counts.user_id)
          and counts.legacy_state_count = (select count(*) from public.student_activity_state state where state.user_id = counts.user_id)
          and counts.total_xp = summary.total_xp
          and counts.coins = summary.coins
          and not exists (
              select 1
              from jsonb_each(counts.units) unit
              cross join lateral jsonb_each(case when jsonb_typeof(unit.value -> 'scores') = 'object' then unit.value -> 'scores' else '{}'::jsonb end) score
              left join public.student_activity_progress normalized
                on normalized.user_id = counts.user_id and normalized.unit_key = unit.key and normalized.activity_type = score.key
              where normalized.user_id is null
                 or normalized.score <> least(100, greatest(0, private.jsonb_number(score.value, 'score', 0)))
                 or normalized.is_complete <> private.jsonb_bool(score.value, 'isComplete', false)
                 or normalized.plays <> greatest(0, floor(private.jsonb_number(score.value, 'plays', 0))::integer)
                 or normalized.total_earned <> greatest(0, floor(private.jsonb_number(score.value, 'totalEarned', 0))::integer)
                 or normalized.verified <> private.jsonb_bool(score.value, 'verified', false)
          )
          and not exists (
              select 1
              from jsonb_each(counts.units) unit
              cross join lateral jsonb_each(case when jsonb_typeof(unit.value -> 'states') = 'object' then unit.value -> 'states' else '{}'::jsonb end) state
              left join public.student_activity_state normalized
                on normalized.user_id = counts.user_id and normalized.unit_key = unit.key and normalized.activity_type = state.key
              where normalized.user_id is null or normalized.state_data <> state.value
          ) as is_consistent
    from counts
    left join public.student_progress_summary summary on summary.user_id = counts.user_id
    order by counts.user_id;
$$;

revoke all on function private.student_progress_v2_reconciliation() from public, anon, authenticated;
