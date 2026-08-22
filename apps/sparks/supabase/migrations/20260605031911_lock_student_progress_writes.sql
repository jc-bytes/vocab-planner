create or replace function private.jsonb_number(value jsonb, key text, fallback numeric default 0)
returns numeric
language sql
immutable
set search_path = public, private, extensions
as $$
    select case
        when coalesce(value, '{}'::jsonb) ? key
          and (coalesce(value, '{}'::jsonb) ->> key) ~ '^-?[0-9]+(\.[0-9]+)?$'
            then (coalesce(value, '{}'::jsonb) ->> key)::numeric
        else fallback
    end;
$$;

create or replace function private.jsonb_bool(value jsonb, key text, fallback boolean default false)
returns boolean
language sql
immutable
set search_path = public, private, extensions
as $$
    select case lower(coalesce(value, '{}'::jsonb) ->> key)
        when 'true' then true
        when 'false' then false
        else fallback
    end;
$$;

create or replace function private.normalize_coin_data(value jsonb)
returns jsonb
language sql
immutable
set search_path = public, private, extensions
as $$
    select jsonb_build_object(
        'balance', greatest(0, floor(private.jsonb_number(value, 'balance', 0))::integer),
        'giftCoins', greatest(0, floor(private.jsonb_number(value, 'giftCoins', 0))::integer),
        'totalEarned', greatest(0, floor(private.jsonb_number(value, 'totalEarned', 0))::integer),
        'totalSpent', greatest(0, floor(private.jsonb_number(value, 'totalSpent', 0))::integer),
        'totalGifted', greatest(0, floor(private.jsonb_number(value, 'totalGifted', 0))::integer)
    );
$$;

create or replace function private.append_coin_history(history jsonb, entry jsonb)
returns jsonb
language sql
stable
set search_path = public, private, extensions
as $$
    with entries as (
        select item.value, item.ordinality::bigint as ord
        from jsonb_array_elements(coalesce(history, '[]'::jsonb)) with ordinality as item(value, ordinality)
        union all
        select coalesce(entry, '{}'::jsonb), 9223372036854775807::bigint
    ),
    kept as (
        select value, ord
        from entries
        order by ord desc
        limit 100
    )
    select coalesce(jsonb_agg(value order by ord), '[]'::jsonb)
    from kept;
$$;

create or replace function private.coin_history_entry(
    entry_type text,
    amount integer,
    source text,
    description text default '',
    client_id text default null
)
returns jsonb
language sql
stable
set search_path = public, private, extensions
as $$
    select jsonb_strip_nulls(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', entry_type,
        'amount', amount,
        'source', source,
        'description', coalesce(description, ''),
        'timestamp', now(),
        'clientId', nullif(left(coalesce(client_id, ''), 120), '')
    ));
$$;

