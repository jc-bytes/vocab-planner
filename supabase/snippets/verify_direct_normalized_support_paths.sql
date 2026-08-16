-- Run inside a transaction and always roll back.
create temp table direct_support_test as
select
    (select user_id from public.profiles where role = 'teacher' order by user_id limit 1) teacher_id,
    summary.user_id student_id,
    summary.version initial_version,
    summary.coins initial_coins,
    (summary.coin_data ->> 'giftCoins')::integer initial_gift_coins,
    legacy.updated_at legacy_updated_at,
    unit.unit_key
from public.student_progress_summary summary
join public.student_progress legacy on legacy.user_id = summary.user_id
join public.student_unit_progress unit on unit.user_id = summary.user_id
order by summary.user_id, unit.unit_key
limit 1;

grant select on direct_support_test to authenticated, service_role;

select set_config(
    'request.jwt.claims',
    jsonb_build_object(
        'sub', (select teacher_id from direct_support_test),
        'role', 'authenticated'
    )::text,
    true
);
set local role authenticated;

select public.gift_student_coins_v2(
    'direct-teacher-gift-verification', student_id, 7, 'Rollback gift verification'
)
from direct_support_test;
select public.gift_student_coins_v2(
    'direct-teacher-gift-verification', student_id, 7, 'Rollback gift verification'
)
from direct_support_test;

create temp table direct_gift_result as
select version, coins, (coin_data ->> 'giftCoins')::integer gift_coins
from public.student_progress_summary
where user_id = (select student_id from direct_support_test);

reset role;
select set_config(
    'request.jwt.claims',
    jsonb_build_object(
        'sub', (select student_id from direct_support_test),
        'role', 'authenticated'
    )::text,
    true
);
set local role authenticated;

select public.accept_student_gift_coins_v2(
    'direct-accept-gift-verification', 'verification-client'
);
select public.accept_student_gift_coins_v2(
    'direct-accept-gift-verification', 'verification-client'
);

select public.sync_student_unit_work_v2(
    'direct-state-verification',
    unit_key,
    '{}'::jsonb,
    jsonb_build_object('states', jsonb_build_object(
        'flashcards', jsonb_build_object('version', 4, 'cardIndex', 3)
    ))
)
from direct_support_test;

reset role;

-- Isolate welcome-bonus behavior using the same student, inside this rollback.
delete from public.student_coin_ledger
where user_id = (select student_id from direct_support_test);
update public.student_progress_summary
set coins = 0,
    coin_data = '{"balance":0,"giftCoins":0,"totalEarned":0,"totalSpent":0,"totalGifted":0}'::jsonb
where user_id = (select student_id from direct_support_test);

set local role authenticated;
select public.claim_student_welcome_bonus_v2(
    'direct-welcome-verification', 'verification-client'
);
select public.claim_student_welcome_bonus_v2(
    'direct-welcome-verification', 'verification-client'
);
reset role;

do $$
declare
    test direct_support_test;
    accepted_wallet public.student_progress_summary;
    legacy_time timestamptz;
begin
    select * into test from direct_support_test;
    select * into accepted_wallet from public.student_progress_summary where user_id = test.student_id;
    select updated_at into legacy_time from public.student_progress where user_id = test.student_id;

    if (select gift_coins from direct_gift_result) <> test.initial_gift_coins + 7 then
        raise exception 'Teacher gift was not applied exactly once.';
    end if;
    if not exists (
        select 1 from public.student_activity_state
        where user_id = test.student_id and unit_key = test.unit_key
          and activity_type = 'flashcards' and state_data ->> 'cardIndex' = '3'
    ) then
        raise exception 'Normalized activity state was not saved.';
    end if;
    if exists (
        select 1 from public.student_unit_progress
        where user_id = test.student_id and unit_key = test.unit_key and work_data ? 'states'
    ) then
        raise exception 'Activity states leaked into unit work JSON.';
    end if;
    if accepted_wallet.coins <> 100
       or (accepted_wallet.coin_data ->> 'totalEarned')::integer <> 100 then
        raise exception 'Welcome bonus was not applied exactly once.';
    end if;
    if (select count(*) from public.student_coin_ledger
        where user_id = test.student_id and source = 'welcome') <> 1 then
        raise exception 'Welcome bonus ledger entry was duplicated.';
    end if;
    if legacy_time is distinct from test.legacy_updated_at then
        raise exception 'A support-path operation modified legacy progress.';
    end if;
end;
$$;

-- Teacher bulk and single-student reads use normalized snapshots.
select set_config(
    'request.jwt.claims',
    jsonb_build_object(
        'sub', (select teacher_id from direct_support_test),
        'role', 'authenticated'
    )::text,
    true
);
set local role authenticated;
do $$
begin
    if jsonb_array_length(public.get_students_progress_v3())
       <> (select count(*) from public.profiles where role = 'student') then
        raise exception 'Teacher normalized progress list is incomplete.';
    end if;
    if public.get_student_progress_v3((select student_id from direct_support_test)) ->> 'userId'
       <> (select student_id::text from direct_support_test) then
        raise exception 'Teacher single-student normalized read failed.';
    end if;
end;
$$;
reset role;

-- Service-role account provisioning can recreate a normalized summary.
delete from public.student_progress_summary
where user_id = (select student_id from direct_support_test);
set local role service_role;
select public.provision_student_progress_v2(
    student_id, '{}'::jsonb
)
from direct_support_test;
reset role;

do $$
begin
    if not exists (
        select 1 from public.student_progress_summary
        where user_id = (select student_id from direct_support_test)
    ) then
        raise exception 'Normalized account provisioning failed.';
    end if;
end;
$$;

select jsonb_build_object(
    'teacherGift', true,
    'giftAcceptance', true,
    'welcomeBonus', true,
    'activityState', true,
    'teacherReads', true,
    'provisioning', true,
    'legacyUntouched', true
) as verification;
