-- Written Spark responses are isolated by assignment, including shared students.
begin;
create table public.class_assignment_responses (
    assignment_id uuid not null references public.class_assignments(id) on delete cascade,
    student_id uuid not null references public.profiles(user_id),
    response text not null check(length(trim(response)) between 1 and 10000),
    revision integer not null default 1 check(revision > 0),
    submitted_at timestamptz not null default now(),
    primary key(assignment_id, student_id)
);
create index class_assignment_responses_student_idx on public.class_assignment_responses(student_id);
alter table public.class_assignment_responses enable row level security;
revoke all on public.class_assignment_responses from public, anon, authenticated;
grant select on public.class_assignment_responses to authenticated;
create policy class_assignment_responses_read on public.class_assignment_responses for select to authenticated
using(exists(select 1 from public.class_assignments a where a.id=assignment_id and
    ((a.owner_id=(select auth.uid()) and (select private.is_teacher())) or
    (student_id=(select auth.uid()) and private.can_read_class_assignment(a.id)))));

create function private.save_class_response_v1(p_assignment_id uuid,p_response text,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.class_assignments; r public.class_assignment_responses; class_key uuid;
begin
    -- Same lock order as enrollment: class first, then assignment and response.
    select class_id into class_key from public.class_assignments where id=p_assignment_id;
    perform 1 from public.teaching_classes where id=class_key and not archived for share;
    if not found then raise exception 'Assignment unavailable.' using errcode='42501'; end if;
    select * into a from public.class_assignments where id=p_assignment_id for share;
    if not private.is_class_member(a.class_id) or a.withdrawn or a.release_at>now()
       or (a.close_at is not null and a.close_at<=now()) or a.kind<>'spark' then
        raise exception 'Assignment is not accepting responses.' using errcode='42501';
    end if;
    if p_expected_revision is null or p_expected_revision<0 or p_response is null
       or length(trim(p_response)) not between 1 and 10000 then raise exception 'Enter a response and its revision.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_assignment_id::text || auth.uid()::text, 0));
    select * into r from public.class_assignment_responses where assignment_id=p_assignment_id and student_id=auth.uid() for update;
    -- An exact retry succeeds, but an older edit cannot overwrite a newer response.
    if r.revision is not null and r.response=trim(p_response) then return to_jsonb(r); end if;
    if coalesce(r.revision,0)<>p_expected_revision then raise exception 'This response changed. Reopen the assignment before saving.' using errcode='P0001'; end if;
    insert into public.class_assignment_responses(assignment_id,student_id,response)
    values(p_assignment_id,auth.uid(),trim(p_response))
    on conflict(assignment_id,student_id) do update set response=excluded.response,
        revision=class_assignment_responses.revision+1,submitted_at=now()
    returning * into r;
    return to_jsonb(r);
end;
$$;
create function public.save_class_response_v1(p_assignment_id uuid,p_response text,p_expected_revision integer)
returns jsonb language sql security invoker set search_path='' as $$ select private.save_class_response_v1(p_assignment_id,p_response,p_expected_revision); $$;
revoke all on function public.save_class_response_v1(uuid,text,integer), private.save_class_response_v1(uuid,text,integer) from public,anon;
grant execute on function public.save_class_response_v1(uuid,text,integer), private.save_class_response_v1(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