create or replace function private.student_profile_json(student_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private, extensions
as $$
    select coalesce(
        (
            select jsonb_build_object(
                'firstName', first_name,
                'lastName', last_name,
                'name', trim(concat_ws(' ', first_name, last_name)),
                'email', email::text,
                'grade', coalesce(grade_level::text, ''),
                'group', coalesce(section_letter, '')
            )
            from public.profiles
            where user_id = student_id
        ),
        '{}'::jsonb
    );
$$;

create or replace function private.ensure_student_progress_row(student_id uuid)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    progress_row public.student_progress;
begin
    insert into public.student_progress (user_id, student_profile, units, coins, coin_data, coin_history)
    values (
        student_id,
        private.student_profile_json(student_id),
        '{}'::jsonb,
        0,
        '{"balance":0,"giftCoins":0,"totalEarned":0,"totalSpent":0,"totalGifted":0}'::jsonb,
        '[]'::jsonb
    )
    on conflict (user_id) do nothing;

    select *
    into progress_row
    from public.student_progress
    where user_id = student_id
    for update;

    if progress_row.user_id is null then
        raise exception 'Could not initialize student progress.';
    end if;

    return progress_row;
end;
$$;

create or replace function public.ensure_own_student_progress(p_student_profile jsonb default '{}'::jsonb)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    progress_row public.student_progress;
begin
    if current_user_id is null then
        raise exception 'You must be signed in to initialize progress.';
    end if;

    progress_row := private.ensure_student_progress_row(current_user_id);

    update public.student_progress
    set student_profile = coalesce(nullif(p_student_profile, '{}'::jsonb), private.student_profile_json(current_user_id)),
        updated_at = now()
    where user_id = current_user_id
    returning * into progress_row;

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
    p_client_id text default null
)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    progress_row public.student_progress;
    allowed_activities constant text[] := array[
        'flashcards',
        'matching',
        'quiz',
        'synonym-antonym',
        'word-search',
        'crossword',
        'hangman',
        'scramble',
        'wordle',
        'speed-match',
        'fill-in-blank',
        'illustration'
    ];
    unit_key text := left(trim(coalesce(p_unit_key, '')), 200);
    activity_type text := left(trim(coalesce(p_activity_type, '')), 80);
    next_units jsonb;
    unit_data jsonb;
    unit_scores jsonb;
    old_score_data jsonb;
    new_score numeric := least(100, greatest(0, coalesce(p_score, 0)));
    old_score numeric;
    best_score numeric;
    old_complete boolean;
    new_complete boolean;
    progress_reward integer := least(1000, greatest(0, floor(private.jsonb_number(p_activity_settings, 'progressReward', 1))::integer));
    completion_bonus integer := least(10000, greatest(0, floor(private.jsonb_number(p_activity_settings, 'completionBonus', 50))::integer));
    steps_gained integer := 0;
    reward integer := 0;
    old_plays integer;
    old_total_earned integer;
    score_data jsonb;
    next_coin_data jsonb;
    next_coin_history jsonb;
    details jsonb := case when jsonb_typeof(coalesce(p_details, '{}'::jsonb)) = 'object' then p_details else '{}'::jsonb end;
    unit_context jsonb;
begin
    if current_user_id is null then
        raise exception 'You must be signed in to save progress.';
    end if;
    if unit_key = '' then
        raise exception 'A unit key is required.';
    end if;
    if activity_type <> all(allowed_activities) then
        raise exception 'Unsupported activity type: %', activity_type;
    end if;
    if length(details::text) > 10000 then
        raise exception 'Activity details are too large.';
    end if;

    progress_row := private.ensure_student_progress_row(current_user_id);
    next_units := coalesce(progress_row.units, '{}'::jsonb);
    unit_data := coalesce(next_units -> unit_key, '{}'::jsonb);
    unit_scores := coalesce(unit_data -> 'scores', '{}'::jsonb);
    old_score_data := coalesce(unit_scores -> activity_type, '{}'::jsonb);
    old_score := least(100, greatest(0, private.jsonb_number(old_score_data, 'score', 0)));
    best_score := greatest(old_score, new_score);
    old_complete := private.jsonb_bool(old_score_data, 'isComplete', false) or old_score >= 100;
    new_complete := old_complete or coalesce(p_is_complete, false) or new_score >= 100;
    old_plays := greatest(0, floor(private.jsonb_number(old_score_data, 'plays', 0))::integer);
    old_total_earned := greatest(0, floor(private.jsonb_number(old_score_data, 'totalEarned', 0))::integer);

    if new_score > old_score then
        steps_gained := floor(new_score / 10)::integer - floor(old_score / 10)::integer;
        reward := greatest(0, steps_gained * progress_reward);
    end if;
    if new_complete and not old_complete then
        reward := reward + completion_bonus;
        old_plays := old_plays + 1;
    end if;

    score_data := old_score_data || jsonb_strip_nulls(jsonb_build_object(
        'score', best_score,
        'details', details,
        'isComplete', new_complete,
        'plays', old_plays,
        'totalEarned', old_total_earned + reward,
        'lastPlayed', now(),
        'updatedAt', now()
    ));

    unit_context := jsonb_strip_nulls(jsonb_build_object(
        'unitId', nullif(left(coalesce(p_unit_context ->> 'unitId', ''), 160), ''),
        'unitName', nullif(left(coalesce(p_unit_context ->> 'unitName', ''), 240), ''),
        'subjectSlug', nullif(left(coalesce(p_unit_context ->> 'subjectSlug', ''), 80), ''),
        'trimester', nullif(left(coalesce(p_unit_context ->> 'trimester', ''), 80), ''),
        'schoolYear', nullif(left(coalesce(p_unit_context ->> 'schoolYear', ''), 20), ''),
        'grade', nullif(left(coalesce(p_unit_context ->> 'grade', ''), 20), '')
    ));
    unit_data := unit_data || unit_context;
    unit_data := jsonb_set(unit_data, '{scores}', unit_scores || jsonb_build_object(activity_type, score_data), true);
    next_units := jsonb_set(next_units, array[unit_key], unit_data, true);

    next_coin_data := private.normalize_coin_data(progress_row.coin_data);
    next_coin_history := coalesce(progress_row.coin_history, '[]'::jsonb);
    if reward > 0 then
        next_coin_history := private.append_coin_history(
            next_coin_history,
            private.coin_history_entry('earn', reward, 'activity', activity_type, p_client_id)
        );
        next_coin_data := jsonb_build_object(
            'balance', (next_coin_data ->> 'balance')::integer + reward,
            'giftCoins', (next_coin_data ->> 'giftCoins')::integer,
            'totalEarned', (next_coin_data ->> 'totalEarned')::integer + reward,
            'totalSpent', (next_coin_data ->> 'totalSpent')::integer,
            'totalGifted', (next_coin_data ->> 'totalGifted')::integer
        );
    end if;

    update public.student_progress
    set units = next_units,
        coin_data = next_coin_data,
        coins = (next_coin_data ->> 'balance')::integer,
        coin_history = next_coin_history,
        student_profile = private.student_profile_json(current_user_id),
        updated_at = now()
    where user_id = current_user_id
    returning * into progress_row;

    return progress_row;
