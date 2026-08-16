-- Direct normalized progress operations. The legacy JSON document remains in
-- place during this migration, but none of these functions read or write it.

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
        where user_id = p_user_id and role = 'student'
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

create or replace function private.spend_student_coins_v2(
    p_event_id text,
    p_amount integer,
    p_source text default 'game',
    p_description text default 'Spent on game',
    p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    amount integer := coalesce(p_amount, 0);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
    summary_row public.student_progress_summary;
    next_coin_data jsonb;
    balance integer;
begin
    if current_user_id is null then raise exception 'You must be signed in to spend coins.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    if amount <= 0 or amount > 10000 then raise exception 'Coin spend amount is invalid.'; end if;
    request_data := jsonb_build_object(
        'amount', amount, 'source', coalesce(p_source, 'game'),
        'description', coalesce(p_description, ''), 'clientId', coalesce(p_client_id, '')
    );
    request_hash := private.student_progress_event_hash('spend-coins-v2', request_data);
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'spend-coins-v2', request_hash
    );
    if cached_response is not null then return cached_response; end if;

    summary_row := private.ensure_student_progress_summary_v3(current_user_id);
    next_coin_data := private.normalize_coin_data(summary_row.coin_data);
    balance := (next_coin_data ->> 'balance')::integer;
    if balance < amount then raise exception 'Not enough coins.'; end if;
    balance := balance - amount;
    next_coin_data := jsonb_set(next_coin_data, '{balance}', to_jsonb(balance), true);
    next_coin_data := jsonb_set(
        next_coin_data, '{totalSpent}',
        to_jsonb((next_coin_data ->> 'totalSpent')::integer + amount), true
    );
    insert into public.student_coin_ledger (
        user_id, event_key, event_type, amount, balance_after, source, description, metadata
    ) values (
        current_user_id, left('spend:' || event_id, 240), 'spend', -amount, balance,
        left(coalesce(p_source, 'game'), 120), left(coalesce(p_description, ''), 500),
        jsonb_build_object('clientId', coalesce(p_client_id, ''))
    );
    update public.student_progress_summary
    set coins = balance, coin_data = next_coin_data,
        version = version + 1, updated_at = now()
    where user_id = current_user_id;
    response_data := private.student_progress_wallet_v3(current_user_id);
    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'spend-coins-v2', request_hash, response_data
    );
end;
$$;

create or replace function private.accept_student_gift_coins_v2(
    p_event_id text,
    p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    request_data jsonb := jsonb_build_object('clientId', coalesce(p_client_id, ''));
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
    summary_row public.student_progress_summary;
    next_coin_data jsonb;
    balance integer;
    gift_coins integer;
begin
    if current_user_id is null then raise exception 'You must be signed in to accept coins.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    request_hash := private.student_progress_event_hash('accept-gift-v2', request_data);
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'accept-gift-v2', request_hash
    );
    if cached_response is not null then return cached_response; end if;
    summary_row := private.ensure_student_progress_summary_v3(current_user_id);
    next_coin_data := private.normalize_coin_data(summary_row.coin_data);
    gift_coins := (next_coin_data ->> 'giftCoins')::integer;
    if gift_coins > 0 then
        balance := (next_coin_data ->> 'balance')::integer + gift_coins;
        next_coin_data := jsonb_set(next_coin_data, '{balance}', to_jsonb(balance), true);
        next_coin_data := jsonb_set(next_coin_data, '{giftCoins}', '0'::jsonb, true);
        next_coin_data := jsonb_set(
            next_coin_data, '{totalGifted}',
            to_jsonb((next_coin_data ->> 'totalGifted')::integer + gift_coins), true
        );
        insert into public.student_coin_ledger (
            user_id, event_key, event_type, amount, balance_after, source, description, metadata
        ) values (
            current_user_id, left('accept:' || event_id, 240), 'accept_gift', gift_coins, balance,
            'teacher', 'Accepted gift from teacher', jsonb_build_object('clientId', coalesce(p_client_id, ''))
        );
        update public.student_progress_summary
        set coins = balance, coin_data = next_coin_data,
            version = version + 1, updated_at = now()
        where user_id = current_user_id;
    end if;
    response_data := private.student_progress_wallet_v3(current_user_id);
    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'accept-gift-v2', request_hash, response_data
    );
