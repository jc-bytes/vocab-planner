alter table public.weekly_sparks
    drop constraint if exists weekly_sparks_type_check;

alter table public.weekly_sparks
    add constraint weekly_sparks_type_check
    check (spark_type in ('cool_fact', 'trivia', 'good_news', 'reflection', 'debate'));
