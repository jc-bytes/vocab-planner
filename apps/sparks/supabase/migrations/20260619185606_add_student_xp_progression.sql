alter table public.student_progress
add column if not exists total_xp integer not null default 0
check (total_xp >= 0);

create table if not exists public.student_xp_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    unit_key text not null,
    activity_type text not null,
    activity_role text not null check (activity_role in ('required', 'optional', 'legacy')),
    attempt_id text not null,
    xp_amount integer not null check (xp_amount > 0 and xp_amount <= 50),
    reason text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists student_xp_events_attempt_idx
on public.student_xp_events (user_id, attempt_id);

create unique index if not exists student_xp_events_required_once_idx
on public.student_xp_events (user_id, unit_key, activity_type)
where activity_role = 'required';

create index if not exists student_xp_events_user_created_idx
on public.student_xp_events (user_id, created_at desc);

create index if not exists student_xp_events_optional_daily_idx
on public.student_xp_events (user_id, unit_key, created_at)
where activity_role = 'optional';

alter table public.student_xp_events enable row level security;

drop policy if exists "student_xp_events_select_self_or_teacher" on public.student_xp_events;
create policy "student_xp_events_select_self_or_teacher"
on public.student_xp_events
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_teacher());

revoke all on public.student_xp_events from anon, authenticated;
grant select on public.student_xp_events to authenticated;

with completed as (
    select
        progress.user_id,
        count(distinct (
            coalesce(nullif(unit.value ->> 'unitId', ''), unit.key)
            || ':' || score.key
        ))::integer as completed_count
    from public.student_progress progress
    cross join lateral jsonb_each(coalesce(progress.units, '{}'::jsonb)) unit
    cross join lateral jsonb_each(coalesce(unit.value -> 'scores', '{}'::jsonb)) score
    where coalesce((score.value ->> 'isComplete')::boolean, false)
       or coalesce((score.value ->> 'score')::numeric, 0) >= 100
    group by progress.user_id
), legacy_credits as (
    insert into public.student_xp_events (
        user_id,
        unit_key,
        activity_type,
        activity_role,
        attempt_id,
        xp_amount,
        reason
    )
    select
        user_id,
        '__legacy__',
        'migration',
        'legacy',
        'legacy-' || user_id::text,
        least(50, completed_count * 20),
        'XP earned before progression upgrade'
    from completed
    where completed_count > 0
    on conflict do nothing
    returning user_id
)
update public.student_progress progress
set total_xp = completed.completed_count * 20
from completed
where progress.user_id = completed.user_id
  and progress.total_xp = 0;

-- Legacy credit can exceed the per-event cap, so split any remainder into
-- deterministic 50-XP ledger entries while preserving the summary total.
insert into public.student_xp_events (
    user_id,
    unit_key,
    activity_type,
    activity_role,
    attempt_id,
    xp_amount,
    reason
)
select
    progress.user_id,
    '__legacy__',
    'migration-' || series.part,
    'legacy',
    'legacy-' || progress.user_id::text || '-' || series.part,
    least(50, progress.total_xp - 50 * series.part),
    'XP earned before progression upgrade'
from public.student_progress progress
cross join lateral generate_series(1, greatest(0, ceil(progress.total_xp / 50.0)::integer - 1)) series(part)
where progress.total_xp - 50 * series.part > 0
on conflict do nothing;

drop function if exists public.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text);
drop function if exists private.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text);

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
    progress_row public.student_progress;
    allowed_activities constant text[] := array[
        'flashcards', 'matching', 'quiz', 'synonym-antonym', 'word-search',
        'crossword', 'hangman', 'scramble', 'wordle', 'speed-match',
        'fill-in-blank', 'illustration'
    ];
    v_unit_key text := left(trim(coalesce(p_unit_key, '')), 200);
    v_activity_type text := left(trim(coalesce(p_activity_type, '')), 80);
    attempt_id text := left(trim(coalesce(p_attempt_id, '')), 160);
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
    xp_awarded integer := 0;
    optional_xp_today integer := 0;
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
    if v_unit_key = '' then
        raise exception 'A unit key is required.';
    end if;
    if v_activity_type <> all(allowed_activities) then
        raise exception 'Unsupported activity type: %', v_activity_type;
    end if;
    if length(details::text) > 10000 then
        raise exception 'Activity details are too large.';
    end if;
    if coalesce(p_is_complete, false) and attempt_id = '' then
        raise exception 'A completed activity requires an attempt ID.';
    end if;

    progress_row := private.ensure_student_progress_row(current_user_id);
    perform 1 from public.student_progress where user_id = current_user_id for update;
    select * into progress_row from public.student_progress where user_id = current_user_id;

    next_units := coalesce(progress_row.units, '{}'::jsonb);
    unit_data := coalesce(next_units -> v_unit_key, '{}'::jsonb);
    unit_scores := coalesce(unit_data -> 'scores', '{}'::jsonb);
    old_score_data := coalesce(unit_scores -> v_activity_type, '{}'::jsonb);
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
    end if;
    if coalesce(p_is_complete, false) then
        old_plays := old_plays + 1;
    end if;

    if coalesce(p_is_required, false) and new_complete and not old_complete then
        insert into public.student_xp_events (
            user_id, unit_key, activity_type, activity_role, attempt_id, xp_amount, reason
        ) values (
            current_user_id, v_unit_key, v_activity_type, 'required', attempt_id, 50, 'First required activity completion'
        )
        on conflict do nothing
        returning xp_amount into xp_awarded;
    elsif not coalesce(p_is_required, false) and coalesce(p_is_complete, false) then
        select coalesce(sum(xp_amount), 0)::integer
        into optional_xp_today
        from public.student_xp_events
        where user_id = current_user_id
          and student_xp_events.unit_key = v_unit_key
          and activity_role = 'optional'
          and created_at >= date_trunc('day', now());

        if optional_xp_today < 50 then
            insert into public.student_xp_events (
                user_id, unit_key, activity_type, activity_role, attempt_id, xp_amount, reason
            ) values (
                current_user_id, v_unit_key, v_activity_type, 'optional', attempt_id,
                least(10, 50 - optional_xp_today), 'Optional activity completion'
            )
            on conflict do nothing
            returning xp_amount into xp_awarded;
        end if;
    end if;
    xp_awarded := coalesce(xp_awarded, 0);

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
    unit_data := jsonb_set(unit_data, '{scores}', unit_scores || jsonb_build_object(v_activity_type, score_data), true);
    next_units := jsonb_set(next_units, array[v_unit_key], unit_data, true);

    next_coin_data := private.normalize_coin_data(progress_row.coin_data);
    next_coin_history := coalesce(progress_row.coin_history, '[]'::jsonb);
    if reward > 0 then
        next_coin_history := private.append_coin_history(
            next_coin_history,
            private.coin_history_entry('earn', reward, 'activity', v_activity_type, p_client_id)
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
        total_xp = total_xp + xp_awarded,
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

revoke all on function private.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text) from public, anon;
grant execute on function private.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text) to authenticated;

revoke all on function public.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text) from public, anon;
grant execute on function public.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text) to authenticated;
