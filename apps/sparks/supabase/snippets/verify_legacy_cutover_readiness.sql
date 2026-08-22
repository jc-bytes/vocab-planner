select jsonb_build_object(
    'studentProfiles', (select count(*) from public.profiles where role = 'student'),
    'legacyRows', (select count(*) from public.student_progress),
    'summaryRows', (select count(*) from public.student_progress_summary),
    'unitRows', (select count(*) from public.student_unit_progress),
    'activityRows', (select count(*) from public.student_activity_progress),
    'stateRows', (select count(*) from public.student_activity_state),
    'inconsistentRows', (
        select count(*) from private.student_progress_v2_reconciliation()
        where not is_consistent
    ),
    'ready',
        (select count(*) from public.profiles where role = 'student')
            = (select count(*) from public.student_progress)
        and (select count(*) from public.profiles where role = 'student')
            = (select count(*) from public.student_progress_summary)
        and not exists (
            select 1 from private.student_progress_v2_reconciliation()
            where not is_consistent
        )
) as cutover_readiness;
