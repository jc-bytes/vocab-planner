create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'student' check (role in ('student', 'teacher')),
    first_name text not null default '',
    last_name text not null default '',
    email extensions.citext not null,
    grade_level integer check (grade_level is null or grade_level between 6 and 9),
    section_letter text check (section_letter is null or section_letter ~ '^[A-Z]$'),
    must_change_password boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.teacher_allowlist (
    email extensions.citext primary key,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vocabularies (
    id text primary key,
    name text not null default '',
    description text not null default '',
    grades text[] not null default '{}',
    activity_settings jsonb not null default '{}'::jsonb,
    words jsonb not null default '[]'::jsonb,
    owner_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.student_progress (
    user_id uuid primary key references auth.users(id) on delete cascade,
    student_profile jsonb not null default '{}'::jsonb,
    units jsonb not null default '{}'::jsonb,
    coins integer not null default 0,
    coin_data jsonb not null default '{"balance":0,"giftCoins":0,"totalEarned":0,"totalSpent":0,"totalGifted":0}'::jsonb,
    coin_history jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.scores (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null default '',
    grade_level integer check (grade_level is null or grade_level between 6 and 9),
    game_id text not null,
    score numeric not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    timestamp timestamptz not null default now()
);

create table if not exists public.app_settings (
    key text primary key,
    value jsonb not null default '{}'::jsonb,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.export_logs (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid references auth.users(id) on delete set null,
    data_types text[] not null default '{}',
    student_count integer not null default 0,
    format text not null default 'json',
    filename text not null default '',
    metadata jsonb not null default '{}'::jsonb,
    timestamp timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_grade_section_idx on public.profiles(grade_level, section_letter);
create index if not exists student_progress_updated_at_idx on public.student_progress(updated_at desc);
create index if not exists scores_game_grade_score_idx on public.scores(game_id, grade_level, score desc);
create index if not exists scores_user_id_idx on public.scores(user_id);
create index if not exists vocabularies_grades_idx on public.vocabularies using gin(grades);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_teacher_allowlist_updated_at on public.teacher_allowlist;
create trigger set_teacher_allowlist_updated_at
before update on public.teacher_allowlist
for each row execute function public.set_updated_at();

drop trigger if exists set_vocabularies_updated_at on public.vocabularies;
create trigger set_vocabularies_updated_at
before update on public.vocabularies
for each row execute function public.set_updated_at();

drop trigger if exists set_student_progress_updated_at on public.student_progress;
create trigger set_student_progress_updated_at
before update on public.student_progress
for each row execute function public.set_updated_at();

drop trigger if exists set_scores_updated_at on public.scores;
create trigger set_scores_updated_at
before update on public.scores
for each row execute function public.set_updated_at();

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create or replace function private.is_teacher(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
    select exists (
        select 1
        from public.profiles
        where user_id = check_user_id
          and role = 'teacher'
    );
$$;

create or replace function private.user_grade(check_user_id uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public, extensions
as $$
    select grade_level
    from public.profiles
    where user_id = check_user_id
    limit 1;
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_teacher(uuid) to authenticated;
grant execute on function private.user_grade(uuid) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    is_allowlisted_teacher boolean;
begin
    select exists (
        select 1
        from public.teacher_allowlist
        where email = new.email::extensions.citext
          and active = true
    )
    into is_allowlisted_teacher;

    insert into public.profiles (
        user_id,
        role,
        first_name,
        last_name,
        email
    )
    values (
        new.id,
        case when is_allowlisted_teacher then 'teacher' else 'student' end,
        coalesce(new.raw_user_meta_data ->> 'first_name', ''),
        coalesce(new.raw_user_meta_data ->> 'last_name', ''),
        coalesce(new.email, '')::extensions.citext
    )
    on conflict (user_id) do update
        set email = excluded.email,
            role = case
                when is_allowlisted_teacher then 'teacher'
                else public.profiles.role
            end,
            updated_at = now();

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.ensure_student_progress()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    if new.role = 'student' then
        insert into public.student_progress (user_id, student_profile)
        values (
            new.user_id,
            jsonb_build_object(
                'firstName', new.first_name,
                'lastName', new.last_name,
                'name', trim(new.first_name || ' ' || new.last_name),
                'email', new.email::text,
                'grade', coalesce(new.grade_level::text, ''),
                'group', coalesce(new.section_letter, '')
            )
        )
        on conflict (user_id) do nothing;
    end if;

    return new;
end;
$$;

drop trigger if exists on_student_profile_created on public.profiles;
create trigger on_student_profile_created
after insert on public.profiles
for each row execute function public.ensure_student_progress();

alter table public.profiles enable row level security;
alter table public.teacher_allowlist enable row level security;
alter table public.vocabularies enable row level security;
alter table public.student_progress enable row level security;
alter table public.scores enable row level security;
alter table public.app_settings enable row level security;
alter table public.export_logs enable row level security;

drop policy if exists "profiles_select_self_or_teacher" on public.profiles;
create policy "profiles_select_self_or_teacher"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_teacher());

drop policy if exists "profiles_insert_own_student" on public.profiles;
create policy "profiles_insert_own_student"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id and role = 'student');

drop policy if exists "profiles_update_own_student" on public.profiles;
create policy "profiles_update_own_student"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id and role = 'student')
with check ((select auth.uid()) = user_id and role = 'student');

drop policy if exists "profiles_update_students_by_teacher" on public.profiles;
create policy "profiles_update_students_by_teacher"
on public.profiles
for update
to authenticated
using (private.is_teacher() and role = 'student')
with check (role = 'student');

drop policy if exists "profiles_update_own_teacher" on public.profiles;
create policy "profiles_update_own_teacher"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id and role = 'teacher')
with check ((select auth.uid()) = user_id and role = 'teacher');

drop policy if exists "teacher_allowlist_select_teachers" on public.teacher_allowlist;
create policy "teacher_allowlist_select_teachers"
on public.teacher_allowlist
for select
to authenticated
using (private.is_teacher());

drop policy if exists "vocabularies_select_authenticated" on public.vocabularies;
create policy "vocabularies_select_authenticated"
on public.vocabularies
for select
to authenticated
using (true);

drop policy if exists "vocabularies_insert_teachers" on public.vocabularies;
create policy "vocabularies_insert_teachers"
on public.vocabularies
for insert
to authenticated
with check (private.is_teacher());

drop policy if exists "vocabularies_update_teachers" on public.vocabularies;
create policy "vocabularies_update_teachers"
on public.vocabularies
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());

drop policy if exists "vocabularies_delete_teachers" on public.vocabularies;
create policy "vocabularies_delete_teachers"
on public.vocabularies
for delete
to authenticated
using (private.is_teacher());

drop policy if exists "student_progress_select_self_or_teacher" on public.student_progress;
create policy "student_progress_select_self_or_teacher"
on public.student_progress
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_teacher());

drop policy if exists "student_progress_insert_self" on public.student_progress;
create policy "student_progress_insert_self"
on public.student_progress
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "student_progress_update_self_or_teacher" on public.student_progress;
create policy "student_progress_update_self_or_teacher"
on public.student_progress
for update
to authenticated
using ((select auth.uid()) = user_id or private.is_teacher())
with check ((select auth.uid()) = user_id or private.is_teacher());

drop policy if exists "scores_select_grade_or_teacher" on public.scores;
create policy "scores_select_grade_or_teacher"
on public.scores
for select
to authenticated
using (
    private.is_teacher()
    or user_id = (select auth.uid())
    or grade_level = private.user_grade()
);

drop policy if exists "scores_insert_own" on public.scores;
create policy "scores_insert_own"
on public.scores
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "scores_update_own_or_teacher" on public.scores;
create policy "scores_update_own_or_teacher"
on public.scores
for update
to authenticated
using (user_id = (select auth.uid()) or private.is_teacher())
with check (user_id = (select auth.uid()) or private.is_teacher());

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_authenticated"
on public.app_settings
for select
to authenticated
using (true);

drop policy if exists "app_settings_insert_teachers" on public.app_settings;
create policy "app_settings_insert_teachers"
on public.app_settings
for insert
to authenticated
with check (private.is_teacher());

drop policy if exists "app_settings_update_teachers" on public.app_settings;
create policy "app_settings_update_teachers"
on public.app_settings
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());

drop policy if exists "export_logs_insert_teachers" on public.export_logs;
create policy "export_logs_insert_teachers"
on public.export_logs
for insert
to authenticated
with check (private.is_teacher());

drop policy if exists "export_logs_select_teachers" on public.export_logs;
create policy "export_logs_select_teachers"
on public.export_logs
for select
to authenticated
using (private.is_teacher());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.teacher_allowlist to authenticated;
grant select, insert, update, delete on public.vocabularies to authenticated;
grant select, insert, update on public.student_progress to authenticated;
grant select, insert, update on public.scores to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
grant select, insert on public.export_logs to authenticated;
grant all on all tables in schema public to service_role;