end;
$$;

create or replace function public.sync_student_unit_work(
    p_unit_key text,
    p_unit_context jsonb,
    p_work_patch jsonb
)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    progress_row public.student_progress;
    unit_key text := left(trim(coalesce(p_unit_key, '')), 200);
    next_units jsonb;
    unit_data jsonb;
    preserved_scores jsonb;
    safe_patch jsonb := case when jsonb_typeof(coalesce(p_work_patch, '{}'::jsonb)) = 'object' then p_work_patch else '{}'::jsonb end;
    unit_context jsonb;
begin
    if current_user_id is null then
        raise exception 'You must be signed in to sync work.';
    end if;
    if unit_key = '' then
        raise exception 'A unit key is required.';
    end if;
    if length(safe_patch::text) > 50000 then
        raise exception 'Unit work payload is too large.';
    end if;

    progress_row := private.ensure_student_progress_row(current_user_id);
    next_units := coalesce(progress_row.units, '{}'::jsonb);
    unit_data := coalesce(next_units -> unit_key, '{}'::jsonb);
    preserved_scores := coalesce(unit_data -> 'scores', '{}'::jsonb);
    unit_context := jsonb_strip_nulls(jsonb_build_object(
        'unitId', nullif(left(coalesce(p_unit_context ->> 'unitId', ''), 160), ''),
        'unitName', nullif(left(coalesce(p_unit_context ->> 'unitName', ''), 240), ''),
        'subjectSlug', nullif(left(coalesce(p_unit_context ->> 'subjectSlug', ''), 80), ''),
        'trimester', nullif(left(coalesce(p_unit_context ->> 'trimester', ''), 80), ''),
        'schoolYear', nullif(left(coalesce(p_unit_context ->> 'schoolYear', ''), 20), ''),
        'grade', nullif(left(coalesce(p_unit_context ->> 'grade', ''), 20), '')
    ));

    safe_patch := safe_patch - 'scores' - 'coins' - 'coinData' - 'coinHistory';
    unit_data := unit_data || unit_context || safe_patch;
    unit_data := jsonb_set(unit_data, '{scores}', preserved_scores, true);
    next_units := jsonb_set(next_units, array[unit_key], unit_data, true);

    update public.student_progress
    set units = next_units,
        student_profile = private.student_profile_json(current_user_id),
        updated_at = now()
    where user_id = current_user_id
    returning * into progress_row;

    return progress_row;
end;
$$;

create or replace function public.spend_student_coins(
    p_amount integer,
    p_source text default 'game',
    p_description text default 'Spent on game',
    p_client_id text default null
)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    progress_row public.student_progress;
    amount integer := coalesce(p_amount, 0);
    next_coin_data jsonb;
    balance integer;
    gift_coins integer;
    total_earned integer;
    total_spent integer;
    total_gifted integer;
    next_coin_history jsonb;
