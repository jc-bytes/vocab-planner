begin;

-- Grading is opt-in, distinct from coins and activity accuracy. Published grades
-- are immutable snapshots; later progress remains provisional until republished.
create function private.normalize_vocabulary_grading_v1(p_config jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare value jsonb := coalesce(nullif(p_config,'null'::jsonb),'{}'::jsonb);
    maximum numeric; bonus numeric; cap numeric; enabled boolean; capped boolean;
begin
    if jsonb_typeof(value)<>'object'
       or (value ? 'enabled' and jsonb_typeof(value->'enabled')<>'boolean')
       or (value ? 'capAtMaxPoints' and jsonb_typeof(value->'capAtMaxPoints')<>'boolean')
       or (value ? 'maxPoints' and jsonb_typeof(value->'maxPoints')<>'number')
       or (value ? 'bonusPerActivity' and jsonb_typeof(value->'bonusPerActivity')<>'number')
       or (value ? 'bonusCap' and jsonb_typeof(value->'bonusCap') not in ('number','null')) then
        raise exception 'Invalid vocabulary grading settings.' using errcode='22023';
    end if;
    enabled:=coalesce((value->>'enabled')::boolean,false);
    capped:=coalesce((value->>'capAtMaxPoints')::boolean,false);
    maximum:=coalesce((value->>'maxPoints')::numeric,100);
    bonus:=coalesce((value->>'bonusPerActivity')::numeric,0);
    cap:=(value->>'bonusCap')::numeric;
    if maximum<=0 or maximum>100000 or bonus<0 or bonus>100000 or cap<0 or cap>100000
       or round(maximum,2)<>maximum or round(bonus,2)<>bonus or round(cap,2)<>cap then
        raise exception 'Invalid vocabulary grading points.' using errcode='22023';
    end if;
    return jsonb_build_object('enabled',enabled,'maxPoints',maximum,'bonusPerActivity',bonus,'bonusCap',cap,'capAtMaxPoints',capped);
end;
$$;
revoke all on function private.normalize_vocabulary_grading_v1(jsonb) from public,anon,authenticated;

create function private.validate_vocabulary_grading_settings_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
    if new.activity_settings ? 'grading' then perform private.normalize_vocabulary_grading_v1(new.activity_settings->'grading'); end if;
    return new;
end;
$$;
revoke all on function private.validate_vocabulary_grading_settings_v1() from public,anon,authenticated;
create trigger validate_vocabulary_grading_settings before insert or update of activity_settings on public.vocabularies
for each row execute function private.validate_vocabulary_grading_settings_v1();

create table private.assignment_vocabulary_grading (
    assignment_id uuid primary key,
    school_id uuid not null,
    config jsonb not null check(jsonb_typeof(config)='object'),
    revision integer not null check(revision>0),
    updated_by uuid not null references public.profiles(user_id),
    updated_at timestamptz not null default now(),
    foreign key(assignment_id,school_id) references public.class_assignments(id,school_id) on delete cascade
);
create table private.vocabulary_grade_publications (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null,
    school_id uuid not null,
    settings_revision integer not null check(settings_revision>0),
    grading jsonb not null,
    published_by uuid not null references public.profiles(user_id),
    published_at timestamptz not null default now(),
    unique(assignment_id,settings_revision),
    foreign key(assignment_id,school_id) references public.class_assignments(id,school_id) on delete cascade
);
create index vocabulary_grade_publications_latest_idx on private.vocabulary_grade_publications(assignment_id,published_at desc,settings_revision desc);
create table private.published_vocabulary_grades (
    publication_id uuid not null references private.vocabulary_grade_publications(id) on delete cascade,
    student_id uuid not null references public.profiles(user_id) on delete cascade,
    grade jsonb not null check(jsonb_typeof(grade)='object'),
    primary key(publication_id,student_id)
);
alter table private.assignment_vocabulary_grading enable row level security;
alter table private.vocabulary_grade_publications enable row level security;
alter table private.published_vocabulary_grades enable row level security;
revoke all on private.assignment_vocabulary_grading,private.vocabulary_grade_publications,private.published_vocabulary_grades from public,anon,authenticated;

create index student_activity_progress_grade_lookup_idx
    on public.student_activity_progress(assignment_id,user_id,activity_type)
    where assignment_id is not null;

-- Mirror the student registry's word filters and weekly minimum-round rules.
-- Explicit published required lists are not substituted by the student client.
create function private.vocabulary_grade_activity_playable_v1(p_content jsonb,p_activity text)
returns boolean language sql immutable set search_path='' as $$
    select count(*) >= case when p_content#>'{activitySettings,weeklyPoolVersion}'='1'::jsonb
         and p_activity=any(array['matching','quiz','word-search','crossword','speed-match','fill-in-blank']) then 4 else 1 end
    from jsonb_array_elements(case when jsonb_typeof(p_content->'words')='array' then p_content->'words' else '[]'::jsonb end) w
    where case p_activity
        when 'flashcards' then length(trim(coalesce(w->>'word','')))>0 and length(trim(coalesce(w->>'definition','')))>0
        when 'matching' then length(trim(coalesce(w->>'word','')))>=2 and length(trim(coalesce(w->>'definition','')))>0
        when 'quiz' then length(trim(coalesce(w->>'word','')))>0 and length(trim(coalesce(w->>'definition','')))>0
        when 'speed-match' then length(trim(coalesce(w->>'word','')))>0 and length(trim(coalesce(w->>'definition','')))>0
        when 'fill-in-blank' then length(trim(coalesce(w->>'word','')))>0 and length(trim(coalesce(w->>'example','')))>0
        when 'illustration' then length(trim(coalesce(w->>'word','')))>0
        when 'hangman' then length(trim(coalesce(w->>'word','')))>0
        when 'scramble' then length(trim(coalesce(w->>'word','')))>0
        when 'synonym-antonym' then length(trim(coalesce(w->>'word','')))>0 and
            (case when jsonb_typeof(w->'synonyms')='array' then jsonb_array_length(w->'synonyms') else 0 end > 0
             or case when jsonb_typeof(w->'antonyms')='array' then jsonb_array_length(w->'antonyms') else 0 end > 0)
        when 'word-search' then case when p_content#>'{activitySettings,weeklyPoolVersion}'='1'::jsonb then
            length(regexp_replace(upper(coalesce(w->>'word','')),'[^A-Z0-9]','','g')) between 2 and 15
            else length(trim(coalesce(w->>'word','')))>=4 end
        when 'crossword' then coalesce(w->>'word','') ~ '^[a-zA-Z]+$' and length(w->>'word')>1 and length(trim(coalesce(w->>'definition','')))>0
        when 'wordle' then coalesce(w->>'word','') ~ '^[a-zA-Z[:space:]-]+$' and length(regexp_replace(w->>'word','[^a-zA-Z]','','g')) between 3 and 10
        else false end;
$$;
revoke all on function private.vocabulary_grade_activity_playable_v1(jsonb,text) from public,anon,authenticated;

create function private.vocabulary_assignment_grade_v1(p_assignment_id uuid,p_student_id uuid,p_config jsonb default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare content jsonb; cfg jsonb; required text[]; additional text[]; blocked text[];
    valid_ids text[]:=array['flashcards','matching','quiz','synonym-antonym','word-search','crossword','hangman','scramble','wordle','speed-match','fill-in-blank','illustration'];
    completed integer; extra_completed integer; maximum numeric; base numeric; bonus numeric; raw_bonus numeric; earned numeric; activities jsonb; result jsonb;
begin
    select v.student_content,private.normalize_vocabulary_grading_v1(coalesce(p_config,s.config,v.student_content#>'{activitySettings,grading}'))
    into content,cfg from public.class_assignments a join private.class_material_versions v on v.id=a.version_id
    left join private.assignment_vocabulary_grading s on s.assignment_id=a.id where a.id=p_assignment_id and a.kind='vocabulary';
    if not found then raise exception 'Vocabulary assignment unavailable.' using errcode='42501'; end if;
    maximum:=(cfg->>'maxPoints')::numeric;
    result:=jsonb_build_object('assignmentId',p_assignment_id,'enabled',(cfg->>'enabled')::boolean,
        'status','ungraded','requiredCount',0,'requiredCompleted',0,'additionalCount',0,'additionalCompleted',0,
        'basePoints',null,'bonusPoints',null,'rawBonusPoints',null,'bonusLimited',false,'earnedPoints',null,'maxPoints',maximum,'percent',null,'activities','[]'::jsonb,'grading',cfg);
    if not (cfg->>'enabled')::boolean then return result; end if;
    if jsonb_typeof(content#>'{activitySettings,requiredActivities}') is distinct from 'array'
       or coalesce(content#>>'{activitySettings,retiredWeeklySet}','false')='true' then
        return result||jsonb_build_object('status','unavailable','reason','Required activities are unavailable.');
    end if;
    select coalesce(array_agg(distinct x),array[]::text[]) into required
    from jsonb_array_elements_text(content#>'{activitySettings,requiredActivities}') x;
    if cardinality(required)=0 or exists(select 1 from unnest(required) x where x is null or not(x=any(valid_ids))) then
        return result||jsonb_build_object('status','unavailable','reason','Choose at least one valid required activity.');
    end if;
    -- The student always includes Flashcards unless this is an explicit review-only pool.
    if (not('flashcards'=any(required)) and not(coalesce(content#>'{activitySettings,weeklyPoolVersion}','null'::jsonb)='1'::jsonb and coalesce(content#>'{activitySettings,reviewOnly}','false'::jsonb)='true'::jsonb))
       or ('flashcards'=any(required) and coalesce(content#>'{activitySettings,weeklyPoolVersion}','null'::jsonb)='1'::jsonb and coalesce(content#>'{activitySettings,reviewOnly}','false'::jsonb)='true'::jsonb) then
        return result||jsonb_build_object('status','unavailable','reason','The published required list does not match the student activity path.');
    end if;
    select coalesce(array_agg(x),array[]::text[]) into blocked from unnest(required) x
    where not private.vocabulary_grade_activity_playable_v1(content,x);
    if cardinality(blocked)>0 then
        return result||jsonb_build_object('status','unavailable','requiredCount',cardinality(required),
            'reason','Some required activities cannot be completed with this published word list.','blockedActivities',to_jsonb(blocked));
    end if;
    select coalesce(array_agg(distinct x),array[]::text[]) into additional
    from jsonb_array_elements_text(case when jsonb_typeof(content#>'{activitySettings,additionalActivities}')='array'
        then content#>'{activitySettings,additionalActivities}' else '[]'::jsonb end) x
    where x=any(valid_ids) and not(x=any(required));
    with tasks as (
        select activity,needed,exists(select 1 from public.student_activity_progress p
            where p.assignment_id=p_assignment_id and p.user_id=p_student_id and p.activity_type=activity
              and p.verified and (p.is_complete or p.score>=100)) as complete
        from (select unnest(required) as activity,true as needed union all select unnest(additional),false) t
    )
    select count(*) filter(where needed and complete),count(*) filter(where not needed and complete),
        coalesce(jsonb_agg(jsonb_build_object('activityType',activity,'required',needed,'complete',complete,
            'points',case when complete then round(case when needed then maximum/cardinality(required) else (cfg->>'bonusPerActivity')::numeric end,2) else 0 end)
            order by needed desc,array_position(valid_ids,activity)),'[]'::jsonb)
    into completed,extra_completed,activities from tasks;
    base:=round(maximum*completed/cardinality(required),2);
    raw_bonus:=round(extra_completed*(cfg->>'bonusPerActivity')::numeric,2); bonus:=raw_bonus;
    if cfg->>'bonusCap' is not null then bonus:=least(bonus,(cfg->>'bonusCap')::numeric); end if;
    if (cfg->>'capAtMaxPoints')::boolean then bonus:=least(bonus,greatest(0,maximum-base)); end if;
    bonus:=round(bonus,2); earned:=round(base+bonus,2);
    return result||jsonb_build_object('status','provisional','requiredCount',cardinality(required),'requiredCompleted',completed,
        'additionalCount',cardinality(additional),'additionalCompleted',extra_completed,'basePoints',base,'bonusPoints',bonus,
        'earnedPoints',earned,'rawBonusPoints',raw_bonus,'bonusLimited',bonus<raw_bonus,'percent',round(100*earned/maximum,2),'activities',activities);
end;
$$;
revoke all on function private.vocabulary_assignment_grade_v1(uuid,uuid,jsonb) from public,anon,authenticated;

create function private.teacher_class_gradebook_v1(p_school_id uuid,p_class_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare zone text; assignments jsonb; students jsonb;
begin
    if auth.uid() is null or not exists(select 1 from public.teaching_classes where id=p_class_id and school_id=p_school_id and private.owns_teaching_class(id)) then
        raise exception 'Class gradebook unavailable.' using errcode='42501'; end if;
    if p_from is null or p_to is null or p_from>p_to then raise exception 'Invalid gradebook date range.' using errcode='22023'; end if;
    select timezone into zone from public.schools where id=p_school_id;
    with selected as materialized (
        select a.id,a.title,a.release_at,a.due_at,a.version_id,
            private.normalize_vocabulary_grading_v1(coalesce(s.config,v.student_content#>'{activitySettings,grading}')) as grading,
            coalesce(s.revision,0) as revision
        from public.class_assignments a join private.class_material_versions v on v.id=a.version_id
        left join private.assignment_vocabulary_grading s on s.assignment_id=a.id
        where a.class_id=p_class_id and a.school_id=p_school_id and a.kind='vocabulary' and not a.withdrawn and a.release_at<=now()
          and a.release_at >= (p_from::timestamp at time zone zone) and a.release_at < ((p_to+1)::timestamp at time zone zone)
          and coalesce(v.student_content#>>'{activitySettings,retiredWeeklySet}','false')<>'true'
    ), latest as materialized (
        select distinct on(p.assignment_id) p.* from private.vocabulary_grade_publications p join selected a on a.id=p.assignment_id
        order by p.assignment_id,p.settings_revision desc
    )
    select coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'releaseAt',a.release_at,'dueAt',a.due_at,
            'grading',a.grading,'revision',a.revision,'publishedAt',p.published_at) order by a.release_at,a.id) from selected a left join latest p on p.assignment_id=a.id),'[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('studentId',m.student_id,'name',trim(concat_ws(' ',profile.first_name,profile.last_name)),
            'email',profile.email,'grades',coalesce((select jsonb_agg(private.vocabulary_assignment_grade_v1(a.id,m.student_id,a.grading)||jsonb_build_object('published',
                case when g.grade is not null then g.grade||jsonb_build_object('publishedAt',p.published_at) else null end) order by a.release_at,a.id)
                from selected a left join latest p on p.assignment_id=a.id
                left join private.published_vocabulary_grades g on g.publication_id=p.id and g.student_id=m.student_id),'[]'::jsonb)) order by profile.last_name,profile.first_name,m.student_id)
            from public.class_memberships m join public.profiles profile on profile.user_id=m.student_id where m.class_id=p_class_id and m.active),'[]'::jsonb)
    into assignments,students;
    return jsonb_build_object('assignments',assignments,'students',students);
end;
$$;
create function public.teacher_class_gradebook_v1(p_school_id uuid,p_class_id uuid,p_from date,p_to date)
returns jsonb language sql stable security invoker set search_path='' as $$select private.teacher_class_gradebook_v1(p_school_id,p_class_id,p_from,p_to);$$;

create function private.teacher_set_assignment_grading_v1(p_school_id uuid,p_assignment_id uuid,p_config jsonb,p_expected_revision integer,p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare assignment public.class_assignments; cfg jsonb; revision integer;
begin
    if p_expected_user_id is null or auth.uid() is distinct from p_expected_user_id then raise exception 'Teacher account changed. Reload before grading.' using errcode='42501'; end if;
    select * into assignment from public.class_assignments where id=p_assignment_id and school_id=p_school_id and kind='vocabulary';
    if not found then raise exception 'Vocabulary grading unavailable.' using errcode='42501'; end if;
    perform 1 from public.schools where id=p_school_id for share;
    perform 1 from public.teaching_classes where id=assignment.class_id for update;
    if not private.owns_teaching_class(assignment.class_id) then raise exception 'Vocabulary grading unavailable.' using errcode='42501'; end if;
    cfg:=private.normalize_vocabulary_grading_v1(p_config);
    select s.revision into revision from private.assignment_vocabulary_grading s where s.assignment_id=p_assignment_id for update;
    if p_expected_revision is null or p_expected_revision<>coalesce(revision,0) then raise exception 'Grading settings changed. Reload before saving.' using errcode='40001'; end if;
    revision:=coalesce(revision,0)+1;
    insert into private.assignment_vocabulary_grading(assignment_id,school_id,config,revision,updated_by)
    values(p_assignment_id,p_school_id,cfg,revision,auth.uid()) on conflict(assignment_id) do update
    set config=excluded.config,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
    return jsonb_build_object('assignmentId',p_assignment_id,'grading',cfg,'revision',revision);
end;
$$;
create function public.teacher_set_assignment_grading_v1(p_school_id uuid,p_assignment_id uuid,p_config jsonb,p_expected_revision integer,p_expected_user_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.teacher_set_assignment_grading_v1(p_school_id,p_assignment_id,p_config,p_expected_revision,p_expected_user_id);$$;

create function private.teacher_publish_vocabulary_grades_v1(p_school_id uuid,p_assignment_id uuid,p_expected_revision integer,p_expected_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare assignment public.class_assignments; cfg jsonb; revision integer; publication uuid; published timestamptz:=now(); student uuid; grade jsonb; count integer:=0;
begin
    if p_expected_user_id is null or auth.uid() is distinct from p_expected_user_id then raise exception 'Teacher account changed. Reload before grading.' using errcode='42501'; end if;
    select * into assignment from public.class_assignments where id=p_assignment_id and school_id=p_school_id and kind='vocabulary';
    if not found then raise exception 'Vocabulary grading unavailable.' using errcode='42501'; end if;
    perform 1 from public.schools where id=p_school_id for share;
    perform 1 from public.teaching_classes where id=assignment.class_id for update;
    if not private.owns_teaching_class(assignment.class_id) then raise exception 'Vocabulary grading unavailable.' using errcode='42501'; end if;
    if assignment.withdrawn or assignment.release_at>now() then raise exception 'Only released, current assignments can have published grades.' using errcode='22023'; end if;
    select s.config,s.revision into cfg,revision from private.assignment_vocabulary_grading s where s.assignment_id=p_assignment_id for update;
    if p_expected_revision is null or p_expected_revision<>coalesce(revision,0) then raise exception 'Grading settings changed. Reload before publishing.' using errcode='40001'; end if;
    if cfg is null then select v.student_content#>'{activitySettings,grading}' into cfg from private.class_material_versions v where v.id=assignment.version_id; end if;
    cfg:=private.normalize_vocabulary_grading_v1(cfg); revision:=coalesce(revision,0)+1;
    -- Check even an empty class before recording a publication of an invalid recipe.
    grade:=private.vocabulary_assignment_grade_v1(p_assignment_id,null,cfg);
    if grade->>'status'='unavailable' then raise exception 'Grades cannot be published: %',grade->>'reason' using errcode='22023'; end if;
    insert into private.assignment_vocabulary_grading(assignment_id,school_id,config,revision,updated_by)
    values(p_assignment_id,p_school_id,cfg,revision,auth.uid()) on conflict(assignment_id) do update
    set config=excluded.config,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=published;
    insert into private.vocabulary_grade_publications(assignment_id,school_id,settings_revision,grading,published_by,published_at)
    values(p_assignment_id,p_school_id,revision,cfg,auth.uid(),published) returning id into publication;
    for student in select m.student_id from public.class_memberships m where m.class_id=assignment.class_id and m.active order by m.student_id loop
        grade:=private.vocabulary_assignment_grade_v1(p_assignment_id,student,cfg);
        insert into private.published_vocabulary_grades(publication_id,student_id,grade) values(publication,student,grade);
        count:=count+1;
    end loop;
    return jsonb_build_object('assignmentId',p_assignment_id,'revision',revision,'publishedAt',published,'students',count);
end;
$$;
create function public.teacher_publish_vocabulary_grades_v1(p_school_id uuid,p_assignment_id uuid,p_expected_revision integer,p_expected_user_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.teacher_publish_vocabulary_grades_v1(p_school_id,p_assignment_id,p_expected_revision,p_expected_user_id);$$;

create function private.my_class_vocabulary_grades_v1(p_school_id uuid,p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
    if auth.uid() is null or not exists(select 1 from public.teaching_classes c where c.id=p_class_id and c.school_id=p_school_id and private.is_class_member(c.id)) then
        raise exception 'Class grades unavailable.' using errcode='42501'; end if;
    with latest as (
        select distinct on(p.assignment_id) p.id,p.assignment_id,p.published_at,p.settings_revision
        from private.vocabulary_grade_publications p join public.class_assignments a on a.id=p.assignment_id
        where a.class_id=p_class_id and a.school_id=p_school_id and not a.withdrawn and a.release_at<=now()
        order by p.assignment_id,p.settings_revision desc
    )
    select coalesce(jsonb_agg(g.grade||jsonb_build_object('assignmentId',a.id,'title',a.title,'publishedAt',p.published_at) order by a.release_at,a.id),'[]'::jsonb)
    into result from latest p join public.class_assignments a on a.id=p.assignment_id
    join private.published_vocabulary_grades g on g.publication_id=p.id and g.student_id=auth.uid()
    where g.grade->'enabled'='true'::jsonb;
    return jsonb_build_object('grades',result);
end;
$$;
create function public.my_class_vocabulary_grades_v1(p_school_id uuid,p_class_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select private.my_class_vocabulary_grades_v1(p_school_id,p_class_id);$$;

revoke all on function private.teacher_class_gradebook_v1(uuid,uuid,date,date),public.teacher_class_gradebook_v1(uuid,uuid,date,date),
    private.teacher_set_assignment_grading_v1(uuid,uuid,jsonb,integer,uuid),public.teacher_set_assignment_grading_v1(uuid,uuid,jsonb,integer,uuid),
    private.teacher_publish_vocabulary_grades_v1(uuid,uuid,integer,uuid),public.teacher_publish_vocabulary_grades_v1(uuid,uuid,integer,uuid),
    private.my_class_vocabulary_grades_v1(uuid,uuid),public.my_class_vocabulary_grades_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function private.teacher_class_gradebook_v1(uuid,uuid,date,date),public.teacher_class_gradebook_v1(uuid,uuid,date,date),
    private.teacher_set_assignment_grading_v1(uuid,uuid,jsonb,integer,uuid),public.teacher_set_assignment_grading_v1(uuid,uuid,jsonb,integer,uuid),
    private.teacher_publish_vocabulary_grades_v1(uuid,uuid,integer,uuid),public.teacher_publish_vocabulary_grades_v1(uuid,uuid,integer,uuid),
    private.my_class_vocabulary_grades_v1(uuid,uuid),public.my_class_vocabulary_grades_v1(uuid,uuid) to authenticated;
commit;
