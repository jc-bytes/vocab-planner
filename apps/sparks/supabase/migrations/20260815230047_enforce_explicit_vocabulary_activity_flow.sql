create or replace function private.normalize_vocabulary_activity_flow()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
    allowed_activities text[] := array[
        'illustration', 'matching', 'flashcards', 'quiz', 'synonym-antonym',
        'word-search', 'crossword', 'hangman', 'scramble', 'wordle',
        'speed-match', 'fill-in-blank'
    ];
    required_list text[];
    additional_config jsonb;
    normalized_additional jsonb;
begin
    new.activity_settings := coalesce(new.activity_settings, '{}'::jsonb);
    required_list := private.required_vocabulary_activities(new);
    new.activity_settings := jsonb_set(
        new.activity_settings,
        '{requiredActivities}',
        to_jsonb(required_list),
        true
    );

    additional_config := new.activity_settings -> 'additionalActivities';
    if jsonb_typeof(additional_config) = 'array' then
        select coalesce(jsonb_agg(value order by first_ordinal), '[]'::jsonb)
        into normalized_additional
        from (
            select value, min(ordinal) as first_ordinal
            from jsonb_array_elements_text(additional_config) with ordinality item(value, ordinal)
            where value = any(allowed_activities)
              and not (value = any(required_list))
            group by value
        ) configured;
    else
        select coalesce(jsonb_agg(value order by ordinal), '[]'::jsonb)
        into normalized_additional
        from unnest(allowed_activities) with ordinality item(value, ordinal)
        where not (value = any(required_list));
    end if;

    new.activity_settings := jsonb_set(
        new.activity_settings,
        '{additionalActivities}',
        normalized_additional,
        true
    );
    return new;
end;
$$;

revoke all on function private.normalize_vocabulary_activity_flow()
from public, anon, authenticated;

drop trigger if exists normalize_vocabulary_activity_flow on public.vocabularies;
create trigger normalize_vocabulary_activity_flow
before insert or update of id, name, week, activity_settings
on public.vocabularies
for each row execute function private.normalize_vocabulary_activity_flow();

update public.vocabularies
set activity_settings = activity_settings
where jsonb_typeof(activity_settings -> 'requiredActivities') is distinct from 'array'
   or jsonb_typeof(activity_settings -> 'additionalActivities') is distinct from 'array';
