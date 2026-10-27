-- Keep the existing school snapshot contract without constructing discarded
-- account rewards. CREATE OR REPLACE preserves its owner and execute ACL.
create or replace function private.student_progress_snapshot_school_v2(p_school_id uuid,p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    with activity_groups as (
        select progress.user_id, progress.unit_key,
            jsonb_object_agg(progress.activity_type, jsonb_strip_nulls(jsonb_build_object(
                'score', progress.score,
                'details', progress.details,
                'isComplete', progress.is_complete,
                'plays', progress.plays,
                'totalEarned', progress.total_earned,
                'accuracy', progress.accuracy,
                'bestAccuracy', progress.best_accuracy,
                'lifetimeCorrect', progress.lifetime_correct,
                'lifetimeAttempted', progress.lifetime_attempted,
                'lifetimeAccuracy', case when progress.lifetime_attempted > 0
                    then round(100 * progress.lifetime_correct::numeric / progress.lifetime_attempted, 2) end,
                'finishedRuns', progress.finished_runs,
                'masteredRuns', progress.mastered_runs,
                'verified', progress.verified,
                'attemptId', progress.attempt_id,
                'bestAttemptId', progress.best_attempt_id,
                'latestAttemptId', progress.latest_attempt_id,
                'bestAttempt', private.student_activity_attempt_json(best_attempt),
                'latestAttempt', private.student_activity_attempt_json(latest_attempt),
                'lastPlayed', progress.last_played,
                'updatedAt', progress.updated_at
            )) order by progress.activity_type) as scores
        from public.student_activity_progress progress
        left join private.student_activity_attempts best_attempt on best_attempt.id = progress.best_attempt_id
        left join private.student_activity_attempts latest_attempt on latest_attempt.id = progress.latest_attempt_id
        where progress.user_id = p_user_id and private.can_read_school_student_assignment(p_school_id,progress.assignment_id,progress.user_id)
        group by progress.user_id, progress.unit_key
    ), state_groups as (
        select state.user_id, state.unit_key,
            jsonb_object_agg(state.activity_type, state.state_data order by state.activity_type) as states
        from public.student_activity_state state
        where state.user_id = p_user_id and private.can_read_school_student_assignment(p_school_id,state.assignment_id,state.user_id)
        group by state.user_id, state.unit_key
    ), unit_snapshot as (
        select coalesce(jsonb_object_agg(unit.unit_key,
            unit.work_data || jsonb_strip_nulls(jsonb_build_object(
                'unitId', unit.unit_id, 'unitName', unit.unit_name,
                'subjectSlug', unit.subject_slug, 'trimester', unit.trimester,
                'schoolYear', unit.school_year, 'grade', unit.grade,
                'scores', coalesce(activity.scores, '{}'::jsonb),
                'states', coalesce(state.states, '{}'::jsonb)
            )) order by unit.unit_key), '{}'::jsonb) as units
        from public.student_unit_progress unit
        left join activity_groups activity
          on activity.user_id = unit.user_id and activity.unit_key = unit.unit_key
        left join state_groups state
          on state.user_id = unit.user_id and state.unit_key = unit.unit_key
        where unit.user_id = p_user_id and private.can_read_school_student_assignment(p_school_id,unit.assignment_id,unit.user_id)
    )
    select (jsonb_build_object(
        'userId', summary.user_id,
        'studentProfile', private.student_profile_json(summary.user_id) || coalesce((select jsonb_build_object('grade',coalesce(m.grade,''),'group',coalesce(m.section,'')) from public.school_memberships m where m.school_id=p_school_id and m.user_id=summary.user_id),'{}'::jsonb),
        'units', unit_snapshot.units,
        'createdAt', summary.created_at
    ))
    from public.student_progress_summary summary
    cross join unit_snapshot
    where summary.user_id = p_user_id and (private.school_has_student(p_school_id,p_user_id));
$function$;
