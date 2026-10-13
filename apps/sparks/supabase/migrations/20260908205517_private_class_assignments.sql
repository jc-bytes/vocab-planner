-- Publication stores an immutable version; the library remains editable.
-- This additive migration is not the legacy access-control cutover.
begin;
create table private.class_material_versions (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(user_id),
    vocabulary_id text references public.vocabularies(id),
    spark_id text references public.weekly_sparks(id),
    student_content jsonb not null check (jsonb_typeof(student_content) = 'object'),
    assessment_key jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    check (num_nonnulls(vocabulary_id, spark_id) = 1),
    unique(id, owner_id)
);
create index class_material_versions_vocabulary_idx on private.class_material_versions(vocabulary_id);
create index class_material_versions_spark_idx on private.class_material_versions(spark_id);

create table public.class_assignments (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(user_id),
    class_id uuid not null,
    version_id uuid not null,
    title text not null check (length(trim(title)) between 1 and 200),
    kind text not null check(kind in ('vocabulary', 'spark')),
    release_at timestamptz not null,
    due_at timestamptz,
    close_at timestamptz,
    withdrawn boolean not null default false,
    publication_key uuid not null,
    created_at timestamptz not null default now(),
    foreign key (class_id, owner_id) references public.teaching_classes(id, owner_id),
    foreign key (version_id, owner_id) references private.class_material_versions(id, owner_id),
    unique(owner_id, publication_key, class_id),
    check(due_at is null or due_at >= release_at),
    check(close_at is null or close_at >= release_at),
    check(close_at is null or due_at is null or close_at >= due_at)
);
create index class_assignments_class_idx on public.class_assignments(class_id, release_at);
create index class_assignments_version_idx on public.class_assignments(version_id, owner_id);
create index class_assignments_owner_idx on public.class_assignments(owner_id);
alter table private.class_material_versions enable row level security;
alter table public.class_assignments enable row level security;
revoke all on private.class_material_versions, public.class_assignments from public, anon, authenticated;
grant select on public.class_assignments to authenticated;

create function private.can_read_class_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists(select 1 from public.class_assignments a where a.id = p_assignment_id and (
        (a.owner_id = auth.uid() and private.is_teacher())
        or (not a.withdrawn and a.release_at <= now() and private.is_class_member(a.class_id))
    ));
$$;
revoke all on function private.can_read_class_assignment(uuid) from public, anon;
grant execute on function private.can_read_class_assignment(uuid) to authenticated;
create policy class_assignments_read on public.class_assignments for select to authenticated
using(private.can_read_class_assignment(id));

