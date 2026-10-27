-- Bind the browser's captured administrator before the existing authorization,
-- mutation and audit logic. Legacy signatures and grants remain unchanged.
create or replace function public.set_school_setting_owned_v1(
    p_expected_user_id uuid, p_school_id uuid, p_key text, p_value jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated account does not own this settings request.' using errcode = '42501';
    end if;
    return private.set_school_setting_v1(p_school_id, p_key, p_value);
end;
$$;

create or replace function public.set_school_year_owned_v1(
    p_expected_user_id uuid, p_school_id uuid, p_year integer,
    p_label text, p_archived boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated account does not own this settings request.' using errcode = '42501';
    end if;
    return private.set_school_year_v1(p_school_id, p_year, p_label, p_archived);
end;
$$;

revoke all on function public.set_school_setting_owned_v1(uuid,uuid,text,jsonb),
    public.set_school_year_owned_v1(uuid,uuid,integer,text,boolean) from public, anon;
grant execute on function public.set_school_setting_owned_v1(uuid,uuid,text,jsonb),
    public.set_school_year_owned_v1(uuid,uuid,integer,text,boolean) to authenticated;
