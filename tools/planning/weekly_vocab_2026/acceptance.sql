-- Run after the migration inside a disposable local transaction. Never seed production.
do $test$
declare
 test_user uuid;
 v public.vocabularies;
 denied boolean;
begin
 select user_id into test_user from public.profiles where role='student' limit 1;
 if test_user is null then raise exception 'A disposable local student fixture is required';end if;
 update public.profiles set grade_level=6,section_letter='A' where user_id=test_user;
 select * into v from public.vocabularies where id='grade6_t3_2026_w09_weekly_v1_c';
 denied:=false;
 begin perform private.assert_weekly_vocabulary_access(test_user,v,'flashcards');
 exception when others then denied:=sqlerrm like '%not assigned to your group%'; end;
 if not denied then raise exception 'Cross-group access was not rejected';end if;
 update public.profiles set section_letter='C' where user_id=test_user;
 v.activity_settings := jsonb_set(v.activity_settings,'{releaseDates,C}',to_jsonb((current_date+10)::text));
 denied:=false;
 begin perform private.assert_weekly_vocabulary_access(test_user,v,'flashcards');
 exception when others then denied:=sqlerrm like '%not available yet%'; end;
 if not denied then raise exception 'Early access was not rejected';end if;
 v.activity_settings := jsonb_set(v.activity_settings,'{releaseDates,C}',to_jsonb((current_date-1)::text));
 perform private.assert_weekly_vocabulary_access(test_user,v,'word-search');
 v.words:=jsonb_build_array(v.words->0,v.words->1,v.words->2);
 denied:=false;
 begin perform private.assert_weekly_vocabulary_access(test_user,v,'word-search');
 exception when others then denied:=sqlerrm like '%Not enough suitable words%'; end;
 if not denied then raise exception 'Undersized round was not rejected';end if;
 v.activity_settings:=v.activity_settings||'{"retiredWeeklySet":true}'::jsonb;
 denied:=false;
 begin perform private.assert_weekly_vocabulary_access(test_user,v,'flashcards');
 exception when others then denied:=sqlerrm like '%archived%'; end;
 if not denied then raise exception 'Archived activity was not rejected';end if;
 select * into v from public.vocabularies where id='grade6_t3_2026_w08_weekly_v1';
 if private.required_vocabulary_activities(v)<>'{}'::text[] then raise exception 'Optional review gained requirements';end if;
 select * into v from public.vocabularies where id='grade9_t3_2026_w02_weekly_v1';
 if private.required_vocabulary_activities(v)<>array['flashcards','matching','fill-in-blank'] then raise exception 'Teaching path differs';end if;
 raise notice 'Weekly vocabulary: group, release, retirement, round-size and required/review checks passed';
end;
$test$;
