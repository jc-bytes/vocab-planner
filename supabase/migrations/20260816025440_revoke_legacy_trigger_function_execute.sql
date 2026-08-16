-- These functions are invoked only by database triggers. They must not be
-- callable through the public Data API.
revoke execute on function public.ensure_student_progress()
from public, anon, authenticated;

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;
