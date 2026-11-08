-- Operator-only, read-only inventory. No student identities or answers are returned.
-- Execute against the selected project before and after a content release.
begin read only;
select a.school_id,count(*) as open_or_scheduled,
 count(*) filter(where m.student_content#>'{activitySettings,retiredWeeklySet}'='true'::jsonb) as retired_history,
 count(*) filter(where private.vocabulary_publication_errors_v1(m.student_content)<>'[]'::jsonb and m.student_content#>'{activitySettings,retiredWeeklySet}' is distinct from 'true'::jsonb) as policy_exceptions,
 count(*) filter(where a.vocabulary_placement is null) as missing_placement,
 coalesce(jsonb_agg(jsonb_build_object('assignmentId',a.id,'classId',a.class_id,'errors',private.vocabulary_publication_errors_v1(m.student_content)))
 filter(where private.vocabulary_publication_errors_v1(m.student_content)<>'[]'::jsonb and m.student_content#>'{activitySettings,retiredWeeklySet}' is distinct from 'true'::jsonb),'[]') as exceptions
from public.class_assignments a join private.class_material_versions m on m.id=a.version_id
where a.kind='vocabulary' and not a.withdrawn and (a.close_at is null or a.close_at>now()) group by a.school_id;
rollback;
