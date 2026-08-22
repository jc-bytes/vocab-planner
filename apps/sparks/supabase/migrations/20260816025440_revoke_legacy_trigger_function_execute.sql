-- These functions are invoked only by database triggers. They must not be
-- callable through the public Data API. rls_auto_enable is platform-managed
-- and may be absent in a clean local stack, so both revocations are guarded.
do $$
begin
    if to_regprocedure('public.ensure_student_progress()') is not null then
        revoke execute on function public.ensure_student_progress()
        from public, anon, authenticated;
    end if;

    if to_regprocedure('public.rls_auto_enable()') is not null then
        revoke execute on function public.rls_auto_enable()
        from public, anon, authenticated;
    end if;
end;
$$;
