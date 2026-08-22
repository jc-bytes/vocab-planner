-- Keep the server-side prerequisite rotation aligned with the student client.
-- Older catalog rows can have a null week even though their stable id/name
-- contains the week number used by the client.
create or replace function private.required_vocabulary_activities(vocabulary_row public.vocabularies)
returns text[]
language plpgsql
stable
set search_path = public, private, extensions
as $$
declare
    configured jsonb := vocabulary_row.activity_settings -> 'requiredActivities';
    effective_week integer := coalesce(
        vocabulary_row.week,
        substring(vocabulary_row.id from '(?i)week[_-]?([0-9]+)')::integer,
        substring(vocabulary_row.name from '(?i)week[[:space:]_-]?([0-9]+)')::integer,
        1
    );
    second_activity text;
    required_list text[];
begin
    if jsonb_typeof(configured) = 'array' then
        select coalesce(array_agg(value order by ordinal), '{}'::text[])
        into required_list
        from jsonb_array_elements_text(configured) with ordinality item(value, ordinal)
        where value = any(array[
            'flashcards', 'matching', 'quiz', 'synonym-antonym', 'word-search',
            'crossword', 'hangman', 'scramble', 'wordle', 'speed-match',
            'fill-in-blank', 'illustration'
        ]);
        if array_length(required_list, 1) is not null then
            if not ('flashcards' = any(required_list)) then
                required_list := array_prepend('flashcards', required_list);
            end if;
            return required_list;
        end if;
    end if;

    if lower(vocabulary_row.id || ' ' || vocabulary_row.name) like '%summative%' then
        return array['flashcards', 'illustration'];
    end if;

    second_activity := case mod(greatest(effective_week, 1) - 1, 10)
        when 0 then 'matching'
        when 1 then 'fill-in-blank'
        when 2 then 'word-search'
        when 3 then 'quiz'
        when 4 then 'speed-match'
        when 5 then 'wordle'
        when 6 then 'crossword'
        when 7 then 'hangman'
        when 8 then 'scramble'
        else 'word-search'
    end;
    return array['flashcards', second_activity];
end;
$$;

revoke all on function private.required_vocabulary_activities(public.vocabularies)
from public, anon, authenticated;

update public.vocabularies
set month = 'June',
    week = 3
where id = 'grade9_iit_june_week3_loops_strings'
  and week is null;