end;
$$;

create or replace function private.claim_student_welcome_bonus_v2(
    p_event_id text,
    p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    request_data jsonb := jsonb_build_object('clientId', coalesce(p_client_id, ''));
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
    summary_row public.student_progress_summary;
    next_coin_data jsonb;
    eligible boolean;
begin
    if current_user_id is null then raise exception 'You must be signed in to claim welcome coins.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    request_hash := private.student_progress_event_hash('welcome-bonus-v2', request_data);
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'welcome-bonus-v2', request_hash
    );
    if cached_response is not null then return cached_response; end if;
    summary_row := private.ensure_student_progress_summary_v3(current_user_id);
    next_coin_data := private.normalize_coin_data(summary_row.coin_data);
    eligible := (next_coin_data ->> 'balance')::integer = 0
        and (next_coin_data ->> 'giftCoins')::integer = 0
        and (next_coin_data ->> 'totalEarned')::integer = 0
        and (next_coin_data ->> 'totalSpent')::integer = 0
        and (next_coin_data ->> 'totalGifted')::integer = 0
        and not exists (
            select 1 from public.student_coin_ledger
            where user_id = current_user_id and source = 'welcome'
        );
    if eligible then
        next_coin_data := jsonb_build_object(
            'balance', 100, 'giftCoins', 0, 'totalEarned', 100,
            'totalSpent', 0, 'totalGifted', 0
        );
        insert into public.student_coin_ledger (
            user_id, event_key, event_type, amount, balance_after, source, description, metadata
        ) values (
            current_user_id, left('welcome:' || event_id, 240), 'welcome', 100, 100,
            'welcome', 'Welcome bonus!', jsonb_build_object('clientId', coalesce(p_client_id, ''))
        );
        update public.student_progress_summary
        set coins = 100, coin_data = next_coin_data,
            version = version + 1, updated_at = now()
        where user_id = current_user_id;
    end if;
    response_data := private.student_progress_wallet_v3(current_user_id);
    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'welcome-bonus-v2', request_hash, response_data
    );
end;
$$;

create or replace function private.gift_student_coins_v2(
    p_event_id text,
    p_student_id uuid,
    p_amount integer,
    p_message text default 'Gift from teacher'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    teacher_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    amount integer := coalesce(p_amount, 0);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
    summary_row public.student_progress_summary;
    next_coin_data jsonb;
begin
    if not private.is_teacher() then raise exception 'Only teachers can gift coins.'; end if;
    if p_student_id is null then raise exception 'A student id is required.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    if amount <= 0 or amount > 10000 then raise exception 'Coin gift amount is invalid.'; end if;
    request_data := jsonb_build_object(
        'teacherId', teacher_id, 'studentId', p_student_id,
        'amount', amount, 'message', coalesce(p_message, 'Gift from teacher')
    );
    request_hash := private.student_progress_event_hash('teacher-gift-v2', request_data);
    perform pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        p_student_id, event_id, 'teacher-gift-v2', request_hash
    );
    if cached_response is not null then return cached_response; end if;
    summary_row := private.ensure_student_progress_summary_v3(p_student_id);
    next_coin_data := private.normalize_coin_data(summary_row.coin_data);
    next_coin_data := jsonb_set(
        next_coin_data, '{giftCoins}',
        to_jsonb((next_coin_data ->> 'giftCoins')::integer + amount), true
    );
    insert into public.student_coin_ledger (
        user_id, event_key, event_type, amount, balance_after, source, description, metadata
    ) values (
        p_student_id, left('gift:' || event_id, 240), 'gift', amount,
        (next_coin_data ->> 'balance')::integer, 'teacher',
        left(coalesce(p_message, 'Gift from teacher'), 500),
        jsonb_build_object('teacherId', teacher_id)
    );
    update public.student_progress_summary
    set coin_data = next_coin_data, version = version + 1, updated_at = now()
    where user_id = p_student_id;
    response_data := private.student_progress_wallet_v3(p_student_id);
    return private.store_student_progress_event_receipt(
        p_student_id, event_id, 'teacher-gift-v2', request_hash, response_data
    );
