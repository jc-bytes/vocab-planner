-- School authority is explicit; legacy profile roles and JWT metadata confer no rights.
begin;
-- School invitations replace the former single-school email-domain gate.
alter table public.profiles drop constraint if exists profiles_student_aid_email_domain;
create table public.schools (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 150),
 timezone text not null default 'America/Panama', active boolean not null default true, onboarding_pending boolean not null default false check(not onboarding_pending or not active), created_at timestamptz not null default now()
);
create table public.platform_admins (user_id uuid primary key references auth.users(id), active boolean not null default true, updated_at timestamptz not null default now());
create table public.school_memberships (
 school_id uuid references public.schools(id), user_id uuid references auth.users(id), active boolean not null default true,
 grade text, section text, joined_at timestamptz not null default now(), removed_at timestamptz, updated_at timestamptz not null default now(),
 primary key(school_id,user_id), check(active = (removed_at is null))
);
create index school_memberships_user_idx on public.school_memberships(user_id,school_id);
create table public.school_member_roles (
 school_id uuid not null, user_id uuid not null, role text not null check(role in ('school_admin','teacher','student')),
 primary key(school_id,user_id,role), foreign key(school_id,user_id) references public.school_memberships(school_id,user_id)
);
create table public.school_settings (school_id uuid primary key references public.schools(id),settings jsonb not null default '{}' check(jsonb_typeof(settings)='object'), updated_at timestamptz not null default now());
create table private.school_invitations (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id), email extensions.citext not null check(position('@' in email::text)>1 and length(email::text)<=254),
 roles text[] not null check(cardinality(roles)>0 and roles <@ array['school_admin','teacher','student']::text[]),
 expires_at timestamptz not null default now()+interval '14 days', revoked_at timestamptz, accepted_at timestamptz, accepted_by uuid references auth.users(id),
 initial_admin boolean not null default false check(not initial_admin or roles=array['school_admin']::text[]),
 invited_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index school_invitations_school_idx on private.school_invitations(school_id);
create index school_invitations_email_idx on private.school_invitations(email);
create table private.school_admin_events (
 id bigint generated always as identity primary key, school_id uuid references public.schools(id), actor_id uuid references auth.users(id),
 action text not null,target_user_id uuid references auth.users(id), details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index school_admin_events_school_idx on private.school_admin_events(school_id,id desc);
alter table public.schools enable row level security;
revoke all on public.schools from public,anon,authenticated;
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public,anon,authenticated;
alter table public.school_memberships enable row level security;
revoke all on public.school_memberships from public,anon,authenticated;
alter table public.school_member_roles enable row level security;
revoke all on public.school_member_roles from public,anon,authenticated;
alter table public.school_settings enable row level security;
revoke all on public.school_settings from public,anon,authenticated;
alter table private.school_invitations enable row level security;
revoke all on private.school_invitations from public,anon,authenticated;
alter table private.school_admin_events enable row level security;
revoke all on private.school_admin_events from public,anon,authenticated;

create function private.is_platform_admin(p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_admins where user_id=p_user_id and active);
$$;
create function private.is_school_member(p_school_id uuid,p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.school_memberships m join public.schools s on s.id=m.school_id where m.school_id=p_school_id and m.user_id=p_user_id and m.active and s.active);
$$;
create function private.has_school_role(p_school_id uuid,p_role text,p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_school_member(p_school_id,p_user_id) and exists(select 1 from public.school_member_roles where school_id=p_school_id and user_id=p_user_id and role=p_role);
$$;
create function private.require_school_admin(p_school_id uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not (private.is_platform_admin() or private.has_school_role(p_school_id,'school_admin')) then raise exception 'School administration access denied' using errcode='42501'; end if;
 end;
$$;
create function private.bootstrap_platform_admin(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
 perform pg_advisory_xact_lock(721917001);
 if exists(select 1 from public.platform_admins) then raise exception 'Platform already bootstrapped'; end if;
 insert into public.platform_admins(user_id) values(p_user_id);
 insert into private.school_admin_events(action,target_user_id) values('platform.bootstrap',p_user_id);
 end;
$$;
revoke all on function private.bootstrap_platform_admin(uuid) from public,anon,authenticated;
grant execute on function private.bootstrap_platform_admin(uuid) to service_role;

create function private.my_school_access_v1() returns jsonb language plpgsql security definer set search_path='' as $$
begin return jsonb_build_object('platformAdmin',private.is_platform_admin(),'schools',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'timezone',s.timezone,'active',s.active,'onboardingPending',s.onboarding_pending,'grade',(select m.grade from public.school_memberships m where m.school_id=s.id and m.user_id=auth.uid() and m.active),'section',(select m.section from public.school_memberships m where m.school_id=s.id and m.user_id=auth.uid() and m.active),'roles',coalesce((select jsonb_agg(r.role order by r.role) from public.school_member_roles r where r.school_id=s.id and r.user_id=auth.uid() and private.is_school_member(s.id)),'[]'::jsonb)) order by s.name,s.id) from public.schools s where private.is_platform_admin() or private.is_school_member(s.id)),'[]'::jsonb)); end;
$$;
create function public.my_school_access_v1() returns jsonb language sql security invoker set search_path='' as $$ select private.my_school_access_v1(); $$;

