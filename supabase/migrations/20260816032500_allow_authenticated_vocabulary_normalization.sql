-- The vocabulary normalization trigger runs as the authenticated caller and
-- delegates its deterministic activity selection to this private helper.
-- Keep the helper unavailable to anon/public while permitting that trigger
-- and the authenticated student progress RPCs to execute it.
revoke all on function private.required_vocabulary_activities(public.vocabularies)
from public, anon;

grant execute on function private.required_vocabulary_activities(public.vocabularies)
to authenticated;
