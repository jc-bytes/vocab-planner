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
