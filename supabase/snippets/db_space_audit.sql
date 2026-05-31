-- Database space audit helpers.
-- Run each section separately in the Supabase SQL Editor.

-- 1) Biggest public tables, including indexes.
select
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup,
    pg_size_pretty(pg_relation_size(relid)) as table_only,
    pg_size_pretty(pg_indexes_size(relid)) as indexes,
    pg_size_pretty(pg_total_relation_size(relid)) as total
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc;

-- 2) JSON column sizes most likely to grow over time.
select
    'student_progress.units' as item,
    count(*) as rows,
    pg_size_pretty(coalesce(sum(pg_column_size(units)), 0)) as total_size
from public.student_progress
union all
select
    'student_progress.coin_history' as item,
    count(*) as rows,
    pg_size_pretty(coalesce(sum(pg_column_size(coin_history)), 0)) as total_size
from public.student_progress
union all
select
    'classroom_activity_submissions.response_data' as item,
    count(*) as rows,
    pg_size_pretty(coalesce(sum(pg_column_size(response_data)), 0)) as total_size
from public.classroom_activity_submissions
union all
select
    'classroom_activity_assignments.activity_data' as item,
    count(*) as rows,
    pg_size_pretty(coalesce(sum(pg_column_size(activity_data)), 0)) as total_size
from public.classroom_activity_assignments
order by item;

-- 3) Legacy inline Excalidraw scenes still in Postgres.
select
    count(*) as rows_with_inline_scene,
    pg_size_pretty(coalesce(sum(pg_column_size(response_data)), 0)) as response_data_size
from public.classroom_activity_submissions
where response_data ? 'excalidrawScene';

-- 4) Classroom scene Storage objects and total size.
select
    bucket_id,
    count(*) as object_count,
    pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as total_size
from storage.objects
where bucket_id = 'classroom-activity-scenes'
group by bucket_id;

-- 5) Legacy base64 images still inside student progress.
select
    count(*) as rows_with_legacy_base64_images,
    pg_size_pretty(coalesce(sum(pg_column_size(units)), 0)) as matching_units_size
from public.student_progress
where units::text like '%data:image/%';

-- 6) Autovacuum/bloat signal after deletes or backfills.
select
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    pg_size_pretty(pg_total_relation_size(relid)) as total
from pg_stat_user_tables
where n_dead_tup > 0
order by n_dead_tup desc;
