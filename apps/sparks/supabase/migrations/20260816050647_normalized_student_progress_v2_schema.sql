-- Normalized, versioned student-progress storage. These tables are introduced
-- alongside the legacy student_progress document and are not a destructive
-- replacement. Direct client writes remain disabled; mutations use RPCs.

create table if not exists public.student_progress_summary (
    user_id uuid primary key references auth.users(id) on delete cascade,
    total_xp integer not null default 0 check (total_xp >= 0),
    coins integer not null default 0 check (coins >= 0),
    coin_data jsonb not null default '{"balance":0,"giftCoins":0,"totalEarned":0,"totalSpent":0,"totalGifted":0}'::jsonb,
    version bigint not null default 0 check (version >= 0),
    legacy_updated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint student_progress_summary_coin_data_object
        check (jsonb_typeof(coin_data) = 'object')
);

create table if not exists public.student_unit_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    unit_key text not null check (length(unit_key) between 1 and 200),
    unit_id text,
    unit_name text not null default '',
    subject_slug text not null default '',
    trimester text not null default '',
    school_year text not null default '',
    grade text not null default '',
    work_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, unit_key),
    constraint student_unit_progress_work_data_object
        check (jsonb_typeof(work_data) = 'object'),
    constraint student_unit_progress_work_data_size
        check (octet_length(work_data::text) <= 65536)
);

create table if not exists public.student_activity_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    unit_key text not null check (length(unit_key) between 1 and 200),
    activity_type text not null check (length(activity_type) between 1 and 80),
    score numeric not null default 0 check (score between 0 and 100),
    is_complete boolean not null default false,
    plays integer not null default 0 check (plays >= 0),
    total_earned integer not null default 0 check (total_earned >= 0),
    accuracy numeric check (accuracy is null or accuracy between 0 and 100),
    details jsonb not null default '{}'::jsonb,
    verified boolean not null default false,
    attempt_id text,
    last_played timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, unit_key, activity_type),
    foreign key (user_id, unit_key)
        references public.student_unit_progress(user_id, unit_key)
        on delete cascade,
    constraint student_activity_progress_details_object
        check (jsonb_typeof(details) = 'object'),
    constraint student_activity_progress_details_size
        check (octet_length(details::text) <= 16384)
);

create table if not exists public.student_activity_state (
    user_id uuid not null references auth.users(id) on delete cascade,
    unit_key text not null check (length(unit_key) between 1 and 200),
    activity_type text not null check (length(activity_type) between 1 and 80),
    state_data jsonb not null default '{}'::jsonb,
    state_version integer not null default 1 check (state_version >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, unit_key, activity_type),
    foreign key (user_id, unit_key)
        references public.student_unit_progress(user_id, unit_key)
        on delete cascade,
    constraint student_activity_state_data_container
        check (jsonb_typeof(state_data) in ('object', 'array')),
    constraint student_activity_state_data_size
        check (octet_length(state_data::text) <= 51200)
);

create table if not exists public.student_coin_ledger (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    event_key text not null check (length(event_key) between 1 and 240),
    event_type text not null check (event_type in ('earn', 'spend', 'gift', 'accept_gift', 'welcome', 'adjustment', 'legacy')),
    amount integer not null check (amount <> 0),
    balance_after integer check (balance_after is null or balance_after >= 0),
    source text not null default '',
    description text not null default '',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (user_id, event_key),
    constraint student_coin_ledger_metadata_object
        check (jsonb_typeof(metadata) = 'object'),
    constraint student_coin_ledger_metadata_size
        check (octet_length(metadata::text) <= 16384)
);

create table if not exists private.student_progress_event_receipts (
    user_id uuid not null references auth.users(id) on delete cascade,
    event_id text not null check (length(event_id) between 8 and 240),
    operation text not null check (length(operation) between 1 and 80),
    request_hash text not null check (length(request_hash) = 64),
    response_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    primary key (user_id, event_id),
    constraint student_progress_event_receipts_response_object
        check (jsonb_typeof(response_data) = 'object')
);

create index if not exists student_coin_ledger_user_created_idx
    on public.student_coin_ledger (user_id, created_at desc);

create index if not exists student_progress_event_receipts_created_idx
    on private.student_progress_event_receipts (created_at);

drop trigger if exists set_student_progress_summary_updated_at on public.student_progress_summary;
create trigger set_student_progress_summary_updated_at
before update on public.student_progress_summary
for each row execute function public.set_updated_at();

