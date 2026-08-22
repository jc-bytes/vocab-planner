-- Calendar changes can affect the whole vocabulary catalog. Apply the small
-- placement patches in one database call instead of one HTTP request per unit.

create or replace function private.update_vocabulary_placements_v1(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_count integer;
    updated_count integer;
begin
    if not private.is_teacher() then
        raise exception 'Only teachers can update vocabulary placements.';
    end if;
    if jsonb_typeof(coalesce(p_updates, '[]'::jsonb)) <> 'array' then
        raise exception 'Vocabulary placement updates must be an array.';
    end if;

    requested_count := jsonb_array_length(coalesce(p_updates, '[]'::jsonb));
    if requested_count > 500 then
        raise exception 'A maximum of 500 vocabulary placements can be updated at once.';
    end if;

    update public.vocabularies vocabulary
    set
        assigned_date = nullif(trim(patch.assigned_date), '')::date,
        trimester = coalesce(patch.trimester, ''),
        month = coalesce(patch.month, ''),
        week = patch.week,
        updated_at = coalesce(patch.updated_at, now())
    from jsonb_to_recordset(coalesce(p_updates, '[]'::jsonb)) as patch(
        id text,
        assigned_date text,
        trimester text,
        month text,
        week integer,
        updated_at timestamptz
    )
    where vocabulary.id = patch.id;

    get diagnostics updated_count = row_count;
    return jsonb_build_object(
        'requested', requested_count,
        'updated', updated_count
    );
end;
$$;

create or replace function public.update_vocabulary_placements_v1(p_updates jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.update_vocabulary_placements_v1(p_updates); $$;

revoke all on function private.update_vocabulary_placements_v1(jsonb) from public, anon;
revoke all on function public.update_vocabulary_placements_v1(jsonb) from public, anon;
grant execute on function private.update_vocabulary_placements_v1(jsonb) to authenticated;
grant execute on function public.update_vocabulary_placements_v1(jsonb) to authenticated;
