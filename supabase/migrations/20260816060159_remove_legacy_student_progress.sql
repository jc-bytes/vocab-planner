-- Complete the normalized progress cutover. This migration intentionally uses
-- restrictive drops: an unknown dependency aborts the whole transaction.

lock table public.student_progress in access exclusive mode;
lock table public.student_progress_summary in access exclusive mode;
lock table public.student_unit_progress in access exclusive mode;
lock table public.student_activity_progress in access exclusive mode;
lock table public.student_activity_state in access exclusive mode;

do $$
begin
    if exists (
        select 1
        from public.profiles profile
        where profile.role = 'student'
          and not exists (
              select 1 from public.student_progress legacy
              where legacy.user_id = profile.user_id
          )
    ) then
        raise exception 'Legacy deletion blocked: a current student is missing the pre-cutover record.';
    end if;

    if exists (
        select 1
        from public.profiles profile
        where profile.role = 'student'
          and not exists (
              select 1 from public.student_progress_summary summary
              where summary.user_id = profile.user_id
          )
    ) then
        raise exception 'Legacy deletion blocked: a current student is missing the normalized summary.';
    end if;

    if exists (
        select 1
        from public.student_progress legacy
        where not exists (
            select 1 from public.student_progress_summary summary
            where summary.user_id = legacy.user_id
        )
    ) then
        raise exception 'Legacy deletion blocked: a legacy row has no normalized recovery copy.';
    end if;
end;
$$;

-- New profiles now create only the small normalized summary row.
create or replace function public.ensure_student_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.role = 'student' then
        insert into public.student_progress_summary (user_id)
        values (new.user_id)
        on conflict (user_id) do nothing;
    end if;
    return new;
end;
$$;

revoke all on function public.ensure_student_progress() from public, anon, authenticated;

-- The fallback attempt-completion trigger must also update the normalized
-- summary. The main activity RPC inserts the XP event first, so it remains
-- protected from double awards by the existing event check.
create or replace function private.award_uncapped_student_activity_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
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

    if vocabulary_row.id is null then return new; end if;

    activity_role := case
        when new.activity_type = any(private.required_vocabulary_activities(vocabulary_row)) then 'required'
        else 'optional'
    end;

    insert into public.student_xp_events (
        user_id, unit_key, activity_type, activity_role, attempt_id, xp_amount, reason
    ) values (
        new.user_id, new.unit_key, new.activity_type, activity_role, new.id::text,
        private.student_activity_xp_amount(new.activity_type),
        case when activity_role = 'required'
            then 'First required activity completion'
            else 'Optional activity completion'
        end
    )
    on conflict do nothing
    returning xp_amount into awarded_xp;

    if coalesce(awarded_xp, 0) > 0 then
        insert into public.student_progress_summary (user_id, total_xp, version)
        values (new.user_id, awarded_xp, 1)
        on conflict (user_id) do update
        set total_xp = public.student_progress_summary.total_xp + excluded.total_xp,
            version = public.student_progress_summary.version + 1,
            updated_at = now();
    end if;

    return new;
end;
$$;

revoke all on function private.award_uncapped_student_activity_xp() from public, anon, authenticated;

drop trigger if exists sync_legacy_student_progress_to_v2 on public.student_progress;

-- Remove the old public API before removing its private implementations.
drop function public.accept_student_gift_coins(text);
drop function public.claim_student_welcome_bonus(text);
drop function public.ensure_own_student_progress(jsonb);
drop function public.gift_student_coins(uuid, integer, text);
drop function public.provision_student_progress_for_account(uuid, jsonb);
drop function public.spend_student_coins(integer, text, text, text);
drop function public.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text);
drop function public.sync_student_unit_work(text, jsonb, jsonb);

drop function private.accept_student_gift_coins(text);
drop function private.claim_student_welcome_bonus(text);
drop function private.ensure_own_student_progress(jsonb);
drop function private.gift_student_coins(uuid, integer, text);
drop function private.provision_student_progress_for_account(uuid, jsonb);
drop function private.spend_student_coins(integer, text, text, text);
drop function private.submit_student_activity_progress(text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text);
drop function private.sync_student_unit_work(text, jsonb, jsonb);
drop function private.apply_student_activity_progress_legacy(text, jsonb, text, numeric, boolean, jsonb, jsonb, text, boolean, text);
drop function private.student_progress_v2_reconciliation();
drop function private.sync_legacy_student_progress_to_v2();
drop function private.apply_legacy_student_progress_to_v2(public.student_progress);
drop function private.ensure_student_progress_row(uuid);

-- Restrictive by design: this fails instead of silently cascading if any old
-- code still depends on the table.
drop table public.student_progress;

alter table public.student_progress_summary
drop column legacy_updated_at;

-- Service-role maintenance clients bypass RLS but still require explicit table
-- privileges for acceptance checks, incident repair, and controlled cleanup.
grant select, insert, update, delete on public.student_progress_summary to service_role;
grant select, insert, update, delete on public.student_unit_progress to service_role;
grant select, insert, update, delete on public.student_activity_progress to service_role;
grant select, insert, update, delete on public.student_activity_state to service_role;
grant select, insert, update, delete on public.student_coin_ledger to service_role;

-- Remove empty progress created for an account that is no longer a student.
delete from public.student_progress_summary summary
where not exists (
        select 1 from public.profiles profile
        where profile.user_id = summary.user_id and profile.role = 'student'
    )
  and summary.total_xp = 0
  and summary.coins = 0
  and summary.coin_data = private.normalize_coin_data('{}'::jsonb)
  and not exists (select 1 from public.student_unit_progress unit where unit.user_id = summary.user_id)
  and not exists (select 1 from public.student_coin_ledger ledger where ledger.user_id = summary.user_id)
  and not exists (select 1 from public.student_xp_events event where event.user_id = summary.user_id);

create or replace function private.student_progress_normalized_integrity()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'studentProfiles', (select count(*) from public.profiles where role = 'student'),
        'summaryRows', (select count(*) from public.student_progress_summary),
        'unitRows', (select count(*) from public.student_unit_progress),
        'activityRows', (select count(*) from public.student_activity_progress),
        'stateRows', (select count(*) from public.student_activity_state),
        'missingSummaries', (
            select count(*) from public.profiles profile
            where profile.role = 'student'
              and not exists (
                  select 1 from public.student_progress_summary summary
                  where summary.user_id = profile.user_id
              )
        ),
        'orphanSummaries', (
            select count(*) from public.student_progress_summary summary
            where not exists (
                select 1 from public.profiles profile
                where profile.user_id = summary.user_id and profile.role = 'student'
            )
        )
    );
$$;

revoke all on function private.student_progress_normalized_integrity()
from public, anon, authenticated;
