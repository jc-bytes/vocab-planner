select n.nspname as schema_name,
       c.relname as table_name,
       t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and (
    c.relname = 'student_progress'
    or pg_get_triggerdef(t.oid) ilike '%student_progress%'
    or pg_get_triggerdef(t.oid) ilike '%award_uncapped_student_activity_xp%'
  )
order by 1, 2, 3;
