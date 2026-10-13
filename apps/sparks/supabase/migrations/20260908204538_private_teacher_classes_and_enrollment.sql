-- Additive foundation. Does not enable the private-workspace cutover or migrate
-- legacy content. Existing broad policies must be replaced before rollout.
begin;

create table public.teacher_subjects (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references public.profiles(user_id),
    name text not null check (length(trim(name)) between 1 and 100),
    archived boolean not null default false,
    created_at timestamptz not null default now(),
    unique (id, owner_id)
);
create index teacher_subjects_owner_idx on public.teacher_subjects(owner_id);

create table public.teaching_classes (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references public.profiles(user_id),
    subject_id uuid not null,
    name text not null check (length(trim(name)) between 1 and 100),
    school_year integer not null check (school_year between 2020 and 2200),
    archived boolean not null default false,
    created_at timestamptz not null default now(),
    unique (id, owner_id),
    foreign key (subject_id, owner_id) references public.teacher_subjects(id, owner_id)
);
create index teaching_classes_owner_idx on public.teaching_classes(owner_id);
create index teaching_classes_subject_idx on public.teaching_classes(subject_id, owner_id);

create table public.class_memberships (
    class_id uuid not null references public.teaching_classes(id),
    student_id uuid not null references public.profiles(user_id),
    active boolean not null default true,
    joined_at timestamptz not null default now(),
    removed_at timestamptz,
    primary key (class_id, student_id),
    check (active = (removed_at is null))
);
create index class_memberships_student_idx on public.class_memberships(student_id, class_id);

create table private.class_invitations (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.teaching_classes(id),
    email extensions.citext not null check (length(email::text) <= 254 and position('@' in email::text) > 1),
    expires_at timestamptz not null default now() + interval '14 days',
    accepted_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    unique (class_id, email)
);

alter table public.teacher_subjects enable row level security;
alter table public.teaching_classes enable row level security;
alter table public.class_memberships enable row level security;
alter table private.class_invitations enable row level security;
revoke all on public.teacher_subjects, public.teaching_classes, public.class_memberships from public, anon, authenticated;
revoke all on private.class_invitations from public, anon, authenticated;
grant select, insert on public.teacher_subjects, public.teaching_classes to authenticated;
grant update (name, archived) on public.teacher_subjects to authenticated;
grant update (name, archived) on public.teaching_classes to authenticated;
grant select on public.class_memberships to authenticated;

create function private.owns_teaching_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select private.is_teacher() and exists (
        select 1 from public.teaching_classes where id = p_class_id and owner_id = auth.uid()
    );
$$;
create function private.is_class_member(p_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.class_memberships
        where class_id = p_class_id and student_id = auth.uid() and active);
$$;
revoke all on function private.owns_teaching_class(uuid), private.is_class_member(uuid) from public, anon;
grant execute on function private.owns_teaching_class(uuid), private.is_class_member(uuid) to authenticated;

create policy teacher_subjects_own_select on public.teacher_subjects for select to authenticated
using (owner_id = (select auth.uid()) and (select private.is_teacher()));
create policy teacher_subjects_own_insert on public.teacher_subjects for insert to authenticated
with check (owner_id = (select auth.uid()) and (select private.is_teacher()));
create policy teacher_subjects_own_update on public.teacher_subjects for update to authenticated
using (owner_id = (select auth.uid()) and (select private.is_teacher()))
with check (owner_id = (select auth.uid()) and (select private.is_teacher()));

create policy teaching_classes_own_select on public.teaching_classes for select to authenticated
using (owner_id = (select auth.uid()) and (select private.is_teacher()));
create policy teaching_classes_own_insert on public.teaching_classes for insert to authenticated
with check (owner_id = (select auth.uid()) and (select private.is_teacher()) and exists (
    select 1 from public.teacher_subjects s where s.id = subject_id and s.owner_id = auth.uid() and not s.archived
));
create policy teaching_classes_own_update on public.teaching_classes for update to authenticated
using (owner_id = (select auth.uid()) and (select private.is_teacher()))
with check (owner_id = (select auth.uid()) and (select private.is_teacher()));
create policy class_memberships_select on public.class_memberships for select to authenticated
using (student_id = (select auth.uid()) or private.owns_teaching_class(class_id));

-- Students get a minimal class projection rather than access to teacher tables.
create function private.my_teaching_classes_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'schoolYear', c.school_year, 'archived', c.archived,
        'subjectId', s.id, 'subjectName', s.name,
        'teacherName', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')
    ) order by c.school_year desc, s.name, c.name), '[]'::jsonb)
    from public.class_memberships m
    join public.teaching_classes c on c.id = m.class_id
    join public.teacher_subjects s on s.id = c.subject_id
    join public.profiles p on p.user_id = c.owner_id
    where m.student_id = auth.uid() and m.active;
$$;

