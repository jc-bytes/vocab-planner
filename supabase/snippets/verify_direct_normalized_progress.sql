-- Run inside a transaction. This intentionally mutates a representative student
-- and must always be followed by ROLLBACK.
create temp table direct_progress_test as
select
    profile.user_id,
    vocabulary.id as vocabulary_id,
    vocabulary.subject_slug || ':' || vocabulary.id as unit_key,
    gen_random_uuid() as attempt_id,
    legacy.updated_at as legacy_updated_at,
    summary.version as initial_version,
    summary.coins as initial_coins
from public.profiles profile
join public.student_progress_summary summary on summary.user_id = profile.user_id
join public.student_progress legacy on legacy.user_id = profile.user_id
join lateral (
    select vocabulary.*
    from public.vocabularies vocabulary
    where profile.grade_level::text = any(vocabulary.grades)
      and (vocabulary.assigned_date is null or vocabulary.assigned_date <= current_date)
    order by vocabulary.assigned_date nulls last, vocabulary.id
    limit 1
) vocabulary on true
where profile.role = 'student' and summary.coins >= 1
order by profile.user_id
limit 1;

grant select on direct_progress_test to authenticated;

do $$
begin
    if not exists (select 1 from direct_progress_test) then
        raise exception 'No representative student is available for direct progress verification.';
    end if;
end;
$$;

insert into private.student_activity_attempts (
    id, user_id, vocabulary_id, unit_key, activity_type, started_at
)
select attempt_id, user_id, vocabulary_id, unit_key, 'flashcards', now() - interval '2 minutes'
from direct_progress_test;

select set_config(
    'request.jwt.claims',
    jsonb_build_object(
        'sub', (select user_id from direct_progress_test),
        'role', 'authenticated'
    )::text,
    true
);
set local role authenticated;

create temp table direct_activity_first as
select public.submit_student_activity_progress_v2(
    'direct-activity-verification',
    test.unit_key,
    jsonb_build_object('unitId', test.vocabulary_id),
    'flashcards',
    20,
    false,
    '{}'::jsonb,
    '{}'::jsonb,
    'verification-client',
    true,
    test.attempt_id::text
) response
from direct_progress_test test;

create temp table direct_activity_version as
select version from public.student_progress_summary
where user_id = (select user_id from direct_progress_test);

select public.submit_student_activity_progress_v2(
    'direct-activity-verification',
    test.unit_key,
    jsonb_build_object('unitId', test.vocabulary_id),
    'flashcards',
    20,
    false,
    '{}'::jsonb,
    '{}'::jsonb,
    'verification-client',
    true,
    test.attempt_id::text
)
from direct_progress_test test;

create temp table direct_unit_first as
select public.sync_student_unit_work_v2(
    'direct-unit-verification',
    test.unit_key,
    jsonb_build_object('unitId', test.vocabulary_id),
    jsonb_build_object('verificationNote', 'normalized-only')
) response
from direct_progress_test test;

create temp table direct_unit_version as
select version from public.student_progress_summary
where user_id = (select user_id from direct_progress_test);

select public.sync_student_unit_work_v2(
    'direct-unit-verification',
    test.unit_key,
    jsonb_build_object('unitId', test.vocabulary_id),
    jsonb_build_object('verificationNote', 'normalized-only')
)
from direct_progress_test test;

create temp table direct_spend_before as
select coins from public.student_progress_summary
where user_id = (select user_id from direct_progress_test);

create temp table direct_spend_first as
select public.spend_student_coins_v2(
    'direct-spend-verification', 1, 'verification', 'Rollback verification', 'verification-client'
) response;

create temp table direct_spend_version as
select version, coins from public.student_progress_summary
where user_id = (select user_id from direct_progress_test);

select public.spend_student_coins_v2(
    'direct-spend-verification', 1, 'verification', 'Rollback verification', 'verification-client'
);

reset role;

do $$
declare
    test direct_progress_test;
    current_version bigint;
    current_coins integer;
    current_legacy_updated_at timestamptz;
begin
    select * into test from direct_progress_test;
    select version, coins into current_version, current_coins
    from public.student_progress_summary where user_id = test.user_id;
    select updated_at into current_legacy_updated_at
    from public.student_progress where user_id = test.user_id;

    if (select version from direct_activity_version) <> test.initial_version + 1 then
        raise exception 'The direct activity did not increment exactly one version.';
    end if;
    if (select version from direct_unit_version) <> test.initial_version + 2 then
        raise exception 'The direct unit write did not increment exactly one version.';
    end if;
    if current_version <> test.initial_version + 3 then
        raise exception 'Idempotent retries changed the summary version.';
    end if;
    if current_coins <> (select coins from direct_spend_before) - 1 then
        raise exception 'The direct spend was not applied exactly once.';
    end if;
    if current_legacy_updated_at is distinct from test.legacy_updated_at then
        raise exception 'A direct normalized operation modified legacy progress.';
    end if;
    if not exists (
        select 1 from public.student_unit_progress
        where user_id = test.user_id and unit_key = test.unit_key
          and work_data ->> 'verificationNote' = 'normalized-only'
    ) then
        raise exception 'The normalized unit patch was not stored.';
    end if;
end;
$$;

select jsonb_build_object(
    'directActivity', true,
    'directUnitWork', true,
    'directWallet', true,
    'idempotentRetries', true,
    'legacyUntouched', true
) as verification;
