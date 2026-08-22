alter table public.student_progress replica identity full;

do $$
begin
    if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'student_progress'
    ) then
        alter publication supabase_realtime add table public.student_progress;
    end if;
end;
$$;