begin
    if current_user_id is null then
        raise exception 'You must be signed in to spend coins.';
    end if;
    if amount <= 0 or amount > 10000 then
        raise exception 'Coin spend amount is invalid.';
    end if;

    progress_row := private.ensure_student_progress_row(current_user_id);
    next_coin_data := private.normalize_coin_data(progress_row.coin_data);
    balance := (next_coin_data ->> 'balance')::integer;
    if balance < amount then
        raise exception 'Not enough coins.';
    end if;

    gift_coins := (next_coin_data ->> 'giftCoins')::integer;
    total_earned := (next_coin_data ->> 'totalEarned')::integer;
    total_spent := (next_coin_data ->> 'totalSpent')::integer;
    total_gifted := (next_coin_data ->> 'totalGifted')::integer;
    next_coin_history := private.append_coin_history(
        coalesce(progress_row.coin_history, '[]'::jsonb),
        private.coin_history_entry('spend', amount, left(coalesce(p_source, 'game'), 80), left(coalesce(p_description, ''), 240), p_client_id)
    );
    next_coin_data := jsonb_build_object(
        'balance', balance - amount,
        'giftCoins', gift_coins,
        'totalEarned', total_earned,
        'totalSpent', total_spent + amount,
        'totalGifted', total_gifted
    );

    update public.student_progress
    set coin_data = next_coin_data,
        coins = (next_coin_data ->> 'balance')::integer,
        coin_history = next_coin_history,
        updated_at = now()
    where user_id = current_user_id
    returning * into progress_row;

    return progress_row;
end;
$$;

create or replace function public.accept_student_gift_coins(p_client_id text default null)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    progress_row public.student_progress;
    next_coin_data jsonb;
    balance integer;
    gift_coins integer;
    total_earned integer;
    total_spent integer;
    total_gifted integer;
    next_coin_history jsonb;
begin
    if current_user_id is null then
        raise exception 'You must be signed in to accept coins.';
    end if;

    progress_row := private.ensure_student_progress_row(current_user_id);
    next_coin_data := private.normalize_coin_data(progress_row.coin_data);
    gift_coins := (next_coin_data ->> 'giftCoins')::integer;
    if gift_coins <= 0 then
        return progress_row;
    end if;

    balance := (next_coin_data ->> 'balance')::integer;
    total_earned := (next_coin_data ->> 'totalEarned')::integer;
    total_spent := (next_coin_data ->> 'totalSpent')::integer;
    total_gifted := (next_coin_data ->> 'totalGifted')::integer;
    next_coin_history := private.append_coin_history(
        coalesce(progress_row.coin_history, '[]'::jsonb),
        private.coin_history_entry('accept', gift_coins, 'teacher', 'Accepted gift from teacher', p_client_id)
    );
    next_coin_data := jsonb_build_object(
        'balance', balance + gift_coins,
        'giftCoins', 0,
        'totalEarned', total_earned,
        'totalSpent', total_spent,
        'totalGifted', total_gifted + gift_coins
    );

    update public.student_progress
    set coin_data = next_coin_data,
        coins = (next_coin_data ->> 'balance')::integer,
        coin_history = next_coin_history,
        updated_at = now()
    where user_id = current_user_id
    returning * into progress_row;

    return progress_row;
end;
$$;

create or replace function public.claim_student_welcome_bonus(p_client_id text default null)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    progress_row public.student_progress;
    next_coin_data jsonb;
    balance integer;
    gift_coins integer;
    total_earned integer;
    total_spent integer;
    total_gifted integer;
    next_coin_history jsonb;
    already_claimed boolean;
