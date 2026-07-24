create table if not exists public.teacher_group_pair_restrictions (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    student_a_id uuid not null references public.profiles(user_id) on delete cascade,
    student_b_id uuid not null references public.profiles(user_id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint teacher_group_pair_distinct_students check (student_a_id <> student_b_id),
    constraint teacher_group_pair_canonical_order check (student_a_id < student_b_id),
    constraint teacher_group_pair_unique unique (teacher_id, student_a_id, student_b_id)
);

create index if not exists teacher_group_pair_restrictions_teacher_idx
on public.teacher_group_pair_restrictions(teacher_id);

create index if not exists teacher_group_pair_restrictions_students_idx
on public.teacher_group_pair_restrictions(student_a_id, student_b_id);

alter table public.teacher_group_pair_restrictions enable row level security;

drop policy if exists "teacher_group_pair_restrictions_select_own" on public.teacher_group_pair_restrictions;
create policy "teacher_group_pair_restrictions_select_own"
on public.teacher_group_pair_restrictions
for select
to authenticated
using (
    private.is_teacher()
    and teacher_id = (select auth.uid())
);

drop policy if exists "teacher_group_pair_restrictions_insert_own" on public.teacher_group_pair_restrictions;
create policy "teacher_group_pair_restrictions_insert_own"
on public.teacher_group_pair_restrictions
for insert
to authenticated
with check (
    private.is_teacher()
    and teacher_id = (select auth.uid())
);

drop policy if exists "teacher_group_pair_restrictions_delete_own" on public.teacher_group_pair_restrictions;
create policy "teacher_group_pair_restrictions_delete_own"
on public.teacher_group_pair_restrictions
for delete
to authenticated
using (
    private.is_teacher()
    and teacher_id = (select auth.uid())
);

revoke all on table public.teacher_group_pair_restrictions from anon;
revoke all on table public.teacher_group_pair_restrictions from authenticated;
grant select, insert, delete on table public.teacher_group_pair_restrictions to authenticated;
