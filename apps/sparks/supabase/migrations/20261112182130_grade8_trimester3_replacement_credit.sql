begin;

-- Teacher-approved 8A and 8B Trimester 3. Use the catalog's explicit replacement
-- links and the required modes frozen in each published assignment.
with class_vocabulary as (
    select a.id, a.class_id, v.id as vocabulary_id, v.activity_settings,
        version.student_content->'activitySettings' as settings
    from public.class_assignments a
    join private.class_material_versions version on version.id = a.version_id
    join public.vocabularies v on v.id = version.vocabulary_id
    where a.class_id in ('e88d8b52-ddb2-51c8-8d75-30c78f5dcfd4', '803da1a1-95a0-5fb5-9f40-31dbe545c695')
      and a.kind = 'vocabulary' and not a.withdrawn and v.trimester = '3' and a.release_at <= now()
      and a.release_at >= '2026-09-14 00:00-05' and a.release_at < '2026-12-12 00:00-05'
)
insert into private.assignment_replacement_credit (target_assignment_id, source_assignment_id, activity_type)
select distinct replacement.id, original.id, mode.value
from class_vocabulary original
join class_vocabulary replacement
    on replacement.class_id = original.class_id
    and original.activity_settings->'replacementIds' ? replacement.vocabulary_id
cross join lateral jsonb_array_elements_text(replacement.settings->'requiredActivities') mode(value)
where original.settings->>'retiredWeeklySet' = 'true'
  and coalesce(replacement.settings->>'retiredWeeklySet', 'false') <> 'true'
  and original.settings->'requiredActivities' ? mode.value
on conflict do nothing;

commit;
