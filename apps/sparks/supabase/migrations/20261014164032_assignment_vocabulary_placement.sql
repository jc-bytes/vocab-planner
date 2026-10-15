-- Preserve the existing assignment access check and frozen learning content.
-- Placement is read separately so previously published units can be scheduled.
create or replace function private.read_class_assignment_v1(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
    if not private.can_read_class_assignment(p_assignment_id) then
        raise exception 'Assignment unavailable.' using errcode = '42501';
    end if;
    select to_jsonb(a) || jsonb_build_object(
        'content', v.student_content,
        'materialId', coalesce(v.vocabulary_id, v.spark_id),
        'className', c.name, 'subjectName', s.name,
        'vocabularyPlacement', case when a.kind = 'vocabulary' then jsonb_build_object(
            'assignedDate', vocabulary.assigned_date,
            'trimester', vocabulary.trimester,
            'month', vocabulary.month,
            'week', vocabulary.week
        ) else null end
    ) into result
    from public.class_assignments a
    join private.class_material_versions v on v.id = a.version_id
    join public.teaching_classes c on c.id = a.class_id
    join public.teacher_subjects s on s.id = c.subject_id
    left join public.vocabularies vocabulary on vocabulary.id = v.vocabulary_id and vocabulary.school_id = a.school_id
    where a.id = p_assignment_id;
    return result;
end;
$$;
