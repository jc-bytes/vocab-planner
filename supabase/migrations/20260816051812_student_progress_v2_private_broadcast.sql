-- Deliver compact progress-summary updates over a private Broadcast topic.
-- The topic is bound to the authenticated user's UUID, so students cannot
-- subscribe to another student's wallet or XP updates.

drop policy if exists "students receive own progress broadcasts" on realtime.messages;
create policy "students receive own progress broadcasts"
on realtime.messages
for select
to authenticated
using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'student-progress:' || (select auth.uid())::text
);

create or replace function private.broadcast_student_progress_summary_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.broadcast_changes(
        'student-progress:' || coalesce(new.user_id, old.user_id)::text,
        tg_op,
        tg_op,
        tg_table_name,
        tg_table_schema,
        new,
        old
    );
    return null;
end;
$$;

revoke all on function private.broadcast_student_progress_summary_v2()
from public, anon, authenticated;

drop trigger if exists broadcast_student_progress_summary_v2
on public.student_progress_summary;
create trigger broadcast_student_progress_summary_v2
after insert or update or delete on public.student_progress_summary
for each row execute function private.broadcast_student_progress_summary_v2();
