begin;
set local lock_timeout = '2s';

-- Older activity states belong to the same assignment as the active state.
-- Keep historical states out of resume, grading, and reward calculations.
create table private.student_assignment_activity_history (
    user_id uuid not null,
    assignment_id uuid not null references public.class_assignments(id) on delete cascade,
    unit_key text generated always as ('assignment:' || assignment_id::text) stored,
    activity_type text not null,
    saved_at timestamptz not null,
    state_data jsonb not null,
    primary key (user_id, assignment_id, activity_type, saved_at),
    foreign key (user_id, unit_key) references public.student_unit_progress(user_id, unit_key) on delete cascade
);
alter table private.student_assignment_activity_history enable row level security;
revoke all on private.student_assignment_activity_history from public, anon, authenticated;

create temporary table drawing_path_updates (
    user_id uuid, unit_key text, work_data jsonb, primary key (user_id, unit_key)
) on commit drop;

-- The Storage API stages identical drawing bytes at their assignment paths first.
-- Abort the entire migration on an ambiguous match or an unverified answer/file.
do $move$
declare
    receipt record;
    unit jsonb;
    assignment_key uuid;
    dest text;
    current_unit public.student_unit_progress;
    original_work jsonb;
    next_work jsonb;
    entry record;
    previous_path text;
    assignment_path text;
    activity public.student_activity_state;
begin
    for receipt in select * from private.student_progress_event_receipts
                   where preserve_final_work order by user_id,event_id for update loop
        unit := receipt.response_data->'unit';
        if receipt.operation <> 'unit-work-v2' or unit->>'unitKey' is null
           or unit->>'unitKey' like 'assignment:%'
           or (receipt.response_data->>'userId')::uuid is distinct from receipt.user_id then
            raise exception 'Unexpected protected receipt';
        end if;
        select a.id into strict assignment_key
        from public.class_assignments a
        join private.class_material_versions m on m.id=a.version_id
        join public.teaching_classes c on c.id=a.class_id
        join public.class_memberships cm on cm.class_id=c.id
        where a.kind='vocabulary' and m.vocabulary_id=unit->>'unitId'
          and a.title=unit->>'unitName' and c.school_year::text=unit->>'schoolYear'
          and cm.student_id=receipt.user_id and cm.active and not c.archived and not a.withdrawn
          and private.has_school_role(c.school_id,'student',receipt.user_id)
        for share of a,m,c,cm;
        dest := 'assignment:' || assignment_key::text;
        select * into strict current_unit from public.student_unit_progress
        where user_id=receipt.user_id and assignment_id=assignment_key and unit_key=dest for update;
        original_work := unit - array['unitKey','unitId','unitName','subjectSlug','trimester','schoolYear','grade','states'];
        next_work := current_unit.work_data;
        if current_unit.grade<>unit->>'grade' or current_unit.school_year<>unit->>'schoolYear'
           or current_unit.unit_name<>unit->>'unitName' then
            raise exception 'Saved unit placement differs';
        end if;

        for entry in select * from jsonb_each(original_work->'wordHunt') loop
            previous_path := entry.value->>'imagePath';
            if coalesce(previous_path,'')='' then continue; end if;
            assignment_path := assignment_key::text || '/' || receipt.user_id::text || '/' ||
                coalesce(nullif(trim(both '-' from regexp_replace(lower(trim(entry.key)),'[^a-z0-9]+','-','g')),''),'word') || '.webp';
            if not (receipt.user_id::text = any(string_to_array(previous_path,'/')))
               or not exists(select from storage.objects src join storage.objects dst
                      on dst.bucket_id=src.bucket_id and dst.name=assignment_path
                      and dst.metadata->>'eTag'=src.metadata->>'eTag' and dst.metadata->>'size'=src.metadata->>'size'
                      where src.bucket_id='word-hunt-images' and src.name=previous_path)
               or coalesce(next_work#>>array['wordHunt',entry.key,'imagePath'],'') not in (previous_path,assignment_path) then
                raise exception 'Assignment drawing could not be verified';
            end if;
            original_work := jsonb_set(original_work,array['wordHunt',entry.key,'imagePath'],to_jsonb(assignment_path),false);
            next_work := jsonb_set(next_work,array['wordHunt',entry.key,'imagePath'],to_jsonb(assignment_path),false);
        end loop;
        if not next_work @> original_work then
            raise exception 'Current assignment does not contain all final written work';
        end if;
        if next_work is distinct from current_unit.work_data then
            insert into drawing_path_updates values (receipt.user_id,dest,next_work);
        end if;

        for entry in select * from jsonb_each(unit->'states') loop
            select * into strict activity from public.student_activity_state
            where user_id=receipt.user_id and unit_key=dest and activity_type=entry.key for share;
            if activity.state_data is distinct from entry.value then
                if activity.updated_at < receipt.created_at then
                    raise exception 'Cannot establish which activity state is current';
                end if;
                insert into private.student_assignment_activity_history
                    (user_id,assignment_id,activity_type,saved_at,state_data)
                values (receipt.user_id,assignment_key,entry.key,receipt.created_at,entry.value);
            end if;
        end loop;
        delete from private.student_progress_event_receipts
        where user_id=receipt.user_id and event_id=receipt.event_id;
    end loop;
    if exists(select from drawing_path_updates) then
        -- This repairs file addresses. Keep the original student work timestamps.
        alter table public.student_unit_progress disable trigger set_student_unit_progress_updated_at;
        update public.student_unit_progress p set work_data=d.work_data
        from drawing_path_updates d where p.user_id=d.user_id and p.unit_key=d.unit_key;
        alter table public.student_unit_progress enable trigger set_student_unit_progress_updated_at;
    end if;
end;
$move$;

CREATE OR REPLACE FUNCTION private.prune_student_progress_operational_history(p_receipt_retention interval DEFAULT '90 days'::interval, p_cron_retention interval DEFAULT '30 days'::interval)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    deleted_receipts bigint;
begin
    if p_receipt_retention < interval '7 days' then
        raise exception 'Receipt retention must be at least 7 days.';
    end if;
    if p_cron_retention < interval '7 days' then
        raise exception 'Cron retention must be at least 7 days.';
    end if;

    delete from private.student_progress_event_receipts
    where created_at < now() - p_receipt_retention;
    get diagnostics deleted_receipts = row_count;

    delete from cron.job_run_details
    where end_time is not null and end_time < now() - p_cron_retention;

    return deleted_receipts;
end;
$function$;

alter table private.student_progress_event_receipts drop column preserve_final_work;

commit;
