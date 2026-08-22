-- Arcade access is intentionally separate from coins. Students must have both
-- enough coins and formative-earned time before a game minute can begin.

create table public.student_arcade_time (
    user_id uuid primary key references auth.users(id) on delete cascade,
    available_seconds integer not null default 0 check (available_seconds >= 0),
    lifetime_earned_seconds integer not null default 0 check (lifetime_earned_seconds >= 0),
    lifetime_used_seconds integer not null default 0 check (lifetime_used_seconds >= 0),
    updated_at timestamptz not null default now()
);

create table public.student_arcade_time_ledger (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    event_key text not null check (length(event_key) between 1 and 240),
    seconds_delta integer not null check (seconds_delta <> 0),
    balance_after integer not null check (balance_after >= 0),
    source text not null default '',
    description text not null default '',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (user_id, event_key),
    constraint student_arcade_time_ledger_metadata_object
        check (jsonb_typeof(metadata) = 'object'),
    constraint student_arcade_time_ledger_metadata_size
        check (octet_length(metadata::text) <= 16384)
);

create index student_arcade_time_ledger_user_created_idx
    on public.student_arcade_time_ledger (user_id, created_at desc);

alter table public.student_arcade_time enable row level security;
alter table public.student_arcade_time_ledger enable row level security;

create policy "student_arcade_time_select_self_or_teacher"
on public.student_arcade_time for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_teacher()));

create policy "student_arcade_time_ledger_select_self_or_teacher"
on public.student_arcade_time_ledger for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_teacher()));

revoke all on public.student_arcade_time from public, anon, authenticated;
revoke all on public.student_arcade_time_ledger from public, anon, authenticated;
revoke all on sequence public.student_arcade_time_ledger_id_seq from public, anon, authenticated;
grant select on public.student_arcade_time to authenticated;
grant select on public.student_arcade_time_ledger to authenticated;
grant select, insert, update, delete on public.student_arcade_time to service_role;
grant select, insert, update, delete on public.student_arcade_time_ledger to service_role;

grant usage, select on sequence public.student_arcade_time_ledger_id_seq to service_role;

create or replace function private.arcade_time_wallet_v1(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'userId', wallet.user_id,
        'availableSeconds', wallet.available_seconds,
        'availableMinutes', floor(wallet.available_seconds / 60.0),
        'lifetimeEarnedSeconds', wallet.lifetime_earned_seconds,
        'lifetimeUsedSeconds', wallet.lifetime_used_seconds,
        'updatedAt', wallet.updated_at
    )
    from public.student_arcade_time wallet
    where wallet.user_id = p_user_id;
$$;

create or replace function private.ensure_arcade_time_wallet_v1(p_user_id uuid)
returns public.student_arcade_time
language plpgsql
security definer
set search_path = ''
as $$
declare
    wallet public.student_arcade_time;
