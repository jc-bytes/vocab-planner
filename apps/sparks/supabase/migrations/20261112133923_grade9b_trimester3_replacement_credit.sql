begin;

-- Teacher-approved 9B Trimester 3. Use the catalog's explicit replacement
-- links and the required modes frozen in each published assignment.
with class_vocabulary as (
    select a.id, v.id as vocabulary_id, v.activity_settings,
        version.student_content->'activitySettings' as settings
    from public.class_assignments a
    join private.class_material_versions version on version.id = a.version_id
    join public.vocabularies v on v.id = version.vocabulary_id
    where a.class_id = '5ec8d78d-99bd-572f-bfab-16e5ff5ad292'
      and a.kind = 'vocabulary' and not a.withdrawn and v.trimester = '3' and a.release_at <= now()
      and a.release_at >= '2026-09-14 00:00-05' and a.release_at < '2026-12-12 00:00-05'
)
insert into private.assignment_replacement_credit (target_assignment_id, source_assignment_id, activity_type)
select distinct replacement.id, original.id, mode.value
from class_vocabulary original
join class_vocabulary replacement
    on original.activity_settings->'replacementIds' ? replacement.vocabulary_id
cross join lateral jsonb_array_elements_text(replacement.settings->'requiredActivities') mode(value)
where original.settings->>'retiredWeeklySet' = 'true'
  and coalesce(replacement.settings->>'retiredWeeklySet', 'false') <> 'true'
  and original.settings->'requiredActivities' ? mode.value
on conflict do nothing;

commit;
