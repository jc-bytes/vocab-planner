-- This private schema owns the temporary Christmas event and its removal boundary.
create schema ornament_gallery;
revoke all on schema ornament_gallery from public;
grant usage on schema ornament_gallery to anon, authenticated;
create table ornament_gallery.event (
  id text primary key, voting_open boolean not null default true, claims_open boolean not null default true
);
create table ornament_gallery.model (
  event_id text not null references ornament_gallery.event on delete cascade,
  id text not null, asset text not null, approved boolean not null default false,
  title text, credit text, primary key(event_id,id)
);
create table ornament_gallery.class_code (
  event_id text not null references ornament_gallery.event on delete cascade,
  section text not null, code uuid not null default gen_random_uuid(), primary key(event_id,section)
);
create table ornament_gallery.teacher_code (
  event_id text not null references ornament_gallery.event on delete cascade,
  code uuid not null default gen_random_uuid(), primary key(event_id,code)
);
create table ornament_gallery.vote (
  event_id text not null, model_id text not null, asset text not null, voter uuid not null,
  teacher boolean not null, score smallint not null check(score between 1 and 10),
  primary key(event_id,model_id,asset,teacher,voter),
  foreign key(event_id,model_id) references ornament_gallery.model on delete cascade
);
create table ornament_gallery.claim (
  id bigint generated always as identity primary key, event_id text not null, model_id text not null,
  private_name text not null, title text not null, credit text,
  status text not null default 'pending' check(status in ('pending','approved','declined')),
  foreign key(event_id,model_id) references ornament_gallery.model on delete cascade
);
revoke all on all tables in schema ornament_gallery from public,anon,authenticated;

create function ornament_gallery.catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'asset',m.asset,'eligible',m.approved and e.voting_open,'title',m.title,'credit',m.credit)), '[]'::jsonb)
 from ornament_gallery.model m join ornament_gallery.event e on e.id=m.event_id where e.id='christmas-2026';
