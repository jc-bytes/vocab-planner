revoke all on function public.submit_student_game_score(text, numeric, jsonb) from public;
revoke all on function public.submit_student_game_score(text, numeric, jsonb) from anon;
grant execute on function public.submit_student_game_score(text, numeric, jsonb) to authenticated;

revoke all on function private.submit_student_game_score(text, numeric, jsonb) from public;
revoke all on function private.submit_student_game_score(text, numeric, jsonb) from anon;
grant execute on function private.submit_student_game_score(text, numeric, jsonb) to authenticated;