create function private.invite_class_student_v1(p_class_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
    if not private.owns_teaching_class(p_class_id) then raise exception 'Class unavailable.' using errcode = '42501'; end if;
    perform 1 from public.teaching_classes where id = p_class_id and not archived for update;
    if not found then raise exception 'Archived classes cannot accept invitations.'; end if;
    if p_email is null or length(trim(p_email)) > 254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Enter a valid email address.';
    end if;
    -- No account lookup and no notification here: response cannot enumerate users.
    insert into private.class_invitations(class_id, email) values(p_class_id, lower(trim(p_email)))
    on conflict(class_id, email) do update set
        expires_at = now() + interval '14 days', accepted_at = null, revoked_at = null;
end;
$$;

create function private.my_class_invitations_v1()
returns jsonb language sql stable security definer set search_path = '' as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'className', c.name, 'subjectName', s.name, 'schoolYear', c.school_year,
        'teacherName', nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'expiresAt', i.expires_at
    ) order by i.created_at desc), '[]'::jsonb)
    from private.class_invitations i
    join public.teaching_classes c on c.id = i.class_id and not c.archived
    join public.teacher_subjects s on s.id = c.subject_id
    join public.profiles p on p.user_id = c.owner_id
    join auth.users u on u.id = auth.uid() and u.email_confirmed_at is not null
    join public.profiles me on me.user_id = u.id and me.role = 'student'
    where i.email = u.email::extensions.citext and i.expires_at > now()
      and i.revoked_at is null and i.accepted_at is null;
$$;

create function private.accept_class_invitation_v1(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target private.class_invitations; caller_email text;
begin
    select u.email into caller_email from auth.users u join public.profiles p on p.user_id = u.id
      where u.id = auth.uid() and u.email_confirmed_at is not null and p.role = 'student';
    if caller_email is null then raise exception 'A verified student account is required.' using errcode = '42501'; end if;
    select * into target from private.class_invitations where id = p_invitation_id
        and email = caller_email::extensions.citext;
    if target.id is null or target.revoked_at is not null or target.expires_at <= now() then
        raise exception 'Invitation unavailable.' using errcode = '42501';
    end if;
    perform 1 from public.teaching_classes where id = target.class_id and not archived for update;
    if not found then raise exception 'Class unavailable.' using errcode = '42501'; end if;
    select * into target from private.class_invitations where id = p_invitation_id
        and email = caller_email::extensions.citext for update;
    if target.id is null or target.revoked_at is not null or target.expires_at <= now() then
        raise exception 'Invitation unavailable.' using errcode = '42501';
    end if;
    if target.accepted_at is not null then
        if private.is_class_member(target.class_id) then return target.class_id; end if;
        raise exception 'Invitation unavailable.' using errcode = '42501';
    end if;
    insert into public.class_memberships(class_id, student_id) values(target.class_id, auth.uid())
    on conflict(class_id, student_id) do update set active = true, joined_at = now(), removed_at = null;
    update private.class_invitations set accepted_at = now() where id = target.id;
    return target.class_id;
end;
$$;

create function private.remove_class_student_v1(p_class_id uuid, p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare student_email text;
begin
    if not private.owns_teaching_class(p_class_id) then raise exception 'Class unavailable.' using errcode = '42501'; end if;
    -- Serialize invite/accept/remove/archive using the class row first.
    perform 1 from public.teaching_classes where id = p_class_id for update;
    select email into student_email from auth.users where id = p_student_id;
    update private.class_invitations set revoked_at = now()
        where class_id = p_class_id and email = student_email::extensions.citext;
    update public.class_memberships set active = false, removed_at = now()
        where class_id = p_class_id and student_id = p_student_id and active;
end;
$$;

create function private.class_roster_v1(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
    if not private.owns_teaching_class(p_class_id) then raise exception 'Class unavailable.' using errcode = '42501'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('studentId', m.student_id,
        'name', trim(concat_ws(' ', p.first_name, p.last_name)), 'email', p.email,
        'joinedAt', m.joined_at) order by p.last_name, p.first_name, m.student_id), '[]'::jsonb)
    into result from public.class_memberships m join public.profiles p on p.user_id = m.student_id
    where m.class_id = p_class_id and m.active;
    return result;
end;
$$;

create function public.my_teaching_classes_v1() returns jsonb language sql stable security invoker set search_path = '' as $$ select private.my_teaching_classes_v1(); $$;
create function public.invite_class_student_v1(p_class_id uuid, p_email text) returns void language sql security invoker set search_path = '' as $$ select private.invite_class_student_v1(p_class_id, p_email); $$;
create function public.my_class_invitations_v1() returns jsonb language sql stable security invoker set search_path = '' as $$ select private.my_class_invitations_v1(); $$;
create function public.accept_class_invitation_v1(p_invitation_id uuid) returns uuid language sql security invoker set search_path = '' as $$ select private.accept_class_invitation_v1(p_invitation_id); $$;
create function public.remove_class_student_v1(p_class_id uuid, p_student_id uuid) returns void language sql security invoker set search_path = '' as $$ select private.remove_class_student_v1(p_class_id, p_student_id); $$;
create function public.class_roster_v1(p_class_id uuid) returns jsonb language sql stable security invoker set search_path = '' as $$ select private.class_roster_v1(p_class_id); $$;

do $$ declare signature text; schema_name text; begin
    foreach signature in array array['my_teaching_classes_v1()', 'invite_class_student_v1(uuid,text)',
        'my_class_invitations_v1()', 'accept_class_invitation_v1(uuid)', 'remove_class_student_v1(uuid,uuid)', 'class_roster_v1(uuid)'] loop
        foreach schema_name in array array['public','private'] loop
            execute format('revoke all on function %s.%s from public, anon', schema_name, signature);
            execute format('grant execute on function %s.%s to authenticated', schema_name, signature);
        end loop;
    end loop;
end $$;
notify pgrst, 'reload schema';
commit;
