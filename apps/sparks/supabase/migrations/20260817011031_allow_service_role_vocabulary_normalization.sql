-- The vocabulary trigger delegates normalization to this private helper.
-- Service-role maintenance and local audit seeding must be able to execute it,
-- while the helper remains unavailable to anon and public callers.
grant execute on function private.required_vocabulary_activities(public.vocabularies)
to service_role;