create function private.create_school_v1(p_name text,p_timezone text,p_admin_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school public.schools; begin
 if not private.is_platform_admin() then raise exception 'Platform administration access denied' using errcode='42501'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
 insert into public.schools(name,timezone) values(trim(p_name),p_timezone) returning * into v_school;
 insert into public.school_memberships(school_id,user_id) values(v_school.id,p_admin_user_id);
 insert into public.school_member_roles values(v_school.id,p_admin_user_id,'school_admin');
 insert into public.school_settings(school_id) values(v_school.id);
 insert into private.school_admin_events(school_id,actor_id,action,target_user_id) values(v_school.id,auth.uid(),'school.created',p_admin_user_id);
 return to_jsonb(v_school); end;
$$;
create function public.create_school_v1(p_name text,p_timezone text,p_admin_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.create_school_v1(p_name,p_timezone,p_admin_user_id); $$;

create function private.set_school_active_v1(p_school_id uuid,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school public.schools; begin
 perform 1 from public.schools where id=p_school_id for update;
 if not private.is_platform_admin() then raise exception 'Platform administration access denied' using errcode='42501'; end if;
 if p_active and not exists(select 1 from public.school_memberships m join public.school_member_roles r using(school_id,user_id) where m.school_id=p_school_id and m.active and r.role='school_admin') then raise exception 'School requires an administrator'; end if;
 update public.schools set active=p_active,onboarding_pending=false where id=p_school_id returning * into v_school;
 if not found then raise exception 'School not found'; end if;
 if not p_active then update private.school_invitations set revoked_at=now() where school_id=p_school_id and initial_admin and accepted_at is null and revoked_at is null; end if;
 insert into private.school_admin_events(school_id,actor_id,action,details) values(p_school_id,auth.uid(),'school.status',jsonb_build_object('active',p_active)); return to_jsonb(v_school); end;
$$;
create function public.set_school_active_v1(p_school_id uuid,p_active boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.set_school_active_v1(p_school_id,p_active); $$;

create function private.set_school_member_v1(p_school_id uuid,p_user_id uuid,p_roles text[],p_active boolean default true,p_grade text default null,p_section text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.school_memberships; begin
 perform 1 from public.schools where id=p_school_id for update;
 perform private.require_school_admin(p_school_id);
 if exists(select 1 from public.schools where id=p_school_id and onboarding_pending) then raise exception 'The first administrator must accept the onboarding invitation before adding members.' using errcode='42501'; end if;
 if p_roles is null or array_position(p_roles,null) is not null or not(p_roles <@ array['school_admin','teacher','student']::text[]) or (p_active and cardinality(p_roles)=0) then raise exception 'Invalid school roles'; end if;
 if (not p_active or not('school_admin'=any(p_roles))) and exists(select 1 from public.schools where id=p_school_id and active) and exists(select 1 from public.school_member_roles where school_id=p_school_id and user_id=p_user_id and role='school_admin') and not exists(select 1 from public.school_memberships m join public.school_member_roles r using(school_id,user_id) where m.school_id=p_school_id and m.user_id<>p_user_id and m.active and r.role='school_admin') then raise exception 'Cannot remove last school administrator'; end if;
 insert into public.school_memberships(school_id,user_id,active,grade,section,removed_at) values(p_school_id,p_user_id,p_active,p_grade,p_section,case when p_active then null else now() end)
 on conflict(school_id,user_id) do update set active=excluded.active,grade=excluded.grade,section=excluded.section,removed_at=excluded.removed_at,updated_at=now() returning * into v_member;
 delete from public.school_member_roles where school_id=p_school_id and user_id=p_user_id;
 insert into public.school_member_roles select p_school_id,p_user_id,unnest(p_roles) on conflict do nothing;
 -- A prior invitation cannot undo a later role reduction or removal.
 update private.school_invitations set revoked_at=now() where school_id=p_school_id and accepted_at is null and revoked_at is null and email=(select email from auth.users where id=p_user_id);
 insert into private.school_admin_events(school_id,actor_id,action,target_user_id,details) values(p_school_id,auth.uid(),'member.changed',p_user_id,jsonb_build_object('active',p_active,'roles',p_roles));
 return to_jsonb(v_member)||jsonb_build_object('roles',p_roles); end;
$$;
create function public.set_school_member_v1(p_school_id uuid,p_user_id uuid,p_roles text[],p_active boolean default true,p_grade text default null,p_section text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.set_school_member_v1(p_school_id,p_user_id,p_roles,p_active,p_grade,p_section); $$;

create function private.list_school_members_v1(p_school_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.require_school_admin(p_school_id);
 return coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('display_name',trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),'email',u.email,'roles',coalesce((select jsonb_agg(r.role order by r.role) from public.school_member_roles r where r.school_id=m.school_id and r.user_id=m.user_id),'[]'::jsonb)) order by m.joined_at,m.user_id) from public.school_memberships m join auth.users u on u.id=m.user_id left join public.profiles p on p.user_id=m.user_id where m.school_id=p_school_id),'[]'::jsonb); end;
$$;
create function public.list_school_members_v1(p_school_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.list_school_members_v1(p_school_id); $$;

-- Administration searches and pages on the server; teacher assignment callers retain the full-list API.
create function private.list_school_members_page_v1(p_school_id uuid,p_search text default '',p_limit integer default 25,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare page_limit integer := least(50,greatest(1,coalesce(p_limit,25))); page_offset integer := greatest(0,coalesce(p_offset,0)); search_text text := lower(trim(coalesce(p_search,''))); result jsonb;
begin
 perform private.require_school_admin(p_school_id);
 if length(search_text)>200 then raise exception 'Member search must be 200 characters or fewer'; end if;
 with matched as materialized (
  select m.*,trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) as display_name,u.email,
   coalesce((select jsonb_agg(r.role order by r.role) from public.school_member_roles r where r.school_id=m.school_id and r.user_id=m.user_id),'[]'::jsonb) as roles
  from public.school_memberships m join auth.users u on u.id=m.user_id left join public.profiles p on p.user_id=m.user_id
  where m.school_id=p_school_id and (search_text='' or position(search_text in lower(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))))>0 or position(search_text in lower(coalesce(u.email,'')))>0)
 ), page as (
  select * from matched order by lower(display_name),lower(email),user_id limit page_limit offset page_offset
 ) select jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(page) order by lower(display_name),lower(email),user_id) from page),'[]'::jsonb),'total',(select count(*) from matched),'limit',page_limit,'offset',page_offset) into result;
 return result;
