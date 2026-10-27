-- Receipt lookup only. No spending implementation is reachable from this path.
create or replace function private.recover_student_arcade_minute_v1(
    p_event_id text, p_game_id text, p_client_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    current_user_id uuid := auth.uid();
    client_event_id text := left(trim(coalesce(p_event_id, '')), 240);
    game_id text := left(trim(coalesce(p_game_id, '')), 120);
    receipt private.student_progress_event_receipts;
    coin_cost integer;
    request_hash text;
    cached_response jsonb;
begin
    if current_user_id is null then raise exception 'You must be signed in to recover Arcade time.' using errcode='42501'; end if;
    if client_event_id = '' or length(client_event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    if game_id = '' then raise exception 'A game ID is required.'; end if;
    -- Match the purchase lock. A lookup that waits for an original purchase sees
    -- its committed receipt; an absent receipt can never fall through to debit.
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || client_event_id, 0));
    select * into receipt from private.student_progress_event_receipts
        where user_id = current_user_id and event_id = client_event_id;
    if not found then return jsonb_build_object('receiptFound', false); end if;
    if receipt.operation <> 'arcade-minute-v1' then
        raise exception 'The client event ID was already used for a different request.';
    end if;
    coin_cost := (receipt.response_data ->> 'coinCost')::integer;
    if coin_cost is null or coin_cost < 1 or coin_cost > 10000 then raise exception 'The Arcade receipt is invalid.'; end if;
    request_hash := private.student_progress_event_hash('arcade-minute-v1', jsonb_build_object(
        'gameId', game_id, 'coinCost', coin_cost, 'clientId', coalesce(p_client_id, '')
    ));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, client_event_id, 'arcade-minute-v1', request_hash
    );
    return jsonb_build_object('receiptFound', true, 'purchase', cached_response || jsonb_build_object(
        'coinWallet', private.student_progress_wallet_v3(current_user_id),
        'arcadeTime', private.arcade_time_wallet_v1(current_user_id)
    ));
end;
$$;
revoke all on function private.recover_student_arcade_minute_v1(text,text,text) from public, anon;
grant execute on function private.recover_student_arcade_minute_v1(text,text,text) to authenticated;

create or replace function public.recover_student_arcade_minute_owned_v1(
    p_expected_user_id uuid, p_event_id text, p_game_id text, p_client_id text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated student does not own this Arcade receipt.' using errcode='42501';
    end if;
    return private.recover_student_arcade_minute_v1(p_event_id,p_game_id,p_client_id);
end;
$$;
revoke all on function public.recover_student_arcade_minute_owned_v1(uuid,text,text,text) from public, anon;
grant execute on function public.recover_student_arcade_minute_owned_v1(uuid,text,text,text) to authenticated;
