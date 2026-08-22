select summary.user_id,
       summary.updated_at,
       summary.total_xp,
       summary.coins,
       (select count(*) from public.student_unit_progress unit where unit.user_id = summary.user_id) as unit_rows,
       (select count(*) from public.student_activity_progress activity where activity.user_id = summary.user_id) as activity_rows,
       (select count(*) from public.student_activity_state state where state.user_id = summary.user_id) as state_rows,
       exists (select 1 from auth.users users where users.id = summary.user_id) as has_auth_user,
       exists (select 1 from public.profiles profile where profile.user_id = summary.user_id) as has_profile
from public.student_progress_summary summary
where not exists (
    select 1 from public.profiles profile
    where profile.user_id = summary.user_id and profile.role = 'student'
)
order by summary.updated_at;