drop trigger if exists set_student_unit_progress_updated_at on public.student_unit_progress;
create trigger set_student_unit_progress_updated_at
before update on public.student_unit_progress
for each row execute function public.set_updated_at();

drop trigger if exists set_student_activity_progress_updated_at on public.student_activity_progress;
create trigger set_student_activity_progress_updated_at
before update on public.student_activity_progress
for each row execute function public.set_updated_at();

drop trigger if exists set_student_activity_state_updated_at on public.student_activity_state;
create trigger set_student_activity_state_updated_at
before update on public.student_activity_state
for each row execute function public.set_updated_at();

alter table public.student_progress_summary enable row level security;
alter table public.student_unit_progress enable row level security;
alter table public.student_activity_progress enable row level security;
alter table public.student_activity_state enable row level security;
alter table public.student_coin_ledger enable row level security;
alter table private.student_progress_event_receipts enable row level security;

drop policy if exists "student_progress_summary_select_self_or_teacher" on public.student_progress_summary;
create policy "student_progress_summary_select_self_or_teacher"
on public.student_progress_summary for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_teacher()));

drop policy if exists "student_unit_progress_select_self_or_teacher" on public.student_unit_progress;
create policy "student_unit_progress_select_self_or_teacher"
on public.student_unit_progress for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_teacher()));

drop policy if exists "student_activity_progress_select_self_or_teacher" on public.student_activity_progress;
create policy "student_activity_progress_select_self_or_teacher"
on public.student_activity_progress for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_teacher()));

drop policy if exists "student_activity_state_select_self_or_teacher" on public.student_activity_state;
create policy "student_activity_state_select_self_or_teacher"
on public.student_activity_state for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_teacher()));

drop policy if exists "student_coin_ledger_select_self_or_teacher" on public.student_coin_ledger;
create policy "student_coin_ledger_select_self_or_teacher"
on public.student_coin_ledger for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_teacher()));

revoke all on public.student_progress_summary from public, anon, authenticated;
revoke all on public.student_unit_progress from public, anon, authenticated;
revoke all on public.student_activity_progress from public, anon, authenticated;
revoke all on public.student_activity_state from public, anon, authenticated;
revoke all on public.student_coin_ledger from public, anon, authenticated;
grant select on public.student_progress_summary to authenticated;
grant select on public.student_unit_progress to authenticated;
grant select on public.student_activity_progress to authenticated;
grant select on public.student_activity_state to authenticated;
grant select on public.student_coin_ledger to authenticated;

revoke all on private.student_progress_event_receipts from public, anon, authenticated;
revoke all on sequence public.student_coin_ledger_id_seq from public, anon, authenticated;

create or replace function private.student_progress_snapshot_v2(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    with activity_groups as (
        select
            progress.user_id,
            progress.unit_key,
            jsonb_object_agg(
                progress.activity_type,
                jsonb_strip_nulls(jsonb_build_object(
                    'score', progress.score,
                    'details', progress.details,
                    'isComplete', progress.is_complete,
                    'plays', progress.plays,
                    'totalEarned', progress.total_earned,
                    'accuracy', progress.accuracy,
                    'verified', progress.verified,
                    'attemptId', progress.attempt_id,
                    'lastPlayed', progress.last_played,
                    'updatedAt', progress.updated_at
                ))
                order by progress.activity_type
            ) as scores
        from public.student_activity_progress progress
        where progress.user_id = p_user_id
        group by progress.user_id, progress.unit_key
    ),
    state_groups as (
        select
            state.user_id,
            state.unit_key,
            jsonb_object_agg(state.activity_type, state.state_data order by state.activity_type) as states
        from public.student_activity_state state
        where state.user_id = p_user_id
        group by state.user_id, state.unit_key
    ),
    unit_snapshot as (
        select coalesce(jsonb_object_agg(
            unit.unit_key,
            unit.work_data || jsonb_strip_nulls(jsonb_build_object(
                'unitId', unit.unit_id,
                'unitName', unit.unit_name,
                'subjectSlug', unit.subject_slug,
                'trimester', unit.trimester,
                'schoolYear', unit.school_year,
                'grade', unit.grade,
                'scores', coalesce(activity.scores, '{}'::jsonb),
                'states', coalesce(state.states, '{}'::jsonb)
            ))
            order by unit.unit_key
        ), '{}'::jsonb) as units
        from public.student_unit_progress unit
        left join activity_groups activity
          on activity.user_id = unit.user_id and activity.unit_key = unit.unit_key
        left join state_groups state
          on state.user_id = unit.user_id and state.unit_key = unit.unit_key
        where unit.user_id = p_user_id
    )
    select jsonb_build_object(
        'userId', summary.user_id,
        'studentProfile', private.student_profile_json(summary.user_id),
        'units', unit_snapshot.units,
        'coins', summary.coins,
        'coinData', summary.coin_data,
        'coinHistory', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', ledger.event_key,
                'type', ledger.event_type,
                'amount', ledger.amount,
                'source', ledger.source,
                'description', ledger.description,
                'timestamp', ledger.created_at
            ) order by ledger.created_at)
            from (
                select * from public.student_coin_ledger
                where user_id = summary.user_id
                order by created_at desc
                limit 100
            ) ledger
        ), '[]'::jsonb),
        'totalXp', summary.total_xp,
        'version', summary.version,
        'createdAt', summary.created_at,
        'updatedAt', summary.updated_at
    )
    from public.student_progress_summary summary
    cross join unit_snapshot
    where summary.user_id = p_user_id;
