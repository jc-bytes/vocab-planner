-- Preserve the existing RPC and ACL; no economy or duration changes.
begin;
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
    client_event_id text := left(trim(coalesce(p_event_id, '')), 240);
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
    if client_event_id = '' or length(client_event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    if game_id = '' then raise exception 'A game ID is required.'; end if;

    -- Serialize the receipt lookup before selecting the price. Replays use the
    -- server price captured by their original receipt, even after settings change.
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || client_event_id, 0));
    select (receipt.response_data ->> 'coinCost')::integer into coin_cost
    from private.student_progress_event_receipts receipt
    where receipt.user_id = current_user_id and receipt.event_id = client_event_id
      and receipt.operation = 'arcade-minute-v1';
    if coin_cost is null then
        select least(10000, greatest(1,
            floor(private.jsonb_number(settings.value, 'exchangeRate', 10))::integer
        )) into coin_cost
        from public.app_settings settings
        where settings.key = 'gamification';
        coin_cost := coalesce(coin_cost, 10);
    end if;

    request_data := jsonb_build_object(
        'gameId', game_id, 'coinCost', coin_cost,
        'clientId', coalesce(p_client_id, '')
    );
    request_hash := private.student_progress_event_hash('arcade-minute-v1', request_data);
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, client_event_id, 'arcade-minute-v1', request_hash
    );
    if cached_response is not null then
        -- The purchased minute and price stay fixed; balances may have changed.
        return cached_response || jsonb_build_object(
            'coinWallet', private.student_progress_wallet_v3(current_user_id),
            'arcadeTime', private.arcade_time_wallet_v1(current_user_id)
        );
    end if;

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
        current_user_id, left('arcade:' || client_event_id, 240), 'spend', -coin_cost, coin_balance,
        'game', 'Arcade minute: ' || game_id,
        jsonb_build_object('clientId', coalesce(p_client_id, ''), 'gameId', game_id)
    );
    insert into public.student_arcade_time_ledger (
        user_id, event_key, seconds_delta, balance_after, source, description, metadata
    ) values (
        current_user_id, left('arcade:' || client_event_id, 240), -60, next_seconds,
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
        current_user_id, client_event_id, 'arcade-minute-v1', request_hash, response_data
    );
end;
$$;

-- New clients bind the captured browser owner to the JWT selected by the SDK.
-- Keep the original three-argument endpoint and its ACL for older releases.
create or replace function public.start_student_arcade_minute_owned_v1(
    p_expected_user_id uuid,
    p_event_id text,
    p_game_id text,
    p_client_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated student does not own this Arcade purchase.' using errcode = '42501';
    end if;
    return private.start_student_arcade_minute_v1(p_event_id, p_game_id, p_client_id);
end;
$$;
revoke all on function public.start_student_arcade_minute_owned_v1(uuid,text,text,text) from public, anon;
grant execute on function public.start_student_arcade_minute_owned_v1(uuid,text,text,text) to authenticated;

commit;