end;
$$;

create or replace function public.spend_student_coins_v2(
    p_event_id text, p_amount integer, p_source text default 'game',
    p_description text default 'Spent on game', p_client_id text default null
) returns jsonb language sql security invoker set search_path = '' as $$
    select private.spend_student_coins_v2(p_event_id, p_amount, p_source, p_description, p_client_id);
$$;
create or replace function public.accept_student_gift_coins_v2(
    p_event_id text, p_client_id text default null
) returns jsonb language sql security invoker set search_path = '' as $$
    select private.accept_student_gift_coins_v2(p_event_id, p_client_id);
$$;
create or replace function public.claim_student_welcome_bonus_v2(
    p_event_id text, p_client_id text default null
) returns jsonb language sql security invoker set search_path = '' as $$
    select private.claim_student_welcome_bonus_v2(p_event_id, p_client_id);
$$;
create or replace function public.gift_student_coins_v2(
    p_event_id text, p_student_id uuid, p_amount integer,
    p_message text default 'Gift from teacher'
) returns jsonb language sql security invoker set search_path = '' as $$
    select private.gift_student_coins_v2(p_event_id, p_student_id, p_amount, p_message);
$$;

revoke all on function private.spend_student_coins_v2(text, integer, text, text, text) from public, anon;
revoke all on function private.accept_student_gift_coins_v2(text, text) from public, anon;
revoke all on function private.claim_student_welcome_bonus_v2(text, text) from public, anon;
revoke all on function private.gift_student_coins_v2(text, uuid, integer, text) from public, anon;
grant execute on function private.spend_student_coins_v2(text, integer, text, text, text) to authenticated;
grant execute on function private.accept_student_gift_coins_v2(text, text) to authenticated;
grant execute on function private.claim_student_welcome_bonus_v2(text, text) to authenticated;
grant execute on function private.gift_student_coins_v2(text, uuid, integer, text) to authenticated;

revoke all on function public.spend_student_coins_v2(text, integer, text, text, text) from public, anon;
revoke all on function public.accept_student_gift_coins_v2(text, text) from public, anon;
revoke all on function public.claim_student_welcome_bonus_v2(text, text) from public, anon;
revoke all on function public.gift_student_coins_v2(text, uuid, integer, text) from public, anon;
grant execute on function public.spend_student_coins_v2(text, integer, text, text, text) to authenticated;
grant execute on function public.accept_student_gift_coins_v2(text, text) to authenticated;
grant execute on function public.claim_student_welcome_bonus_v2(text, text) to authenticated;
grant execute on function public.gift_student_coins_v2(text, uuid, integer, text) to authenticated;

