select n.nspname as schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prokind = 'f'
  and (
    pg_get_functiondef(p.oid) ilike '%public.student_progress%'
    or pg_get_function_result(p.oid) ilike '%student_progress%'
  )
order by 1, 2, 3;