begin
    if current_user_id is null then
        raise exception 'You must be signed in to claim welcome coins.';
    end if;

    progress_row := private.ensure_student_progress_row(current_user_id);
    next_coin_data := private.normalize_coin_data(progress_row.coin_data);
    next_coin_history := coalesce(progress_row.coin_history, '[]'::jsonb);
    already_claimed := exists (
        select 1
        from jsonb_array_elements(next_coin_history) as entry(value)
        where entry.value ->> 'source' = 'welcome'
    );

    if already_claimed then
        return progress_row;
    end if;

    balance := (next_coin_data ->> 'balance')::integer;
    gift_coins := (next_coin_data ->> 'giftCoins')::integer;
    total_earned := (next_coin_data ->> 'totalEarned')::integer;
    total_spent := (next_coin_data ->> 'totalSpent')::integer;
    total_gifted := (next_coin_data ->> 'totalGifted')::integer;

    if balance > 0 or gift_coins > 0 or total_earned > 0 or total_spent > 0 or total_gifted > 0 then
        return progress_row;
    end if;

    next_coin_history := private.append_coin_history(
        next_coin_history,
        private.coin_history_entry('earn', 100, 'welcome', 'Welcome bonus!', p_client_id)
    );
    next_coin_data := jsonb_build_object(
        'balance', 100,
        'giftCoins', 0,
        'totalEarned', 100,
        'totalSpent', 0,
        'totalGifted', 0
    );

    update public.student_progress
    set coin_data = next_coin_data,
        coins = 100,
        coin_history = next_coin_history,
        updated_at = now()
    where user_id = current_user_id
    returning * into progress_row;

    return progress_row;
end;
$$;

create or replace function public.gift_student_coins(
    p_student_id uuid,
    p_amount integer,
    p_message text default 'Gift from teacher'
)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    progress_row public.student_progress;
    amount integer := coalesce(p_amount, 0);
    next_coin_data jsonb;
    balance integer;
    gift_coins integer;
    total_earned integer;
    total_spent integer;
    total_gifted integer;
    next_coin_history jsonb;
begin
    if not private.is_teacher() then
        raise exception 'Only teachers can gift coins.';
    end if;
    if p_student_id is null then
        raise exception 'A student id is required.';
    end if;
    if amount <= 0 or amount > 10000 then
        raise exception 'Coin gift amount is invalid.';
    end if;
    if not exists (select 1 from public.profiles where user_id = p_student_id and role = 'student') then
        raise exception 'Student profile was not found.';
    end if;

    progress_row := private.ensure_student_progress_row(p_student_id);
    next_coin_data := private.normalize_coin_data(progress_row.coin_data);
    balance := (next_coin_data ->> 'balance')::integer;
    gift_coins := (next_coin_data ->> 'giftCoins')::integer;
    total_earned := (next_coin_data ->> 'totalEarned')::integer;
    total_spent := (next_coin_data ->> 'totalSpent')::integer;
    total_gifted := (next_coin_data ->> 'totalGifted')::integer;
    next_coin_history := private.append_coin_history(
        coalesce(progress_row.coin_history, '[]'::jsonb),
        private.coin_history_entry('gift', amount, 'teacher', left(coalesce(p_message, 'Gift from teacher'), 240), null)
    );
    next_coin_data := jsonb_build_object(
        'balance', balance,
        'giftCoins', gift_coins + amount,
        'totalEarned', total_earned,
        'totalSpent', total_spent,
        'totalGifted', total_gifted
    );

    update public.student_progress
    set coin_data = next_coin_data,
        coins = balance,
        coin_history = next_coin_history,
        updated_at = now()
    where user_id = p_student_id
    returning * into progress_row;

    return progress_row;
end;
$$;

create or replace function public.submit_student_game_score(
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
        'level-devil',
        'radius-raid',
        'packabunchas',
        'spacepi',
        'black-hole-square',
        'glitch-buster',
        'callisto',
        'js13k2021',
        'mystic-valley',
        'slash-knight'
    ];
    numeric_score numeric := coalesce(p_score, 0);
    lower_is_better boolean;
    profile_row public.profiles;
    existing_row public.scores;
    result_row public.scores;
    score_id text;
    safe_metadata jsonb := case when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then p_metadata else '{}'::jsonb end;
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

    if profile_row.user_id is null or profile_row.role <> 'student' then
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

alter function public.ensure_own_student_progress(jsonb) set schema private;
alter function public.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text) set schema private;
alter function public.sync_student_unit_work(text, jsonb, jsonb) set schema private;
alter function public.spend_student_coins(integer, text, text, text) set schema private;
alter function public.accept_student_gift_coins(text) set schema private;
alter function public.claim_student_welcome_bonus(text) set schema private;
alter function public.gift_student_coins(uuid, integer, text) set schema private;
alter function public.submit_student_game_score(text, numeric, jsonb) set schema private;