begin
    if p_user_id is null then raise exception 'A student ID is required.'; end if;
    if not exists (
        select 1 from public.profiles
        where user_id = p_user_id and role = 'student'
    ) then
        raise exception 'Student profile was not found.';
    end if;

    insert into public.student_arcade_time (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select * into wallet
    from public.student_arcade_time
    where user_id = p_user_id
    for update;
    return wallet;
end;
$$;

-- Flashcards are study/review rather than a formative check. Every other
-- verified first completion refreshes one non-stacking ten-minute window.
create or replace function private.award_arcade_time_for_formative_completion_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    wallet public.student_arcade_time;
    next_balance integer;
    seconds_added integer;
    event_key text := left('formative:' || new.unit_key || ':' || new.activity_type, 240);
begin
    if not new.is_complete
        or not new.verified
        or (tg_op = 'UPDATE' and old.is_complete)
        or new.activity_type = 'flashcards'
    then
        return new;
    end if;

    wallet := private.ensure_arcade_time_wallet_v1(new.user_id);
    next_balance := 600;
    seconds_added := greatest(0, next_balance - wallet.available_seconds);

    if seconds_added = 0 then return new; end if;

    insert into public.student_arcade_time_ledger (
        user_id, event_key, seconds_delta, balance_after,
        source, description, metadata
    ) values (
        new.user_id, event_key, seconds_added, next_balance,
        'formative_activity', 'Refreshed the 10-minute Arcade window',
        jsonb_build_object('unitKey', new.unit_key, 'activityType', new.activity_type)
    ) on conflict (user_id, event_key) do nothing;

    if found then
        update public.student_arcade_time
        set available_seconds = next_balance,
            lifetime_earned_seconds = lifetime_earned_seconds + seconds_added,
            updated_at = now()
        where user_id = new.user_id;
    end if;
    return new;
end;
$$;

create trigger award_arcade_time_for_formative_completion
after insert or update of is_complete on public.student_activity_progress
for each row execute function private.award_arcade_time_for_formative_completion_v1();

create or replace function private.get_own_arcade_time_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    perform private.ensure_arcade_time_wallet_v1(current_user_id);
    return private.arcade_time_wallet_v1(current_user_id);
end;
$$;

create or replace function private.start_student_arcade_minute_v1(
    p_event_id text,
    p_game_id text,
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
    game_id text := left(trim(coalesce(p_game_id, '')), 120);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
    summary_row public.student_progress_summary;
    wallet public.student_arcade_time;
    next_coin_data jsonb;
    coin_balance integer;
    coin_cost integer := 10;
    next_seconds integer;
begin
    if current_user_id is null then raise exception 'You must be signed in to play.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    if game_id = '' then raise exception 'A game ID is required.'; end if;

    select least(10000, greatest(1,
        floor(private.jsonb_number(settings.value, 'exchangeRate', 10))::integer
    )) into coin_cost
    from public.app_settings settings
    where settings.key = 'gamification';
    coin_cost := coalesce(coin_cost, 10);

    request_data := jsonb_build_object(
        'gameId', game_id, 'coinCost', coin_cost,
        'clientId', coalesce(p_client_id, '')
    );
    request_hash := private.student_progress_event_hash('arcade-minute-v1', request_data);
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'arcade-minute-v1', request_hash
    );
    if cached_response is not null then return cached_response; end if;

    summary_row := private.ensure_student_progress_summary_v3(current_user_id);
    wallet := private.ensure_arcade_time_wallet_v1(current_user_id);
    next_coin_data := private.normalize_coin_data(summary_row.coin_data);
    coin_balance := (next_coin_data ->> 'balance')::integer;

    if wallet.available_seconds < 60 then
        raise exception 'Complete another formative activity before continuing the Arcade.';
    end if;
    if coin_balance < coin_cost then raise exception 'Not enough coins.'; end if;

    coin_balance := coin_balance - coin_cost;
    next_seconds := wallet.available_seconds - 60;
    next_coin_data := jsonb_set(next_coin_data, '{balance}', to_jsonb(coin_balance), true);
    next_coin_data := jsonb_set(
        next_coin_data, '{totalSpent}',
        to_jsonb((next_coin_data ->> 'totalSpent')::integer + coin_cost), true
    );

    insert into public.student_coin_ledger (
        user_id, event_key, event_type, amount, balance_after, source, description, metadata
    ) values (
        current_user_id, left('arcade:' || event_id, 240), 'spend', -coin_cost, coin_balance,
        'game', 'Arcade minute: ' || game_id,
        jsonb_build_object('clientId', coalesce(p_client_id, ''), 'gameId', game_id)
    );
    insert into public.student_arcade_time_ledger (
        user_id, event_key, seconds_delta, balance_after, source, description, metadata
    ) values (
        current_user_id, left('arcade:' || event_id, 240), -60, next_seconds,
        'arcade', 'Played one Arcade minute',
        jsonb_build_object('clientId', coalesce(p_client_id, ''), 'gameId', game_id)
    );

    update public.student_progress_summary
    set coins = coin_balance, coin_data = next_coin_data,
        version = version + 1, updated_at = now()
    where user_id = current_user_id;
    update public.student_arcade_time
    set available_seconds = next_seconds,
        lifetime_used_seconds = lifetime_used_seconds + 60,
        updated_at = now()
    where user_id = current_user_id;

    response_data := jsonb_build_object(
        'coinWallet', private.student_progress_wallet_v3(current_user_id),
        'arcadeTime', private.arcade_time_wallet_v1(current_user_id),
        'minuteSeconds', 60,
        'coinCost', coin_cost
    );
    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'arcade-minute-v1', request_hash, response_data
    );
end;
$$;

create or replace function public.get_own_arcade_time_v1()
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.get_own_arcade_time_v1(); $$;

create or replace function public.start_student_arcade_minute_v1(
    p_event_id text,
    p_game_id text,
    p_client_id text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.start_student_arcade_minute_v1(p_event_id, p_game_id, p_client_id); $$;

revoke all on function private.arcade_time_wallet_v1(uuid) from public, anon, authenticated;
revoke all on function private.ensure_arcade_time_wallet_v1(uuid) from public, anon, authenticated;
revoke all on function private.award_arcade_time_for_formative_completion_v1() from public, anon, authenticated;
revoke all on function private.get_own_arcade_time_v1() from public, anon;
revoke all on function private.start_student_arcade_minute_v1(text, text, text) from public, anon;
grant execute on function private.get_own_arcade_time_v1() to authenticated;
grant execute on function private.start_student_arcade_minute_v1(text, text, text) to authenticated;

revoke all on function public.get_own_arcade_time_v1() from public, anon;
revoke all on function public.start_student_arcade_minute_v1(text, text, text) from public, anon;
grant execute on function public.get_own_arcade_time_v1() to authenticated;
grant execute on function public.start_student_arcade_minute_v1(text, text, text) to authenticated;

grant select, insert, update, delete on public.student_arcade_time to service_role;
grant select, insert, update, delete on public.student_arcade_time_ledger to service_role;
