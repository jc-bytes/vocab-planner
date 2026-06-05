alter table public.weekly_sparks
    add column if not exists grade_questions jsonb not null default '{}'::jsonb;

update public.weekly_sparks
set grade_questions = '{}'::jsonb
where grade_questions is null
   or jsonb_typeof(grade_questions) <> 'object';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'weekly_sparks_grade_questions_object_check'
          and conrelid = 'public.weekly_sparks'::regclass
    ) then
        alter table public.weekly_sparks
            add constraint weekly_sparks_grade_questions_object_check
            check (jsonb_typeof(grade_questions) = 'object');
    end if;
end $$;