grant execute on function private.ensure_own_student_progress(jsonb) to authenticated;
grant execute on function private.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text) to authenticated;
grant execute on function private.sync_student_unit_work(text, jsonb, jsonb) to authenticated;
grant execute on function private.spend_student_coins(integer, text, text, text) to authenticated;
grant execute on function private.accept_student_gift_coins(text) to authenticated;
grant execute on function private.claim_student_welcome_bonus(text) to authenticated;
grant execute on function private.gift_student_coins(uuid, integer, text) to authenticated;
grant execute on function private.submit_student_game_score(text, numeric, jsonb) to authenticated;

create or replace function public.ensure_own_student_progress(p_student_profile jsonb default '{}'::jsonb)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.ensure_own_student_progress(p_student_profile);
$$;

create or replace function public.submit_student_activity_progress(
    p_unit_key text,
    p_unit_context jsonb,
    p_activity_type text,
    p_score numeric,
    p_is_complete boolean default false,
    p_details jsonb default '{}'::jsonb,
    p_activity_settings jsonb default '{}'::jsonb,
    p_client_id text default null
)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.submit_student_activity_progress(
        p_unit_key,
        p_unit_context,
        p_activity_type,
        p_score,
        p_is_complete,
        p_details,
        p_activity_settings,
        p_client_id
    );
$$;

create or replace function public.sync_student_unit_work(
    p_unit_key text,
    p_unit_context jsonb,
    p_work_patch jsonb
)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.sync_student_unit_work(p_unit_key, p_unit_context, p_work_patch);
$$;

create or replace function public.spend_student_coins(
    p_amount integer,
    p_source text default 'game',
    p_description text default 'Spent on game',
    p_client_id text default null
)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.spend_student_coins(p_amount, p_source, p_description, p_client_id);
$$;

create or replace function public.accept_student_gift_coins(p_client_id text default null)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.accept_student_gift_coins(p_client_id);
$$;

create or replace function public.claim_student_welcome_bonus(p_client_id text default null)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.claim_student_welcome_bonus(p_client_id);
$$;

create or replace function public.gift_student_coins(
    p_student_id uuid,
    p_amount integer,
    p_message text default 'Gift from teacher'
)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.gift_student_coins(p_student_id, p_amount, p_message);
$$;

create or replace function public.submit_student_game_score(
    p_game_id text,
    p_score numeric,
    p_metadata jsonb default '{}'::jsonb
)
returns public.scores
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.submit_student_game_score(p_game_id, p_score, p_metadata);
$$;

drop policy if exists "student_progress_insert_self" on public.student_progress;
drop policy if exists "student_progress_update_self_or_teacher" on public.student_progress;
drop policy if exists "student_progress_update_teachers" on public.student_progress;
create policy "student_progress_update_teachers"
on public.student_progress
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());

drop policy if exists "scores_insert_own" on public.scores;
drop policy if exists "scores_update_own_or_teacher" on public.scores;
drop policy if exists "scores_insert_teachers" on public.scores;
create policy "scores_insert_teachers"
on public.scores
for insert
to authenticated
with check (private.is_teacher());

drop policy if exists "scores_update_teachers" on public.scores;
create policy "scores_update_teachers"
on public.scores
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());

revoke insert, update on public.student_progress from authenticated;
revoke insert, update on public.scores from authenticated;
grant select on public.student_progress to authenticated;
grant select on public.scores to authenticated;

revoke all on function public.ensure_own_student_progress(jsonb) from public;
revoke all on function public.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text) from public;
revoke all on function public.sync_student_unit_work(text, jsonb, jsonb) from public;
revoke all on function public.spend_student_coins(integer, text, text, text) from public;
revoke all on function public.accept_student_gift_coins(text) from public;
revoke all on function public.claim_student_welcome_bonus(text) from public;
revoke all on function public.gift_student_coins(uuid, integer, text) from public;
revoke all on function public.submit_student_game_score(text, numeric, jsonb) from public;

grant execute on function public.ensure_own_student_progress(jsonb) to authenticated;
grant execute on function public.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text) to authenticated;
grant execute on function public.sync_student_unit_work(text, jsonb, jsonb) to authenticated;
grant execute on function public.spend_student_coins(integer, text, text, text) to authenticated;
grant execute on function public.accept_student_gift_coins(text) to authenticated;
grant execute on function public.claim_student_welcome_bonus(text) to authenticated;
grant execute on function public.gift_student_coins(uuid, integer, text) to authenticated;
grant execute on function public.submit_student_game_score(text, numeric, jsonb) to authenticated;