create or replace function private.sync_student_unit_work_v2(
    p_event_id text,
    p_unit_key text,
    p_unit_context jsonb,
    p_work_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    v_unit_key text := left(trim(coalesce(p_unit_key, '')), 200);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
begin
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
$$;

create or replace function public.sync_student_unit_work_v2(
    p_event_id text,
    p_unit_key text,
    p_unit_context jsonb,
    p_work_patch jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.sync_student_unit_work_v2(
        p_event_id, p_unit_key, p_unit_context, p_work_patch
    );
$$;

revoke all on function private.sync_student_unit_work_v2(text, text, jsonb, jsonb) from public, anon;
grant execute on function private.sync_student_unit_work_v2(text, text, jsonb, jsonb) to authenticated;
revoke all on function public.sync_student_unit_work_v2(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.sync_student_unit_work_v2(text, text, jsonb, jsonb) to authenticated;

create or replace function private.student_progress_wallet_v3(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'userId', summary.user_id,
        'version', summary.version,
        'totalXp', summary.total_xp,
        'coins', summary.coins,
        'coinData', summary.coin_data,
        'updatedAt', summary.updated_at
    )
    from public.student_progress_summary summary
    where summary.user_id = p_user_id;
$$;

create or replace function private.upsert_student_unit_work_v3(
    p_user_id uuid,
    p_unit_key text,
    p_unit_context jsonb,
    p_work_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_unit_key text := left(trim(coalesce(p_unit_key, '')), 200);
    safe_context jsonb := case when jsonb_typeof(coalesce(p_unit_context, '{}'::jsonb)) = 'object'
        then p_unit_context else '{}'::jsonb end;
    safe_patch jsonb := case when jsonb_typeof(coalesce(p_work_patch, '{}'::jsonb)) = 'object'
        then p_work_patch else '{}'::jsonb end;
    state_map jsonb;
    state_record record;
begin
    if v_unit_key = '' then raise exception 'A unit key is required.'; end if;
    if octet_length(safe_patch::text) > 65536 then
        raise exception 'Unit work payload is too large.';
    end if;

    state_map := case when jsonb_typeof(safe_patch -> 'states') = 'object'
        then safe_patch -> 'states' else null end;
    safe_patch := safe_patch - 'scores' - 'states' - 'coins' - 'coinData' - 'coinHistory';

    insert into public.student_unit_progress (
        user_id, unit_key, unit_id, unit_name, subject_slug,
        trimester, school_year, grade, work_data, updated_at
    ) values (
        p_user_id,
        v_unit_key,
        nullif(left(coalesce(safe_context ->> 'unitId', ''), 160), ''),
        left(coalesce(safe_context ->> 'unitName', ''), 240),
        left(coalesce(safe_context ->> 'subjectSlug', ''), 80),
        left(coalesce(safe_context ->> 'trimester', ''), 80),
        left(coalesce(safe_context ->> 'schoolYear', ''), 20),
        left(coalesce(safe_context ->> 'grade', ''), 20),
        safe_patch,
        now()
    )
    on conflict (user_id, unit_key) do update set
        unit_id = coalesce(excluded.unit_id, public.student_unit_progress.unit_id),
        unit_name = case when excluded.unit_name <> '' then excluded.unit_name else public.student_unit_progress.unit_name end,
        subject_slug = case when excluded.subject_slug <> '' then excluded.subject_slug else public.student_unit_progress.subject_slug end,
        trimester = case when excluded.trimester <> '' then excluded.trimester else public.student_unit_progress.trimester end,
        school_year = case when excluded.school_year <> '' then excluded.school_year else public.student_unit_progress.school_year end,
        grade = case when excluded.grade <> '' then excluded.grade else public.student_unit_progress.grade end,
        work_data = public.student_unit_progress.work_data || excluded.work_data,
        updated_at = now();

    if state_map is not null then
        for state_record in select entry.key, entry.value from jsonb_each(state_map) entry loop
            if jsonb_typeof(state_record.value) in ('object', 'array')
               and octet_length(state_record.value::text) <= 51200 then
                insert into public.student_activity_state (
                    user_id, unit_key, activity_type, state_data, state_version, updated_at
                ) values (
                    p_user_id, v_unit_key, left(state_record.key, 80), state_record.value,
                    greatest(1, floor(private.jsonb_number(state_record.value, 'version', 1))::integer), now()
                )
                on conflict (user_id, unit_key, activity_type) do update set
                    state_data = excluded.state_data,
                    state_version = excluded.state_version,
                    updated_at = now();
            end if;
        end loop;

        delete from public.student_activity_state state
        where state.user_id = p_user_id
          and state.unit_key = v_unit_key
          and not (state_map ? state.activity_type);
    end if;
end;
$$;

create or replace function private.student_unit_delta_v3(p_user_id uuid, p_unit_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'userId', summary.user_id,
        'version', summary.version,
        'totalXp', summary.total_xp,
        'coins', summary.coins,
        'coinData', summary.coin_data,
        'updatedAt', summary.updated_at,
        'unit', unit.work_data || jsonb_strip_nulls(jsonb_build_object(
            'unitKey', unit.unit_key,
            'unitId', unit.unit_id,
            'unitName', unit.unit_name,
            'subjectSlug', unit.subject_slug,
            'trimester', unit.trimester,
            'schoolYear', unit.school_year,
            'grade', unit.grade,
            'states', coalesce((
                select jsonb_object_agg(state.activity_type, state.state_data order by state.activity_type)
                from public.student_activity_state state
                where state.user_id = unit.user_id and state.unit_key = unit.unit_key
            ), '{}'::jsonb)
        ))
    )
    from public.student_progress_summary summary
    join public.student_unit_progress unit
      on unit.user_id = summary.user_id and unit.unit_key = p_unit_key
    where summary.user_id = p_user_id;
$$;

revoke all on function private.ensure_student_progress_summary_v3(uuid) from public, anon, authenticated;
revoke all on function private.student_progress_wallet_v3(uuid) from public, anon, authenticated;
revoke all on function private.upsert_student_unit_work_v3(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.student_unit_delta_v3(uuid, text) from public, anon, authenticated;

-- Required-activity gating now reads normalized activity rows.
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
set search_path = ''
as $$
declare
    vocabulary_row public.vocabularies;
    student_grade integer;
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

    select * into vocabulary_row from public.vocabularies where id = p_vocabulary_id;
    if vocabulary_row.id is null then raise exception 'Unknown vocabulary unit.'; end if;
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
$$;

revoke all on function private.assert_student_activity_access(uuid, text, text, text)
from public, anon, authenticated;

-- Replace the v2 wrapper implementation: validation, scoring, XP, coins, and
-- the normalized activity row now commit in one transaction without legacy JSON.
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
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    v_unit_key text := left(trim(coalesce(p_unit_key, '')), 200);
    v_activity_type text := left(trim(coalesce(p_activity_type, '')), 80);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
    attempt_row private.student_activity_attempts;
    vocabulary_row public.vocabularies;
    required_list text[];
    server_required boolean;
    minimum_score numeric;
    minimum_seconds integer;
    word_count integer;
    sanitized_score numeric := least(100, greatest(0, coalesce(p_score, 0)));
    catalog_context jsonb;
    evidence jsonb := case when jsonb_typeof(p_details -> 'evidence') = 'object'
        then p_details -> 'evidence' else '{}'::jsonb end;
    evidence_correct numeric;
    evidence_total numeric;
    evidence_answered numeric;
    evidence_accuracy numeric;
    old_activity public.student_activity_progress;
    old_score numeric := 0;
    best_score numeric;
    old_complete boolean := false;
    new_complete boolean;
    old_plays integer := 0;
    old_total_earned integer := 0;
    progress_reward integer;
    completion_bonus integer;
    steps_gained integer := 0;
    reward integer := 0;
    xp_awarded integer := 0;
    activity_role text;
    summary_row public.student_progress_summary;
    next_coin_data jsonb;
    next_balance integer;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    if v_unit_key = '' then raise exception 'A unit key is required.'; end if;
    if octet_length(coalesce(p_details, '{}'::jsonb)::text) > 10000 then
        raise exception 'Activity details are too large.';
    end if;

    request_data := jsonb_build_object(
        'unitKey', v_unit_key, 'unitContext', coalesce(p_unit_context, '{}'::jsonb),
        'activityType', v_activity_type, 'score', p_score,
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

    if coalesce(p_attempt_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'A server-issued activity attempt is required.';
    end if;

    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id::uuid and user_id = current_user_id
    for update;
    if attempt_row.id is null
       or attempt_row.unit_key <> v_unit_key
       or attempt_row.activity_type <> v_activity_type then
        raise exception 'This activity attempt is invalid.';
    end if;
    if attempt_row.started_at < now() - interval '4 hours' then
        raise exception 'This activity attempt expired. Start the activity again.';
    end if;

    vocabulary_row := private.assert_student_activity_access(
        current_user_id, v_unit_key, attempt_row.vocabulary_id, v_activity_type
    );
    required_list := private.required_vocabulary_activities(vocabulary_row);
    server_required := v_activity_type = any(required_list);
    word_count := jsonb_array_length(coalesce(vocabulary_row.words, '[]'::jsonb));
    minimum_seconds := greatest(5, least(60, word_count * 2));
    if v_activity_type = 'speed-match' then minimum_seconds := greatest(15, minimum_seconds); end if;
    minimum_score := case when v_activity_type in ('quiz', 'synonym-antonym') then 80 else 100 end;

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
        if evidence_total < least(4, word_count) then raise exception 'Not enough activity items were completed.'; end if;
        if v_activity_type in ('quiz', 'synonym-antonym') then
            if evidence_answered <> evidence_total or evidence_accuracy < 80
               or evidence_correct < ceil(evidence_total * 0.8) then
                raise exception 'Quiz mastery evidence is incomplete.';
            end if;
        elsif v_activity_type = 'speed-match' then
            if evidence_correct < 10 then raise exception 'Match at least 10 correct words to complete Speed Match.'; end if;
        elsif v_activity_type = 'matching' then
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

    summary_row := private.ensure_student_progress_summary_v3(current_user_id);
    catalog_context := jsonb_build_object(
        'unitId', vocabulary_row.id,
        'unitName', vocabulary_row.name,
        'subjectSlug', vocabulary_row.subject_slug,
        'trimester', coalesce(vocabulary_row.trimester, ''),
        'grade', coalesce((select grade_level::text from public.profiles where user_id = current_user_id), '')
    );
    perform private.upsert_student_unit_work_v3(current_user_id, v_unit_key, catalog_context, '{}'::jsonb);

    select * into old_activity
    from public.student_activity_progress
    where user_id = current_user_id and unit_key = v_unit_key and activity_type = v_activity_type
    for update;
    if old_activity.user_id is not null then
        old_score := old_activity.score;
        old_complete := old_activity.is_complete or old_activity.score >= 100;
        old_plays := old_activity.plays;
        old_total_earned := old_activity.total_earned;
    end if;
    best_score := greatest(old_score, sanitized_score);
    new_complete := old_complete or coalesce(p_is_complete, false);
    progress_reward := least(10, greatest(0, floor(private.jsonb_number(vocabulary_row.activity_settings, 'progressReward', 1))::integer));
    completion_bonus := least(200, greatest(0, floor(private.jsonb_number(vocabulary_row.activity_settings, 'completionBonus', 50))::integer));
    if sanitized_score > old_score then
        steps_gained := floor(sanitized_score / 10)::integer - floor(old_score / 10)::integer;
        reward := greatest(0, steps_gained * progress_reward);
    end if;
    if new_complete and not old_complete then reward := reward + completion_bonus; end if;
    if p_is_complete then old_plays := old_plays + 1; end if;

    insert into public.student_activity_progress (
        user_id, unit_key, activity_type, score, is_complete, plays,
        total_earned, accuracy, details, verified, attempt_id, last_played, updated_at
    ) values (
        current_user_id, v_unit_key, v_activity_type, best_score, new_complete, old_plays,
        old_total_earned + reward,
        case when p_details ? 'accuracy' then private.jsonb_number(p_details, 'accuracy', 0)
             when evidence ? 'accuracy' then private.jsonb_number(evidence, 'accuracy', 0)
             else null end,
        coalesce(p_details, '{}'::jsonb),
        coalesce(old_activity.verified, false) or coalesce(p_is_complete, false),
        attempt_row.id::text, now(), now()
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
        updated_at = now();

    if p_is_complete then
        activity_role := case when server_required then 'required' else 'optional' end;
        insert into public.student_xp_events (
            user_id, unit_key, activity_type, activity_role, attempt_id, xp_amount, reason
        ) values (
            current_user_id, v_unit_key, v_activity_type, activity_role,
            attempt_row.id::text, private.student_activity_xp_amount(v_activity_type),
            case when server_required then 'First required activity completion' else 'Optional activity completion' end
        )
        on conflict do nothing
        returning xp_amount into xp_awarded;
        xp_awarded := coalesce(xp_awarded, 0);

        update private.student_activity_attempts
        set completed_at = now()
        where id = attempt_row.id;
    end if;

    next_coin_data := private.normalize_coin_data(summary_row.coin_data);
    next_balance := (next_coin_data ->> 'balance')::integer + reward;
    if reward > 0 then
        next_coin_data := jsonb_set(next_coin_data, '{balance}', to_jsonb(next_balance), true);
        next_coin_data := jsonb_set(
            next_coin_data, '{totalEarned}',
            to_jsonb((next_coin_data ->> 'totalEarned')::integer + reward), true
        );
        insert into public.student_coin_ledger (
            user_id, event_key, event_type, amount, balance_after,
            source, description, metadata
        ) values (
            current_user_id, left('activity:' || event_id, 240), 'earn', reward, next_balance,
            'activity', v_activity_type,
            jsonb_build_object('clientId', coalesce(p_client_id, ''), 'activityType', v_activity_type)
        ) on conflict (user_id, event_key) do nothing;
    end if;

    update public.student_progress_summary
    set total_xp = total_xp + xp_awarded,
        coins = next_balance,
        coin_data = next_coin_data,
        version = version + 1,
        updated_at = now()
    where user_id = current_user_id;

    response_data := private.student_progress_delta_v2(current_user_id, v_unit_key, v_activity_type);
    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'activity-progress-v2', request_hash, response_data
    );
end;
$$;

create or replace function private.get_own_student_progress_v2()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    perform private.ensure_student_progress_summary_v3(current_user_id);
    return private.student_progress_snapshot_v2(current_user_id);
end;
$$;

create or replace function private.get_student_progress_v3(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then raise exception 'You must be signed in.'; end if;
    if auth.uid() <> p_user_id and not private.is_teacher() then
        raise exception 'You are not allowed to read this student progress.';
    end if;
    return private.student_progress_snapshot_v2(p_user_id);
end;
$$;

create or replace function public.get_student_progress_v3(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_student_progress_v3(p_user_id); $$;

create or replace function private.get_students_progress_v3()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result_data jsonb;
begin
    if not private.is_teacher() then raise exception 'Only teachers can list student progress.'; end if;
    select coalesce(jsonb_agg(private.student_progress_snapshot_v2(profile.user_id)
        order by profile.grade_level, profile.section_letter, profile.last_name), '[]'::jsonb)
    into result_data
    from public.profiles profile
    where profile.role = 'student';
    return result_data;
end;
$$;

create or replace function public.get_students_progress_v3()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_students_progress_v3(); $$;

create or replace function private.provision_student_progress_v2(
    p_student_id uuid,
    p_student_profile jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform private.ensure_student_progress_summary_v3(p_student_id);
    return private.student_progress_snapshot_v2(p_student_id);
end;
$$;

create or replace function public.provision_student_progress_v2(
    p_student_id uuid,
    p_student_profile jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.provision_student_progress_v2(p_student_id, p_student_profile); $$;

revoke all on function private.get_student_progress_v3(uuid) from public, anon;
revoke all on function private.get_students_progress_v3() from public, anon;
grant execute on function private.get_student_progress_v3(uuid) to authenticated;
grant execute on function private.get_students_progress_v3() to authenticated;
revoke all on function public.get_student_progress_v3(uuid) from public, anon;
revoke all on function public.get_students_progress_v3() from public, anon;
grant execute on function public.get_student_progress_v3(uuid) to authenticated;
grant execute on function public.get_students_progress_v3() to authenticated;

revoke all on function private.provision_student_progress_v2(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.provision_student_progress_v2(uuid, jsonb) to service_role;
revoke all on function public.provision_student_progress_v2(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.provision_student_progress_v2(uuid, jsonb) to service_role;