$$;

create or replace function private.student_progress_event_hash(
    p_operation text,
    p_request jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
    select encode(
        extensions.digest(
            convert_to(trim(coalesce(p_operation, '')) || ':' || coalesce(p_request, '{}'::jsonb)::text, 'UTF8'),
            'sha256'
        ),
        'hex'
    );
$$;

create or replace function private.get_student_progress_event_receipt(
    p_user_id uuid,
    p_event_id text,
    p_operation text,
    p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    receipt private.student_progress_event_receipts;
begin
    select * into receipt
    from private.student_progress_event_receipts
    where user_id = p_user_id and event_id = p_event_id;

    if receipt.user_id is null then
        return null;
    end if;
    if receipt.operation <> p_operation or receipt.request_hash <> p_request_hash then
        raise exception 'The client event ID was already used for a different request.';
    end if;
    return receipt.response_data;
end;
$$;

create or replace function private.store_student_progress_event_receipt(
    p_user_id uuid,
    p_event_id text,
    p_operation text,
    p_request_hash text,
    p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    stored private.student_progress_event_receipts;
begin
    insert into private.student_progress_event_receipts (
        user_id, event_id, operation, request_hash, response_data
    ) values (
        p_user_id, p_event_id, p_operation, p_request_hash, coalesce(p_response, '{}'::jsonb)
    )
    on conflict (user_id, event_id) do nothing;

    select * into stored
    from private.student_progress_event_receipts
    where user_id = p_user_id and event_id = p_event_id;

    if stored.operation <> p_operation or stored.request_hash <> p_request_hash then
        raise exception 'The client event ID was already used for a different request.';
    end if;
    return stored.response_data;
end;
$$;

create or replace function private.get_own_student_progress_v2()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
begin
    if current_user_id is null then
        raise exception 'You must be signed in.';
    end if;
    return private.student_progress_snapshot_v2(current_user_id);
end;
$$;

create or replace function public.get_own_student_progress_v2()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.get_own_student_progress_v2();
$$;

create or replace function public.get_own_student_progress_summary_v2()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select jsonb_build_object(
        'userId', summary.user_id,
        'totalXp', summary.total_xp,
        'coins', summary.coins,
        'coinData', summary.coin_data,
        'version', summary.version,
        'updatedAt', summary.updated_at
    )
    from public.student_progress_summary summary
    where summary.user_id = (select auth.uid());
$$;

revoke all on function private.student_progress_snapshot_v2(uuid) from public, anon, authenticated;
revoke all on function private.student_progress_event_hash(text, jsonb) from public, anon, authenticated;
revoke all on function private.get_student_progress_event_receipt(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.store_student_progress_event_receipt(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.get_own_student_progress_v2() from public, anon;
grant execute on function private.get_own_student_progress_v2() to authenticated;
revoke all on function public.get_own_student_progress_v2() from public, anon;
revoke all on function public.get_own_student_progress_summary_v2() from public, anon;
grant execute on function public.get_own_student_progress_v2() to authenticated;
grant execute on function public.get_own_student_progress_summary_v2() to authenticated;
