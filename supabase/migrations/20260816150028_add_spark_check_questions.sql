alter table public.weekly_sparks
    add column if not exists check_mode text not null default 'optional',
    add column if not exists questions jsonb not null default '[]'::jsonb;

alter table public.weekly_sparks
    drop constraint if exists weekly_sparks_check_mode_check;

alter table public.weekly_sparks
    add constraint weekly_sparks_check_mode_check
    check (check_mode in ('reading_only', 'optional', 'required'));

alter table public.weekly_sparks
    drop constraint if exists weekly_sparks_questions_array_check;

alter table public.weekly_sparks
    add constraint weekly_sparks_questions_array_check
    check (
        jsonb_typeof(questions) = 'array'
        and jsonb_array_length(questions) <= 3
    );
