import json,pathlib,argparse
here=pathlib.Path(__file__).parent
parser=argparse.ArgumentParser();parser.add_argument('--app',type=pathlib.Path,required=True);args=parser.parse_args()
out=args.app/'supabase/migrations/20260916180000_weekly_vocabulary_pools.sql'
header='''-- Versioned weekly pools. Historical content and progress are retained.
begin;
create or replace function private.assert_weekly_vocabulary_access(p_user_id uuid, v public.vocabularies, activity text)
returns void language plpgsql stable security definer set search_path = '' as $fn$
declare
 s jsonb := coalesce(v.activity_settings, '{}'::jsonb);
 section text;
 eligible integer;
begin
 if s ->> 'retiredWeeklySet' = 'true' then
   raise exception 'This class set is archived. Open the weekly vocabulary from Units.';
 end if;
 if s ->> 'weeklyPoolVersion' is distinct from '1' then return; end if;
 select upper(trim(section_letter)) into section from public.profiles where user_id=p_user_id;
 if jsonb_array_length(coalesce(s->'sections','[]'::jsonb)) > 0 and not coalesce((s->'sections') ? section,false) then
   raise exception 'This weekly vocabulary is not assigned to your group.';
 end if;
 if coalesce((s->'releaseDates'->>section)::date,v.assigned_date) > (now() at time zone 'America/Panama')::date then
   raise exception 'This weekly vocabulary is not available yet.';
 end if;
 if activity = any(array['matching','quiz','word-search','crossword','speed-match','fill-in-blank']) then
   select count(*) into eligible from jsonb_array_elements(v.words) w
   where case activity
    when 'word-search' then length(regexp_replace(upper(w->>'word'),'[^A-Z0-9]','','g')) between 2 and 15
    when 'crossword' then w->>'word' ~ '^[A-Za-z]{2,}$' and length(trim(w->>'definition'))>0
    when 'fill-in-blank' then length(trim(w->>'word'))>0 and length(trim(w->>'example'))>0
    when 'matching' then length(trim(w->>'word'))>=2 and length(trim(w->>'definition'))>0
    else length(trim(w->>'word'))>0 and length(trim(w->>'definition'))>0 end;
   if eligible < 4 then raise exception 'Not enough suitable words for this activity.'; end if;
 end if;
end;
$fn$;
revoke all on function private.assert_weekly_vocabulary_access(uuid,public.vocabularies,text) from public,anon,authenticated;
-- Patch the deployed functions in place, retaining unrelated access and scoring rules.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('private.required_vocabulary_activities(public.vocabularies)'::regprocedure) into definition;
 if position('weeklyPoolVersion' in definition)=0 then
  if position('begin' in definition)=0 then raise exception 'Unexpected required-activity function'; end if;
  definition := regexp_replace(definition,'begin', $body$begin
    if vocabulary_row.activity_settings ->> 'weeklyPoolVersion' = '1'
       and vocabulary_row.activity_settings ->> 'reviewOnly' = 'true' then
        return '{}'::text[];
    end if;$body$);
  execute definition;
 end if;
 select pg_get_functiondef('private.assert_student_activity_access(uuid,text,text,text)'::regprocedure) into definition;
 if position('assert_weekly_vocabulary_access' in definition)=0 then
  if position('required_list := private.required_vocabulary_activities(vocabulary_row);' in definition)=0 then
   raise exception 'Unexpected activity access function';
  end if;
  definition := replace(definition,'required_list := private.required_vocabulary_activities(vocabulary_row);',
   'perform private.assert_weekly_vocabulary_access(p_user_id, vocabulary_row, p_activity_type);
    required_list := private.required_vocabulary_activities(vocabulary_row);');
  execute definition;
 end if;
end;
$patch$;
create temporary table weekly_frozen_before on commit drop as
 select id, to_jsonb(v) as value from public.vocabularies v where id ~ '^grade[6-9]_t3_2026_w01_part[12]$';
'''
units=json.loads((here/'weekly-units.json').read_text());mapping=json.loads((here/'replacement-map.json').read_text())
# Full data artifact remains reviewable and is also used for live parity checks.
body='''
with incoming as (select value as v from jsonb_array_elements($catalog$'''+json.dumps(units,separators=(',',':'))+'''$catalog$::jsonb))
insert into public.vocabularies (id,name,description,grades,subject_slug,trimester,month,week,assigned_date,words,activity_settings,owner_id)
select v->>'id',v->>'name',v->>'description',array(select jsonb_array_elements_text(v->'grades')),
v->>'subjectSlug',v->>'trimester',v->>'month',(v->>'week')::integer,(v->>'assignedDate')::date,v->'words',v->'activitySettings',
(select owner_id from public.vocabularies where id='grade9_t3_2026_w01_part1') from incoming
on conflict(id) do update set name=excluded.name,description=excluded.description,grades=excluded.grades,
subject_slug=excluded.subject_slug,trimester=excluded.trimester,month=excluded.month,week=excluded.week,
assigned_date=excluded.assigned_date,words=excluded.words,activity_settings=excluded.activity_settings;

with mapping as (select key as id,value as replacements from jsonb_each($mapping$'''+json.dumps(mapping,separators=(',',':'))+'''$mapping$::jsonb))
update public.vocabularies v set activity_settings=coalesce(v.activity_settings,'{}'::jsonb)||jsonb_build_object('retiredWeeklySet',true,'replacementIds',m.replacements)
from mapping m where v.id=m.id;

do $verify$
begin
 if exists(select 1 from weekly_frozen_before b join public.vocabularies v using(id) where b.value is distinct from to_jsonb(v)) then
  raise exception 'Week 1 changed';
 end if;
 if (select count(*) from public.vocabularies where activity_settings->>'weeklyPoolVersion'='1')<>33 then
  raise exception 'Expected 33 weekly pools';
 end if;
 if exists(select 1 from public.vocabularies where activity_settings->>'weeklyPoolVersion'='1' and (week in (5,6) or jsonb_array_length(words)<>5)) then
  raise exception 'Invalid weekly content or project-week assignment';
 end if;
end;
$verify$;
commit;
'''
sparks=json.loads((here/'spark-patches.json').read_text())
spark_sql='''
with patches as (select value as v from jsonb_array_elements($sparks$'''+json.dumps(sparks,separators=(',',':'))+'''$sparks$::jsonb))
update public.weekly_sparks s set status=p.v->>'status',
title=coalesce(p.v->>'title',s.title),spark_text=coalesce(p.v->>'spark_text',s.spark_text),
why_it_matters=coalesce(p.v->>'why_it_matters',s.why_it_matters),question=coalesce(p.v->>'question',s.question),
source_title=coalesce(p.v->>'source_title',s.source_title),source_url=coalesce(p.v->>'source_url',s.source_url),check_mode='optional'
from patches p where s.id=p.v->>'id';
'''
body=body.replace('do $verify$',spark_sql+'\ndo $verify$')
out.write_text(header+body)
print(out, out.stat().st_size)
