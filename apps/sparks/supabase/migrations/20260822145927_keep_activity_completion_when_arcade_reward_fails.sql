-- Arcade time is a secondary reward. Its ledger must never roll back a valid
-- student activity completion.
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
    v_event_key text := left('formative:' || new.unit_key || ':' || new.activity_type, 240);
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
        new.user_id, v_event_key, seconds_added, next_balance,
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
exception when others then
    raise warning 'Could not award Arcade time for completed activity: %', sqlerrm;
    return new;
end;
$$;

revoke all on function private.award_arcade_time_for_formative_completion_v1()
from public, anon, authenticated;