end;
$$;
create function public.list_school_members_page_v1(p_school_id uuid,p_search text default '',p_limit integer default 25,p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$ select private.list_school_members_page_v1(p_school_id,p_search,p_limit,p_offset); $$;
revoke all on function private.list_school_members_page_v1(uuid,text,integer,integer),public.list_school_members_page_v1(uuid,text,integer,integer) from public,anon;
grant execute on function private.list_school_members_page_v1(uuid,text,integer,integer),public.list_school_members_page_v1(uuid,text,integer,integer) to authenticated;

create function private.invite_school_member_v1(p_school_id uuid,p_email text,p_roles text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_inv private.school_invitations; pending_onboarding boolean; begin
 perform 1 from public.schools where id=p_school_id for update;
 perform private.require_school_admin(p_school_id);
 select onboarding_pending into pending_onboarding from public.schools where id=p_school_id;
 if pending_onboarding then
  if not private.is_platform_admin() or p_roles is distinct from array['school_admin']::text[] then raise exception 'A pending school can invite only its first administrator.' using errcode='42501'; end if;
 else
  if not exists(select 1 from public.schools where id=p_school_id and active) then raise exception 'School unavailable'; end if;
 end if;
 if p_roles is null or array_position(p_roles,null) is not null or cardinality(p_roles)=0 or not(p_roles <@ array['school_admin','teacher','student']::text[]) then raise exception 'Invalid school roles'; end if;
 if p_email is null or length(trim(p_email))>254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
 update private.school_invitations set revoked_at=now() where school_id=p_school_id and (email=lower(trim(p_email)) or (pending_onboarding and initial_admin)) and accepted_at is null and revoked_at is null;
 insert into private.school_invitations(school_id,email,roles,invited_by,initial_admin) values(p_school_id,lower(trim(p_email)),p_roles,auth.uid(),pending_onboarding) returning * into v_inv;
 insert into private.school_admin_events(school_id,actor_id,action,details) values(p_school_id,auth.uid(),'invitation.created',jsonb_build_object('invitation_id',v_inv.id,'roles',p_roles)); return to_jsonb(v_inv); end;
$$;
create function public.invite_school_member_v1(p_school_id uuid,p_email text,p_roles text[]) returns jsonb language sql security invoker set search_path='' as $$ select private.invite_school_member_v1(p_school_id,p_email,p_roles); $$;

-- A stale pending-school form must not become an additional-admin invitation
-- after another request has already activated the school.
create function private.replace_initial_school_admin_invitation_v1(p_school_id uuid,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.schools where id=p_school_id for update;
 if not private.is_platform_admin() then raise exception 'Platform administration access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.schools where id=p_school_id and onboarding_pending and not active) then raise exception 'This school is no longer awaiting its first administrator.' using errcode='42501'; end if;
 return private.invite_school_member_v1(p_school_id,p_email,array['school_admin']);
end;
$$;
create function public.replace_initial_school_admin_invitation_v1(p_school_id uuid,p_email text) returns jsonb language sql security invoker set search_path='' as $$select private.replace_initial_school_admin_invitation_v1(p_school_id,p_email);$$;
revoke all on function private.replace_initial_school_admin_invitation_v1(uuid,text),public.replace_initial_school_admin_invitation_v1(uuid,text) from public,anon;
grant execute on function private.replace_initial_school_admin_invitation_v1(uuid,text),public.replace_initial_school_admin_invitation_v1(uuid,text) to authenticated;

create function private.my_school_invitations_v1() returns jsonb language plpgsql security definer set search_path='' as $$
begin return coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('school_name',s.name) order by i.created_at desc) from private.school_invitations i join public.schools s on s.id=i.school_id join auth.users u on u.id=auth.uid() and u.email=i.email where u.email_confirmed_at is not null and (s.active or (s.onboarding_pending and i.initial_admin and 'school_admin'=any(i.roles))) and i.revoked_at is null and i.accepted_at is null and i.expires_at>now()),'[]'::jsonb); end;
$$;
create function public.my_school_invitations_v1() returns jsonb language sql security invoker set search_path='' as $$ select private.my_school_invitations_v1(); $$;

