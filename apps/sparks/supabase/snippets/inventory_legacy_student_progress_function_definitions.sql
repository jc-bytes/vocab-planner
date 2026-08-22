select n.nspname as schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prokind = 'f'
  and p.proname in (
    'award_uncapped_student_activity_xp',
    'ensure_student_progress',
    'sync_legacy_student_progress_to_v2'
  )
order by 1, 2, 3;
