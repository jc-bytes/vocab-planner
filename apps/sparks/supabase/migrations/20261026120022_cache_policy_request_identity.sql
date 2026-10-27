begin;

-- Cache only caller identity. School/class permission checks depend on each row.
-- Preserve policy operations, roles, grants and permissive behavior.
alter policy subjects_school_insert on public.teacher_subjects
    with check (owner_id = (select auth.uid()) and private.can_edit_school_library(school_id));
alter policy classes_school_insert on public.teaching_classes
    with check (owner_id = (select auth.uid()) and private.can_edit_school_library(school_id));
alter policy class_members_school_read on public.class_memberships
    using (private.owns_teaching_class(class_id)
        or (student_id = (select auth.uid()) and private.is_class_member(class_id)));

-- The prior scalar SELECT already cached lower(jwt.email); put the SELECT
-- directly around auth.jwt() so the advisor recognizes the same invariant,
-- retaining the outer cache for the normalized caller email as well.
alter policy allowlist_read_self on public.teacher_allowlist
    using (lower(email::text) = (select lower(((select auth.jwt()) ->> 'email'))));

alter policy export_logs_school on public.export_logs
    using (teacher_id = (select auth.uid()) and private.can_edit_school_library(school_id))
    with check (teacher_id = (select auth.uid()) and private.can_edit_school_library(school_id));
alter policy group_pairs_school_read on public.teacher_group_pair_restrictions
    using (teacher_id = (select auth.uid()) and private.has_school_role(school_id, 'teacher'::text));
alter policy group_pairs_school_insert on public.teacher_group_pair_restrictions
    with check (teacher_id = (select auth.uid()) and private.has_school_role(school_id, 'teacher'::text));
alter policy group_pairs_school_delete on public.teacher_group_pair_restrictions
    using (teacher_id = (select auth.uid()) and private.has_school_role(school_id, 'teacher'::text));

commit;
