-- Remove the legacy full-row logical-decoding path now that clients consume
-- compact private Broadcast messages. Keep the legacy table and RPCs intact for
-- cached-client compatibility and emergency rollback.

do $$
begin
    if exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'student_progress'
    ) then
        alter publication supabase_realtime drop table public.student_progress;
    end if;
end;
$$;

alter table public.student_progress replica identity default;

-- This timestamp index received four scans while the primary key received more
-- than 1.7 million. Removing it avoids maintaining a large index on every JSON
-- document rewrite.
drop index if exists public.student_progress_updated_at_idx;

-- Favor HOT updates and timely cleanup on the small, frequently updated tables.
alter table public.student_progress set (
    fillfactor = 80,
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_vacuum_threshold = 50,
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_analyze_threshold = 50
);

alter table public.student_progress_summary set (
    fillfactor = 80,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_threshold = 50
);

alter table public.student_activity_progress set (
    fillfactor = 85,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_threshold = 100
);

alter table public.student_activity_state set (
    fillfactor = 85,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_vacuum_threshold = 100
);

create extension if not exists pg_cron;

create or replace function private.prune_student_progress_operational_history(
    p_receipt_retention interval default interval '90 days',
    p_cron_retention interval default interval '30 days'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    deleted_receipts bigint;
begin
    if p_receipt_retention < interval '7 days' then
        raise exception 'Receipt retention must be at least 7 days.';
    end if;
    if p_cron_retention < interval '7 days' then
        raise exception 'Cron retention must be at least 7 days.';
    end if;

    delete from private.student_progress_event_receipts
    where created_at < now() - p_receipt_retention;
    get diagnostics deleted_receipts = row_count;

    delete from cron.job_run_details
    where end_time is not null and end_time < now() - p_cron_retention;

    return deleted_receipts;
end;
$$;

revoke all on function private.prune_student_progress_operational_history(interval, interval)
from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'student-progress-operational-history-prune';

select cron.schedule(
    'student-progress-operational-history-prune',
    '17 3 * * *',
    $$select private.prune_student_progress_operational_history();$$
);