create function private.accept_school_invitation_v1(p_invitation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_inv private.school_invitations; v_school uuid; v_member_active boolean; begin
 select school_id into v_school from private.school_invitations where id=p_invitation_id;
 perform 1 from public.schools where id=v_school for update;
 select * into v_inv from private.school_invitations where id=p_invitation_id for update;
 if v_inv.id is null or v_inv.revoked_at is not null or not exists(select 1 from public.schools where id=v_school and (active or (onboarding_pending and v_inv.initial_admin and 'school_admin'=any(v_inv.roles)))) or not exists(select 1 from auth.users where id=auth.uid() and email=v_inv.email and email_confirmed_at is not null) then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 if v_inv.accepted_at is not null then
 if v_inv.accepted_by=auth.uid() and private.is_school_member(v_school) then return jsonb_build_object('school_id',v_school); end if;
 raise exception 'Invitation unavailable'; end if;
 if v_inv.expires_at<=now() then raise exception 'Invitation expired'; end if;
 -- An active membership accepts additional invited roles. Rejoining after removal
 -- establishes only the new invitation's roles; retained history is not authority.
 select active into v_member_active from public.school_memberships where school_id=v_school and user_id=auth.uid() for update;
 if v_member_active is distinct from true then
  delete from public.school_member_roles where school_id=v_school and user_id=auth.uid();
 end if;
 insert into public.school_memberships(school_id,user_id) values(v_school,auth.uid()) on conflict(school_id,user_id) do update set active=true,removed_at=null,updated_at=now();
 insert into public.school_member_roles select v_school,auth.uid(),unnest(v_inv.roles) on conflict do nothing;
 -- Initial administrator acceptance is the only activation path for pending schools.
 if v_inv.initial_admin and 'school_admin'=any(v_inv.roles) then
  update public.schools set active=true,onboarding_pending=false where id=v_school and onboarding_pending;
 end if;
 update private.school_invitations set accepted_at=now(),accepted_by=auth.uid() where id=p_invitation_id;
 insert into private.school_admin_events(school_id,actor_id,action,target_user_id,details) values(v_school,auth.uid(),'invitation.accepted',auth.uid(),jsonb_build_object('invitation_id',p_invitation_id)); return jsonb_build_object('school_id',v_school); end;
$$;
create function public.accept_school_invitation_v1(p_invitation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.accept_school_invitation_v1(p_invitation_id); $$;

create function private.revoke_school_invitation_v1(p_invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid; begin
 select school_id into v_school from private.school_invitations where id=p_invitation_id;
 perform 1 from public.schools where id=v_school for update;
 perform private.require_school_admin(v_school);
 update private.school_invitations set revoked_at=now() where id=p_invitation_id and accepted_at is null;
 insert into private.school_admin_events(school_id,actor_id,action,details) values(v_school,auth.uid(),'invitation.revoked',jsonb_build_object('invitation_id',p_invitation_id)); end;
$$;
create function public.revoke_school_invitation_v1(p_invitation_id uuid) returns void language sql security invoker set search_path='' as $$ select private.revoke_school_invitation_v1(p_invitation_id); $$;

create function private.list_school_invitations_v1(p_school_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.require_school_admin(p_school_id); return coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from private.school_invitations i where i.school_id=p_school_id),'[]'::jsonb); end;
$$;
create function public.list_school_invitations_v1(p_school_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.list_school_invitations_v1(p_school_id); $$;

create function private.list_school_audit_v1(p_school_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_school_id is null then if not private.is_platform_admin() then raise exception 'Platform administration access denied' using errcode='42501'; end if;
 else perform private.require_school_admin(p_school_id); end if;
 return coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from (select * from private.school_admin_events where p_school_id is null or school_id=p_school_id order by id desc limit 200) e),'[]'::jsonb); end;
$$;
create function public.list_school_audit_v1(p_school_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.list_school_audit_v1(p_school_id); $$;

create function private.set_platform_admin_v1(p_user_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(721917001);
 if not private.is_platform_admin() then raise exception 'Platform administration access denied' using errcode='42501'; end if;
 if not p_active and not exists(select 1 from public.platform_admins where active and user_id<>p_user_id) then raise exception 'Cannot remove last platform administrator'; end if;
 insert into public.platform_admins(user_id,active) values(p_user_id,p_active) on conflict(user_id) do update set active=excluded.active,updated_at=now();
 insert into private.school_admin_events(actor_id,action,target_user_id,details) values(auth.uid(),'platform.admin.changed',p_user_id,jsonb_build_object('active',p_active)); end;
$$;
create function public.set_platform_admin_v1(p_user_id uuid,p_active boolean) returns void language sql security invoker set search_path='' as $$ select private.set_platform_admin_v1(p_user_id,p_active); $$;

create function private.list_platform_admins_v1() returns jsonb language plpgsql security definer set search_path='' as $$
begin if not private.is_platform_admin() then raise exception 'Platform administration access denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('email',u.email) order by a.user_id) from public.platform_admins a join auth.users u on u.id=a.user_id),'[]'::jsonb); end;
$$;
create function public.list_platform_admins_v1() returns jsonb language sql security invoker set search_path='' as $$ select private.list_platform_admins_v1(); $$;

create function private.get_school_settings_v1(p_school_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin if not private.is_school_member(p_school_id) then raise exception 'School access denied' using errcode='42501'; end if; return coalesce((select settings from public.school_settings where school_id=p_school_id),'{}'::jsonb); end;
$$;
create function public.get_school_settings_v1(p_school_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_school_settings_v1(p_school_id); $$;

create function private.set_school_settings_v1(p_school_id uuid,p_settings jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.schools where id=p_school_id for update; perform private.require_school_admin(p_school_id);
 insert into public.school_settings(school_id,settings) values(p_school_id,p_settings) on conflict(school_id) do update set settings=excluded.settings,updated_at=now();
 insert into private.school_admin_events(school_id,actor_id,action) values(p_school_id,auth.uid(),'settings.changed'); return p_settings; end;
$$;
create function public.set_school_settings_v1(p_school_id uuid,p_settings jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.set_school_settings_v1(p_school_id,p_settings); $$;
revoke all on function private.my_school_access_v1() from public,anon;
grant execute on function private.my_school_access_v1() to authenticated;
revoke all on function public.my_school_access_v1() from public,anon;
grant execute on function public.my_school_access_v1() to authenticated;
revoke all on function private.create_school_v1(text,text,uuid) from public,anon;
grant execute on function private.create_school_v1(text,text,uuid) to authenticated;
revoke all on function public.create_school_v1(text,text,uuid) from public,anon;
grant execute on function public.create_school_v1(text,text,uuid) to authenticated;
revoke all on function private.set_school_active_v1(uuid,boolean) from public,anon;
grant execute on function private.set_school_active_v1(uuid,boolean) to authenticated;
revoke all on function public.set_school_active_v1(uuid,boolean) from public,anon;
grant execute on function public.set_school_active_v1(uuid,boolean) to authenticated;
revoke all on function private.set_school_member_v1(uuid,uuid,text[],boolean,text,text) from public,anon;
grant execute on function private.set_school_member_v1(uuid,uuid,text[],boolean,text,text) to authenticated;
revoke all on function public.set_school_member_v1(uuid,uuid,text[],boolean,text,text) from public,anon;
grant execute on function public.set_school_member_v1(uuid,uuid,text[],boolean,text,text) to authenticated;
revoke all on function private.list_school_members_v1(uuid) from public,anon;
grant execute on function private.list_school_members_v1(uuid) to authenticated;
revoke all on function public.list_school_members_v1(uuid) from public,anon;
grant execute on function public.list_school_members_v1(uuid) to authenticated;
revoke all on function private.invite_school_member_v1(uuid,text,text[]) from public,anon;
grant execute on function private.invite_school_member_v1(uuid,text,text[]) to authenticated;
revoke all on function public.invite_school_member_v1(uuid,text,text[]) from public,anon;
grant execute on function public.invite_school_member_v1(uuid,text,text[]) to authenticated;
revoke all on function private.my_school_invitations_v1() from public,anon;
grant execute on function private.my_school_invitations_v1() to authenticated;
revoke all on function public.my_school_invitations_v1() from public,anon;
grant execute on function public.my_school_invitations_v1() to authenticated;
revoke all on function private.accept_school_invitation_v1(uuid) from public,anon;
grant execute on function private.accept_school_invitation_v1(uuid) to authenticated;
revoke all on function public.accept_school_invitation_v1(uuid) from public,anon;
grant execute on function public.accept_school_invitation_v1(uuid) to authenticated;
revoke all on function private.revoke_school_invitation_v1(uuid) from public,anon;
grant execute on function private.revoke_school_invitation_v1(uuid) to authenticated;
revoke all on function public.revoke_school_invitation_v1(uuid) from public,anon;
grant execute on function public.revoke_school_invitation_v1(uuid) to authenticated;
revoke all on function private.list_school_invitations_v1(uuid) from public,anon;
grant execute on function private.list_school_invitations_v1(uuid) to authenticated;
revoke all on function public.list_school_invitations_v1(uuid) from public,anon;
grant execute on function public.list_school_invitations_v1(uuid) to authenticated;
revoke all on function private.list_school_audit_v1(uuid) from public,anon;
grant execute on function private.list_school_audit_v1(uuid) to authenticated;
revoke all on function public.list_school_audit_v1(uuid) from public,anon;
grant execute on function public.list_school_audit_v1(uuid) to authenticated;
revoke all on function private.set_platform_admin_v1(uuid,boolean) from public,anon;
grant execute on function private.set_platform_admin_v1(uuid,boolean) to authenticated;
revoke all on function public.set_platform_admin_v1(uuid,boolean) from public,anon;
grant execute on function public.set_platform_admin_v1(uuid,boolean) to authenticated;
revoke all on function private.list_platform_admins_v1() from public,anon;
grant execute on function private.list_platform_admins_v1() to authenticated;
revoke all on function public.list_platform_admins_v1() from public,anon;
grant execute on function public.list_platform_admins_v1() to authenticated;
revoke all on function private.get_school_settings_v1(uuid) from public,anon;
grant execute on function private.get_school_settings_v1(uuid) to authenticated;
revoke all on function public.get_school_settings_v1(uuid) from public,anon;
grant execute on function public.get_school_settings_v1(uuid) to authenticated;
revoke all on function private.set_school_settings_v1(uuid,jsonb) from public,anon;
grant execute on function private.set_school_settings_v1(uuid,jsonb) to authenticated;
revoke all on function public.set_school_settings_v1(uuid,jsonb) from public,anon;
grant execute on function public.set_school_settings_v1(uuid,jsonb) to authenticated;
revoke all on function private.is_platform_admin(uuid) from public,anon;
grant execute on function private.is_platform_admin(uuid) to authenticated;
revoke all on function private.is_school_member(uuid,uuid) from public,anon;
grant execute on function private.is_school_member(uuid,uuid) to authenticated;
revoke all on function private.has_school_role(uuid,text,uuid) from public,anon;
grant execute on function private.has_school_role(uuid,text,uuid) to authenticated;
revoke all on function private.require_school_admin(uuid) from public,anon;
grant execute on function private.require_school_admin(uuid) to authenticated;

create function private.set_school_setting_v1(p_school_id uuid,p_key text,p_value jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.schools where id=p_school_id for update;
 perform private.require_school_admin(p_school_id);
 if p_key is null or length(trim(p_key)) not between 1 and 100 then raise exception 'Invalid setting key'; end if;
 insert into public.school_settings(school_id,settings) values(p_school_id,jsonb_build_object(p_key,p_value))
 on conflict(school_id) do update set settings=public.school_settings.settings||excluded.settings,updated_at=now();
 insert into private.school_admin_events(school_id,actor_id,action,details) values(p_school_id,auth.uid(),'settings.changed',jsonb_build_object('key',p_key)); return p_value;
end; $$;
create function public.set_school_setting_v1(p_school_id uuid,p_key text,p_value jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.set_school_setting_v1(p_school_id,p_key,p_value); $$;
revoke all on function private.set_school_setting_v1(uuid,text,jsonb),public.set_school_setting_v1(uuid,text,jsonb) from public,anon;
grant execute on function private.set_school_setting_v1(uuid,text,jsonb),public.set_school_setting_v1(uuid,text,jsonb) to authenticated;
-- Invitations allow identity registration, never unverified membership or role grants.
create or replace function private.handle_provisioned_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
declare submitted_token uuid; consumed_token uuid; legacy_teacher boolean;
begin
 begin submitted_token:=nullif(new.raw_user_meta_data->>'provisioning_token','')::uuid; exception when invalid_text_representation then submitted_token:=null; end;
 if submitted_token is not null then
 delete from private.auth_user_provisioning_tickets where email=new.email::extensions.citext and token=submitted_token and expires_at>now() returning token into consumed_token;
 end if;
 if consumed_token is null and not exists(select 1 from private.school_invitations i join public.schools s on s.id=i.school_id where (s.active or (s.onboarding_pending and i.initial_admin)) and i.email=new.email::extensions.citext and i.revoked_at is null and i.accepted_at is null and i.expires_at>now()) then raise exception 'A valid school invitation is required to create an account.'; end if;
 select consumed_token is not null and exists(select 1 from public.teacher_allowlist where email=new.email::extensions.citext and active) into legacy_teacher;
 insert into public.profiles(user_id,role,first_name,last_name,email) values(new.id,case when legacy_teacher then 'teacher' else 'student' end,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'last_name',''),new.email::extensions.citext);
 return new;
end; $$;
revoke all on function private.handle_provisioned_auth_user() from public,anon,authenticated;
-- A new school stays unavailable until its invited first administrator verifies
-- their email and accepts. Platform creation never grants educational access.
create table private.school_creation_requests (
 actor_id uuid not null references auth.users(id), request_id uuid not null,
 school_id uuid not null unique references public.schools(id),
 name text not null, timezone text not null, admin_email extensions.citext not null,
 primary key(actor_id,request_id)
);
alter table private.school_creation_requests enable row level security;
revoke all on private.school_creation_requests from public,anon,authenticated;
create function private.create_school_with_admin_invitation_v1(p_name text,p_timezone text,p_admin_email text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.schools; prior private.school_creation_requests; invitation_id uuid;
 normalized_name text:=trim(p_name); normalized_email text:=lower(trim(p_admin_email));
begin
 if not private.is_platform_admin() then raise exception 'Platform administration access denied' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'A creation request ID is required.'; end if;
 if normalized_email is null or length(normalized_email)>254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid administrator email address.'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,91706));
 select * into prior from private.school_creation_requests where actor_id=auth.uid() and request_id=p_request_id;
 if prior.school_id is not null then
  if prior.name is distinct from normalized_name or prior.timezone is distinct from p_timezone or prior.admin_email is distinct from normalized_email::extensions.citext then raise exception 'This creation request was already used for a different school.'; end if;
  select * into result from public.schools where id=prior.school_id;
  return to_jsonb(result);
 end if;
 insert into public.schools(name,timezone,active,onboarding_pending) values(normalized_name,p_timezone,false,true) returning * into result;
 insert into public.school_settings(school_id) values(result.id);
 insert into private.school_invitations(school_id,email,roles,invited_by,initial_admin)
 values(result.id,normalized_email,array['school_admin'],auth.uid(),true) returning id into invitation_id;
 insert into private.school_creation_requests(actor_id,request_id,school_id,name,timezone,admin_email)
 values(auth.uid(),p_request_id,result.id,normalized_name,p_timezone,normalized_email);
 insert into private.school_admin_events(school_id,actor_id,action,details)
 values(result.id,auth.uid(),'school.awaiting_administrator',jsonb_build_object('invitation_id',invitation_id));
 return to_jsonb(result);
end;
$$;
create function public.create_school_with_admin_invitation_v1(p_name text,p_timezone text,p_admin_email text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.create_school_with_admin_invitation_v1(p_name,p_timezone,p_admin_email,p_request_id);$$;
revoke all on function private.create_school_with_admin_invitation_v1(text,text,text,uuid),public.create_school_with_admin_invitation_v1(text,text,text,uuid) from public,anon;
grant execute on function private.create_school_with_admin_invitation_v1(text,text,text,uuid),public.create_school_with_admin_invitation_v1(text,text,text,uuid) to authenticated;

commit;