create function private.publish_class_material_v1(
    p_class_ids uuid[], p_kind text, p_material_id text, p_release_at timestamptz,
    p_publication_key uuid, p_due_at timestamptz default null, p_close_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    version_id uuid; content jsonb; answer_key jsonb := '{}'::jsonb;
    material_title text; owned_id text; result jsonb; existing_count integer;
begin
    if not private.is_teacher() then raise exception 'Teacher access required.' using errcode = '42501'; end if;
    if p_publication_key is null or p_release_at is null or coalesce(cardinality(p_class_ids),0) not between 1 and 50
       or exists(select 1 from unnest(p_class_ids) id where id is null)
       or cardinality(p_class_ids) <> (select count(distinct id) from unnest(p_class_ids) id) then
        raise exception 'Choose distinct classes, a release date and a publication key.';
    end if;
    if p_kind is null or p_kind not in ('vocabulary','spark') then raise exception 'Unsupported material type.'; end if;
    if p_material_id is null or length(trim(p_material_id)) = 0 then raise exception 'Choose a material.'; end if;
    -- Stable lock serializes retried requests with the same teacher/key.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_publication_key::text, 0));
    perform 1 from public.teaching_classes where id = any(p_class_ids) order by id for update;
    if (select count(*) from public.teaching_classes where id = any(p_class_ids)
        and owner_id = auth.uid() and not archived) <> cardinality(p_class_ids) then
        raise exception 'One or more classes are unavailable.' using errcode = '42501';
    end if;
    select count(*) into existing_count from public.class_assignments
      where owner_id = auth.uid() and publication_key = p_publication_key;
    if existing_count > 0 then
        if existing_count <> cardinality(p_class_ids) or exists(
            select 1 from public.class_assignments a join private.class_material_versions v on v.id=a.version_id
            where a.owner_id=auth.uid() and a.publication_key=p_publication_key and
             (not(a.class_id=any(p_class_ids)) or a.kind<>p_kind or coalesce(v.vocabulary_id,v.spark_id)<>p_material_id
               or a.release_at<>p_release_at or a.due_at is distinct from p_due_at or a.close_at is distinct from p_close_at)
        ) then raise exception 'Publication key was already used for a different assignment.'; end if;
    else
        if p_kind = 'vocabulary' then
            select v.id, v.name, jsonb_build_object('kind','vocabulary','name',v.name,
                'description',v.description,'words',v.words,'activitySettings',v.activity_settings)
            into owned_id,material_title,content from public.vocabularies v
            where v.id=p_material_id and v.owner_id=auth.uid() for share;
        else
            select s.id,s.title,jsonb_build_object('kind','spark','title',s.title,'sparkText',s.spark_text,
                'whyItMatters',s.why_it_matters,'question',s.question,'gradeQuestions',s.grade_questions,
                'sourceTitle',s.source_title,'sourceUrl',s.source_url,'checkMode',s.check_mode,
                'questions',coalesce((select jsonb_agg(q - 'correctOption') from jsonb_array_elements(s.questions) q),'[]'::jsonb)),
                jsonb_build_object('questions',s.questions)
            into owned_id,material_title,content,answer_key from public.weekly_sparks s
            where s.id=p_material_id and s.owner_id=auth.uid() for share;
        end if;
        if owned_id is null then raise exception 'Material unavailable. Only owned materials can be assigned.' using errcode='42501'; end if;
        insert into private.class_material_versions(owner_id,vocabulary_id,spark_id,student_content,assessment_key)
        values(auth.uid(),case when p_kind='vocabulary' then owned_id end,case when p_kind='spark' then owned_id end,content,answer_key)
        returning id into version_id;
        insert into public.class_assignments(owner_id,class_id,version_id,title,kind,release_at,due_at,close_at,publication_key)
        select auth.uid(),id,version_id,material_title,p_kind,p_release_at,p_due_at,p_close_at,p_publication_key from unnest(p_class_ids) id;
    end if;
    select jsonb_agg(to_jsonb(a) order by a.class_id) into result from public.class_assignments a
      where a.owner_id=auth.uid() and a.publication_key=p_publication_key;
    return result;
end;
$$;

create function private.read_class_assignment_v1(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
    if not private.can_read_class_assignment(p_assignment_id) then raise exception 'Assignment unavailable.' using errcode='42501'; end if;
    select to_jsonb(a) || jsonb_build_object('content',v.student_content,'className',c.name,'subjectName',s.name)
    into result from public.class_assignments a join private.class_material_versions v on v.id=a.version_id
    join public.teaching_classes c on c.id=a.class_id join public.teacher_subjects s on s.id=c.subject_id
    where a.id=p_assignment_id;
    return result;
end;
$$;

create function private.withdraw_class_assignment_v1(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
    update public.class_assignments set withdrawn=true where id=p_assignment_id and owner_id=auth.uid() and private.is_teacher();
    if not found then raise exception 'Assignment unavailable.' using errcode='42501'; end if;
end;
$$;

create function public.publish_class_material_v1(p_class_ids uuid[],p_kind text,p_material_id text,p_release_at timestamptz,p_publication_key uuid,p_due_at timestamptz default null,p_close_at timestamptz default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.publish_class_material_v1(p_class_ids,p_kind,p_material_id,p_release_at,p_publication_key,p_due_at,p_close_at); $$;
create function public.read_class_assignment_v1(p_assignment_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_class_assignment_v1(p_assignment_id); $$;
create function public.withdraw_class_assignment_v1(p_assignment_id uuid) returns void language sql security invoker set search_path='' as $$ select private.withdraw_class_assignment_v1(p_assignment_id); $$;
do $$ declare signature text; schema_name text; begin
    foreach signature in array array['publish_class_material_v1(uuid[],text,text,timestamptz,uuid,timestamptz,timestamptz)',
        'read_class_assignment_v1(uuid)','withdraw_class_assignment_v1(uuid)'] loop
        foreach schema_name in array array['public','private'] loop
            execute format('revoke all on function %s.%s from public, anon',schema_name,signature);
            execute format('grant execute on function %s.%s to authenticated',schema_name,signature);
        end loop;
    end loop;
end $$;
notify pgrst, 'reload schema';
commit;
