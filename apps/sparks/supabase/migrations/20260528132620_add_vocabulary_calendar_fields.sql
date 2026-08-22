alter table public.vocabularies
    add column if not exists assigned_date date,
    add column if not exists trimester text,
    add column if not exists month text,
    add column if not exists week integer;

create index if not exists vocabularies_assigned_date_idx
    on public.vocabularies (assigned_date);

create index if not exists vocabularies_trimester_month_week_idx
    on public.vocabularies (trimester, month, week);
