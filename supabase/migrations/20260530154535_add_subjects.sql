create table if not exists public.subjects (
    slug text primary key,
    name text not null default '',
    color text not null default '#2563eb',
    sort_order integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint subjects_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    constraint subjects_color_format check (color ~ '^#[0-9A-Fa-f]{6}$')
);

insert into public.subjects (slug, name, color, sort_order, active)
values
    ('technology', 'Technology', '#2563eb', 10, true),
    ('science', 'Science', '#16a34a', 20, true)
on conflict (slug) do update
set
    name = excluded.name,
    color = excluded.color,
    sort_order = excluded.sort_order,
    active = excluded.active;

alter table public.vocabularies
    add column if not exists subject_slug text not null default 'technology';

update public.vocabularies
set subject_slug = 'technology'
where subject_slug is null or subject_slug = '';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'vocabularies_subject_slug_fkey'
          and conrelid = 'public.vocabularies'::regclass
    ) then
        alter table public.vocabularies
            add constraint vocabularies_subject_slug_fkey
            foreign key (subject_slug)
            references public.subjects(slug)
            on update cascade
            on delete restrict;
    end if;
end $$;

drop trigger if exists set_subjects_updated_at on public.subjects;
create trigger set_subjects_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create index if not exists subjects_active_sort_idx
    on public.subjects (active, sort_order, name);

create index if not exists vocabularies_subject_grade_idx
    on public.vocabularies (subject_slug);

alter table public.subjects enable row level security;

drop policy if exists "subjects_select_authenticated" on public.subjects;
create policy "subjects_select_authenticated"
on public.subjects
for select
to authenticated
using (true);

drop policy if exists "subjects_insert_teachers" on public.subjects;
create policy "subjects_insert_teachers"
on public.subjects
for insert
to authenticated
with check (private.is_teacher());

drop policy if exists "subjects_update_teachers" on public.subjects;
create policy "subjects_update_teachers"
on public.subjects
for update
to authenticated
using (private.is_teacher())
with check (private.is_teacher());

drop policy if exists "subjects_delete_teachers" on public.subjects;
create policy "subjects_delete_teachers"
on public.subjects
for delete
to authenticated
using (private.is_teacher());

grant select, insert, update, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
