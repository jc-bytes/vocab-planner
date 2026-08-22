create table if not exists private.auth_user_provisioning_tickets (
    email extensions.citext primary key,
    token uuid not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

revoke all on table private.auth_user_provisioning_tickets
from public, anon, authenticated;

-- The server issues an unpredictable, short-lived token immediately before
-- calling the Auth Admin API. Public clients cannot execute this function.
create or replace function public.issue_auth_user_provisioning_ticket(
    p_email text,
    p_token uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
    delete from private.auth_user_provisioning_tickets
    where expires_at <= now();

    insert into private.auth_user_provisioning_tickets (email, token, expires_at)
    values (lower(trim(p_email))::extensions.citext, p_token, now() + interval '5 minutes')
    on conflict (email) do update
    set token = excluded.token,
        expires_at = excluded.expires_at,
        created_at = now();
end;
$$;

revoke all on function public.issue_auth_user_provisioning_ticket(text, uuid)
from public, anon, authenticated;
grant execute on function public.issue_auth_user_provisioning_ticket(text, uuid)
to service_role;

-- Supabase Auth applies custom app_metadata after its initial users insert, so
-- the insert trigger authenticates provisioning with the single-use token
-- carried temporarily in user_metadata instead.
create or replace function private.handle_provisioned_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    submitted_token uuid;
    consumed_token uuid;
    is_allowlisted_teacher boolean;
begin
    begin
        submitted_token := nullif(
            new.raw_user_meta_data ->> 'provisioning_token',
            ''
        )::uuid;
    exception
        when invalid_text_representation then
            submitted_token := null;
    end;

    if submitted_token is null then
        raise exception 'Account creation is restricted to teacher provisioning.';
    end if;

    delete from private.auth_user_provisioning_tickets
    where email = new.email::extensions.citext
      and token = submitted_token
      and expires_at > now()
    returning token into consumed_token;

    if consumed_token is null then
        raise exception 'Account provisioning ticket is invalid or expired.';
    end if;

    select exists (
        select 1
        from public.teacher_allowlist
        where email = new.email::extensions.citext
          and active = true
    ) into is_allowlisted_teacher;

    insert into public.profiles (
        user_id,
        role,
        first_name,
        last_name,
        email
    ) values (
        new.id,
        case when is_allowlisted_teacher then 'teacher' else 'student' end,
        coalesce(new.raw_user_meta_data ->> 'first_name', ''),
        coalesce(new.raw_user_meta_data ->> 'last_name', ''),
        coalesce(new.email, '')::extensions.citext
    )
    on conflict (user_id) do update
    set email = excluded.email,
        role = case
            when is_allowlisted_teacher then 'teacher'
            else public.profiles.role
        end,
        updated_at = now();

    return new;
end;
$$;
