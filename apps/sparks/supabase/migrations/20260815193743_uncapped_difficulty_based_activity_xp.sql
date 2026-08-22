-- Award XP by activity difficulty. Required activities still earn XP only once
-- per unit/activity; optional activities can earn XP on every verified attempt.
create or replace function private.student_activity_xp_amount(p_activity_type text)
returns integer
language sql
immutable
set search_path = ''
as $$
    select case trim(coalesce(p_activity_type, ''))
        when 'flashcards' then 10
        when 'matching' then 20
        when 'word-search' then 20
        when 'hangman' then 20
        when 'scramble' then 20
        when 'wordle' then 25
        when 'speed-match' then 30
        when 'fill-in-blank' then 30
        when 'crossword' then 35
        when 'quiz' then 40
        when 'synonym-antonym' then 40
        when 'illustration' then 50
        else 10
    end
$$;

revoke all on function private.student_activity_xp_amount(text) from public, anon, authenticated;

-- Normalize every new required/optional ledger entry before the legacy award
-- function reads it back, so total_xp receives the difficulty-based amount.
create or replace function private.set_student_xp_event_amount()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
    if new.activity_role in ('required', 'optional') then
        new.xp_amount := private.student_activity_xp_amount(new.activity_type);
    end if;
    return new;
end;
$$;

revoke all on function private.set_student_xp_event_amount() from public, anon, authenticated;

drop trigger if exists set_student_xp_event_amount on public.student_xp_events;
create trigger set_student_xp_event_amount
before insert on public.student_xp_events
for each row execute function private.set_student_xp_event_amount();

-- The previous implementation stops inserting optional XP after 50 XP per
-- unit/day. A verified completed attempt with no ledger row therefore means the
-- old cap blocked it. Insert that missing event here, with no daily cap.
create or replace function private.award_uncapped_student_activity_xp()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
    vocabulary_row public.vocabularies;
    activity_role text;
    awarded_xp integer;
begin
    if old.completed_at is not null or new.completed_at is null then
        return new;
    end if;

    if exists (
        select 1
        from public.student_xp_events event
        where event.user_id = new.user_id
          and event.attempt_id = new.id::text
    ) then
        return new;
    end if;

    select * into vocabulary_row
    from public.vocabularies
    where id = new.vocabulary_id;

    if vocabulary_row.id is null then
        return new;
    end if;

    activity_role := case
        when new.activity_type = any(private.required_vocabulary_activities(vocabulary_row)) then 'required'
        else 'optional'
    end;

    insert into public.student_xp_events (
        user_id, unit_key, activity_type, activity_role, attempt_id, xp_amount, reason
    ) values (
        new.user_id,
        new.unit_key,
        new.activity_type,
        activity_role,
        new.id::text,
        private.student_activity_xp_amount(new.activity_type),
        case
            when activity_role = 'required' then 'First required activity completion'
            else 'Optional activity completion'
        end
    )
    on conflict do nothing
    returning xp_amount into awarded_xp;

    if coalesce(awarded_xp, 0) > 0 then
        update public.student_progress
        set total_xp = total_xp + awarded_xp,
            updated_at = now()
        where user_id = new.user_id;
    end if;

    return new;
end;
$$;

revoke all on function private.award_uncapped_student_activity_xp() from public, anon, authenticated;

drop trigger if exists award_uncapped_student_activity_xp on private.student_activity_attempts;
create trigger award_uncapped_student_activity_xp
after update of completed_at on private.student_activity_attempts
for each row execute function private.award_uncapped_student_activity_xp();
