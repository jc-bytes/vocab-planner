-- Read-only reliability baseline for the student-progress migration.
-- Run through `supabase db query --linked --file <this file>`.

select
    now() as captured_at,
    current_database() as database_name,
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    (select stats_reset from pg_stat_statements_info) as statement_stats_reset,
    (select stats_reset from pg_stat_wal) as wal_stats_reset;

select
    count(*) as progress_rows,
    pg_size_pretty(pg_total_relation_size('public.student_progress')) as progress_total_size,
    pg_size_pretty(sum(pg_column_size(units))::bigint) as units_total,
    pg_size_pretty(avg(pg_column_size(units))::bigint) as units_average,
    pg_size_pretty(max(pg_column_size(units))::bigint) as units_maximum,
    pg_size_pretty(sum(pg_column_size(coin_history))::bigint) as coin_history_total,
    pg_size_pretty(avg(pg_column_size(coin_history))::bigint) as coin_history_average,
    pg_size_pretty(max(pg_column_size(coin_history))::bigint) as coin_history_maximum
from public.student_progress;

select
    relname,
    n_live_tup,
    n_dead_tup,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_tup_hot_upd,
    seq_scan,
    idx_scan,
    last_autovacuum,
    last_autoanalyze
from pg_stat_user_tables
where schemaname in ('public', 'private')
order by n_tup_upd desc, relname;

select
    indexrelname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
from pg_stat_user_indexes
where schemaname = 'public'
  and relname = 'student_progress'
order by idx_scan desc, indexrelname;

select
    wal_records,
    wal_fpi,
    pg_size_pretty(wal_bytes::bigint) as cumulative_wal,
    stats_reset
from pg_stat_wal;

select
    calls,
    round(total_exec_time::numeric, 2) as total_exec_time_ms,
    round(mean_exec_time::numeric, 4) as mean_exec_time_ms,
    left(regexp_replace(query, '\\s+', ' ', 'g'), 240) as query_sample
from pg_stat_statements
where query ilike '%student_progress%'
   or query ilike '%realtime.list_changes%'
order by total_exec_time desc
limit 30;

select count(*) as current_realtime_subscriptions
from realtime.subscription;
