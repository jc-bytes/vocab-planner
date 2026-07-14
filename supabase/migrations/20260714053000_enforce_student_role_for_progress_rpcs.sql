create or replace function private.ensure_student_progress_row(student_id uuid)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    progress_row public.student_progress;
begin
    if not exists (
        select 1
        from public.profiles
        where user_id = student_id
          and role = 'student'
    ) then
        raise exception 'Only student profiles can own student progress.';
    end if;

    insert into public.student_progress (user_id, student_profile, units, coins, coin_data, coin_history)
    values (
        student_id,
        private.student_profile_json(student_id),
        '{}'::jsonb,
        0,
        '{"balance":0,"giftCoins":0,"totalEarned":0,"totalSpent":0,"totalGifted":0}'::jsonb,
        '[]'::jsonb
    )
    on conflict (user_id) do nothing;

    select *
    into progress_row
    from public.student_progress
    where user_id = student_id
    for update;

    if progress_row.user_id is null then
        raise exception 'Could not initialize student progress.';
    end if;

    return progress_row;
end;
$$;

revoke all on function private.ensure_student_progress_row(uuid) from public;
revoke all on function private.ensure_student_progress_row(uuid) from anon;
revoke all on function private.ensure_student_progress_row(uuid) from authenticated;
