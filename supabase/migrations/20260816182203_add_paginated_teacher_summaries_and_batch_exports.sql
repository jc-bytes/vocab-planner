-- Keep roster/list traffic small. Full unit, activity-state, and coin-ledger
-- snapshots are loaded only when a teacher opens details, analytics, or export.

create index if not exists profiles_student_roster_idx
    on public.profiles (grade_level, section_letter, last_name, first_name, user_id)
    where role = 'student';

create or replace function private.list_student_progress_summaries_v1(
    p_limit integer default 100,
    p_offset integer default 0,
    p_grade integer default null,
    p_section text default null,
    p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    page_size integer := least(greatest(coalesce(p_limit, 100), 1), 200);
    page_offset integer := greatest(coalesce(p_offset, 0), 0);
    section_filter text := nullif(upper(trim(coalesce(p_section, ''))), '');
    search_filter text := nullif(trim(coalesce(p_search, '')), '');
    result_data jsonb;
begin
    if not private.is_teacher() then
        raise exception 'Only teachers can list student progress.';
    end if;
    if p_grade is not null and p_grade not between 6 and 9 then
        raise exception 'Grade must be between 6 and 9.';
    end if;
    if section_filter is not null and section_filter !~ '^[A-Z]$' then
        raise exception 'Section must be one letter.';
    end if;

    with filtered as materialized (
        select
            profile.user_id,
            profile.role,
            profile.first_name,
            profile.last_name,
            profile.email,
            profile.grade_level,
            profile.section_letter,
            profile.must_change_password,
            profile.created_at as profile_created_at,
            profile.updated_at as profile_updated_at,
            summary.total_xp,
            summary.coins,
            summary.coin_data,
            summary.version,
            summary.created_at as progress_created_at,
            summary.updated_at as progress_updated_at
        from public.profiles profile
        left join public.student_progress_summary summary
          on summary.user_id = profile.user_id
        where profile.role = 'student'
          and (p_grade is null or profile.grade_level = p_grade)
          and (section_filter is null or profile.section_letter = section_filter)
          and (
              search_filter is null
              or concat_ws(' ', profile.first_name, profile.last_name, profile.email::text)
                  ilike '%' || search_filter || '%'
          )
    ), paged as (
        select *
        from filtered
        order by grade_level nulls last,
                 section_letter nulls last,
                 last_name,
                 first_name,
                 user_id
        limit page_size
        offset page_offset
    )
    select jsonb_build_object(
        'items', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', item.user_id,
                'userId', item.user_id,
                'email', item.email,
                'role', item.role,
                'mustChangePassword', item.must_change_password,
                'studentProfile', jsonb_build_object(
                    'firstName', item.first_name,
                    'lastName', item.last_name,
                    'name', trim(concat_ws(' ', item.first_name, item.last_name)),
                    'email', item.email,
                    'grade', coalesce(item.grade_level::text, ''),
                    'group', coalesce(item.section_letter, '')
                ),
                'coins', coalesce(item.coins, 0),
                'coinData', coalesce(
                    item.coin_data,
                    '{"balance":0,"giftCoins":0,"totalEarned":0,"totalSpent":0,"totalGifted":0}'::jsonb
                ),
                'totalXp', coalesce(item.total_xp, 0),
                'version', coalesce(item.version, 0),
                'createdAt', coalesce(item.progress_created_at, item.profile_created_at),
                'updatedAt', greatest(item.progress_updated_at, item.profile_updated_at)
            ) order by item.grade_level nulls last,
                       item.section_letter nulls last,
                       item.last_name,
                       item.first_name,
                       item.user_id)
            from paged item
        ), '[]'::jsonb),
        'total', (select count(*) from filtered),
        'limit', page_size,
        'offset', page_offset
    ) into result_data;

    return result_data;
end;
$$;

create or replace function public.list_student_progress_summaries_v1(
    p_limit integer default 100,
    p_offset integer default 0,
    p_grade integer default null,
    p_section text default null,
    p_search text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select private.list_student_progress_summaries_v1(
        p_limit, p_offset, p_grade, p_section, p_search
    );
$$;

create or replace function private.get_students_progress_by_ids_v1(p_user_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    requested_ids uuid[] := coalesce(p_user_ids, '{}'::uuid[]);
    result_data jsonb;
begin
    if not private.is_teacher() then
        raise exception 'Only teachers can read student progress.';
    end if;
    if cardinality(requested_ids) > 200 then
        raise exception 'A maximum of 200 students can be requested at once.';
    end if;

    select coalesce(jsonb_agg(snapshot.value
        order by profile.grade_level nulls last,
                 profile.section_letter nulls last,
                 profile.last_name,
                 profile.first_name,
                 profile.user_id), '[]'::jsonb)
    into result_data
    from public.profiles profile
    cross join lateral (
        select private.student_progress_snapshot_v2(profile.user_id) as value
    ) snapshot
    where profile.role = 'student'
      and profile.user_id = any(requested_ids)
      and snapshot.value is not null;

    return result_data;
end;
$$;

create or replace function public.get_students_progress_by_ids_v1(p_user_ids uuid[])
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_students_progress_by_ids_v1(p_user_ids); $$;

revoke all on function private.list_student_progress_summaries_v1(integer, integer, integer, text, text)
    from public, anon;
revoke all on function public.list_student_progress_summaries_v1(integer, integer, integer, text, text)
    from public, anon;
revoke all on function private.get_students_progress_by_ids_v1(uuid[])
    from public, anon;
revoke all on function public.get_students_progress_by_ids_v1(uuid[])
    from public, anon;

grant execute on function private.list_student_progress_summaries_v1(integer, integer, integer, text, text)
    to authenticated;
grant execute on function public.list_student_progress_summaries_v1(integer, integer, integer, text, text)
    to authenticated;
grant execute on function private.get_students_progress_by_ids_v1(uuid[])
    to authenticated;
grant execute on function public.get_students_progress_by_ids_v1(uuid[])
    to authenticated;

-- Catalog screens need placement and counts, not every word definition. This
-- invoker function keeps the table's RLS policies authoritative.
create or replace function public.list_vocabulary_metadata_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', vocabulary.id,
        'name', vocabulary.name,
        'description', vocabulary.description,
        'grades', vocabulary.grades,
        'subjectSlug', vocabulary.subject_slug,
        'assignedDate', vocabulary.assigned_date,
        'trimester', vocabulary.trimester,
        'month', vocabulary.month,
        'week', vocabulary.week,
        'activitySettings', vocabulary.activity_settings,
        'wordCount', jsonb_array_length(vocabulary.words),
        'ownerId', vocabulary.owner_id,
        'createdAt', vocabulary.created_at,
        'updatedAt', vocabulary.updated_at
    ) order by vocabulary.assigned_date nulls last, vocabulary.name, vocabulary.id), '[]'::jsonb)
    from public.vocabularies vocabulary;
$$;

revoke all on function public.list_vocabulary_metadata_v1() from public, anon;
grant execute on function public.list_vocabulary_metadata_v1() to authenticated;