$$;
create function ornament_gallery.rate(model_id text, asset_key text, voter_id uuid, rating integer, teacher_key uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if voter_id is null or rating is null or rating not between 1 and 10 then raise exception 'Invalid rating'; end if;
 perform 1 from ornament_gallery.model m join ornament_gallery.event e on m.event_id=e.id
 where e.id='christmas-2026' and m.id=model_id and m.asset=asset_key and m.approved and e.voting_open for share of m,e;
 if not found then raise exception 'Rating unavailable'; end if;
 if teacher_key is not null and not exists(select from ornament_gallery.teacher_code t where t.event_id='christmas-2026' and t.code=teacher_key)
 then raise exception 'Invalid teacher code'; end if;
 insert into ornament_gallery.vote values('christmas-2026',model_id,asset_key,coalesce(teacher_key,voter_id),teacher_key is not null,rating)
 on conflict on constraint vote_pkey do update set score=excluded.score;
end $$;
create function ornament_gallery.claim_model(model_id text, class_key uuid, student_name text, model_title text, public_credit text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if nullif(trim(student_name),'') is null or nullif(trim(model_title),'') is null or length(student_name)>80 or length(model_title)>65 or length(public_credit)>40 then raise exception 'Check the claim fields'; end if;
 perform 1 from ornament_gallery.model m join ornament_gallery.event e on m.event_id=e.id
 join ornament_gallery.class_code c on c.event_id=e.id and c.section=split_part(m.id,'-',1)
 where e.id='christmas-2026' and m.id=model_id and c.code=class_key and e.claims_open for share of e,m,c;
 if not found then raise exception 'Check the class code or claim window'; end if;
 insert into ornament_gallery.claim(event_id,model_id,private_name,title,credit)
 values('christmas-2026',model_id,trim(student_name),trim(model_title),nullif(trim(public_credit),''));
end $$;
-- Called only by the event owner from an administrative SQL connection.
create function ornament_gallery.review_claim(claim_id bigint, accept boolean) returns void language plpgsql set search_path='' as $$
declare c ornament_gallery.claim;
begin
 select * into strict c from ornament_gallery.claim where id=claim_id and status='pending' for update;
 if accept then update ornament_gallery.model set title=c.title,credit=c.credit where event_id=c.event_id and id=c.model_id; end if;
 update ornament_gallery.claim set status=case when accept then 'approved' else 'declined' end where id=c.id;
end $$;
create function public.ornament_catalog() returns jsonb language sql stable security invoker set search_path='' as $$ select ornament_gallery.catalog() $$;
create function public.ornament_rate(model_id text,asset_key text,voter_id uuid,rating integer,teacher_key uuid default null)
returns void language sql security invoker set search_path='' as $$ select ornament_gallery.rate($1,$2,$3,$4,$5) $$;
create function public.ornament_claim(model_id text,class_key uuid,student_name text,model_title text,public_credit text)
returns void language sql security invoker set search_path='' as $$ select ornament_gallery.claim_model($1,$2,$3,$4,$5) $$;
revoke all on all functions in schema ornament_gallery from public,anon,authenticated;
grant execute on function ornament_gallery.catalog(),ornament_gallery.rate(text,text,uuid,integer,uuid),ornament_gallery.claim_model(text,uuid,text,text,text) to anon,authenticated;
revoke all on function public.ornament_catalog(),public.ornament_rate(text,text,uuid,integer,uuid),public.ornament_claim(text,uuid,text,text,text) from public;
grant execute on function public.ornament_catalog(),public.ornament_rate(text,text,uuid,integer,uuid),public.ornament_claim(text,uuid,text,text,text) to anon,authenticated;

insert into ornament_gallery.event(id) values('christmas-2026');
insert into ornament_gallery.class_code(event_id,section) values('christmas-2026','6A'),('christmas-2026','6B'),('christmas-2026','6C');
insert into ornament_gallery.model(event_id,id,asset,approved) values
('christmas-2026','6B-001','cbcc0d1af70638f839bc',true),
('christmas-2026','6B-002','fef11353bacf259a29cb',true),
('christmas-2026','6B-003','8b67b62ae5cd8327a7aa',true),
('christmas-2026','6B-004','92e4445fb187056214cc',false),
('christmas-2026','6B-005','fef11353bacf259a29cb',true),
('christmas-2026','6B-006','ae3e47c779cd6ed697c4',true),
('christmas-2026','6B-007','13f611428ee33bd44fce',true),
('christmas-2026','6B-008','7103c7d6cc4f1c3fb048',false),
('christmas-2026','6B-009','88012adbc68fb66e7da8',false),
('christmas-2026','6B-010','040b63425ca823b05c00',false),
('christmas-2026','6B-011','13f611428ee33bd44fce',true),
('christmas-2026','6B-012','abf828b7601bcaa0b202',true),
('christmas-2026','6B-013','d6961273c22294a69d8f',false),
('christmas-2026','6B-014','f167e7a02580af6ba599',false),
('christmas-2026','6B-015','f047a11dda23dc3c0643',false),
('christmas-2026','6B-016','5d116904e1927f5874ee',true),
('christmas-2026','6B-017','0005bcb6d331c928e61e',false),
('christmas-2026','6B-018','f1805bc8288cd2cd2a18',false),
('christmas-2026','6B-019','9fbb9dfa1bd59a0df4f6',true),
('christmas-2026','6B-020','331ef305aadca030d885',false),
('christmas-2026','6B-021','bb9ebbecdf824b0e59a0',false),
('christmas-2026','6B-022','db9a0bc03bd36907c96e',false),
('christmas-2026','6B-023','68fa120ce715e770f71c',false),
('christmas-2026','6B-024','89196972afd7ed3c733b',false),
('christmas-2026','6B-025','41a96a87c9df15b42668',true),
('christmas-2026','6B-026','835c1e0c6d99d6ba0f5d',false),
('christmas-2026','6B-027','11c9f23d792fd024292b',true),
('christmas-2026','6C-001','60d9fbafa543640cf1ae',false),
('christmas-2026','6C-002','9a586daa8e03121c4b2d',false),
('christmas-2026','6C-003','88788fcb19e2210d5df9',false),
('christmas-2026','6C-004','422497262b1624452656',false),
('christmas-2026','6C-005','422497262b1624452656',false),
('christmas-2026','6C-006','70b197c46d4662d4a11c',false),
('christmas-2026','6C-007','b48c7c44dcad61c27710',false),
('christmas-2026','6C-008','c8f3e01db4971ebb9f67',false),
('christmas-2026','6C-009','a62331697e540331f9bb',false),
('christmas-2026','6C-010','6f522eb6b59b5463782e',false),
('christmas-2026','6C-011','8886da886cfce3a99a2c',false),
('christmas-2026','6C-012','4f70a387703b561994ed',false),
('christmas-2026','6C-013','db87897ccf1f524fa51d',false),
('christmas-2026','6C-014','6d63bd6df20fbe8dee3e',false),
('christmas-2026','6C-015','0aa00cc7b1adc209fac8',false),
('christmas-2026','6C-016','835c1e0c6d99d6ba0f5d',false),
('christmas-2026','6C-017','795f1ad4eff3ec9cd0e9',false);

create function ornament_gallery.my_ratings(voter_id uuid, teacher_key uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(v.model_id,v.score),'{}'::jsonb)
 from ornament_gallery.vote v join ornament_gallery.model m on (m.event_id,m.id,m.asset)=(v.event_id,v.model_id,v.asset)
 where m.event_id='christmas-2026' and m.approved and v.teacher=(teacher_key is not null)
 and v.voter=coalesce(teacher_key,voter_id) and (teacher_key is null or exists(select from ornament_gallery.teacher_code t where t.event_id=m.event_id and t.code=teacher_key));
$$;
create function public.ornament_my_ratings(voter_id uuid,teacher_key uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select ornament_gallery.my_ratings($1,$2) $$;
revoke all on function public.ornament_my_ratings(uuid,uuid),ornament_gallery.my_ratings(uuid,uuid) from public;
grant execute on function public.ornament_my_ratings(uuid,uuid),ornament_gallery.my_ratings(uuid,uuid) to anon,authenticated;
